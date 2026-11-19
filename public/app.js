const main = document.querySelector('main');
const dialog = document.querySelector('#dialog');
const paths = {
  shop: '<path d="M3 9h18l-2-5H5z M3 9v2a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9 M5 14v6h14v-6 M10 20v-4h4v4"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5H4l1.6-3.3A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8.5 12h7"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
  box: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 5V3m6 2V3m-6 11h6"/>',
  tag: '<path d="M20 13 13 20a2 2 0 0 1-3 0l-7-7V4h9l8 6a2 2 0 0 1 0 3Z"/><circle cx="8" cy="8" r="1"/>',
  chart: '<path d="M3 3v17h18M8 15v-4m5 4V7m5 8V5"/>',
  shield: '<path d="M12 22s7-3.8 7-10V5l-7-3-7 3v7c0 6.2 7 10 7 10Z"/><path d="m9 12 2 2 4-4"/>',
  user: '<circle cx="12" cy="8" r="3"/><path d="M5 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2"/>',
  flask: '<path d="M9 3h6m-5 0v7l-5 8a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-8V3M8 15h8"/>',
  pin: '<path d="M19 10c0 5-7 10-7 10s-7-5-7-10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/>',
  calendar: '<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M4 10h16M8 4v4m8-4v4"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6m-6 4h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m12 6-6 6 6 6M6 12h14"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  link: '<path d="m10 13 4-4m-6 7-1 1a3 3 0 0 1-4-4l5-5a3 3 0 0 1 4 0m0 8a3 3 0 0 0 4 0l5-5a3 3 0 0 0-4-4l-1 1"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="white"/><circle cx="15" cy="17" r="2" fill="white"/>',
  wallet: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M21 10h-6a2 2 0 0 0 0 4h6m-5-2h.01"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
const rub = (cents) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100);
const pct = (value) => value === null ? '—' : new Intl.NumberFormat('ru-RU', { style: 'percent', maximumFractionDigits: 1 }).format(value);
const date = (value, options = { day: 'numeric', month: 'long' }) => new Intl.DateTimeFormat('ru-RU', { ...options, timeZone: 'Europe/Moscow' }).format(new Date(value));
const datetime = (value) => date(value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const duration = (ms) => ms < 60000 ? Math.round(ms / 1000) + ' сек' : Math.floor(ms / 60000) + ' мин';
const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const methodName = (method) => ({ card: 'Банковская карта', sbp: 'СБП' })[method] ?? '—';
const stageLabel = { started: 'Начато', details: 'Нужны сведения', partner: 'Нужны сведения', registered: 'Нужны сведения', review: 'На проверке', connected: 'Подключено', paused: 'Приостановлено', ineligible: 'Требуется другой статус' };
const receiptLabel = { missing: 'Ожидается', issued: 'Выдан', corrected: 'Скорректирован' };
const payoutLabel = { waiting: 'Ожидает оплаты', scheduled: 'Запланирована', sent: 'Перечислена', cancelled: 'Отменена', reversed: 'Возвращена партнёру' };
const fulfillmentLabel = { new: 'Новый', ready: 'Готов', delivered: 'Выдан', cancelled: 'Отменён' };
const badge = (label, tone = '') => `<span class="badge ${tone}">${safe(label)}</span>`;
const button = (label, action, options = {}) => `<button type="button" class="btn ${options.kind || 'primary'}" data-action="${action}" ${options.disabled ? 'disabled' : ''}>${options.icon ? icon(options.icon) : ''}${label}</button>`;
const row = (label, value, cls = '') => `<div class="detail-row ${cls}"><span>${label}</span><strong>${value}</strong></div>`;
const tile = (label, value, note, symbol) => `<div class="panel metric">${icon(symbol)}<span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ''}</div>`;
const cashInput = (cents) => (cents / 100).toFixed(2).replace(/\.00$/, '');

class RequestError extends Error {}
async function api(path, data) {
  if (document.documentElement.dataset.hosting === 'pages') {
    const { request } = await import('./pages-client.js');
    try {
      return await request(path, data);
    } catch (error) {
      throw new RequestError(error.message);
    }
  }
  const options = data === undefined ? undefined : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  };
  const response = await fetch('/api/' + path, options);
  const payload = await response.json();
  if (!response.ok) throw new RequestError(payload.error);
  return payload;
}

let state = { quantity: 2, variant: 0, method: 'card', busy: false };
let poll;
let toastTimer;
let routeVersion = 0;

const navigation = [
  ['Покупатель', [['shop', 'shop', 'Витрина'], ['cart','wallet','Корзина'], ['purchases','receipt','Мои заказы'], ['chat', 'chat', 'Переписка']]],
  ['Продавец', [['seller', 'bolt', 'Подключение'], ['price', 'tag', 'Цена и комиссии'], ['orders', 'box', 'Заказы'], ['analytics', 'chart', 'Аналитика']]],
  ['Администрирование', [['admin', 'shield', 'Сверка платежей']]],
];
const route = () => location.hash.slice(1).split('/').filter(Boolean);
const current = () => route()[0] ?? 'shop';
const go = (href) => { location.hash = '/' + href; };

function chrome(page) {
  const buyerPages = ['product', 'shop', 'cart', 'purchases', 'chat', 'checkout', 'receipt'];
  const currentSection = page === 'checkout' || page === 'receipt'
    ? (state.order?.source === 'chat' ? 'chat' : state.order?.source === 'cart' ? 'cart' : 'shop')
    : page === 'product' ? 'shop' : page;
  const names = Object.fromEntries(navigation.flatMap(([, list]) => list.map(([key,, name]) => [key, name])));
  Object.assign(names, { product: 'Карточка товара', checkout: 'Оформление заказа', receipt: 'Чек' });
  document.querySelector('#sidebar').innerHTML = `
    <nav aria-label="Разделы приложения">${navigation.map(([title, items]) => `<div class="nav-group"><p>${title}</p>${items.map(([key, symbol, name]) => `<a href="#/${key}" ${key === currentSection ? 'aria-current="page"' : ''}>${icon(symbol)}${name}</a>`).join('')}</div>`).join('')}</nav>`;
  const orderPage = page === 'checkout' || page === 'receipt';
  const rootLabel = buyerPages.includes(page) ? 'Керамика «Форма»' : page === 'admin' ? 'Администрирование' : 'Кабинет продавца';
  document.querySelector('#topbar').innerHTML = `
    <div class="breadcrumbs">
      ${buyerPages.includes(page) && page !== 'shop' ? `<a href="#/shop">${rootLabel}</a>` : `<span>${rootLabel}</span>`}
      ${orderPage ? `${icon('chevron')}<a href="#/${currentSection}">${names[currentSection]}</a>` : ''}
      ${icon('chevron')}<strong aria-current="page">${names[page] ?? 'Витрина'}</strong>
    </div>`;
}

function heading(title, subtitle = '', extra = '') {
  return `<div class="page-head"><div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${extra}</div>`;
}

const filters = { search: '', category: '', min: '', max: '', sort: 'default' };

function matchingProducts() {
  const term = filters.search.trim().toLocaleLowerCase('ru');
  const items = state.store.catalog.filter((item) =>
    (!filters.category || item.category === filters.category) &&
    (filters.min === '' || item.price >= Number(filters.min) * 100) &&
    (filters.max === '' || item.price <= Number(filters.max) * 100) &&
    [item.title, item.description, item.category, ...item.variants].join(' ').toLocaleLowerCase('ru').includes(term));
  if (filters.sort === 'asc') items.sort((a, b) => a.price - b.price);
  if (filters.sort === 'desc') items.sort((a, b) => b.price - a.price);
  return items;
}

