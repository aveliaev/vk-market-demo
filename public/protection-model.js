// A test-only transaction model. No bank, carrier or production VK APIs are called.
export const DAY = 86400000;
export const CHECK_PERIOD = 2 * DAY;
export const SAMPLE = Object.freeze({
  id: 'ЗС-1042', seller: 'Керамика «Форма»', title: 'Керамическая кружка «Утро»',
  variant: 'Кобальтовая', quantity: 2, unit: 120000, shipping: 29000, amount: 269000,
  delivery: 'СДЭК · ПВЗ «Центр», ул. Садовая, 8',
});

export function createProtectedOrder(scenario = 'good', now = Date.now()) {
  if (!['good', 'different'].includes(scenario)) throw Error('Выберите сценарий.');
  return {
    version: 1, ...SAMPLE, scenario, phase: 'offer', method: 'card',
    created: now, sendBy: now + DAY, deliveryBy: now + 4 * DAY,
    paidAt: null, deliveredAt: null, checkUntil: null, dispute: null,
    fees: {service: 0, acquiring: 0, net: 0}, payout: 0, refunded: 0,
    events: [{at: now, text: 'Магазин согласовал заказ и отправил карточку в переписку.'}],
  };
}

export function protectionFees(method, amount = SAMPLE.amount) {
  const rates = {card: 200, sbp: 70, wallet: 0};
  if (!Object.hasOwn(rates, method)) throw Error('Выберите способ оплаты.');
  const service = Math.round(amount * 150 / 10000);
  const acquiring = Math.round(amount * rates[method] / 10000);
  return {service, acquiring, net: amount - service - acquiring};
}

function event(order, at, text) {
  order.events.push({at, text});
}

function finish(order, at, automatic = false) {
  order.phase = 'completed';
  order.payout = order.fees.net;
  event(order, at, automatic ? 'Срок проверки истёк без спора. Заказ завершён.' : 'Покупатель подтвердил приёмку. Заказ завершён.');
  event(order, at, 'Платёжный партнёр перечислил выплату магазину.');
}

export function refreshProtectedOrder(source, now = Date.now()) {
  if (source.phase !== 'delivered' || source.dispute || now < source.checkUntil) return source;
  const order = structuredClone(source);
  finish(order, order.checkUntil, true);
  return order;
}

export function canReport(order, now = Date.now()) {
  return order.phase === 'delivered' && now < order.checkUntil ||
    ['paid', 'shipped'].includes(order.phase) && now > order.deliveryBy;
}

export function moneyLocation(order) {
  if (['offer', 'checkout', 'payment'].includes(order.phase)) return 'Деньги у покупателя';
  if (order.phase === 'completed') return 'Выплата у продавца';
  if (order.phase === 'refunded') return 'Деньги возвращены покупателю';
  return 'Деньги у платёжного партнёра';
}

export function transitionProtectedOrder(source, action, now = Date.now()) {
  const order = structuredClone(refreshProtectedOrder(source, now));
  const require = (condition, message = 'Это действие сейчас недоступно.') => { if (!condition) throw Error(message); };
  const role = (expected) => require(action.role === expected, 'Переключитесь на нужную сторону заказа.');
  switch (action.type) {
    case 'checkout':
      role('buyer'); require(order.phase === 'offer'); order.phase = 'checkout'; break;
    case 'back':
      role('buyer'); require(['checkout', 'payment'].includes(order.phase)); order.phase = 'offer'; break;
    case 'method':
      role('buyer'); require(order.phase === 'checkout');
      protectionFees(action.method); order.method = action.method; break;
    case 'pay':
      role('buyer'); require(order.phase === 'checkout'); order.phase = 'payment'; break;
    case 'confirm-payment':
      role('buyer'); require(order.phase === 'payment');
      order.phase = 'paid'; order.paidAt = now; order.sendBy = now + DAY; order.deliveryBy = now + 4 * DAY;
      order.fees = protectionFees(order.method, order.amount);
      event(order, now, 'Оплата подтверждена. Деньги удерживаются платёжным партнёром.'); break;
    case 'ship':
      role('seller'); require(order.phase === 'paid');
      const tracking = String(action.tracking ?? 'DEMO-1042').trim();
      require(/^[A-Za-z0-9-]{5,40}$/.test(tracking), 'Укажите трек-номер: от 5 до 40 букв, цифр или дефисов.');
      order.phase = 'shipped'; order.tracking = tracking;
      event(order, now, 'Продавец передал посылку в СДЭК. Трек ' + tracking + '.'); break;
    case 'deliver':
      require(action.role === 'demo'); require(order.phase === 'shipped');
      order.phase = 'delivered'; order.deliveredAt = now; order.checkUntil = now + CHECK_PERIOD;
      event(order, now, 'Служба доставки подтвердила вручение. Начались 48 часов проверки.'); break;
    case 'accept':
      role('buyer'); require(order.phase === 'delivered' && !order.dispute);
      finish(order, now); break;
    case 'report': {
      role('buyer'); require(canReport(order, now), 'Открыть спор можно после вручения или при просроченной доставке.');
      const reason = action.reason;
      require(['different', 'damaged', 'missing'].includes(reason), 'Выберите причину.');
      require(reason !== 'missing' || ['paid', 'shipped'].includes(order.phase), 'Для полученного товара выберите несоответствие или повреждение.');
      require(reason === 'missing' || order.phase === 'delivered', 'Дождитесь вручения или выберите «Заказ не пришёл».');
      const description = String(action.description ?? '').trim();
      require(description.length >= 10 && description.length <= 600, 'Опишите проблему — от 10 до 600 символов.');
      order.dispute = {reason, description, photos: (action.photos ?? []).slice(0, 3), requested: order.amount, approved: 0, opened: now};
      order.phase = 'dispute';
      event(order, now, 'Обращение принято. Выплата продавцу приостановлена до решения.'); break;
    }
    case 'decide':
      require(action.role === 'demo'); require(order.phase === 'dispute');
      order.phase = 'approved'; order.dispute.approved = order.amount;
      event(order, now, 'Демо-решение партнёра: одобрен полный возврат, включая доставку.'); break;
    case 'refund':
      require(action.role === 'demo'); require(order.phase === 'approved');
      order.phase = 'refunded'; order.refunded = order.dispute.approved;
      event(order, now, 'Платёжный партнёр вернул деньги покупателю исходным способом оплаты. Выплата магазину отменена.'); break;
    default: throw Error('Неизвестное действие.');
  }
  return order;
}
