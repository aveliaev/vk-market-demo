import { DAY, SAMPLE, canReport, createProtectedOrder, moneyLocation, protectionFees, refreshProtectedOrder, transitionProtectedOrder } from './protection-model.js';

export function createProtectionDemo({ main, icon, rub, safe, datetime, date, row, badge, shopAvatar, methodName, methodChoices, orderDetails, redraw, notify }) {
  const key = 'vk-protected-deal-v1';
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(key)); } catch { /* Start a fresh demonstration. */ }
  let order = saved?.order?.version === 1 && saved.order.id === SAMPLE.id ? saved.order : null;
  let role = saved?.role === 'seller' ? 'seller' : 'buyer';
  let offset = Number.isFinite(saved?.offset) ? saved.offset : 0;
  let issue = false;
  let draft = {reason: 'different', description: '', photos: []};
  let uploading = false;
  let storageFailed = false;
  let generation = 0;
  let thread = false;
  let juryOpen = false;
  let messages = Array.isArray(saved?.messages) ? saved.messages : [];
  const now = () => Date.now() + offset;
  const isHere = () => /^#\/deal(?:\/(?:buyer|seller)(?:\/chat)?)?$/.test(location.hash);
  const btn = (text, action, kind = 'primary') => `<button type="button" class="btn ${kind}" data-protection="${action}">${text}</button>`;
  const demo = (text, action, note) => `<div class="deal-demo-action"><span>Демонстрация</span>${btn(text, action, 'secondary')}<small>${note}</small></div>`;
  const policy = 'Если товар не придёт или окажется другим, вы сможете открыть спор и запросить возврат';

  function persist() {
    try { sessionStorage.setItem(key, JSON.stringify({order, role, offset, messages})); storageFailed = false; }
    catch { storageFailed = true; }
  }

  function update(focus = true) {
    persist(); redraw();
    if (focus) {
      main.querySelector('.deal-stage-title, h1')?.focus({preventScroll: true});
      window.scrollTo({top: 0, behavior: 'instant'});
    }
  }

  function apply(type, payload = {}, asRole = role, at = now()) {
    order = transitionProtectedOrder(order, {type, role: asRole, ...payload}, at);
    offset = at - Date.now();
    issue = false;
    if (isHere()) window.history.replaceState(null, '', '#/deal/' + role);
    update();
  }

  function dto() {
    return {...order, total: order.unit * order.quantity, fulfillment: 'Пункт выдачи',
      lines: [{productId: 'cups', title: order.title, variant: order.variant, quantity: order.quantity, total: order.unit * order.quantity}],
      delivery: {address: order.delivery, from: order.deliveryBy - DAY, to: order.deliveryBy}, deliveryOptions: []};
  }

  function toolbar() {
    return `<div class="deal-toolbar"><div><h1>${role === 'buyer' && (order.phase === 'offer' || thread) ? 'Переписка' : 'Заказ ' + safe(order.id)}</h1><p>${role === 'buyer' ? safe(order.seller) : 'Покупатель · Алексей'} · ${datetime(order.created)}</p></div>
      ${btn(role === 'buyer' ? 'Вид продавца' : 'Вид покупателя', role === 'buyer' ? 'role-seller' : 'role-buyer', 'text-button')}
    </div>`;
  }

  function juryTools() {
    return `<details class="deal-jury-tools" ${juryOpen ? 'open' : ''}><summary>${icon('flask')}Для жюри · события примера</summary><div><strong>Управление временем и исходом</strong><p>В интерфейсе магазина события приходят от службы доставки и платёжного партнёра. Здесь их можно ускорить.</p>
      <div class="inline-actions">${btn('Новая обычная покупка', 'start-good', 'secondary')}${btn('Пример с другим товаром', 'start-different', 'secondary')}</div>
      ${['paid','shipped'].includes(order.phase) ? demo('Срок доставки прошёл, посылки нет', 'demo-delay', 'Проверить обращение без подтверждения вручения.') : ''}
      ${order.phase === 'shipped' ? demo('Подтвердить вручение службой доставки', 'demo-deliver', 'Имитировать событие доставки, после которого начнутся 48 часов проверки.') : ''}
      ${order.phase === 'delivered' ? demo('Срок проверки истёк без спора', 'demo-expire', 'Перенести время на конец проверки.') : ''}
      ${order.phase === 'dispute' ? demo('Посмотреть решение по спору', 'demo-decide', 'Платёжный партнёр одобрит полный возврат для этого примера.') : ''}
      ${order.phase === 'approved' ? demo('Посмотреть зачисление возврата', 'demo-refund', 'Имитировать подтверждение зачисления.') : ''}
      <small>Прототип. Реальные деньги не списываются.</small></div></details>`;
  }

  function conversation() {
    return `<div class="deal-chat-layout"><section class="panel conversation deal-thread"><div class="conversation-head">${shopAvatar()}<div><strong>${safe(order.seller)}</strong><span>Обычно отвечает в течение часа</span></div><a class="btn text-button" href="#/shop">В магазин</a></div>
      <div class="messages"><time class="deal-chat-day">Сегодня</time><p class="bubble mine">Здравствуйте! Возьму две кобальтовые кружки с доставкой в ПВЗ.</p><p class="bubble">Согласовали. Кружки в наличии, отправим до ${date(order.sendBy)}. Отправляю заказ.</p>
      <article class="deal-live-order"><div class="registry-head"><h2>Заказ ${safe(order.id)}</h2>${badge(order.phase === 'offer' ? 'Ожидает оплаты' : titles[order.phase][0], 'blue')}</div>${summary(true)}${order.phase === 'offer' ? stageBody() : `${btn('Открыть заказ', 'order', 'secondary')}<p class="deal-muted">${moneyLocation(order)}</p>`}</article>
      ${messages.map((message) => `<p class="bubble ${message.mine ? 'mine' : ''}">${safe(message.text)}</p>`).join('')}</div>
      <form class="deal-composer" data-protection-form="message"><label class="deal-message-label"><span>Сообщение магазину</span><textarea name="message" rows="1" maxlength="1000" required placeholder="Написать сообщение…"></textarea></label><button class="btn primary" aria-label="Отправить сообщение">→</button></form></section>
      <aside class="panel section deal-shop-aside">${shopAvatar()}<h2>${safe(order.seller)}</h2><p>Мастерская керамики</p><div class="deal-shop-rating">★ 4,9 <span>126 отзывов</span></div><a class="order-link" href="#/shop">Товары сообщества ${icon('chevron')}</a><div class="section-divider"></div><p>Отправляем СДЭК. Заказ и условия получения согласуем в переписке.</p><span class="badge blue">${icon('shield')}Оплата с защитой</span></aside></div>`;
  }

  function money() {
    const before = ['offer','checkout','payment'].includes(order.phase);
    const final = ['completed','refunded'].includes(order.phase);
    return `<div class="deal-money ${final ? 'settled' : ''}" role="status">${icon(final ? 'check' : 'shield')}<div><strong>${moneyLocation(order)}</strong><span>${before ? 'До подтверждения тестового платежа списания нет.' : order.phase === 'completed' ? `Магазину перечислено ${rub(order.payout)} после комиссий.` : order.phase === 'refunded' ? `${rub(order.refunded)} возвращены исходным способом оплаты. Магазину — 0 ₽.` : order.phase === 'approved' ? 'Возврат одобрен. Партнёр готовит зачисление покупателю; выплата магазину отменена.' : order.phase === 'dispute' ? 'Выплата приостановлена. До решения деньги не переводятся магазину.' : 'Магазин получит выплату после приёмки или окончания проверки без спора.'}</span></div><b>${rub(order.phase === 'completed' ? order.payout : order.amount)}</b></div>`;
  }

  function summary(embedded = false) {
    return `<section class="${embedded ? 'deal-summary' : 'panel section deal-summary'}"><div class="summary-seller">${shopAvatar()}<div><strong>${safe(order.seller)}</strong><span>Заказ ${safe(order.id)} · из переписки сообщества</span></div></div>
      <div class="mini-product"><img src="./assets/cups.webp" width="76" height="76" alt="Керамические кружки «Утро»"><div><strong>${safe(order.title)}</strong><span>${safe(order.variant)} · ${order.quantity} шт. × ${rub(order.unit)}</span></div></div>
      ${embedded ? '' : row('Товары', rub(order.unit * order.quantity))}${row('Доставка продавцом', rub(order.shipping))}
      <p class="deal-delivery-address">${icon('pin')}${safe(order.delivery)}</p>
      ${row('Ожидаемое получение', 'До ' + date(order.deliveryBy))}${row('Итого', rub(order.amount), 'sum')}
      ${embedded ? '' : '<small class="deal-muted">Заказ из переписки сообщества</small>'}</section>`;
  }

  function sellerFinance() {
    const f = order.paidAt ? order.fees : protectionFees(order.method, order.amount);
    const cancelled = ['approved','refunded'].includes(order.phase);
    return `<section class="panel section deal-finance"><h2>Выплата магазину</h2>${row('Оплата покупателя', rub(order.amount))}${row('Комиссия сервиса · 1,5%', rub(cancelled ? 0 : f.service))}${row('Эквайринг · ' + methodName(order.method), rub(cancelled ? 0 : f.acquiring))}${row(cancelled ? 'К выплате' : order.phase === 'completed' ? 'Получено' : 'После комиссий', rub(cancelled ? 0 : f.net), 'sum')}
      <p>${cancelled ? 'В этом демо полный возврат отменяет выплату и комиссии.' : 'Условие выплаты — подтверждённое вручение, затем приёмка покупателя или 48 часов без спора.'}</p><small class="deal-muted">Демонстрационные тарифы. Выплата до налогов.</small></section>`;
  }

  const titles = {
    offer: ['Заказ согласован в переписке', 'Заказ отправлен покупателю'],
    checkout: ['Оплата с защитой', 'Покупатель выбирает способ оплаты'],
    payment: ['Подтвердите тестовый платёж', 'Ожидаем подтверждения оплаты'],
    paid: ['Заказ оплачен. Деньги у платёжного партнёра', 'Оплата подтверждена. Можно отправлять'],
    shipped: ['Магазин отправил заказ', 'Заказ отправлен. Ждём вручения'],
    delivered: ['Заказ вручён. Проверьте товар', 'Товар у покупателя. Идёт проверка'],
    dispute: ['Обращение принято', 'Выплата приостановлена'],
    approved: ['Возврат одобрен', 'Решение по обращению — возврат'],
    refunded: ['Деньги возвращены покупателю', 'Деньги возвращены покупателю'],
    completed: ['Заказ завершён', 'Выплата получена'],
  };

  function stageBody() {
    const buyer = role === 'buyer';
    const overdue = now() > order.deliveryBy;
    if (order.phase === 'offer') return buyer
      ? `<div class="deal-protected-payment">${btn('Оплатить с защитой', 'checkout')}<p class="deal-protection-copy">${icon('shield')}${policy}.</p></div>`
      : `<p>Покупатель получил состав заказа, условия доставки и объяснение защиты до оплаты.</p>${btn('Посмотреть глазами покупателя', 'role-buyer')}<p class="deal-muted">Отправляйте товар после подтверждения платежа.</p>`;
    if (['checkout','payment'].includes(order.phase)) return `<p>Покупатель подтверждает платёж. Средства пока не списаны.</p>${btn('Перейти к оплате покупателя', 'role-buyer')}`;
    if (order.phase === 'paid') return `<p>Отправка ожидается до <strong>${datetime(order.sendBy)}</strong>. Доставка — до ${date(order.deliveryBy)}.</p>${buyer ? `<p>Магазин сам передаст посылку в службу доставки. Деньги уже у партнёра, но ещё не у магазина.</p>${btn('Написать продавцу', 'thread', 'secondary')}` : `<p>Передайте заказ в СДЭК и укажите отправку. Выплата станет доступна после проверки покупки.</p><form data-protection-form="ship"><label class="field">Трек-номер СДЭК<input name="tracking" required minlength="5" maxlength="40" pattern="[A-Za-z0-9-]{5,40}" placeholder="Укажите трек-номер отправления"></label><button class="btn primary">Заказ передан в доставку</button></form>`}${missingActions(overdue)}`;
    if (order.phase === 'shipped') return `<p>СДЭК · трек <strong>${safe(order.tracking)}</strong>. Ожидаемое получение — до ${date(order.deliveryBy)}.</p><p>Подтверждение вручения запускает 48 часов проверки. До этого выплата не производится.</p>${missingActions(overdue)}`;
    if (order.phase === 'delivered') return `<p>Проверка до <strong>${datetime(order.checkUntil)}</strong> — 48 часов после вручения.</p>${buyer ? `<p>${order.scenario === 'different' ? 'Проверьте полученный товар. Если состав заказа не совпал, сообщите о проблеме до окончания проверки.' : 'Проверьте количество, цвет и состояние кружек. Подтвердите приёмку, если всё совпало.'}</p>
      <div class="deal-equal-actions">${btn('С товаром всё в порядке', 'accept', 'secondary')}${btn('Есть проблема', 'issue', 'secondary')}</div>` : `<p>Покупатель может подтвердить приёмку или открыть спор. До этого деньги остаются у партнёра.</p>${btn('Перейти к проверке покупателя', 'role-buyer')}`}
      `;
    if (order.phase === 'dispute') return `<div class="deal-dispute-details"><p>Причина — <strong>${reasonLabel(order.dispute.reason)}</strong>. Запрошен возврат <strong>${rub(order.dispute.requested)}</strong>.</p><blockquote class="deal-claim">${safe(order.dispute.description)}</blockquote><p>Платёжный партнёр рассматривает обращение. Выплата магазину заблокирована, даже если срок проверки закончится.</p></div>${photos(order.dispute.photos)}`;
    if (order.phase === 'approved') return `<p>Одобрено <strong>${rub(order.dispute.approved)}</strong> — товары и доставка полностью.</p><p>${order.dispute.reason === 'missing' ? 'Доставка просрочена, подтверждения вручения нет.' : 'Несоответствие подтверждено при рассмотрении обращения. По этому решению обратная отправка не требуется.'}</p><p>Магазину выплата отменена. Возврат пойдёт тем же способом — ${methodName(order.method)}.</p>`;
    if (order.phase === 'refunded') return `<div class="deal-result-amount">${rub(order.refunded)}</div><p>Возвращены покупателю · ${methodName(order.method)}. У партнёра — 0 ₽, выплата магазину — 0 ₽.</p>${buyer ? btn('Написать продавцу', 'thread', 'secondary') : '<a class="btn secondary" href="#/orders">К заказам магазина</a>'}`;
    return `<div class="deal-result-amount">${rub(buyer ? order.amount : order.payout)}</div><p>${buyer ? 'Приёмка завершена. Платёжный партнёр перечислил магазину сумму после комиссий.' : 'Платёжный партнёр перечислил деньги магазину после завершения проверки.'}</p><a class="btn secondary" href="#/${buyer ? 'purchases' : 'orders'}">${buyer ? 'К моим покупкам' : 'К заказам магазина'}</a>`;
  }

  function missingActions(overdue) {
    if (overdue) return role === 'buyer'
      ? `<div class="notice">${icon('clock')}Срок доставки прошёл. Подтверждения вручения нет.</div>${btn('Заказ не пришёл', 'issue-missing', 'secondary')}`
      : '<p class="notice">Срок доставки прошёл. Покупатель может открыть обращение без подтверждения получения.</p>';
    return '';
  }

  function reasonLabel(reason) { return {different: 'Пришёл другой товар', damaged: 'Товар повреждён', missing: 'Заказ не пришёл'}[reason]; }
  function photos(items) {
    return items?.length ? `<div class="deal-photos">${items.map((photo) => `<figure><img src="${photo.data === 'demo' ? './assets/plate.webp' : safe(photo.data)}" alt="${safe(photo.name)}"><figcaption>${safe(photo.name)}</figcaption></figure>`).join('')}</div>` : '';
  }

  function issueForm() {
    const missing = ['paid','shipped'].includes(order.phase);
    return `<section class="panel section deal-issue"><h2 class="deal-stage-title" tabindex="-1">Сообщить о проблеме</h2><p>После отправки обращения выплата сразу приостановится. Партнёр рассмотрит описание и фото.</p>
      <form data-protection-form="dispute"><label class="field">Причина<select name="claim-reason">${(missing ? ['missing'] : ['different','damaged']).map((reason) => `<option value="${reason}" ${draft.reason === reason ? 'selected' : ''}>${reasonLabel(reason)}</option>`).join('')}</select></label>
      <label class="field">Что произошло?<textarea name="claim-description" minlength="10" maxlength="600" rows="3" required placeholder="Опишите, чем полученный товар отличается от заказа">${safe(draft.description)}</textarea></label>
      <label class="field deal-file">Фото, если есть <small>До 3 изображений, каждое до 5 МБ. Только для этого демо.</small><input type="file" name="claim-photos" accept="image/jpeg,image/png,image/webp" multiple></label>
      ${!missing ? btn('Добавить демо-фото другого товара', 'sample-photo', 'text-button') : ''}${photos(draft.photos)}
      ${draft.photos.length ? btn('Убрать фото', 'clear-photos', 'text-button') : ''}
      <p class="deal-upload-status" role="status">${uploading ? 'Подготавливаем фото…' : ''}</p>
      ${row('Запрашиваемый возврат', rub(order.amount), 'sum')}<p class="deal-muted">Включая доставку ${rub(order.shipping)}. Деньги ещё не перечислены магазину.</p>
      <p class="deal-form-error" role="alert"></p><div class="inline-actions"><button class="btn primary" ${uploading ? 'disabled' : ''}>Отправить обращение и запросить возврат</button>${btn('Назад к заказу', 'cancel-issue', 'secondary')}</div></form></section>`;
  }

  function history() {
    return `<section class="panel section deal-history"><h2>Последние события</h2><p class="deal-muted">Заказ ${safe(order.id)}</p><ol>${order.events.slice().reverse().map((e) => `<li><span>${icon('check')}</span><div><strong>${safe(e.text)}</strong><time>${datetime(e.at)}</time></div></li>`).join('')}</ol></section>`;
  }

  function checkout() {
    const confirming = order.phase === 'payment';
    return `<div class="two-column checkout-grid">${orderDetails(dto())}<section class="panel section payment-panel">
      <h2 class="deal-stage-title" tabindex="-1">${confirming ? {card: 'Тестовая форма партнёра', sbp: 'Тестовое приложение банка', wallet: 'Тестовый VK Кошелёк'}[order.method] : 'Оплата с защитой'}</h2>
      ${confirming ? `<p>Подтвердите ${rub(order.amount)}. После подтверждения деньги останутся у партнёра до проверки товара.</p>${btn('Подтвердить тестовый платёж', 'confirm-payment')}${btn('Назад к заказу', 'back', 'text-button')}` : `${methodChoices(order.method, false)}${row('Итого к оплате', rub(order.amount), 'sum')}${btn('Оплатить с защитой', 'pay')}<p class="deal-protection-copy">${icon('shield')}${policy}.</p>${btn('Вернуться в переписку', 'back', 'text-button')}`}
      <p class="payment-note">${icon('flask')}Тестовая оплата. Данные карты и реальные деньги не используются.</p></section></div>`;
  }

  function render(tourView, requestedRole, requestedThread = false) {
    if (!tourView) {
      if (!order) { order = createProtectedOrder('good'); offset = 0; persist(); }
      if (['buyer','seller'].includes(requestedRole)) role = requestedRole;
      thread = requestedThread;
      return renderCurrent();
    }
    // Rendering a tour scene is synchronous and never persists or replaces the live order.
    const snapshot = {order, role, offset, issue, storageFailed, thread, messages};
    try {
      order = structuredClone(tourView.order); role = tourView.role;
      offset = tourView.now - Date.now(); issue = false; storageFailed = false; thread = false; messages = [];
      return renderCurrent(true);
    } finally {
      ({order, role, offset, issue, storageFailed, thread, messages} = snapshot);
    }
  }

  function renderCurrent(previewing = false) {
    const refreshed = refreshProtectedOrder(order, now());
    if (refreshed !== order) { order = refreshed; issue = false; if (!previewing) persist(); }
    const buyerCheckout = role === 'buyer' && ['checkout','payment'].includes(order.phase);
    const inConversation = role === 'buyer' && !buyerCheckout && (order.phase === 'offer' || thread);
    return `<div class="protected-demo deal-commerce">${toolbar()}${!inConversation || order.phase !== 'offer' ? money() : ''}
      <p class="deal-inline-error" role="alert"></p>
      ${buyerCheckout ? checkout() : inConversation ? conversation() : `<div class="deal-grid"><div>${summary()}${role === 'seller' ? sellerFinance() : ''}</div>
      <div>${issue && role === 'buyer' ? issueForm() : `<section class="panel section deal-stage"><span class="badge ${['completed','refunded'].includes(order.phase) ? 'green' : 'blue'}">${role === 'buyer' ? 'Покупатель' : 'Продавец'}</span><h2 class="deal-stage-title" tabindex="-1">${titles[order.phase][role === 'buyer' ? 0 : 1]}</h2>${stageBody()}</section>`}</div></div>`}
      ${!inConversation && !buyerCheckout ? history() : ''}${previewing ? '' : juryTools()}${storageFailed ? '<p class="deal-test-note">Сохранение недоступно: при перезагрузке прогресс может сброситься.</p>' : ''}</div>`;
  }

  function orderCard(asRole) {
    if (!order) return '';
    const refreshed = refreshProtectedOrder(order, now());
    if (refreshed !== order) { order = refreshed; persist(); }
    return `<article class="panel section purchase-record"><div class="registry-head"><h2><a class="order-link" href="#/deal/${asRole}">Заказ ${safe(order.id)}</a></h2>${badge('Оплата с защитой', 'blue')}</div><div class="mini-product"><img src="./assets/cups.webp" width="76" height="76" alt=""><div><strong>${safe(order.title)}</strong><span>${order.quantity} шт. · ${rub(order.amount)} с доставкой</span></div></div><p>${titles[order.phase][asRole === 'seller' ? 1 : 0]}</p><a class="btn secondary" href="#/deal/${asRole}">Открыть заказ</a></article>`;
  }

  function afterRender() {
    const messages = main.querySelector('.deal-thread .messages');
    if (messages) messages.scrollTop = messages.scrollHeight;
  }

  main.addEventListener('click', (e) => {
    const control = e.target.closest('[data-protection]');
    if (!control || !isHere()) return;
    const action = control.dataset.protection;
    try {
      if (action.startsWith('start-')) { ++generation; offset = 0; order = createProtectedOrder(action.slice(6), Date.now()); role = 'buyer'; messages = []; window.history.replaceState(null, '', '#/deal/buyer/chat'); issue = false; draft = {reason: 'different', description: '', photos: []}; uploading = false; update(); }
      else if (action === 'thread' || action === 'order') { thread = action === 'thread'; window.history.replaceState(null, '', '#/deal/' + role + (thread ? '/chat' : '')); update(); }
      else if (action.startsWith('role-')) { role = action.slice(5); window.history.replaceState(null, '', '#/deal/' + role); update(); }
      else if (action === 'issue' || action === 'issue-missing') {
        if (!canReport(order, now())) throw Error('Обращение сейчас недоступно. Проверьте статус заказа.');
        draft = {reason: action === 'issue-missing' ? 'missing' : 'different', description: '', photos: []}; issue = true; update();
      }
      else if (action === 'cancel-issue') { ++generation; uploading = false; issue = false; update(); }
      else if (action === 'sample-photo') { if (!draft.photos.some((p) => p.data === 'demo') && draft.photos.length < 3) draft.photos.push({name: 'Демо-фото: вместо кружек пришла тарелка', data: 'demo'}); update(false); }
      else if (action === 'clear-photos') { ++generation; uploading = false; draft.photos = []; update(false); }
      else if (action === 'demo-deliver') { apply('deliver', {}, 'demo', Math.max(now(), order.paidAt + 3 * DAY)); }
      else if (action === 'demo-expire') { order = refreshProtectedOrder(order, order.checkUntil + 1); offset = order.checkUntil + 1 - Date.now(); update(); }
      else if (action === 'demo-delay') { offset = order.deliveryBy + 1 - Date.now(); role = 'buyer'; window.history.replaceState(null, '', '#/deal/buyer'); update(); }
      else if (action === 'demo-decide') apply('decide', {}, 'demo', now() + DAY);
      else if (action === 'demo-refund') apply('refund', {}, 'demo', now() + 3600000);
      else apply(action);
    } catch (err) { main.querySelector('.deal-inline-error').textContent = err.message; }
  });

  main.addEventListener('toggle', (e) => {
    if (isHere() && e.target.matches('.deal-jury-tools')) juryOpen = e.target.open;
  }, true);

  main.addEventListener('input', (e) => {
    if (isHere() && e.target.name === 'claim-description') draft.description = e.target.value;
  });
  main.addEventListener('change', async (e) => {
    if (!isHere()) return;
    const field = e.target;
    if (field.name === 'method') { apply('method', {method: field.value}); return; }
    if (field.name === 'claim-reason') draft.reason = field.value;
    if (field.name !== 'claim-photos') return;
    const files = [...field.files];
    const ticket = ++generation;
    uploading = true;
    main.querySelector('.deal-upload-status').textContent = 'Подготавливаем фото…';
    main.querySelector('[data-protection-form] button[type="submit"], [data-protection-form] button:not([type])')?.setAttribute('disabled', '');
    try {
      if (draft.photos.length + files.length > 3) throw Error('Можно приложить до 3 фото.');
      const additions = [];
      for (const file of files) {
        if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw Error('Выберите JPG, PNG или WebP размером до 5 МБ.');
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
        additions.push({name: file.name, data: canvas.toDataURL('image/jpeg', .75)});
      }
      if (ticket !== generation) return;
      draft.photos.push(...additions);
    } catch (err) { if (ticket === generation) notify(err.message, true); }
    finally { if (ticket === generation) { uploading = false; if (isHere()) update(false); } }
  });
  main.addEventListener('submit', (e) => {
    if (!isHere() || !e.target.dataset.protectionForm) return;
    e.preventDefault();
    if (e.target.dataset.protectionForm === 'message') {
      const text = new FormData(e.target).get('message').trim();
      if (text) { messages.push({text: text.slice(0,1000), mine: true}); update(false); }
      return;
    }
    if (e.target.dataset.protectionForm === 'ship') {
      try { apply('ship', {tracking: new FormData(e.target).get('tracking').trim()}); }
      catch (err) { main.querySelector('.deal-inline-error').textContent = err.message; }
      return;
    }
    if (e.target.dataset.protectionForm !== 'dispute') return;
    if (uploading) return;
    try {
      apply('report', {reason: draft.reason, description: draft.description, photos: draft.photos});
    } catch (err) { main.querySelector('.deal-form-error').textContent = err.message; }
  });

  setInterval(() => {
    if (!isHere() || !order) return;
    const refreshed = refreshProtectedOrder(order, now());
    if (refreshed !== order) { order = refreshed; issue = false; update(false); }
  }, 10000);
  function totals() {
    if (!order?.paidAt) return {turnover: 0, scheduled: 0, payouts: 0};
    const cancelled = ['approved','refunded'].includes(order.phase);
    return {turnover: cancelled ? 0 : order.amount, scheduled: ['paid','shipped','delivered'].includes(order.phase) ? order.fees.net : 0, payouts: order.payout};
  }
  return {render, orderCard, afterRender, totals};
}