function catalogCards(items) {
  return items.map((item) => `<a class="catalog-card" href="#/product/${item.id}">
    <img src="${item.image}" alt="" width="300" height="300">
    <strong>${rub(item.price)}</strong><span>${safe(item.title)}</span>
    <small>${safe(item.category)}</small>
  </a>`).join('') || '<p class="catalog-empty">Товаров с такими параметрами нет. Попробуйте изменить поиск или фильтры.</p>';
}

function shop() {
  const items = matchingProducts();
  const categories = ['', ...new Set(state.store.catalog.map((item) => item.category))];
  return `<section class="panel store-head">
    <div class="store-identity"><div class="shop-avatar">Ф</div><div><h1>${state.store.seller}</h1><p>Мастерская керамики и товаров для дома</p></div></div>
    <a class="btn secondary" href="#/chat">${icon('chat')}Сообщение</a>
  </section>
  <div class="catalog-layout">
    <section class="panel catalog-panel">
      <div class="catalog-title"><h2>Все товары <small id="catalog-count">${items.length}</small></h2>
        <select data-filter="sort" aria-label="Сортировка">${[['default','По умолчанию'],['asc','Сначала дешевле'],['desc','Сначала дороже']].map(([value, name]) => `<option value="${value}" ${filters.sort === value ? 'selected' : ''}>${name}</option>`).join('')}</select>
      </div>
      <input class="catalog-search" type="search" data-filter="search" aria-label="Поиск товаров" placeholder="Поиск товаров мастерской" value="${safe(filters.search)}">
      <div id="catalog-grid" class="catalog-grid">${catalogCards(items)}</div>
    </section>
    <aside class="panel catalog-filters"><h2>Фильтры</h2>
      <fieldset><legend>Цена, ₽</legend><div class="price-range">${[['min','От'],['max','До']].map(([key,name]) => `<input type="number" min="0" data-filter="${key}" aria-label="Цена ${name.toLowerCase()}" placeholder="${name}" value="${safe(filters[key])}">`).join('')}</div></fieldset>
      <fieldset><legend>Категория</legend>${categories.map((name) => `<label class="category-option"><input name="category" type="radio" data-filter="category" value="${safe(name)}" ${filters.category === name ? 'checked' : ''}>${name || 'Все товары'}</label>`).join('')}</fieldset>
      ${button('Сбросить фильтры', 'clear-filters', { kind: 'text-button' })}
    </aside>
  </div>`;
}

function product() {
  const { store, quantity, variant, item } = state;
  if (!item) return errorPanel('Товар не найден.');
  return `${heading('Карточка товара', '', '<a class="btn text-button" href="#/shop">К каталогу</a>')}
  <article class="panel product">
    <div class="product-photo"><img src="${item.image}" width="1000" height="800" alt="${safe(item.title)}"></div>
    <div class="product-info">
      ${badge(store.eligible ? 'В наличии' : 'Приём оплаты приостановлен', store.eligible ? 'green' : 'amber')}
      <h2>${safe(item.title)}</h2>
      <p class="product-description">${safe(item.description)}</p>
      <fieldset class="colors"><legend>Цвет</legend><div class="chips">${item.variants.map((name, i) => `<button type="button" class="chip ${variant === i ? 'selected' : ''}" data-action="variant:${i}" aria-pressed="${variant === i}">${name}</button>`).join('')}</div></fieldset>
      <div class="purchase-control"><div><div class="product-price">${rub(item.price)}</div><div class="muted">за штуку</div></div>
        <div class="stepper" aria-label="Количество">
          <button type="button" data-action="quantity:-1" aria-label="Уменьшить количество" ${quantity === 1 ? 'disabled' : ''}>${icon('minus')}</button>
          <output aria-live="polite">${quantity}</output>
          <button type="button" data-action="quantity:1" aria-label="Увеличить количество" ${quantity === 8 ? 'disabled' : ''}>${icon('plus')}</button>
        </div>
      </div>
      <div class="product-actions">${button('В корзину', 'cart-add', { kind: 'secondary', disabled: !store.eligible })}${button('Купить сейчас за ' + rub(item.price * quantity), 'buy', { disabled: !store.eligible })}</div>
    </div>
  </article>
  <div class="product-foot">
    <div class="panel feature"><div class="feature-icon">${icon('pin')}</div><div><strong>Самовывоз</strong><span>Из мастерской продавца</span></div></div>
    <div class="panel feature"><div class="feature-icon">${icon('calendar')}</div><div><strong>Готовность ${date(store.ready)}</strong><span>Дата фиксируется в заказе</span></div></div>
    <div class="panel feature"><div class="feature-icon">${icon('shield')}</div><div><strong>Карта или СБП</strong><span>Оплата на экране заказа</span></div></div>
  </div>
  ${productQuestions()}`;
}

