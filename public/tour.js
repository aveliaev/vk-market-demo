import { DAY, createProtectedOrder, transitionProtectedOrder } from './protection-model.js';

const steps = [
  ['deal/tour-protection-before', '.deal-protected-payment', 'Защита понятна до предоплаты', 'Рядом с кнопкой оплаты заранее объясняем защиту: если товар не придёт или окажется другим, покупатель сможет открыть спор и запросить возврат.', 'new', {shape: 'frame', padX: 22, padY: 12}],
  ['deal/tour-protection-held', '.deal-money', 'Деньги удерживаются до проверки', 'В этом концепте после оплаты деньги остаются у платёжного партнёра. Продавец видит подтверждение и может отправлять заказ, но выплата ждёт приёмки или окончания 48 часов проверки без спора.', 'new', {shape: 'frame', padX: 20, padY: 18}],
  ['deal/tour-protection-dispute', '.deal-dispute-details', 'Спор останавливает выплату', 'Вместо кружек пришёл другой товар. Покупатель описывает проблему и запрашивает возврат. Обращение принято, деньги остаются у партнёра, а у продавца выплата приостановлена до решения.', 'new', {shape: 'frame', padX: 22, padY: 22}],
  ['deal/tour-protection-payout', '.deal-finance', 'После проверки — выплата магазину', 'Если покупатель подтвердил приёмку или 48 часов истекли без спора, заказ завершается. Из оплаты 2 690 ₽ магазин получает 2 595,85 ₽ после комиссий. Обе стороны видят один заказ и общие события.', 'new', {shape: 'frame', padX: 22, padY: 22}],
  ['shop', '.friend-sticker', 'Покупки друзей — у конкретного товара', 'Социальная метка уже есть в VK. В концепте размещаем её на конкретном товаре, чтобы помочь с выбором в каталоге.', 'improvement'],
  ['shop', '.catalog-card[href="#/product/plate"]', 'Срок изготовления виден в каталоге', 'У индивидуального товара отдельно показываем максимальный срок изготовления. Покупатель оценивает ожидание ещё до открытия карточки.', 'improvement'],
  ['product/plate', ['.production-time', '.product-actions [data-action="compose"]'], 'Индивидуальный заказ сначала обсуждаем', 'Переписка с продавцом уже доступна в VK. Дорабатываем сценарий: рядом с максимальным сроком предлагаем согласовать детали и дату изготовления.', 'improvement'],
  ['checkout/tour-stock', '.delivery-before-payment', 'Стоимость и срок — до оплаты', 'Выбор доставки в VK уже есть. Наша доработка — один понятный блок с местом, сроком и стоимостью получения до подтверждения платежа.', 'improvement'],
  ['checkout/tour-custom', '.delivery-before-payment', 'Два срока для индивидуального заказа', 'Предлагаем отдельно показывать согласованную дату готовности изделия и срок его получения. Время изготовления не смешивается с доставкой.', 'new'],
  ['checkout/tour-stock', '.payment-choices', 'Понятный общий чекаут', 'Способы оплаты уже существуют. В концепте собираем их на одном экране с условиями получения и общей суммой заказа.', 'improvement'],
  ['checkout/tour-stock', '#cashback-preview', 'Выгода показана до подтверждения', 'Кешбэк VK уже существует. Дорабатываем его подачу: покупатель сразу видит ожидаемую сумму для этого заказа.', 'improvement'],
  ['chat/tour-question', '.chat-order-builder', 'Фиксируем договорённости перед оплатой', 'Карточка с кнопкой оплаты в VK уже есть. Наша доработка — продавец сначала фиксирует состав, цену и дату готовности индивидуального заказа, затем отправляет его на оплату.', 'improvement'],
  ['seller', '.progress', 'Понятнее путь подключения', 'Подключение оплаты и работа с самозанятыми уже существуют. В концепте делаем этапы, текущий статус и оставшиеся действия видимыми в одном месте.', 'improvement'],
  ['price', '#fee-preview', 'Расчёт выплаты при настройке цены', 'Дорабатываем настройку цены: заранее показываем комиссии и ожидаемую выплату по каждому способу оплаты.', 'improvement', {shape: 'frame', padX: 32, padY: 36}],
  ['analytics', '.chat-sales-metrics', 'Отдельный учёт заказов из переписки', 'Базовые показатели магазина уже есть в VK. Предлагаем отдельно считать отправленные из чата заказы, открытия оформления и оплаты, чтобы оценивать этот сценарий.', 'new'],
  ['analytics', '.seller-economy-inputs', 'Учитываем внешние продажи и расходы', 'Предлагаем дополнять данные магазина внешними продажами, себестоимостью и расходами на продвижение. Они участвуют в расчёте доли продаж и дохода продавца.', 'new'],
  ['post', '.post-suggestion', 'Подсказка в подходящий момент', 'Прикрепление товара к посту уже есть. Предлагаем подсказку продавцу с активным каталогом и оплатой: прикрепить именно товар в наличии.', 'new'],
];

