import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY, SAMPLE, createProtectedOrder, transitionProtectedOrder as change, refreshProtectedOrder, canReport, moneyLocation, protectionFees } from '../public/protection-model.js';

const t = Date.UTC(2026, 10, 21, 10);
function paid(method = 'card', scenario = 'good') {
  let o = createProtectedOrder(scenario, t);
  for (const action of [{type:'checkout'}, {type:'method', method}, {type:'pay'}, {type:'confirm-payment'}]) o = change(o, {...action, role:'buyer'}, t);
  return o;
}
function delivered(scenario = 'good') {
  let o = paid('card', scenario);
  o = change(o, {type:'ship', role:'seller'}, t + DAY / 2);
  return change(o, {type:'deliver', role:'demo'}, t + 3 * DAY);
}

test('все способы оплаты удерживают полную сумму, выплаты до приёмки нет', () => {
  for (const method of ['card','sbp','wallet']) {
    const o = paid(method);
    assert.equal(o.id, SAMPLE.id);
    assert.equal(o.amount, 269000);
    assert.equal(o.payout, 0);
    assert.equal(o.method, method);
    assert.equal(o.fees.net + o.fees.service + o.fees.acquiring, o.amount);
    assert.equal(moneyLocation(o), 'Деньги у платёжного партнёра');
    assert.throws(() => change(o, {type:'accept', role:'buyer'}, t));
    assert.throws(() => change(o, {type:'refund', role:'demo'}, t));
  }
  assert.deepEqual(protectionFees('card'), {service:4035, acquiring:5380, net:259585});
  assert.deepEqual(protectionFees('sbp'), {service:4035, acquiring:1883, net:263082});
  assert.deepEqual(protectionFees('wallet'), {service:4035, acquiring:0, net:264965});
});

test('после подтверждения приёмки заказ завершён и выплата сделана ровно один раз', () => {
  const before = delivered();
  assert.equal(before.checkUntil - before.deliveredAt, 2 * DAY);
  const o = change(before, {type:'accept', role:'buyer'}, before.deliveredAt + 1000);
  assert.equal(before.phase, 'delivered', 'переход не должен менять исходный объект');
  assert.equal(o.phase, 'completed');
  assert.equal(o.payout, 259585);
  assert.equal(moneyLocation(o), 'Выплата у продавца');
  assert.equal(o.id, before.id);
  assert.equal(o.amount, before.amount);
  assert.throws(() => change(o, {type:'accept', role:'buyer'}, t + 4 * DAY));
  assert.throws(() => change(o, {type:'report', role:'buyer', reason:'different', description:'Другой товар'}, t + 4 * DAY));
});

test('истечение 48 часов без спора автоматически завершает заказ при восстановлении', () => {
  const before = delivered();
  assert.equal(refreshProtectedOrder(before, before.checkUntil - 1).phase, 'delivered');
  const o = refreshProtectedOrder(JSON.parse(JSON.stringify(before)), before.checkUntil);
  assert.equal(o.phase, 'completed');
  assert.equal(o.payout, o.fees.net);
  assert.equal(refreshProtectedOrder(o, before.checkUntil + DAY).events.length, o.events.length);
});

test('другой товар: спор блокирует автоматическую выплату, решение и возврат сходятся', () => {
  const before = delivered('different');
  let o = change(before, {type:'report', role:'buyer', reason:'different', description:'Вместо двух кобальтовых кружек пришли тарелки.', photos:[{name:'Фото',data:'demo'}]}, before.deliveredAt + 1000);
  assert.equal(o.phase, 'dispute');
  assert.equal(o.dispute.requested, o.amount);
  assert.equal(o.dispute.photos.length, 1);
  o = refreshProtectedOrder(o, before.checkUntil + 10 * DAY);
  assert.equal(o.phase, 'dispute');
  assert.equal(o.payout, 0);
  assert.throws(() => change(o, {type:'accept', role:'buyer'}, before.checkUntil + DAY));
  o = change(o, {type:'decide', role:'demo'}, before.checkUntil + 11 * DAY);
  assert.equal(o.dispute.approved, 269000);
  assert.equal(o.refunded, 0);
  o = change(o, {type:'refund', role:'demo'}, before.checkUntil + 12 * DAY);
  assert.equal(o.phase, 'refunded');
  assert.equal(o.refunded, 269000);
  assert.equal(o.payout, 0);
  assert.equal(moneyLocation(o), 'Деньги возвращены покупателю');
  assert.throws(() => change(o, {type:'refund', role:'demo'}, before.checkUntil + 13 * DAY));
});

test('недоставка доступна без вручения после срока, но не раньше', () => {
  for (const shipped of [false,true]) {
    let o = paid();
    if (shipped) o = change(o, {type:'ship', role:'seller'}, t + DAY);
    assert.equal(o.deliveredAt, null);
    assert.equal(canReport(o, o.deliveryBy - 1), false);
    const action = {type:'report', role:'buyer', reason:'missing', description:'Срок доставки истёк, посылка в пункт выдачи не поступила.'};
    assert.throws(() => change(o, action, o.deliveryBy - 1));
    assert.equal(canReport(o, o.deliveryBy + 1), true);
    o = change(o, action, o.deliveryBy + 1);
    assert.equal(o.phase, 'dispute');
    assert.equal(o.deliveredAt, null);
    assert.equal(o.payout, 0);
    o = change(o, {type:'decide',role:'demo'}, t + 6 * DAY);
    o = change(o, {type:'refund',role:'demo'}, t + 7 * DAY);
    assert.equal(o.refunded, SAMPLE.amount);
  }
});

test('валидация и роли не позволяют обойти оплату, вручение и срок проверки', () => {
  const offer = createProtectedOrder('good', t);
  assert.throws(() => change(offer, {type:'ship',role:'seller'}, t));
  assert.throws(() => change(offer, {type:'confirm-payment',role:'buyer'}, t));
  assert.throws(() => change(paid(), {type:'deliver',role:'seller'}, t));
  assert.throws(() => change(paid(), {type:'ship',role:'buyer'}, t));
  const d = delivered();
  assert.throws(() => change(d, {type:'report',role:'buyer',reason:'different',description:' '}, t + 3 * DAY));
  assert.throws(() => change(d, {type:'report',role:'buyer',reason:'missing',description:'Не пришёл заказ.'}, t + 3 * DAY));
  const expired = refreshProtectedOrder(d, d.checkUntil);
  assert.equal(canReport(expired, d.checkUntil + 1), false);
  assert.throws(() => change(d, {type:'back',role:'buyer'}, t + 3 * DAY));
});