function seller() {
  const s = state.seller;
  const phases = {
    started: ['Подключите оплату', 'Выберите статус продавца, чтобы начать.'],
    details: s.kind === 'none' ? ['Подходит ли вам НПД?', 'Ответы определяют следующий шаг подключения.'] : ['Проверка статуса', 'Подтвердите, что тестовый партнёр может проверить ваш статус.'],
    partner: ['Регистрация у партнёра', 'Имитация защищённого интерфейса партнёра. Используются только тестовые сведения.'],
    registered: ['Вы вернулись в магазин', 'Статус самозанятого подтверждён. Подключите выплаты и чеки.'],
    review: ['Проверяем подключение', 'В демонстрации ответ партнёра можно получить сразу.'],
    connected: ['Оплата подключена', 'Покупатели могут платить банковской картой и через СБП.'],
    paused: ['Оплата приостановлена', 'Тестовый партнёр сообщил об утрате статуса. Доступна повторная проверка.'],
    ineligible: ['Требуется другой статус', s.reason],
  };
  const [title, desc] = phases[s.stage];
  const check = (name, label, required = true) => `<label class="check"><input type="checkbox" name="${name}" ${required ? 'required' : ''}><span>${label}</span></label>`;
  const actions = {
    started: `<div class="choice-stack">${[['self','Самозанятый','Проверить существующий статус'],['business','ИП или организация','Узнать, какой путь подходит'],['none','Пока нет статуса','Проверить условия и зарегистрироваться']].map(([kind, label, desc]) => `<button class="choice" data-action="choose:${kind}"><span><strong>${label}</strong><small>${desc}</small></span>${icon('chevron')}</button>`).join('')}</div>`,
    details: s.kind === 'none'
      ? `<form data-form="eligibility"><label class="field">Что вы продаёте?<select name="activity" required><option value="">Выберите вид деятельности</option><option value="own">Изделия собственного производства</option><option value="other">Перепродаю товары или выбрана другая деятельность</option></select></label><label class="field">Применимость режима<select name="regime" required><option value="">Выберите ответ</option><option value="eligible">Подтверждаю, что проверил ограничения НПД и они соблюдены</option><option value="ineligible">Есть ограничения или мне нужна консультация</option></select></label>${check('agreed', 'Согласен перейти к тестовому партнёру, если режим подходит.')}<button class="btn primary">Продолжить</button></form>`
      : `<form data-form="verify-existing">${check('agreed', 'Разрешаю выполнить тестовую проверку статуса.') }<button class="btn primary">Отправить на проверку</button></form>`,
    partner: `<form data-form="register"><div class="notice">${icon('flask')}Демо-профиль · Мастерская «Форма»</div>${check('agreed', 'Подтверждаю сведения и согласие на тестовую регистрацию.')}<button class="btn primary">Зарегистрироваться и вернуться</button></form>`,
    registered: `<form data-form="permissions">${check('payouts', 'Подключить перечисление средств продавцу.')}${check('receipts', 'Разрешить тестовому партнёру выдавать чеки НПД.')}<button class="btn primary">Отправить на проверку</button></form>`,
    review: button('Получить тестовый ответ', 'seller:verify'),
    connected: `<div class="inline-actions"><a class="btn primary" href="#/price">Настроить цену</a>${button('Пройти подключение заново', 'restart-prompt', { kind: 'secondary' })}</div>`,
    paused: button('Повторить проверку', 'seller:restore'),
    ineligible: button('Выбрать другой статус', 'seller:restart', { kind: 'secondary' }),
  };
  const flow = s.kind === 'self' ? ['Статус', 'Проверка', 'Выплаты и чеки', 'Готово'] : ['Статус', 'Регистрация', 'Выплаты и чеки', 'Готово'];
  const step = ({ started: 0, details: 0, ineligible: 0, partner: 1, registered: 2, review: s.payouts ? 2 : 1, connected: 3, paused: 3 })[s.stage];
  return `${heading('Подключение оплаты', 'Керамика «Форма»', badge(stageLabel[s.stage], s.stage === 'connected' ? 'green' : 'blue'))}
  <div class="two-column">
    <section class="panel section">
      <ol class="progress">${flow.map((label, i) => `<li class="${i === step ? 'active' : i < step ? 'done' : ''}"><span>${i < step ? icon('check') : i + 1}</span><small>${label}</small></li>`).join('')}</ol>
      <h2>${title}</h2><p class="muted">${safe(desc)}</p><div class="setup-actions">${actions[s.stage]}</div>
    </section>
    <aside class="panel section terms"><div class="feature-icon">${icon('wallet')}</div><h2>Условия оплаты</h2>
      ${row('Комиссия VK', '1,5%')}${row('Эквайринг по карте', '2%')}${row('Эквайринг СБП', '0,7%')}
      <p>Комиссии считаются от оплаченной суммы. Тарифы эквайринга приведены для демонстрации. Налоги продавец уплачивает самостоятельно.</p>
      <p>Демо-выплату подтверждает оператор. При полном возврате комиссия VK возвращается, эквайринг удерживается.</p>
      ${s.stage === 'connected' ? `<div class="section-divider"></div>${row('Действия продавца', duration(s.active))}${row('Ожидание проверки', duration(s.waiting))}` : ''}
    </aside>
  </div>`;
}

function pricePage() {
  return `${heading('Цена и комиссии', 'Керамическая кружка «Утро»')}
    <div class="two-column">
      <section class="panel section"><h2>Цена товара</h2><p class="muted">Укажите сумму после комиссии VK, до эквайринга и налогов.</p>
        <form data-form="price"><label class="field">Базовая сумма, ₽<input required type="number" min="1" max="100000" step="0.01" name="base" value="${cashInput(state.store.base)}"></label>
        <div class="total-box"><span>Цена для покупателя</span><strong id="price-preview">${rub(state.store.price)}</strong></div>
        <button class="btn primary">Сохранить цену</button></form>
      </section>
      <aside class="panel section terms"><div class="feature-icon">${icon('wallet')}</div><h2>Расчёт за одну кружку</h2>
      <div id="fee-preview">${feePreview(state.store.base)}</div><p>Покупатель видит одну цену при любом способе оплаты.</p></aside>
    </div>`;
}

function feePreview(base) {
  const price = Math.round(base * 10000 / (10000 - state.store.vkRate));
  const vk = Math.round(price * state.store.vkRate / 10000);
  return row('Комиссия VK · 1,5%', rub(vk)) + Object.entries(state.store.rates).map(([method, rate]) => {
    const acquiring = Math.round(price * rate / 10000);
    return `<div class="section-divider"></div><h3>${methodName(method)}</h3>${row('Эквайринг · ' + pct(rate / 10000), rub(acquiring))}${row('К выплате до налогов', rub(price - vk - acquiring), 'emphasis')}`;
  }).join('');
}

function productQuestions() {
  return `<section class="panel section product-questions">
    <h2>Вопросы о товаре</h2>
    ${state.faq.map((entry) => `<details class="public-answer"><summary>${safe(entry.question)}</summary><p>${safe(entry.answer)}</p></details>`).join('')}
    <form data-form="ask" class="ask-form">
      <label class="field">Вопрос продавцу<input name="question" maxlength="300" required placeholder="Что вы хотите уточнить?"></label>
      <button class="btn secondary">Спросить в переписке</button>
    </form>
  </section>`;
}

function questionThread(q) {
  const item = state.store.catalog.find((p) => p.id === q.product_id);
  const ref = safe(q.id);
  return `<article class="thread-question">
    <a class="order-link" href="#/product/${item.id}">${safe(item.title)}</a><small> · ${safe(q.variant)}</small>
    <p class="bubble mine">${safe(q.question)}</p>
    ${q.reply ? `<p class="bubble">${safe(q.reply)}</p>
      ${route()[1] === q.id ? button('Подготовить заказ по вопросу', 'focus-offer', { kind: 'secondary' }) : `<a href="#/chat/${ref}" class="order-link">Подготовить заказ по вопросу</a>`}
      ${q.public_question ? `<form data-form="unpublish"><input type="hidden" name="id" value="${ref}"><button class="btn text-button">Снять ответ с публикации</button></form>`
      : `<details class="public-answer"><summary>Опубликовать ответ в карточке</summary>
        <form data-form="publish"><input type="hidden" name="id" value="${ref}">
        <label class="field">Общий вопрос без личных данных<input name="question" maxlength="300" required></label>
        <label class="field">Ответ для всех покупателей<textarea name="answer" maxlength="600" required></textarea></label>
        <button class="btn secondary">Опубликовать</button></form></details>`}`
      : `<form data-form="reply"><input type="hidden" name="id" value="${ref}">
        <label class="field">Ответ продавца<textarea name="reply" required maxlength="600"></textarea></label><button class="btn secondary">Ответить покупателю</button></form>`}
  </article>`;
}