const markerAssets = {
  pill: './assets/tour-marker-pill.png',
  circle: './assets/tour-marker-circle.png',
  frame: './assets/tour-marker-frame.png',
};

function markerShape(element) {
  const {width, height} = element.getBoundingClientRect();
  if (height <= 80 && width / height >= 3.5) return 'pill';
  return width / height < 1.3 ? 'circle' : 'frame';
}

export function tourArrowPath(c, r) {
  const centerX = r.left + r.width / 2;
  const centerY = r.top + r.height / 2;
  const edgeX = Math.max(c.left + 18, Math.min(c.right - 18, centerX));
  const edgeY = Math.max(c.top + 18, Math.min(c.bottom - 18, centerY));
  let start, end, direction;
  if (c.left >= r.right) {
    start = [c.left - 5, edgeY];
    end = [r.right + 5, centerY];
    direction = [-1, 0];
  } else if (c.right <= r.left) {
    start = [c.right + 5, edgeY];
    end = [r.left - 5, centerY];
    direction = [1, 0];
  } else if (c.top >= r.bottom) {
    start = [edgeX, c.top - 5];
    end = [centerX, r.bottom + 5];
    direction = [0, -1];
  } else if (c.bottom <= r.top) {
    start = [edgeX, c.bottom + 5];
    end = [centerX, r.top - 5];
    direction = [0, 1];
  } else {
    return '';
  }
  let departure = direction;
  // For a target above or below a neighbouring card, turn once from the
  // nearest horizontal edge instead of squeezing an S-curve into the gap.
  if (direction[0] && centerY > c.bottom + 18) {
    start = [direction[0] > 0 ? c.right - 18 : c.left + 18, c.bottom + 5];
    departure = [0, 1];
  } else if (direction[0] && centerY < c.top - 18) {
    start = [direction[0] > 0 ? c.right - 18 : c.left + 18, c.top - 5];
    departure = [0, -1];
  } else if (direction[1] && centerX < c.left - 18) {
    start = [c.left - 5, direction[1] > 0 ? c.bottom - 18 : c.top + 18];
    departure = [-1, 0];
  } else if (direction[1] && centerX > c.right + 18) {
    start = [c.right + 5, direction[1] > 0 ? c.bottom - 18 : c.top + 18];
    departure = [1, 0];
  }
  const [sx, sy] = start;
  const [ex, ey] = end;
  const [dx, dy] = direction;
  const bendX = Math.min(72, Math.abs(ex - sx) * .45);
  const bendY = Math.min(72, Math.abs(ey - sy) * .45);
  const c1x = sx + departure[0] * bendX;
  const c1y = sy + departure[1] * bendY;
  const c2x = ex - dx * bendX;
  const c2y = ey - dy * bendY;
  const angle = Math.atan2(dy, dx);
  const wing = (offset) => [ex - 11 * Math.cos(angle+offset), ey - 11 * Math.sin(angle+offset)];
  const a = wing(.5);
  const b = wing(-.5);
  return `M ${sx} ${sy} C ${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey} M ${a[0]} ${a[1]} L ${ex} ${ey} L ${b[0]} ${b[1]}`;
}

