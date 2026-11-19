import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';

let child;
let folder;
let file;
let baseUrl;

async function startServer() {
  child = spawn(process.execPath, ['server.mjs'], {
    env: { ...process.env, VK_DEMO_DB: file, PORT: '0' },
  });
  let startup = '';
  for await (const chunk of child.stdout) {
    startup += chunk.toString();
    const match = startup.match(/http:\/\/127\.0\.0\.1:\d+/);
    if (match) {
      baseUrl = match[0];
      return;
    }
  }
  const errors = [];
  for await (const chunk of child.stderr) errors.push(chunk);
  throw new Error(Buffer.concat(errors).toString() || 'Сервер демо не запустился.');
}

async function stopServer() {
  if (child?.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
}

before(async () => {
  folder = await mkdtemp(join(tmpdir(), 'vk-payment-test-'));
  file = join(folder, 'test.sqlite');
  await startServer();
});

after(async () => {
  await stopServer();
  if (folder) await rm(folder, { recursive: true, force: true });
});

async function api(path, body, status = 200, cookie = '') {
  const response = await fetch(baseUrl + '/api/' + path, {
    method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(response.status, status, path + ' ' + JSON.stringify(data));
  return data;
}

async function until(path, status) {
  for (let attempt = 0; attempt < 25; attempt++) {
    const result = await api(path);
    if (result.status === status) return result;
    await delay(150);
  }
  assert.fail('Ожидался статус ' + status);
}

test('продавец без статуса проходит отбор, регистрацию, проверку и подключение', async () => {
  await api('seller/restart', {});
  const store = await api('store');
  const item = { unit: store.price, variant: store.variants[0], quantity: 2 };
  assert.equal(store.eligible, false);
  await api('orders/store', item, 409);
  await api('seller/choose', { kind: 'none' });
  const incompatible = await api('seller/details', { eligible: false });
  assert.equal(incompatible.stage, 'ineligible');
  await api('seller/choose', { kind: 'none' });
  assert.equal((await api('seller/details', { eligible: true, agreed: true })).stage, 'partner');
  assert.equal((await api('seller/register', { agreed: true })).stage, 'registered');
  await api('seller/permissions', { payouts: true, receipts: false }, 409);
  assert.equal((await api('seller/permissions', { payouts: true, receipts: true })).stage, 'review');
  assert.equal((await api('seller/verify', {})).stage, 'connected');
  assert.equal((await api('store')).eligible, true);
});

test('цена, повторные запросы, оплата после перезапуска, чек, выплата и возврат', async () => {
  const store = await api('store');
  const order = await api('orders/store', { unit: store.price, variant: store.variants[0], quantity: 2 });
  const path = 'checkout/' + order.token;
  const detail = 'merchant/' + encodeURIComponent(order.id);
  assert.equal(order.amount, 240000);
  const price = await api('price', { base: 100000 });
  assert.equal(price.price, 101523);
  await api('orders/store', { unit: store.price, variant: store.variants[0], quantity: 2 }, 409);
  assert.equal((await api(path)).amount, order.amount);
  const starts = await Promise.all(Array.from({ length: 3 }, () => api(path + '/start', { method: 'card' })));
  assert.equal(new Set(starts.map((item) => item.paymentId)).size, 1);
  await Promise.all([api(path + '/confirm', {}), api(path + '/confirm', {})]);
  await api(path + '/cancel', {}, 409);
  await stopServer();
  await startServer();
  const paid = await until(path, 'paid');
  assert.deepEqual(paid.fees, { vk: 3600, acquiring: 4800, net: 231600 });
  assert.equal(paid.receipt, 'issued');
  assert.equal(paid.payout, 'scheduled');
  assert.equal(paid.fulfillmentStatus, 'new');
  assert.equal((await api(detail + '/ready', {})).fulfillmentStatus, 'ready');
  assert.equal((await api(detail + '/payout', {})).payout, 'sent');
  assert.equal((await api(detail + '/deliver', {})).fulfillmentStatus, 'delivered');
  await api(path + '/request-refund', {});
  await api(detail + '/refund', {});
  await api(detail + '/refund', {}, 409);
  const returned = await until(path, 'refunded');
  assert.equal(returned.receipt, 'corrected');
  assert.equal(returned.payout, 'reversed');
  const report = await api('admin');
  assert.equal(report.discrepancies, 0);
  assert.equal(report.events.filter((event) => event.order_id === order.id && event.name === 'payment.succeeded').length, 1);
});

test('заказ из чата поддерживает СБП, доставку, отмену и просрочку', async () => {
  const store = await api('store');
  const input = { title: 'Кружка с надписью', variant: 'Кобальтовая', quantity: 2, total: 240001, fulfillment: 'delivery', shipping: 50000, hours: 24, ready: store.ready };
  const chat = await api('orders/chat', input);
  assert.equal(chat.amount, 290001);
  assert.equal((await api('chat')).at(-1).id, chat.id);
  const path = 'checkout/' + chat.token;
  await api(path + '/start', { method: 'sbp' });
  await api(path + '/confirm', {});
  assert.equal((await until(path, 'paid')).fees.acquiring, 2030);
  const open = await api('orders/chat', input);
  assert.deepEqual((await api('chat')).map((order) => order.id), [chat.id, open.id]);
  assert.equal((await api('checkout/' + open.token + '/cancel', {})).status, 'cancelled');
  await api('checkout/' + open.token + '/start', { method: 'card' }, 409);

  const expired = await api('orders/chat', input);
  const db = new DatabaseSync(file);
  db.prepare('UPDATE orders SET data=json_set(data, ?, ?) WHERE id = ?').run('$.expires', Date.now() - 1000, expired.id);
  db.close();
  assert.equal((await api('checkout/' + expired.token)).status, 'expired');
  await api('checkout/' + expired.token + '/start', { method: 'sbp' }, 409);
  await api('checkout/missing-token', undefined, 404);
  await api('seller/pause', {});
  assert.equal((await api('store')).eligible, false);
  await api('orders/chat', input, 409);
  assert.equal((await api('seller/restore', {})).stage, 'connected');
});

test('корзина сохраняет состав и принадлежность, повтор оформления возвращает прежний заказ', async () => {
  const session = await fetch(baseUrl);
  const cookie = session.headers.get('set-cookie').split(';')[0];
  const own = (path, body, status) => api(path, body, status, cookie);
  const before = (await api('merchant')).funnel;
  const count = (data, stage) => data.find((e) => e.channel === 'store' && e.stage === stage)?.count ?? 0;
  await own('view/vase', {});
  await own('view/vase', {});
  const vase = await own('cart/add', {productId:'vase', variant:'Шалфей', quantity:1});
  const cart = await own('cart/add', {productId:'cups', variant:'Молочная', quantity:2});
  assert.equal((await api('cart')).lines.length, 0);
  await own('cart/set', {productId:'vase', variant:'Шалфей', quantity:0, revision:vase.revision}, 409);
  const details = {revision:cart.revision, total:cart.total, units:cart.lines.map((line) => line.unit)};
  await own('cart/checkout', {...details, total:1}, 409);
  const [first, retry] = await Promise.all([own('cart/checkout', details), own('cart/checkout', details)]);
  assert.equal(first.id, retry.id);
  assert.deepEqual(first.lines, cart.lines);
  assert.equal(first.amount, cart.total);
  assert.equal((await own('cart')).lines.length, 0);
  assert.equal((await own('purchases')).length, 1);
  assert.equal((await api('purchases')).length, 0);
  const path = 'checkout/' + first.token;
  await own(path + '/start', {method:'card'});
  await own(path + '/confirm', {});
  await until(path, 'paid');
  const after = (await api('merchant')).funnel;
  for (const stage of ['view','cart','checkout','paid']) assert.equal(count(after,stage) - count(before,stage), 1);
  await own('merchant/' + encodeURIComponent(first.id) + '/ready', {});
  assert.equal((await own('purchases'))[0].fulfillmentStatus, 'ready');
  await own(path + '/request-refund', {});
  await own('merchant/' + encodeURIComponent(first.id) + '/refund', {});
  const refunded = await until(path, 'refunded');
  assert.equal(refunded.receipt, 'corrected');
  assert.deepEqual(refunded.lines, cart.lines);
});

test('тарелку заказывают через переписку и оплачивают тестовым кошельком с кешбэком', async () => {
  const { catalog } = await api('store');
  const plate = catalog.find((item) => item.id === 'plate');
  const selection = { productId: plate.id, variant: plate.variants[0], quantity: 1, unit: plate.price };
  assert.equal(plate.leadDays, 14);
  await api('orders/store', selection, 409);
  await api('cart/add', selection, 409);

  const offer = { ...selection, title: plate.title, total: plate.price, ready: plate.latestReady, hours: 24, fulfillment: 'pickup' };
  await api('orders/chat', offer, 409);
  const question = await api('questions', { ...selection, question: 'Можно заказать тарелку?' });
  await api('orders/chat', { ...offer, ready: '2099-12-31', questionId: question.id }, 400);
  const order = await api('orders/chat', { ...offer, questionId: question.id });
  assert.equal(order.amount, 185000);
  assert.equal(order.walletCashback, 9250);
  const path = 'checkout/' + order.token;
  await api(path + '/start', { method: 'wallet' });
  await api(path + '/confirm', {});
  const paid = await until(path, 'paid');
  assert.equal(paid.method, 'wallet');
  assert.equal(paid.amount, order.amount);
  assert.equal(paid.receipt, 'issued');
  assert.deepEqual(paid.fees, { vk: 2775, acquiring: 0, net: 182225 });
});