function chat() {
  const store = state.store;
  const selected = state.questions.find((entry) => entry.id === route()[1]);
  const product = store.catalog.find((entry) => entry.id === selected?.product_id) ?? store.catalog[0];
  return `${heading('Переписка', 'Индивидуальный заказ')}
    <div class="two-column chat-grid"><section class="panel conversation">
      <div class="conversation-head"><div class="shop-avatar">Ф</div><div><strong>${store.seller}</strong><span>Сообщения магазина</span></div></div>
      <div class="messages">
        ${selected ? questionThread(selected) : `<div class="bubble mine">Здравствуйте! Можно заказать две кобальтовые кружки?</div>
        <div class="bubble">Здравствуйте! Да, сделаем две кружки. Будут готовы ${date(store.ready)}. Стоимость — ${rub(store.price * 2)}.</div>
        <div class="bubble mine">Подходит. Заберу в мастерской.</div>
        ${state.questions.map(questionThread).join('')}`}
        ${state.chatOrders.filter((order) => !selected || order.questionId === selected.id).map((order) => {
          const payable = order.status === 'unpaid' || order.status === 'pending';
          return `<div class="chat-order"><div class="feature-icon">${icon('receipt')}</div><div><small>Заказ ${safe(order.id)}</small><h3>${safe(order.title)}</h3><p>${safe(order.variant)} · ${order.quantity} шт. · ${rub(order.amount)}</p><p>${payable ? 'Оплата до ' + datetime(order.expires) : safe(order.statusLabel)}</p>
            <a class="btn ${payable ? 'primary' : 'secondary'}" href="#/checkout/${order.token}">${payable ? 'Оплатить заказ' : 'Открыть заказ'}</a></div></div>`;
        }).join('')}
      </div></section>
      <section class="panel section"><h2>Сформировать заказ</h2><p class="muted">Карточка оплаты появится в переписке.</p>
        <form data-form="chat"><input type="hidden" name="questionId" value="${safe(selected?.id)}"><input type="hidden" name="productId" value="${product.id}">
          <label class="field">Товар<input name="title" maxlength="100" required value="${safe(product.title)}"></label>
          <label class="field">Вариант<input name="variant" maxlength="80" required value="${safe(selected?.variant ?? 'Кобальтовая')}"></label>
          <div class="form-pair"><label class="field">Количество<input type="number" name="quantity" min="1" max="99" value="${selected ? 1 : 2}" required></label><label class="field">Цена товаров, ₽<input type="number" name="total" step="0.01" min="0.01" max="1000000" value="${cashInput(product.price * (selected ? 1 : 2))}" required></label></div>
          <div class="form-pair"><label class="field">Готовность<input name="ready" type="date" required value="${store.ready}"></label><label class="field">Срок оплаты<select name="hours"><option value="24">24 часа</option><option value="48">48 часов</option><option value="72">72 часа</option></select></label></div>
          <label class="field">Получение<select name="fulfillment" id="fulfillment"><option value="pickup">Самовывоз</option><option value="delivery">Доставка</option></select></label>
          <label class="field" id="shipping-field" hidden>Доставка, ₽<input type="number" name="shipping" step="0.01" min="0" max="100000" value="0"></label>
          <button class="btn primary" ${store.eligible ? '' : 'disabled'}>Отправить на оплату</button>
          ${store.eligible ? '' : '<p class="form-hint">Для отправки заказа подключите оплату.</p>'}
        </form>
      </section></div>`;
}

function orderLines(o) {
  return o.lines.map((line) => `<div class="mini-product">
    ${line.productId || o.source !== 'chat' ? `<img src="./assets/${safe(line.productId || 'cups')}.webp" alt="" width="76" height="76">` : ''}
    <div><strong>${safe(line.title)}</strong><span>${safe(line.variant)} · ${line.quantity} шт.</span></div>
    <strong class="line-amount">${rub(line.total)}</strong>
  </div>`).join('');
}

function cartPage() {
  const cart = state.cart;
  const catalogLink = '<a class="btn secondary" href="#/shop">В каталог</a>';
  if (!cart.lines.length) return heading('Корзина') + `<section class="panel section"><h2>Корзина пуста</h2><p>Добавьте товары мастерской из их карточек.</p>${catalogLink}</section>`;
  return `${heading('Корзина', 'Керамика «Форма»', catalogLink)}<div class="two-column checkout-grid">
    <section class="panel section">${cart.lines.map((line, i) => `<article class="cart-line">
      <img src="./assets/${safe(line.productId)}.webp" alt="" width="66" height="66">
      <div><a class="order-link" href="#/product/${line.productId}">${safe(line.title)}</a><small>${safe(line.variant)} · ${rub(line.unit)} за штуку</small>
      ${button('Удалить', 'cart-remove:' + i, {kind:'text-button'})}</div>
      <div class="stepper"><button data-action="cart-minus:${i}" aria-label="Уменьшить количество" ${line.quantity <= 1 ? 'disabled' : ''}>${icon('minus')}</button><output>${line.quantity}</output><button data-action="cart-plus:${i}" aria-label="Увеличить количество" ${line.quantity >= 8 ? 'disabled' : ''}>${icon('plus')}</button></div>
      <strong>${rub(line.total)}</strong></article>`).join('')}</section>
    <aside class="panel section"><h2>Ваш заказ</h2>${row('Количество товаров', String(cart.lines.reduce((sum,l) => sum+l.quantity,0)))}
      ${row('Самовывоз', 'Бесплатно')}${row('Итого', rub(cart.total), 'sum')}
      ${button('Оформить заказ', 'cart-checkout', {disabled: !state.store.eligible})}
      ${state.store.eligible ? '' : '<p>Магазин временно приостановил приём оплаты.</p>'}</aside></div>`;
}

function purchases() {
  const orders = state.purchases;
  return `${heading('Мои заказы', 'Покупки, оформленные в этом браузере')}
    ${orders.length ? orders.map((o) => `<article class="panel section purchase-record">
      <div class="registry-head"><h2><a class="order-link" href="#/checkout/${o.token}">Заказ ${safe(o.id)}</a></h2>${badge(o.statusLabel, o.status === 'paid' ? 'green' : '')}</div>
      ${orderLines(o)}${row('Итого',rub(o.amount),'sum')}
      ${row(safe(o.fulfillment), date(o.ready))}${o.status === 'paid' ? row('Исполнение', o.fulfillmentStatus === 'ready' && o.fulfillment.startsWith('Самовывоз') ? 'Готов к самовывозу' : fulfillmentLabel[o.fulfillmentStatus]) : ''}
      <div class="inline-actions"><a class="btn secondary" href="#/checkout/${o.token}">Открыть заказ</a>
      ${o.receipt !== 'missing' ? `<a class="btn text-button" href="#/receipt/${o.token}">Чек</a>` : ''}</div>
      </article>`).join('') : '<section class="panel section"><h2>Заказов пока нет</h2><p>После оформления заказ появится здесь.</p><a href="#/shop" class="btn primary">В каталог</a></section>'}`;
}

function funnelPanel(data, orders) {
  const count = (channel, stage) => data.find((row) => row.channel === channel && row.stage === stage)?.count ?? 0;
  const chats = orders.filter((o) => o.source === 'chat');
  return `<section class="panel section funnel"><h2>Воронка покупки</h2>
    <p class="muted">Уникальные браузеры покупателей с момента включения учёта. Быстрая покупка пропускает корзину.</p>
    <div class="funnel-steps">${[['view','Открыли товар'],['cart','Добавили в корзину'],['checkout','Начали оформление'],['paid','Оплатили']].map(([stage, label]) => `<div><span>${label}</span><strong>${count('store',stage)}</strong></div>`).join('')}</div>
    <h3>Заказы из переписки</h3>${row('Отправлено заказов',String(chats.length))}${row('Оплачено заказов',String(chats.filter((o) => o.paidAt).length))}
    ${row('Покупатели, открывшие оформление',String(count('chat','checkout')))}${row('Покупатели, оплатившие заказ',String(count('chat','paid')))}
  </section>`;
}

function orderDetails(o) {
  return `<section class="panel section checkout-summary">
    <div class="summary-seller"><div class="shop-avatar">Ф</div><div><strong>Керамика «Форма»</strong><span>Продавец</span></div></div>
    <div class="checkout-block">
      <h2>Получение</h2>
      <dl class="checkout-meta">
        <div><dt>${icon('pin')}Способ получения</dt><dd>${safe(o.fulfillment)}</dd></div>
        <div><dt>${icon('calendar')}Готовность</dt><dd>${date(o.ready)}</dd></div>
      </dl>
      ${o.shipping ? row('Стоимость доставки', rub(o.shipping)) : ''}
    </div>
    <div class="checkout-block">
      <h2>Состав заказа</h2>
      ${orderLines(o)}
    </div>
  </section>`;
}

