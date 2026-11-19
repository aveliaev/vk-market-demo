export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const requireThat = (condition, message, status = 409) => {
  if (!condition) throw new ApiError(status, message);
};

export function createMarket(db, { randomUUID, makeToken, signature, timingSafeEqual }) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY, product_id TEXT NOT NULL, variant TEXT NOT NULL, question TEXT NOT NULL,
      reply TEXT, public_question TEXT, public_answer TEXT
    );
    CREATE TABLE IF NOT EXISTS buyer_orders (order_id TEXT PRIMARY KEY, buyer TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS buyer_order_index ON buyer_orders(buyer);
    CREATE TABLE IF NOT EXISTS funnel (buyer TEXT, channel TEXT, stage TEXT, PRIMARY KEY(buyer,channel,stage));
    CREATE TABLE IF NOT EXISTS cart_checkouts (buyer TEXT, revision TEXT, order_id TEXT NOT NULL, PRIMARY KEY(buyer,revision));
    CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, due INTEGER NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, created INTEGER NOT NULL, order_id TEXT, name TEXT NOT NULL, data TEXT NOT NULL);
  `);

  const HOUR = 3600000;
  const DAY = 24 * HOUR;
  const initialEconomy = { externalCount: 3, externalAmount: 460000, productCosts: 361000, promotion: 120000 };
  const economyFields = Object.keys(initialEconomy);
  const VK_RATE = 150;
  const RATES = { card: 200, sbp: 70, wallet: 0 };
  const VARIANTS = ['Молочная', 'Кобальтовая'];
  const PICKUP = 'Самовывоз из мастерской';
  const SELLER = 'Керамика «Форма»';
  const PRODUCT = 'Керамическая кружка «Утро»';
  const get = (key) => JSON.parse(db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? 'null');
  const put = (key, value) => db.prepare('INSERT OR REPLACE INTO settings VALUES (?, ?)').run(key, JSON.stringify(value));
  const save = (order) => db.prepare('INSERT INTO orders VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(order.id, order.token, JSON.stringify(order));
  const getOrder = (id) => JSON.parse(db.prepare('SELECT data FROM orders WHERE id = ?').get(id)?.data ?? 'null');
  const getBuyerOrder = (token) => JSON.parse(db.prepare('SELECT data FROM orders WHERE token = ?').get(token)?.data ?? 'null');
  const allOrders = () => db.prepare('SELECT data FROM orders ORDER BY rowid DESC').all().map(({ data }) => JSON.parse(data));
  const charge = (amount, basisPoints) => Math.round(amount * basisPoints / 10000);
  const priceFor = (base) => Math.round(base * 10000 / (10000 - VK_RATE));
  const timestamp = () => Date.now();
  const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });
  const futureDate = (days) => calendar.format(timestamp() + days * DAY);
  const readyDate = () => futureDate(4) <= '2026-12-15' ? '2026-12-15' : futureDate(4);

  const assortment = [
    { id: 'cups', title: PRODUCT, category: 'Посуда', variants: VARIANTS, description: 'Кружка ручной работы с цветной глазурью. Объём 300 мл.' },
    { id: 'vase', title: 'Ваза «Орбита»', price: 320000, category: 'Декор', variants: ['Шалфей', 'Оливковая'], description: 'Скульптурная ваза из каменной керамики. Высота 18 см.' },
    { id: 'bowl', title: 'Пиала «Песок»', price: 145000, category: 'Посуда', variants: ['Песочная', 'Молочная'], description: 'Глубокая пиала для завтрака с крапчатой глазурью. Объём 450 мл.' },
    { id: 'candles', title: 'Подсвечник «Волна»', price: 210000, category: 'Декор', variants: ['Молочный'], description: 'Фигурный подсвечник на две тонкие свечи. Ширина 16 см.' },
    { id: 'plate', leadDays: 14, title: 'Тарелка «Спираль»', price: 185000, category: 'Посуда', variants: ['Кобальтовая'], description: 'Плоская тарелка с ручной росписью под глазурью. Диаметр 22 см.' },
    { id: 'jug', title: 'Кувшин «Терра»', price: 270000, category: 'Посуда', variants: ['Терракотовый'], description: 'Небольшой кувшин с ручкой и узким носиком. Объём 600 мл.' },
    { id: 'linen', title: 'Льняное полотенце «Полоса»', price: 85000, category: 'Текстиль', variants: ['Индиго', 'Графит'], description: 'Кухонное полотенце из натурального льна. Размер 45 × 65 см.' },
  ];

  function catalog() {
    return assortment.map((item) => ({ ...item, latestReady: item.leadDays ? futureDate(item.leadDays) : null, price: item.price ?? priceFor(get('base')), image: './assets/' + item.id + '.webp' }));
  }

  db.prepare(`INSERT OR IGNORE INTO questions VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    'demo-vase-height', 'vase', 'Шалфей', 'Какая высота у вазы?', 'Высота вазы 18 см.',
    'Какой высоты ваза «Орбита»?', 'Высота — 18 см в обоих цветах.'
  );

  function updateQuestion(id, action, body) {
    const item = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
    requireThat(item, 'Вопрос не найден.', 404);
    if (action === 'reply') {
      requireThat(item.reply === null, 'Ответ уже отправлен.');
      db.prepare('UPDATE questions SET reply = ? WHERE id = ?').run(string(body.reply, 1, 600), id);
    } else if (action === 'publish') {
      requireThat(item.reply && item.public_question === null, 'Для публикации нужен ответ в переписке.');
      db.prepare('UPDATE questions SET public_question = ?, public_answer = ? WHERE id = ?')
        .run(string(body.question, 1, 300), string(body.answer, 1, 600), id);
    } else if (action === 'unpublish') {
      db.prepare('UPDATE questions SET public_question = NULL, public_answer = NULL WHERE id = ?').run(id);
    } else {
      throw new ApiError(404, 'Действие не найдено.');
    }
    return { id };
  }

  function record(name, orderId = null, data = {}, id = randomUUID()) {
    db.prepare('INSERT INTO events VALUES (?, ?, ?, ?, ?)').run(id, timestamp(), orderId, name, JSON.stringify(data));
  }

  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function newOrder({ lines = null, productId = null, questionId = null, title, variant, quantity, unit, total = unit * quantity, shipping = 0, fulfillment = PICKUP, ready = null, expires = timestamp() + DAY, source }) {
    const number = get('nextOrder') ?? 1042;
    put('nextOrder', number + 1);
    const order = {
      id: 'ФР-' + number, token: makeToken(),
      lines, productId, questionId, title, variant, quantity, unit, total, shipping, fulfillment, ready, expires, source,
      amount: total + shipping, created: timestamp(), status: 'unpaid',
      receipt: 'missing', payout: 'waiting', fulfillmentStatus: 'new',
      refund: 'none', method: null, paymentId: null, bankConfirmed: false,
    };
    save(order);
    record('order.created', order.id, { source });
    return order;
  }

  function fees(order, method = order.method) {
    const vk = charge(order.amount, VK_RATE);
    const acquiring = charge(order.amount, RATES[method] ?? 0);
    return { vk, acquiring, net: order.amount - vk - acquiring };
  }

  function account(changes = {}) {
    return { stage: 'connected', kind: 'self', registered: true, payouts: true, receipts: true, since: timestamp(), active: 0, waiting: 0, ...changes };
  }

  function setStage(changes) {
    const current = get('seller');
    const elapsed = timestamp() - current.since;
    const timed = {
      partner: { active: current.active + elapsed },
      details: { active: current.active + elapsed },
      started: { active: current.active + elapsed },
      registered: { active: current.active + elapsed },
      review: { waiting: current.waiting + elapsed },
    };
    const next = { ...current, ...timed[current.stage], ...changes, since: timestamp() };
    put('seller', next);
    record('seller.' + next.stage);
    return next;
  }

  function eligible() {
    const seller = get('seller');
    return seller.stage === 'connected' && seller.registered && seller.payouts && seller.receipts;
  }

  transaction(() => {
    if (get('seller')) return;
    put('seller', account());
    put('base', 118200);
    put('economy', initialEconomy);
    const demo = newOrder({ title: PRODUCT, variant: VARIANTS[0], quantity: 2, unit: 120000, source: 'store' });
    Object.assign(demo, {
      created: timestamp() - 2 * DAY, status: 'paid', method: 'card', paymentId: 'test_' + randomUUID(),
      bankConfirmed: true, paidAt: timestamp() - 2 * DAY, receipt: 'issued', payout: 'sent', fulfillmentStatus: 'ready',
    });
    save(demo);
    record('payment.succeeded', demo.id, { amount: demo.amount, paymentId: demo.paymentId });
  });

  const labels = {
    unpaid: 'Ожидает оплаты', pending: 'Проверяем оплату', paid: 'Оплачен', cancelled: 'Отменён',
    expired: 'Срок истёк', refunded: 'Возвращён',
  };

  function effectiveStatus(order) {
    return order.expires <= timestamp() && (order.status === 'unpaid' || (order.status === 'pending' && !order.bankConfirmed))
      ? 'expired'
      : order.status;
  }

  function present(order) {
    const status = effectiveStatus(order);
    const lines = order.lines ?? [{ productId: order.productId, title: order.title, variant: order.variant, quantity: order.quantity, unit: order.unit, total: order.total ?? order.amount - order.shipping }];
    return { ...order, lines, status, statusLabel: labels[status], fees: fees(order), walletCashback: charge(order.amount, 500) };
  }

  function integer(value, min, max) {
    requireThat(Number.isInteger(value) && value >= min && value <= max, 'Проверьте числовые значения.', 400);
    return value;
  }

  function string(value, min, max) {
    const clean = typeof value === 'string' ? value.trim() : '';
    requireThat(clean.length >= min && clean.length <= max, 'Проверьте заполнение текстовых полей.', 400);
    return clean;
  }

  function schedule(order, type, id) {
    const payload = { id, type, orderId: order.id, paymentId: order.paymentId, amount: order.amount, method: order.method };
    db.prepare('INSERT OR IGNORE INTO jobs VALUES (?, ?, ?)').run(id, timestamp() + 2000, JSON.stringify(payload));
  }

  // The local partner runs a signed callback through the same amount and identifier checks.
  function receivePartnerEvent(raw, signed) {
    requireThat(signed.length === 32 && timingSafeEqual(signature(raw), signed), 'Подпись партнёра не совпала.', 403);
    const event = JSON.parse(raw);
    if (db.prepare('SELECT 1 FROM events WHERE id = ?').get(event.id)) return;
    const order = getOrder(event.orderId);
    requireThat(order?.paymentId === event.paymentId && order.amount === event.amount && order.method === event.method,
      'Данные платежа не совпали.');
    if (event.type === 'payment.succeeded') {
      requireThat(order.status === 'pending' && order.bankConfirmed, 'Платёж не ожидает подтверждения.');
      const owner = db.prepare('SELECT buyer FROM buyer_orders WHERE order_id = ?').get(order.id);
      if (owner) markStage(owner.buyer, order.source === 'chat' ? 'chat' : 'store', 'paid');
      Object.assign(order, { status: 'paid', paidAt: timestamp(), receipt: 'issued', payout: 'scheduled' });
    } else if (event.type === 'refund.succeeded') {
      requireThat(order.status === 'paid' && order.refund === 'processing', 'Возврат не ожидает подтверждения.');
      Object.assign(order, { status: 'refunded', refund: 'complete', refundedAt: timestamp(), receipt: 'corrected' });
      order.payout = order.payout === 'sent' ? 'reversed' : 'cancelled';
    } else {
      throw new ApiError(400, 'Неизвестное событие партнёра.');
    }
    save(order);
    record(event.type, order.id, event, event.id);
  }

  function processJobs() {
    const jobs = db.prepare('SELECT * FROM jobs WHERE due <= ?').all(timestamp());
    for (const job of jobs) {
      transaction(() => {
        if (!db.prepare('SELECT 1 FROM jobs WHERE id = ?').get(job.id)) return;
        receivePartnerEvent(job.payload, signature(job.payload));
        db.prepare('DELETE FROM jobs WHERE id = ?').run(job.id);
      });
    }
  }

  function ordersSummary(orders, economy) {
    const settled = orders.filter((order) => order.status === 'paid');
    const confirmed = orders.filter((order) => order.paidAt);
    const returned = orders.filter((order) => order.status === 'refunded');
    const sum = (list, amount) => list.reduce((total, order) => total + amount(order), 0);
    const gross = sum(confirmed, (order) => order.amount);
    const turnover = sum(settled, (order) => order.amount);
    const vk = sum(settled, (order) => fees(order).vk);
    // In the simulation VK returns its fee and acquiring charges are retained.
    const acquiring = sum(confirmed, (order) => fees(order).acquiring);
    return {
      gross, turnover, acquiring, paid: settled.length, confirmed: confirmed.length, total: orders.length,
      pending: orders.filter((order) => order.status === 'pending').length,
      payouts: sum(settled.filter((order) => order.payout === 'sent'), (order) => fees(order).net),
      scheduled: sum(settled.filter((order) => order.payout === 'scheduled'), (order) => fees(order).net),
      refunds: returned.length, refundsAmount: sum(returned, (order) => order.amount),
      receipts: confirmed.filter((order) => order.receipt === 'issued' || order.receipt === 'corrected').length,
      share: settled.length + economy.externalCount ? settled.length / (settled.length + economy.externalCount) : null,
      turnoverShare: turnover + economy.externalAmount ? turnover / (turnover + economy.externalAmount) : null,
      conversion: orders.length ? confirmed.length / orders.length : null,
      sellerIncome: turnover + economy.externalAmount - vk - acquiring - economy.productCosts - economy.promotion,
    };
  }

  function sellerAction(action, body) {
    const seller = get('seller');
    switch (action) {
      case 'restart': {
        const next = account({ stage: 'started', kind: null, registered: false, payouts: false, receipts: false });
        put('seller', next);
        record('seller.started');
        return next;
      }
      case 'choose':
        requireThat(['started', 'ineligible', 'details'].includes(seller.stage), 'Вернитесь к выбору статуса.');
        requireThat(['self', 'none', 'business'].includes(body.kind), 'Выберите статус продавца.', 400);
        return setStage({ kind: body.kind, stage: body.kind === 'business' ? 'ineligible' : 'details', reason: body.kind === 'business' ? 'Для ИП и организаций предусмотрено отдельное подключение.' : '' });
      case 'details':
        requireThat(seller.stage === 'details', 'Этот шаг уже пройден.');
        if (seller.kind === 'none' && body.eligible === false) {
          return setStage({ stage: 'ineligible', reason: 'Для выбранной деятельности нужен другой статус. Проверьте вариант ИП или организации.' });
        }
        if (seller.kind === 'none') {
          requireThat(body.eligible === true && body.agreed === true, 'Подтвердите условия перед переходом.', 400);
          return setStage({ stage: 'partner' });
        }
        requireThat(body.agreed === true, 'Подтвердите проверку статуса.', 400);
        return setStage({ stage: 'review', registered: true });
      case 'register':
        requireThat(seller.stage === 'partner' && body.agreed === true, 'Подтвердите согласие у тестового партнёра.');
        return setStage({ stage: 'registered', registered: true });
      case 'permissions':
        requireThat(seller.stage === 'registered' && body.payouts === true && body.receipts === true, 'Подключите выплаты и выдачу чеков.');
        return setStage({ stage: 'review', payouts: true, receipts: true });
      case 'verify':
        requireThat(seller.stage === 'review', 'Проверка сейчас недоступна.');
        return seller.payouts && seller.receipts ? setStage({ stage: 'connected' }) : setStage({ stage: 'registered' });
      case 'pause':
        requireThat(seller.stage === 'connected', 'Приём оплаты уже приостановлен.');
        return setStage({ stage: 'paused', registered: false });
      case 'restore':
        requireThat(seller.stage === 'paused', 'Проверка сейчас недоступна.');
        return setStage({ stage: 'connected', registered: true });
      default:
        throw new ApiError(404, 'Действие не найдено.');
    }
  }

  function buyerAction(order, action, body) {
    const status = effectiveStatus(order);
    switch (action) {
      case 'start': {
        requireThat(status === 'unpaid' || status === 'pending', 'Этот заказ уже закрыт для оплаты.');
        if (status === 'pending') return present(order);
        requireThat(eligible(), 'Магазин временно не принимает оплату.');
        requireThat(Object.hasOwn(RATES, body.method), 'Выберите способ оплаты.', 400);
        Object.assign(order, { status: 'pending', method: body.method, paymentId: 'test_' + randomUUID() });
        record('payment.started', order.id, { method: body.method, paymentId: order.paymentId });
        break;
      }
      case 'confirm':
        requireThat(status === 'pending', 'Платёж уже обработан.');
        if (!order.bankConfirmed) {
          order.bankConfirmed = true;
          schedule(order, 'payment.succeeded', order.paymentId);
        }
        break;
      case 'decline':
        requireThat(status === 'pending' && !order.bankConfirmed, 'Платёж уже обрабатывается.');
        Object.assign(order, { status: 'unpaid', method: null, paymentId: null });
        record('payment.declined', order.id);
        break;
      case 'cancel':
        requireThat(status === 'unpaid' || (status === 'pending' && !order.bankConfirmed), 'Заказ уже оплачивается. Дождитесь подтверждения.');
        order.status = 'cancelled';
        order.fulfillmentStatus = 'cancelled';
        record('order.cancelled', order.id);
        break;
      case 'request-refund':
        requireThat(status === 'paid' && order.refund === 'none', 'Запрос возврата уже обработан.');
        order.refund = 'requested';
        record('refund.requested', order.id);
        break;
      default:
        throw new ApiError(404, 'Действие не найдено.');
    }
    save(order);
    return present(order);
  }

  function merchantAction(order, action) {
    requireThat(order.status === 'paid', 'Действие доступно для оплаченных заказов.');
    if (action === 'refund') {
      requireThat(order.refund === 'requested', 'Покупатель ещё не запросил возврат.');
      order.refund = 'processing';
      order.fulfillmentStatus = 'cancelled';
      schedule(order, 'refund.succeeded', 'refund_' + order.paymentId);
    } else {
      requireThat(order.refund === 'none', 'По заказу запрошен возврат.');
      if (action === 'ready') {
        requireThat(order.fulfillmentStatus === 'new', 'Заказ уже в другом статусе.');
        order.fulfillmentStatus = 'ready';
      } else if (action === 'deliver') {
        requireThat(order.fulfillmentStatus === 'ready', 'Сначала отметьте готовность.');
        order.fulfillmentStatus = 'delivered';
      } else if (action === 'payout') {
        requireThat(order.payout === 'scheduled', 'Выплата уже обработана.');
        order.payout = 'sent';
      } else {
        throw new ApiError(404, 'Действие не найдено.');
      }
    }
    save(order);
    record('merchant.' + action, order.id);
    return present(order);
  }

  function matchingOrder(order) {
    requireThat(order, 'Заказ не найден.', 404);
    return order;
  }

  function markStage(buyer, channel, stage) {
    db.prepare('INSERT OR IGNORE INTO funnel VALUES (?, ?, ?)').run(buyer, channel, stage);
  }

  function attachOrder(order, buyer) {
    db.prepare('INSERT OR IGNORE INTO buyer_orders VALUES (?, ?)').run(order.id, buyer);
    const owner = db.prepare('SELECT buyer FROM buyer_orders WHERE order_id = ?').get(order.id).buyer;
    markStage(owner, order.source === 'chat' ? 'chat' : 'store', 'checkout');
    return present(order);
  }

  function readCart(buyer) {
    const saved = get('cart:' + buyer) ?? { revision: 'empty', lines: [] };
    const products = catalog();
    const lines = saved.lines.map((line) => {
      const item = products.find((entry) => entry.id === line.productId);
      return { ...line, ...(item.leadDays ? { requiresChat: true } : {}), title: item.title, unit: item.price, total: item.price * line.quantity };
    });
    return { revision: saved.revision, lines, total: lines.reduce((sum, line) => sum + line.total, 0) };
  }

  function changeCart(buyer, action, body) {
    const cart = readCart(buyer);
    if (action === 'checkout') {
      const previous = db.prepare('SELECT order_id FROM cart_checkouts WHERE buyer = ? AND revision = ?').get(buyer, string(body.revision, 1, 50));
      if (previous) return present(getOrder(previous.order_id));
      requireThat(cart.lines.length && eligible(), 'Для оформления нужна непустая корзина и подключённый магазин.');
      requireThat(!cart.lines.some((line) => line.requiresChat), 'Уберите товары на заказ из корзины и обсудите их с продавцом.');
      requireThat(cart.total === body.total && cart.revision === body.revision && cart.lines.every((line,i) => line.unit === body.units?.[i]), 'Корзина или цена изменилась. Проверьте обновлённый итог.');
      const quantity = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
      const first = cart.lines[0];
      const order = newOrder({ lines: cart.lines, productId: first.productId,
        title: cart.lines.length === 1 ? first.title : first.title + ' и ещё ' + (cart.lines.length - 1),
        variant: first.variant, quantity, unit: null, total: cart.total, source: 'cart' });
      db.prepare('INSERT INTO cart_checkouts VALUES (?, ?, ?)').run(buyer, cart.revision, order.id);
      put('cart:' + buyer, { revision: randomUUID(), lines: [] });
      return attachOrder(order, buyer);
    }
    requireThat(action === 'add' || action === 'set', 'Неизвестное действие.', 404);
    const product = assortment.find((item) => item.id === body.productId);
    requireThat(product?.variants.includes(body.variant), 'Товар или вариант недоступен.', 400);
    requireThat(!product.leadDays || (action === 'set' && body.quantity === 0), 'Этот товар изготавливается на заказ. Напишите продавцу.');
    const lines = cart.lines.map(({ productId, variant, quantity }) => ({ productId, variant, quantity }));
    const index = lines.findIndex((line) => line.productId === product.id && line.variant === body.variant);
    let quantity = integer(body.quantity, action === 'add' ? 1 : 0, 8);
    if (action === 'add') {
      quantity += lines[index]?.quantity ?? 0;
      requireThat(quantity <= 8, 'Можно заказать до восьми штук одного варианта.');
      markStage(buyer, 'store', 'cart');
    } else {
      requireThat(index >= 0 && body.revision === cart.revision, 'Корзина обновилась в другой вкладке.');
    }
    if (!quantity) lines.splice(index, 1);
    else if (index >= 0) lines[index].quantity = quantity;
    else lines.push({ productId: product.id, variant: body.variant, quantity });
    put('cart:' + buyer, { revision: randomUUID(), lines });
    return readCart(buyer);
  }

  function api(method, path, body, buyer) {
    const parts = path.split('/').slice(2).map(decodeURIComponent);
    const [area, key, action] = parts;
    if (method === 'GET') {
      if (area === 'cart') return readCart(buyer);
      if (area === 'purchases') return db.prepare('SELECT data FROM orders JOIN buyer_orders ON orders.id = buyer_orders.order_id WHERE buyer = ? ORDER BY orders.rowid DESC').all(buyer).map((entry) => present(JSON.parse(entry.data)));
      if (area === 'store') {
        return { catalog: catalog(), seller: SELLER, product: PRODUCT, base: get('base'), price: priceFor(get('base')), variants: VARIANTS, ready: readyDate(), eligible: eligible(), pickup: PICKUP, rates: RATES, vkRate: VK_RATE };
      }
      if (area === 'faq') return db.prepare('SELECT public_question AS question, public_answer AS answer FROM questions WHERE product_id = ? AND public_question IS NOT NULL ORDER BY rowid DESC').all(key || '');
      if (area === 'questions') return db.prepare('SELECT * FROM questions ORDER BY rowid DESC').all();
      if (area === 'seller') return get('seller');
      if (area === 'chat') return allOrders().filter((item) => item.source === 'chat').reverse().map(present);
      if (area === 'checkout' && key) return present(matchingOrder(getBuyerOrder(key)));
      if (area === 'merchant') {
        const orders = allOrders().map(present);
        const funnel = db.prepare('SELECT channel, stage, COUNT(*) AS count FROM funnel GROUP BY channel, stage').all();
        const saved = get('economy');
        const economy = Object.fromEntries(economyFields.map((field) => [field, saved[field]]));
        return { orders, funnel, summary: ordersSummary(orders, economy), seller: get('seller'), economy };
      }
      if (area === 'admin') {
        const orders = allOrders().map(present);
        const events = db.prepare('SELECT * FROM events ORDER BY rowid DESC LIMIT 80').all();
        const paid = orders.filter((order) => order.paidAt);
        const paymentIds = new Set(paid.map((order) => order.paymentId));
        const confirmed = db.prepare("SELECT order_id, data FROM events WHERE name = 'payment.succeeded'").all();
        const discrepancies = paid.filter((order) => !confirmed.some((item) => {
          const event = JSON.parse(item.data);
          return item.order_id === order.id && event.paymentId === order.paymentId && event.amount === order.amount;
        })).length + confirmed.filter((item) => !paymentIds.has(JSON.parse(item.data).paymentId)).length;
        return { events, paid: paid.length, discrepancies, seller: get('seller') };
      }
    }
    if (method === 'POST') {
      if (area === 'cart') return changeCart(buyer, key, body);
      if (area === 'view') {
        requireThat(assortment.some((item) => item.id === key), 'Товар не найден.', 404);
        markStage(buyer, 'store', 'view');
        return {};
      }
      if (area === 'checkout' && action === 'visit') {
        const order = matchingOrder(getBuyerOrder(key));
        if (order.source === 'chat' && effectiveStatus(order) === 'unpaid') return attachOrder(order, buyer);
        return present(order);
      }
      if (area === 'questions') {
        if (key) return updateQuestion(key, action, body);
        const item = assortment.find((entry) => entry.id === body.productId);
        requireThat(item && item.variants.includes(body.variant), 'Проверьте товар и вариант.', 400);
        const id = randomUUID();
        db.prepare('INSERT INTO questions (id, product_id, variant, question) VALUES (?, ?, ?, ?)')
          .run(id, item.id, body.variant, string(body.question, 1, 300));
        return { id };
      }
      if (area === 'seller') return sellerAction(key, body);
      if (area === 'price') {
        const base = integer(body.base, 100, 10000000);
        put('base', base);
        record('product.price-updated', null, { base });
        return { base, price: priceFor(base) };
      }
      if (area === 'orders' && key === 'store') {
        requireThat(eligible(), 'Магазин временно не принимает оплату.');
        const item = catalog().find((entry) => entry.id === (body.productId ?? 'cups'));
        requireThat(item, 'Товар не найден.', 404);
        requireThat(item.variants.includes(body.variant), 'Выберите доступный вариант.', 400);
        requireThat(!item.leadDays, 'Сначала обсудите индивидуальный заказ с продавцом.');
        const quantity = integer(body.quantity, 1, 8);
        const unit = item.price;
        requireThat(body.unit === unit, 'Цена обновилась. Проверьте новую цену в карточке.');
        return attachOrder(newOrder({ productId: item.id, title: item.title, variant: body.variant, quantity, unit, source: 'store' }), buyer);
      }
      if (area === 'orders' && key === 'chat') {
        requireThat(eligible(), 'Сначала подключите приём оплаты.');
        const product = assortment.find((entry) => entry.id === body.productId);
        requireThat(!product?.leadDays || body.questionId, 'Для индивидуального заказа откройте переписку о товаре.');
        if (body.questionId) {
          const context = db.prepare('SELECT product_id FROM questions WHERE id = ?').get(string(body.questionId, 1, 50));
          requireThat(context && context.product_id === body.productId, 'Товар не совпадает с вопросом покупателя.', 400);
        }
        const fulfillment = body.fulfillment === 'delivery' ? 'Доставка' : PICKUP;
        const ready = string(body.ready, 10, 10);
        const parsed = new Date(ready + 'T00:00:00Z');
        requireThat(/^\d{4}-\d{2}-\d{2}$/.test(ready) && Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === ready && ready >= futureDate(0),
          'Укажите дату готовности в будущем.', 400);
        requireThat(!product?.leadDays || ready <= futureDate(product.leadDays), 'Дата превышает максимальный срок изготовления.', 400);
        const quantity = integer(body.quantity, 1, 99);
        const total = integer(body.total, quantity, 100000000);
        return present(newOrder({
          questionId: body.questionId || null,
          productId: product?.id ?? null,
          title: string(body.title, 2, 100), variant: string(body.variant, 1, 80), quantity, unit: null, total,
          fulfillment, ready, shipping: fulfillment === 'Доставка' ? integer(body.shipping, 0, 10000000) : 0,
          expires: timestamp() + HOUR * integer(body.hours, 1, 168), source: 'chat',
        }));
      }
      if (area === 'checkout' && key && action) {
        const order = matchingOrder(getBuyerOrder(key));
        if (action === 'start' && order.source === 'chat') attachOrder(order, buyer);
        return buyerAction(order, action, body);
      }
      if (area === 'merchant' && key && action) return merchantAction(matchingOrder(getOrder(key)), action);
      if (area === 'economy') {
        const values = Object.fromEntries(economyFields.map((field) => [field, integer(body[field], 0, 1000000000)]));
        put('economy', values);
        return values;
      }
    }
    throw new ApiError(404, 'Страница не найдена.');
  }

  return {
    productIds: assortment.map((item) => item.id),
    processJobs,
    request(method, path, body, buyer) {
      processJobs();
      return method === 'POST'
        ? transaction(() => api(method, path, body, buyer))
        : api(method, path, body, buyer);
    },
  };
}