export function tourCardPosition(ring, width, height, viewportWidth, viewportHeight) {
  const gap = 48;
  const centerX = (ring.left + ring.right) / 2;
  const centeredLeft = Math.max(16, Math.min(viewportWidth - width - 16, centerX - width / 2));
  const sideTop = ring.top < 70 && ring.bottom > 70 ? 70 : ring.top;
  const positions = [
    [ring.right + gap, sideTop],
    [ring.left - width - gap, sideTop],
    [centeredLeft, ring.bottom + gap],
    [centeredLeft, ring.top - height - gap],
  ];
  const fits = ([x,y]) => x >= 16 && x + width <= viewportWidth - 16 && y >= 70 && y + height <= viewportHeight - 16;
  return positions.find(fits) ?? [viewportWidth - width - 20, Math.max(70, viewportHeight - height - 20)];
}

// Build tour scenes through the same transitions as the interactive demo.
// Each scene is independent; inspecting the tour never advances a live order.
export function protectedTourViews(now = Date.now()) {
  const change = (order, type, role, at = now, extra = {}) => transitionProtectedOrder(order, {type, role, ...extra}, at);
  const offer = createProtectedOrder('good', now);
  let paid = change(offer, 'checkout', 'buyer');
  paid = change(paid, 'pay', 'buyer');
  paid = change(paid, 'confirm-payment', 'buyer');
  const shipped = change(paid, 'ship', 'seller', now + DAY);
  const delivered = change(shipped, 'deliver', 'demo', now + 3 * DAY);
  const checkedAt = now + 3 * DAY + 3600000;
  const disputed = change({...delivered, scenario: 'different'}, 'report', 'buyer', checkedAt, {
    reason: 'different', description: 'Вместо двух кобальтовых кружек пришли тарелки. Прошу вернуть стоимость заказа и доставки.',
  });
  const completed = change(delivered, 'accept', 'buyer', checkedAt);
  return {
    'tour-protection-before': {order: offer, role: 'buyer', now},
    'tour-protection-held': {order: paid, role: 'buyer', now},
    'tour-protection-dispute': {order: disputed, role: 'buyer', now: checkedAt},
    'tour-protection-payout': {order: completed, role: 'seller', now: checkedAt},
  };
}