function methodChoices() {
  return `<fieldset class="payment-choices"><legend>Способ оплаты</legend>${[['card','card','Банковская карта','Подтверждение на стороне партнёра'],['sbp','bolt','СБП','Подтверждение в приложении банка']].map(([method, symbol, title, desc]) => `<label class="choice payment-choice"><span class="feature-icon">${icon(symbol)}</span><span class="payment-label"><strong>${title}</strong><small>${desc}</small></span><input type="radio" name="method" value="${method}" ${state.method === method ? 'checked' : ''}></label>`).join('')}</fieldset>`;
}

function checkoutComparison() {
  return `<details class="panel flow-comparison">
    <summary>${icon('info')}Сравнить с оплатой в чате${icon('chevron', 'comparison-chevron')}</summary>
    <div class="comparison-columns">
      <section class="comparison-path">
        <h2>Сценарий на скриншотах VK</h2>
        <ol>
          <li>Покупатель оформляет заказ из корзины.</li>
          <li>В чате появляется сообщение с номером заказа, ссылкой и суммой за товар.</li>
          <li>Стоимость и срок доставки, а также порядок оплаты уточняются у продавца в чате.</li>
        </ol>
      </section>
      <section class="comparison-path proposed">
        <h2>Сценарий MVP для готового товара</h2>
        <ol>
          <li>На оформлении уже видны итоговая сумма, способ получения и дата готовности.</li>
          <li>Покупатель выбирает карту или СБП и подтверждает платёж на стороне партнёра.</li>
          <li>Подтверждение заказа и чек доступны в деталях заказа.</li>
        </ol>
      </section>
    </div>
  </details>`;
}

function checkout() {
  const o = state.order;
  const back = `<a class="btn text-button" href="#/${o.source === 'chat' ? 'chat' : o.source === 'cart' ? 'purchases' : 'product/' + (o.productId || 'cups')}">${icon('back')}${o.source === 'chat' ? 'В переписку' : o.source === 'cart' ? 'К моим заказам' : 'К товару'}</a>`;
  let body;
  if (o.status === 'unpaid') {
    body = `<h2>Способ оплаты</h2>
      ${methodChoices()}
      ${row('Итого к оплате', rub(o.amount), 'sum')}
      <div class="payment-actions">${button('Оплатить ' + rub(o.amount), 'checkout:start')}${button('Отменить заказ', 'cancel-prompt', { kind: 'text-button' })}</div>
      <p class="payment-note">${icon('shield')}Оплата тестовая. После оплаты возврат оформляется по запросу.</p>`;
  } else if (o.status === 'pending' && !o.bankConfirmed) {
    body = `<div class="feature-icon status-icon">${icon(o.method === 'sbp' ? 'bolt' : 'card')}</div><h2>${o.method === 'sbp' ? 'Тестовое приложение банка' : 'Тестовая форма партнёра'}</h2>
      <p class="muted">Подтвердите платёж на сумму ${rub(o.amount)}. Реальные платёжные данные вводить не нужно.</p>
      <div class="inline-actions">${button('Подтвердить тестовый платёж', 'checkout:confirm')}${button('Выбрать другой способ', 'checkout:decline', { kind: 'secondary' })}</div>`;
  } else if (o.status === 'pending') {
    body = `<div class="feature-icon status-icon">${icon('clock')}</div><h2>Проверяем оплату</h2><p class="muted">Ожидаем подтверждение от тестового партнёра.</p><div class="spinner" aria-label="Проверка оплаты"></div>`;
  } else if (o.status === 'paid') {
    const refundText = o.refund === 'requested' ? 'Продавец получил запрос на возврат.' : 'Партнёр обрабатывает полный возврат.';
    body = `<div class="feature-icon status-icon success-icon">${icon('check')}</div><h2>Заказ оплачен</h2>
      <p class="muted">Платёж ${rub(o.amount)} подтверждён. Продавец — Керамика «Форма».</p>
      <div class="status-lines">${row('Способ оплаты', methodName(o.method))}${row('Исполнение', fulfillmentLabel[o.fulfillmentStatus])}</div>
      <div class="inline-actions"><a class="btn primary" href="#/receipt/${o.token}">${icon('receipt')}Открыть чек</a>
        <a class="btn secondary" href="#/chat">${icon('chat')}Написать продавцу</a></div>
      ${o.refund === 'none' ? button('Запросить возврат', 'refund-prompt', { kind: 'text-button' }) : `<p class="notice">${icon('info')}${refundText}</p>`}`;
  } else if (o.status === 'refunded') {
    body = `<div class="feature-icon status-icon success-icon">${icon('check')}</div><h2>Возврат оформлен</h2>
      <p class="muted">Тестовый партнёр вернул ${rub(o.amount)} исходным способом оплаты · ${methodName(o.method)}.</p>
      <a class="btn secondary" href="#/receipt/${o.token}">${icon('receipt')}Открыть скорректированный чек</a>`;
  } else {
    body = `<div class="feature-icon status-icon">${icon('info')}</div><h2>${o.status === 'cancelled' ? 'Заказ отменён' : 'Срок оплаты истёк'}</h2><p class="muted">Вы можете вернуться в магазин и оформить новый заказ.</p>`;
  }
  const source = o.source === 'chat' ? 'Заказ из переписки' : o.source === 'cart' ? 'Заказ из корзины' : 'Заказ с витрины';
  const comparing = o.status === 'unpaid' && o.source === 'store';
  return `${o.status === 'unpaid' ? heading('Оформление заказа', safe(o.id) + ' · ' + source, back) : heading('Заказ ' + safe(o.id), source, back)}
    <div class="two-column checkout-grid">${orderDetails(o)}<section class="panel section payment-panel">${body}</section></div>
    ${comparing ? checkoutComparison() : ''}`;
}

function receipt() {
  const o = state.order;
  return `${heading('Чек по заказу ' + safe(o.id), '', `<a class="btn text-button" href="#/checkout/${o.token}">${icon('back')}К заказу</a>`)}
    <section class="panel section receipt-panel"><div class="feature-icon status-icon">${icon('receipt')}</div>
    <h2>${o.receipt === 'corrected' ? 'Чек скорректирован' : o.receipt === 'issued' ? 'Тестовый чек НПД' : 'Чек пока не выдан'}</h2>
    ${o.receipt !== 'missing' ? `<p class="muted">Керамика «Форма» · ${datetime(o.paidAt)}</p>
      ${o.lines.map((line) => row(safe(line.title) + ' · ' + safe(line.variant) + ' · ' + line.quantity + ' шт.', rub(line.total))).join('')}${o.shipping ? row('Доставка', rub(o.shipping)) : ''}
      ${row('Способ оплаты', methodName(o.method))}${row(o.receipt === 'corrected' ? 'Возвращено' : 'Оплачено', rub(o.amount), 'sum')}
      <p class="notice">${icon('flask')}Демонстрационный документ. В ФНС не передавался.</p>` : ''}</section>`;
}

function orders() {
  const { orders, summary } = state.merchant;
  return `${heading('Заказы', 'Реестр магазина «Форма»', '<a class="btn primary" href="#/chat">' + icon('plus') + 'Создать заказ</a>')}
    <div class="metrics three">${tile('Оборот после возвратов', rub(summary.turnover), '', 'chart')}
      ${tile('К перечислению', rub(summary.scheduled), 'Демо-выплаты', 'wallet')}${tile('Перечислено', rub(summary.payouts), 'До налогов', 'check')}</div>
    <section class="panel registry"><div class="registry-head"><h2>Все заказы</h2>${badge(String(orders.length), 'blue')}</div>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Таблица заказов"><table><thead><tr><th>Заказ</th><th>Оплата</th><th>Сумма</th><th>Комиссия VK</th><th>Эквайринг</th><th>К выплате</th><th>Исполнение</th></tr></thead><tbody>
        ${orders.map((o) => `<tr><td><a class="order-link" href="#/orders/${encodeURIComponent(o.id)}">${safe(o.id)}</a><small>${o.source === 'chat' ? 'Переписка' : o.source === 'cart' ? 'Корзина' : 'Витрина'} · ${datetime(o.created)}</small></td>
          <td>${badge(o.statusLabel, o.status === 'paid' ? 'green' : o.status === 'pending' ? 'blue' : '')}${o.refund === 'requested' ? '<small class="amber-text">Запрошен возврат</small>' : ''}</td>
          <td>${rub(o.amount)}</td><td>${o.paidAt ? rub(o.status === 'refunded' ? 0 : o.fees.vk) : '—'}</td><td>${o.paidAt ? rub(o.fees.acquiring) : '—'}</td><td>${o.paidAt ? rub(o.status === 'refunded' ? 0 : o.fees.net) : '—'}<small>${payoutLabel[o.payout]}</small></td>
          <td>${fulfillmentLabel[o.fulfillmentStatus]}</td></tr>`).join('')}
      </tbody></table></div></section>`;
}

function orderDetail(id) {
  const o = state.merchant.orders.find((order) => order.id === id);
  if (!o) return errorPanel('Заказ не найден.');
  const refundButton = o.refund === 'requested' ? button('Подтвердить полный возврат', 'merchant-refund', { icon: 'wallet' }) : '';
  const fulfillmentButton = o.fulfillmentStatus === 'new'
    ? button('Отметить готовым', 'merchant:ready')
    : o.fulfillmentStatus === 'ready' ? button('Отметить выданным', 'merchant:deliver') : '';
  const payoutButton = o.payout === 'scheduled' ? button('Подтвердить тестовую выплату', 'merchant:payout', { kind: 'secondary' }) : '';
  return `${heading('Заказ ' + safe(o.id), safe(o.title), '<a class="btn text-button" href="#/orders">' + icon('back') + 'К реестру</a>')}
    <div class="two-column">
      <section class="panel section"><h2>Состав заказа</h2>${orderLines(o)}<hr class="section-divider"><h2>Состояние заказа</h2>
        ${row('Оплата', badge(o.statusLabel, o.status === 'paid' ? 'green' : 'blue'))}
        ${row('Способ оплаты', methodName(o.method))}${row('Чек', receiptLabel[o.receipt])}
        ${row('Исполнение', fulfillmentLabel[o.fulfillmentStatus])}${row('Перечисление', payoutLabel[o.payout])}
        ${o.refund !== 'none' ? row('Возврат', { requested: 'Запрошен', processing: 'Обрабатывается', complete: 'Выполнен' }[o.refund]) : ''}
        <div class="inline-actions">${refundButton || (o.status === 'paid' && o.refund === 'none' ? fulfillmentButton + payoutButton : '')}</div>
        <div class="inline-actions">${o.receipt !== 'missing' ? `<a class="btn secondary" href="#/receipt/${o.token}">${icon('receipt')}Чек</a>` : ''}<a class="btn text-button" href="#/checkout/${o.token}">Открыть заказ покупателя</a></div>
      </section>
      <aside class="panel section terms"><h2>Расчёт выплаты</h2>${row('Сумма заказа', rub(o.amount))}
        ${o.paidAt ? `${row('Комиссия VK · 1,5%', rub(o.fees.vk))}${row('Эквайринг', rub(o.fees.acquiring))}
        ${o.status === 'refunded' ? `${row('Возвращено покупателю', rub(o.amount))}${row('Возвращено комиссии VK', rub(o.fees.vk))}${row('Удержан эквайринг', rub(o.fees.acquiring), 'emphasis')}` : row('К выплате до налогов', rub(o.fees.net), 'sum')}` : '<p>Сумма к выплате рассчитывается после оплаты.</p>'}
      </aside>
    </div>`;
}

function analytics() {
  const { summary: a, economy: e } = state.merchant;
  const economyFields = [['externalCount', 'Число внешних продаж', 1], ['externalAmount', 'Оборот внешних продаж, ₽', 100], ['productCosts', 'Себестоимость, ₽', 100], ['promotion', 'Продвижение продавца, ₽', 100], ['vkCosts', 'Расходы VK, ₽', 100]];
  return `${heading('Аналитика', 'Сводка по заказам демо-магазина')}
    <div class="metrics three">
      ${tile('Доля оплат через VK', pct(a.share), 'По числу продаж после возвратов', 'card')}
      ${tile('Доля оборота через VK', pct(a.turnoverShare), 'С учётом внешних продаж', 'chart')}
      ${tile('Конверсия в оплату VK', pct(a.conversion), a.confirmed + ' оплат / ' + a.total + ' заказов', 'check')}
      ${tile('Доход продавца', rub(a.sellerIncome), 'До налогов, после затрат', 'wallet')}
      ${tile('Комиссионная выручка VK', rub(a.vk), 'После возвратов комиссии', 'tag')}
      ${tile('Вклад VK после расходов', rub(a.vkIncome), '', 'chart')}
    </div>
    ${funnelPanel(state.merchant.funnel, state.merchant.orders)}
    <div class="two-column analytics-grid"><section class="panel section"><h2>Итоги операций</h2>
      ${row('Оплаченный оборот до возвратов', rub(a.gross))}${row('Возвраты · ' + a.refunds, rub(a.refundsAmount))}
      ${row('Эквайринг продавца', rub(a.acquiring))}${row('Выдано чеков', a.receipts + ' из ' + a.confirmed)}
      ${row('Платежи на проверке', String(a.pending))}</section>
    <section class="panel section"><h2>Внешние продажи и расходы</h2><p class="muted">Демо-данные можно заменить значениями из реестра магазина.</p>
      <form data-form="economy"><div class="form-pair">${economyFields.map(([key, label, scale]) => `<label class="field">${label}<input name="${key}" type="number" min="0" max="${1000000000 / scale}" step="${1 / scale}" value="${scale === 1 ? e[key] : cashInput(e[key])}" required></label>`).join('')}</div><button class="btn primary">Обновить расчёт</button></form>
    </section></div>`;
}

const eventLabels = {
  'order.created': 'Заказ создан', 'payment.started': 'Оплата начата', 'payment.succeeded': 'Оплата подтверждена',
  'payment.declined': 'Подтверждение отменено', 'order.cancelled': 'Заказ отменён',
  'refund.requested': 'Возврат запрошен', 'refund.succeeded': 'Возврат подтверждён',
  'merchant.refund': 'Возврат отправлен партнёру', 'merchant.ready': 'Заказ готов', 'merchant.deliver': 'Заказ выдан',
  'merchant.payout': 'Выплата подтверждена', 'product.price-updated': 'Цена обновлена',
  'seller.started': 'Подключение начато', 'seller.details': 'Запрошены сведения', 'seller.partner': 'Переход к партнёру',
  'seller.registered': 'Статус подтверждён', 'seller.ineligible': 'Требуется другой статус',
  'seller.review': 'Подключение на проверке', 'seller.connected': 'Оплата подключена', 'seller.paused': 'Оплата приостановлена',
};