export function createFeatureTour({ api, navigate, state, onStart, onEnd }) {
  const root = document.createElement('div');
  root.className = 'feature-tour';
  root.hidden = true;
  document.body.append(root);
  const trigger = document.querySelector('#start-tour');
  let active = false;
  let index = 0;
  let version = 0;
  let originalHash;
  let preview;
  let targets = [];
  let frame;
  let welcoming = false;
  const welcomeKey = 'vk-market-phoenix-jury-welcome-v2';

  function rememberWelcome() {
    try { sessionStorage.setItem(welcomeKey, 'seen'); } catch { /* The tour also works without browser storage. */ }
  }

  function dismissWelcome(focus = true) {
    if (!welcoming) return;
    welcoming = false;
    ++version;
    rememberWelcome();
    targets = [];
    root.hidden = true;
    root.innerHTML = '';
    root.classList.remove('tour-welcome', 'tour-positioned');
    if (focus) trigger.focus();
  }

  async function welcome() {
    if (active || welcoming) return;
    try { if (sessionStorage.getItem(welcomeKey)) return; } catch { /* Show the introduction when storage is unavailable. */ }
    const ticket = version;
    const marker = new Image();
    marker.src = new URL(markerAssets.pill, import.meta.url).href;
    try { await marker.decode(); } catch { return; }
    if (active || ticket !== version) return;
    welcoming = true;
    targets = [trigger];
    root.hidden = false;
    root.classList.add('tour-welcome');
    root.innerHTML = `<div class="tour-shade"></div>
      <img class="tour-marker" data-shape="pill" src="${markerAssets.pill}" alt="" aria-hidden="true">
      <svg class="tour-arrow" aria-hidden="true"><path pathLength="1" /></svg>
      <section class="tour-card" role="dialog" aria-label="Обзор проекта для жюри" tabindex="-1">
        <div class="tour-card-head"><span>Команда «Феникс»</span><button type="button" data-tour="welcome-dismiss" aria-label="Закрыть приветствие">×</button></div>
        <h2>Уважаемые члены жюри!</h2>
        <p>Приглашаем вас пройти короткий интерактивный обзор и самостоятельно оценить улучшения магазина ВКонтакте. Первые четыре шага покажут защиту до оплаты, удержание денег, спор и выплату магазину.</p>
        <div class="tour-controls"><button type="button" class="tour-next" data-tour="welcome-start">Начать обзор <span aria-hidden="true">→</span></button><button type="button" data-tour="welcome-dismiss">Посмотреть самостоятельно</button></div>
      </section>`;
    requestAnimationFrame(() => {
      if (!welcoming || ticket !== version) return;
      place();
      root.classList.add('tour-positioned');
      root.querySelector('.tour-card').focus({preventScroll: true});
    });
  }

  function makePreview(store, merchant) {
    const item = store.catalog.find((entry) => entry.id === 'cups');
    const plate = store.catalog.find((entry) => entry.id === 'plate');
    const day = (offset) => new Date(Date.parse(plate.latestReady) + offset * 86400000).toISOString().slice(0, 10);
    const base = {
      id: 'Образец', token: 'tour-stock', source: 'store', productId: item.id,
      title: item.title, variant: item.variants[0], quantity: 2, unit: item.price,
      total: item.price * 2, amount: item.price * 2, shipping: 0, created: Date.now(),
      status: 'unpaid', statusLabel: 'Ожидает оплаты', fulfillment: 'Самовывоз из мастерской',
      fulfillmentStatus: 'new', receipt: 'missing', payout: 'waiting', refund: 'none',
      expires: Date.now() + 86400000, walletCashback: Math.round(item.price * 2 * .05),
      lines: [{productId: item.id, title: item.title, variant: item.variants[0], quantity: 2, unit: item.price, total: item.price * 2}],
      delivery: {id: 'studio-am', method: 'Самовывоз из мастерской', address: 'Мастерская «Форма»', fee: 0, from: day(-12), to: day(-12), hours: '10:00–14:00'},
    };
    base.deliveryOptions = [base.delivery, {id: 'point-central', method: 'Пункт выдачи', address: 'ПВЗ «Центр» · ул. Садовая, 8', fee: 29000, from: day(-10), to: day(-8)}];
    const paid = {...base, token: 'tour-paid', status: 'paid', statusLabel: 'Оплачен', method: 'wallet', paidAt: Date.now(), receipt: 'issued', deliveryOptions: []};
    const custom = {...base, token: 'tour-custom', source: 'chat', productId: plate.id, title: plate.title,
      variant: plate.variants[0], ready: plate.latestReady, quantity: 1, total: plate.price,
      amount: plate.price + 29000, shipping: 29000, fulfillment: 'Пункт выдачи', deliveryOptions: [],
      delivery: {method: 'Пункт выдачи', address: 'ПВЗ «Центр» · ул. Садовая, 8', from: day(2), to: day(4)},
      lines: [{productId: plate.id, title: plate.title, variant: plate.variants[0], quantity: 1, total: plate.price}]};
    return {
      store: {...store, eligible: true}, merchant, posts: [], faq: [], protected: protectedTourViews(),
      seller: {...merchant.seller, stage: 'connected', payouts: true, receipts: true, registered: true},
      questions: [{id: 'tour-question', product_id: plate.id, variant: plate.variants[0], question: 'Хочу тарелку с индивидуальной росписью. Согласуем состав, цену и дату готовности?', reply: 'Согласовали одну тарелку в кобальтовом цвете. Цена и дата готовности зафиксированы в заказе.'}], chatOrders: [{...custom, questionId: 'tour-question'}], purchases: [paid],
      cart: {lines: base.lines, total: base.total, revision: 'tour'},
      orders: {'tour-stock': base, 'tour-custom': custom, 'tour-paid': paid},
    };
  }

  function dataFor(field, key) {
    if (!active || !preview) return undefined;
    return field === 'order' ? preview.orders[key] : field === 'protected' ? preview.protected[key] : preview[field];
  }

  function place() {
    if ((!active && !welcoming) || !targets.length || targets.some((target) => !target.isConnected)) return;
    const rings = [...root.querySelectorAll('.tour-marker')];
    const paths = [...root.querySelectorAll('.tour-arrow path')];
    const card = root.querySelector('.tour-card');
    if (!rings.length || !card) return;
    const rects = targets.map((target) => target.getBoundingClientRect());
    const options = welcoming ? {} : steps[index][5] ?? {};
    rects.forEach((r, i) => {
      const padX = Math.max(options.padX ?? 18, r.width * .05);
      const padY = welcoming ? 6 : Math.max(options.padY ?? 16, r.height * .05);
      Object.assign(rings[i].style, {left: r.left - padX + 'px', top: r.top - padY + 'px', width: r.width + 2 * padX + 'px', height: r.height + 2 * padY + 'px'});
    });
    const bounds = rings.map((ring) => ring.getBoundingClientRect());
    const ringBounds = {
      left: Math.min(...bounds.map((r) => r.left)), right: Math.max(...bounds.map((r) => r.right)),
      top: Math.min(...bounds.map((r) => r.top)), bottom: Math.max(...bounds.map((r) => r.bottom)),
    };
    const [x,y] = tourCardPosition(ringBounds, card.offsetWidth, card.offsetHeight, innerWidth, innerHeight);
    card.style.left = Math.max(16,x) + 'px';
    card.style.top = Math.max(70,y) + 'px';
    rings.forEach((ring, i) => paths[i]?.setAttribute('d', tourArrowPath(card.getBoundingClientRect(), ring.getBoundingClientRect())));
  }

  async function show(next) {
    root.classList.remove('tour-positioned');
    index = next;
    const ticket = ++version;
    targets = [];
    root.innerHTML = '<div class="tour-shade"></div><p class="tour-loading" role="status">Открываем следующий раздел…</p>';
    const [route, selector, title, description, kind, marker = {}] = steps[index];
    await navigate(route);
    if (!active || ticket !== version) return;
    if (selector === '#cashback-preview') {
      state.method = 'wallet';
      const radio = document.querySelector('[name="method"][value="wallet"]');
      if (radio) radio.checked = true;
      document.querySelector('#cashback-preview').hidden = false;
    }
    targets = (Array.isArray(selector) ? selector : [selector]).map((entry) => document.querySelector(entry)).filter(Boolean);
    root.innerHTML = `<div class="tour-shade"></div>
      ${targets.map((target, i) => {
        const shape = marker.shape ?? markerShape(target);
        return `<img class="tour-marker" data-shape="${shape}" src="${markerAssets[shape]}" style="animation-delay: ${i * .3}s" alt="" aria-hidden="true">`;
      }).join('')}
      <svg class="tour-arrow" aria-hidden="true">${targets.map((_, i) => `<path pathLength="1" style="animation-delay: ${.65 + i * .3}s" />`).join('')}</svg>
      <section class="tour-card" role="dialog" aria-label="Обзор улучшений" aria-modal="true" tabindex="-1">
        <div class="tour-card-head"><span>Что улучшили. Шаг ${index + 1}/${steps.length}.</span><button type="button" data-tour="close" aria-label="Закрыть обзор">×</button></div>
        <span class="tour-kind ${kind === 'new' ? 'new' : ''}">${kind === 'new' ? 'Предлагаем новую функцию' : 'Улучшаем существующее'}</span>
        <h2>${title}</h2><p>${description}</p>
        <div class="tour-controls"><button type="button" data-tour="back" ${index ? '' : 'disabled'}>Назад</button><button type="button" class="tour-next" data-tour="next">${index === steps.length - 1 ? 'Завершить' : 'Дальше'} <span aria-hidden="true">→</span></button></div>
      </section>`;
    if (targets.length) {
      const rects = targets.map((target) => target.getBoundingClientRect());
      const rect = {top: Math.min(...rects.map((r) => r.top)), bottom: Math.max(...rects.map((r) => r.bottom))};
      if (rect.top < 100 || rect.bottom > innerHeight - 60) {
        const y = Math.max(0, scrollY + rect.top - 100);
        window.scrollTo({left: 0, top: y, behavior: 'instant'});
      }
    }
    if (targets.length) {
      const rect = targets[0].getBoundingClientRect();
      const left = Math.max(0, scrollX + rect.left + rect.width / 2 - innerWidth / 2);
      window.scrollTo({left, top: scrollY, behavior: 'instant'});
    }
    // Wait for the browser to measure the card before positioning it.
    requestAnimationFrame(() => {
      if (!active || ticket !== version) return;
      place();
      root.classList.add('tour-positioned');
      root.querySelector('.tour-card').focus({preventScroll: true});
    });
  }

  function loadingPanel(message, failed = false) {
    root.hidden = false;
    root.classList.add('tour-positioned');
    root.innerHTML = `<div class="tour-shade"></div>
      <section class="tour-card tour-loading-card" role="dialog" aria-modal="true" aria-label="Обзор улучшений" tabindex="-1">
        <div class="tour-card-head"><span>Что улучшили.</span><button type="button" data-tour="close" aria-label="Закрыть обзор">×</button></div>
        <h2>${failed ? 'Не удалось открыть обзор' : 'Готовим обзор улучшений'}</h2>
        <p role="status">${message}</p>
        ${failed ? '<div class="tour-controls"><button type="button" data-tour="retry">Попробовать снова</button></div>' : '<div class="tour-load-progress" aria-hidden="true"></div>'}
      </section>`;
    root.querySelector('.tour-card').focus({preventScroll: true});
  }

  async function start() {
    if (active || trigger.disabled) return;
    dismissWelcome(false);
    rememberWelcome();
    const ticket = ++version;
    const savedHash = location.hash;
    active = true;
    originalHash = savedHash;
    trigger.disabled = true;
    document.querySelector('.shell').inert = true;
    document.querySelector('.globalbar').inert = true;
    loadingPanel('Загружаем примеры и обводки. Первый шаг откроется автоматически.');
    let timeout;
    try {
      const markers = Object.values(markerAssets).map((src) => {
        const marker = new Image();
        marker.src = new URL(src, import.meta.url).href;
        return marker.decode();
      });
      const result = await Promise.race([
        Promise.all([api('store'), api('merchant'), ...markers]),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error('loading timeout')), 15000);
        }),
      ]);
      if (!active || version !== ticket) return;
      preview = makePreview(result[0], result[1]);
      onStart();
      await show(0);
    } catch (error) {
      if (active && version === ticket) {
        loadingPanel('Проверьте соединение и попробуйте снова.', true);
      }
    } finally {
      clearTimeout(timeout);
      trigger.disabled = false;
    }
  }

  async function close() {
    trigger.disabled = false;
    active = false;
    ++version;
    targets = [];
    root.hidden = true;
    root.innerHTML = '';
    document.querySelector('.shell').inert = false;
    document.querySelector('.globalbar').inert = false;
    if (preview) onEnd();
    preview = null;
    await navigate((originalHash || '#/shop').slice(2));
    trigger.focus();
  }

  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-tour]')?.dataset.tour;
    if (action === 'welcome-dismiss') dismissWelcome();
    if (action === 'welcome-start') void start();
    if (action === 'retry') {
      active = false;
      trigger.disabled = false;
      void start();
    }
    if (action === 'close') void close();
    if (action === 'back' && index) void show(index - 1);
    if (action === 'next') void (index === steps.length - 1 ? close() : show(index + 1));
  });
  document.addEventListener('keydown', (event) => {
    if (welcoming && event.key === 'Escape') { event.preventDefault(); dismissWelcome(); return; }
    if (!active) return;
    if (event.key === 'Escape') { event.preventDefault(); void close(); }
    if (event.key === 'Tab') {
      const controls = [...root.querySelectorAll('button:not(:disabled)')];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root.querySelector('.tour-card'))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }
  });
  const reposition = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(place);
  };
  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition, {passive:true});
  window.addEventListener('hashchange', () => dismissWelcome(false));
  trigger.addEventListener('click', () => void start());
  return {dataFor, welcome, get active() {return active;}};
}