function admin() {
  const { events, paid, discrepancies, seller } = state.admin;
  return `${heading('Сверка платежей', 'Журнал тестового партнёра', button('Обновить сверку', 'refresh', { kind: 'secondary' }))}
    <div class="metrics three">
      ${tile('Подтверждено платежей', paid, 'По событиям партнёра и реестру', 'check')}
      ${tile('Расхождения', discrepancies, 'По суммам и идентификаторам', 'shield')}
      ${tile('Статус магазина', stageLabel[seller.stage], 'Керамика «Форма»', 'shop')}
    </div>
    ${seller.stage === 'connected' ? `<div class="panel control-bar"><div><strong>Проверка утраты статуса</strong><p>Приостановит новые оплаты в демо-магазине.</p></div>${button('Смоделировать утрату статуса', 'pause-prompt', { kind: 'secondary' })}</div>` : ''}
    <section class="panel registry"><div class="registry-head"><h2>Последние события</h2></div>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Журнал событий"><table><thead><tr><th>Событие</th><th>Заказ</th><th>Сумма</th><th>Время</th></tr></thead><tbody>
      ${events.map((e) => {
        const data = JSON.parse(e.data);
        return `<tr><td>${safe(eventLabels[e.name] ?? e.name)}</td><td>${e.order_id ? `<a class="order-link" href="#/orders/${encodeURIComponent(e.order_id)}">${safe(e.order_id)}</a>` : '—'}</td><td>${data.amount === undefined ? '—' : rub(data.amount)}</td><td>${datetime(e.created)}</td></tr>`;
      }).join('')}</tbody></table></div>
    </section>`;
}

function errorPanel(message) {
  return `<section class="panel section"><h1>Не удалось открыть экран</h1><p>${safe(message)}</p><a class="btn primary" href="#/shop">На витрину</a></section>`;
}

const pages = { shop, cart: cartPage, purchases, product, seller, price: pricePage, chat, checkout, receipt, orders, analytics, admin };
function render(page = current()) {
  const [, key] = route();
  main.innerHTML = page === 'orders' && key ? orderDetail(decodeURIComponent(key)) : (Object.hasOwn(pages, page) ? pages[page]() : errorPanel('Такого раздела нет.'));
}

function needsPoll() {
  const o = state.order;
  return current() === 'checkout' && (o?.status === 'pending' && o.bankConfirmed ||
    o?.status === 'paid' && ['requested', 'processing'].includes(o.refund));
}

function startPoll(version) {
  clearTimeout(poll);
  if (!needsPoll()) return;
  poll = setTimeout(async () => {
    try {
      const order = await api('checkout/' + state.order.token);
      if (version !== routeVersion) return;
      if (order.status !== state.order.status || order.refund !== state.order.refund) {
        state.order = order;
        render();
        if (order.status === 'paid') toast('Оплата подтверждена');
        if (order.status === 'refunded') toast('Возврат оформлен');
      }
    } catch (error) {
      if (version === routeVersion) toast(error.message, true);
    } finally {
      if (version === routeVersion) startPoll(version);
    }
    }, state.order.refund === 'requested' ? 1800 : 700);
}

async function load({ focus = true } = {}) {
  const version = ++routeVersion;
  clearTimeout(poll);
  if (dialog.open) dialog.close();
  const [path = 'shop', key] = route();
  chrome(path);
  main.setAttribute('aria-busy', 'true');
  if (focus) main.innerHTML = '<p class="loading">Загружаем…</p>';
  try {
    const query = {
      shop: ['store'], cart: ['cart','store'], purchases: ['purchases'], product: ['store', 'faq'], price: ['store'], seller: ['seller'], chat: ['store', 'chatOrders', 'questions'],
      checkout: ['order'], receipt: ['order'], orders: ['merchant'], analytics: ['merchant'], admin: ['admin'],
    };
    const endpoint = { faq: 'faq/' + encodeURIComponent(key ?? ''), order: 'checkout/' + encodeURIComponent(key ?? ''), chatOrders: 'chat' };
    const entries = await Promise.all((Object.hasOwn(query, path) ? query[path] : []).map(async (field) => {
      if (field === 'order' && path === 'checkout') return [field, await api(endpoint.order + '/visit', {})];
      return [field, await api(endpoint[field] ?? field)];
    }));
    if (version !== routeVersion) return;
    Object.assign(state, Object.fromEntries(entries));
    if (path === 'product') {
      if (state.item?.id !== key) {
        state.quantity = key === 'cups' ? 2 : 1;
        state.variant = 0;
      }
      state.item = state.store.catalog.find((item) => item.id === key);
      if (state.item) await api('view/' + key, {});
      if (version !== routeVersion) return;
    }
    if (path === 'checkout' && state.order.method) state.method = state.order.method;
    if (path === 'checkout' && !state.order.method) state.method = 'card';
    chrome(path);
    render(path);
    startPoll(version);
  } catch (error) {
    if (version === routeVersion) main.innerHTML = errorPanel(error.message);
  } finally {
    if (version === routeVersion) {
      main.setAttribute('aria-busy', 'false');
      if (focus) {
        window.scrollTo(0, 0);
        main.focus({ preventScroll: true });
      }
    }
  }
}

function toast(message, error = false) {
  const element = document.querySelector('#toast');
  element.className = error ? 'toast visible error' : 'toast visible';
  element.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.className = ''; element.textContent = ''; }, 4500);
}

function confirmDialog(title, note, label, action) {
  dialog.setAttribute('aria-label', title);
  dialog.innerHTML = `<div class="dialog-inner"><button class="icon-btn dialog-close" data-action="close-dialog" aria-label="Закрыть">${icon('x')}</button>
    <h2>${title}</h2><p class="muted">${note}</p><div class="inline-actions">${button(label, action)}${button('Назад', 'close-dialog', { kind: 'secondary' })}</div></div>`;
  dialog.showModal();
}

async function act(control, work) {
  if (state.busy) return;
  state.busy = true;
  control.disabled = true;
  try {
    await work(routeVersion);
  } catch (error) {
    toast(error instanceof RequestError ? error.message : 'Проверьте связь с сервером и повторите.', true);
  } finally {
    state.busy = false;
    if (control.isConnected) control.disabled = false;
  }
}

function patchShop(control, action) {
  if (action === 'quantity') {
    main.querySelector('output').value = state.quantity;
    main.querySelector('[data-action="quantity:-1"]').disabled = state.quantity === 1;
    main.querySelector('[data-action="quantity:1"]').disabled = state.quantity === 8;
    main.querySelector('[data-action="buy"]').textContent = 'Купить сейчас за ' + rub(state.item.price * state.quantity);
  } else {
    for (const chip of main.querySelectorAll('.chip')) {
      const selected = chip === control;
      chip.classList.toggle('selected', selected);
      chip.setAttribute('aria-pressed', selected);
    }
  }
}

document.addEventListener('click', (event) => {
  const control = event.target.closest('button[data-action]');
  if (!control) return;
  const [action, arg] = control.dataset.action.split(':');
  if (action === 'focus-offer') {
    main.querySelector('form[data-form="chat"] input[name="title"]').focus();
    return;
  }
  if (action === 'clear-filters') {
    Object.assign(filters, { search: '', category: '', min: '', max: '', sort: 'default' });
    render();
    main.querySelector('.catalog-search').focus();
    return;
  }
  if (action === 'quantity' || action === 'variant') {
    if (action === 'quantity') state.quantity += Number(arg);
    else state.variant = Number(arg);
    patchShop(control, action);
    return;
  }
  if (action === 'close-dialog') { dialog.close(); return; }
  const prompts = {
    'restart-prompt': ['Начать подключение заново?', 'Приём новых платежей приостановится до завершения подключения. Заказы сохранятся.', 'Начать заново', 'seller:restart'],
    'pause-prompt': ['Приостановить оплату?', 'Новые платежи будут недоступны до повторной проверки продавца.', 'Приостановить', 'seller:pause'],
    'cancel-prompt': ['Отменить заказ?', 'Платёж по этому заказу станет недоступен.', 'Отменить заказ', 'checkout:cancel'],
    'refund-prompt': ['Запросить возврат?', 'Продавец получит запрос на возврат полной суммы исходным способом оплаты.', 'Отправить запрос', 'checkout:request-refund'],
    'merchant-refund': ['Оформить полный возврат?', 'Тестовый партнёр вернёт покупателю всю сумму. Эквайринг будет удержан.', 'Оформить возврат', 'merchant:refund'],
  };
  if (Object.hasOwn(prompts, action)) { confirmDialog(...prompts[action]); return; }
  const perform = async (version) => {
    if (action === 'cart-add') {
      await api('cart/add', { productId: state.item.id, variant: state.item.variants[state.variant], quantity: state.quantity });
      if (version === routeVersion) toast('Товар добавлен в корзину');
    } else if (action === 'cart-checkout' || ['cart-plus','cart-minus','cart-remove'].includes(action)) {
      try {
        const cart = state.cart;
        if (action === 'cart-checkout') {
          const o = await api('cart/checkout', {revision: cart.revision, total: cart.total, units: cart.lines.map((l) => l.unit)});
          if (version === routeVersion) go('checkout/' + o.token);
        } else {
          const line = cart.lines[Number(arg)];
          const quantity = action === 'cart-remove' ? 0 : line.quantity + (action === 'cart-plus' ? 1 : -1);
          await api('cart/set', {revision: cart.revision, productId: line.productId, variant: line.variant, quantity});
          if (version === routeVersion) await load({focus: false});
        }
      } catch (error) {
        if (version === routeVersion) await load({focus: false});
        throw error;
      }
    } else if (action === 'buy') {
      try {
        const next = await api('orders/store', { quantity: state.quantity, productId: state.item.id, variant: state.item.variants[state.variant], unit: state.item.price });
        if (version === routeVersion) go('checkout/' + next.token);
      } catch (error) {
        if (version === routeVersion) await load({ focus: false });
        throw error;
      }
    } else if (action === 'choose' || action === 'seller') {
      await api(action === 'choose' ? 'seller/choose' : 'seller/' + arg, action === 'choose' ? { kind: arg } : {});
      if (version !== routeVersion) return;
      if (arg === 'pause') { await load({ focus: false }); toast('Приём оплаты приостановлен'); }
      else await load({ focus: false });
    } else if (action === 'checkout') {
      await api('checkout/' + state.order.token + '/' + arg, { method: state.method });
      if (version === routeVersion) await load({ focus: false });
    } else if (action === 'merchant') {
      await api('merchant/' + route()[1] + '/' + arg, {});
      if (version === routeVersion) {
        await load({ focus: false });
        toast(arg === 'refund' ? 'Возврат отправлен партнёру' : 'Статус обновлён');
        if (arg === 'refund') {
          const refundVersion = routeVersion;
          clearTimeout(poll);
          poll = setTimeout(() => { if (refundVersion === routeVersion) void load({ focus: false }); }, 2400);
        }
      }
    } else if (action === 'refresh') {
      await load({ focus: false });
      toast('Сверка обновлена');
    }
  };
  void act(control, perform);
});

const asCents = (value) => Math.round(Number(value) * 100);
const formHandlers = {
  ask: (f) => api('questions', { productId: state.item.id, variant: state.item.variants[state.variant], question: f.question }),
  reply: (f) => api('questions/' + f.id + '/reply', { reply: f.reply }),
  publish: (f) => api('questions/' + f.id + '/publish', { question: f.question, answer: f.answer }),
  unpublish: (f) => api('questions/' + f.id + '/unpublish', {}),
  eligibility: (f) => api('seller/details', { eligible: f.activity === 'own' && f.regime === 'eligible', agreed: f.agreed === 'on' }),
  'verify-existing': (f) => api('seller/details', { agreed: f.agreed === 'on' }),
  register: (f) => api('seller/register', { agreed: f.agreed === 'on' }),
  permissions: (f) => api('seller/permissions', { payouts: f.payouts === 'on', receipts: f.receipts === 'on' }),
  price: (f) => api('price', { base: asCents(f.base) }),
  chat: (f) => api('orders/chat', { ...f, quantity: Number(f.quantity), hours: Number(f.hours), total: asCents(f.total), shipping: asCents(f.shipping) }),
  economy: (f) => api('economy', Object.fromEntries(Object.entries(f).map(([key, value]) => [key, key === 'externalCount' ? Number(value) : asCents(value)]))),
};
document.addEventListener('submit', (event) => {
  const form = event.target;
  const handler = formHandlers[form.dataset.form];
  if (!handler) return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  void act(event.submitter ?? form.querySelector('button'), async (version) => {
    const result = await handler(values);
    if (version !== routeVersion) return;
    if (form.dataset.form === 'ask') {
      go('chat/' + result.id);
      toast('Вопрос отправлен продавцу');
      return;
    }
    await load({ focus: false });
    const messages = { reply: 'Ответ отправлен', publish: 'Ответ опубликован в карточке', unpublish: 'Ответ снят с публикации', price: 'Цена сохранена', chat: 'Заказ отправлен на оплату', economy: 'Расчёт обновлён' };
    if (messages[form.dataset.form]) toast(messages[form.dataset.form]);
  });
});

document.addEventListener('change', (event) => {
  const field = event.target;
  if (field.name === 'method') state.method = field.value;
  if (field.id === 'fulfillment') document.querySelector('#shipping-field').hidden = field.value !== 'delivery';
});

document.addEventListener('input', (event) => {
  const field = event.target;
  if (field.dataset.filter) {
    filters[field.dataset.filter] = field.value;
    const items = matchingProducts();
    document.querySelector('#catalog-grid').innerHTML = catalogCards(items);
    document.querySelector('#catalog-count').textContent = items.length;
    return;
  }
  if (field.name !== 'base') return;
  const base = asCents(field.value);
  const ok = base >= 100 && base <= 10000000 && field.validity.valid;
  document.querySelector('#price-preview').textContent = ok ? rub(Math.round(base * 10000 / (10000 - state.store.vkRate))) : '—';
  document.querySelector('#fee-preview').innerHTML = ok ? feePreview(base) : '<p class="muted">Укажите сумму от 1 до 100 000 ₽.</p>';
});

document.querySelector('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  main.focus();
});
window.addEventListener('hashchange', () => void load());
void load({ focus: false });
