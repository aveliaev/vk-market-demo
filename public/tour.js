const steps = [
  ['shop', '.friend-sticker', 'Знакомый выбор помогает решиться', 'Видно, какие товары уже купили друзья.'],
  ['shop', '.catalog-card[href="#/product/plate"]', 'Срок понятен ещё в каталоге', 'Индивидуальный товар отмечен отдельно. Максимальный срок изготовления виден до открытия карточки.'],
  ['product/cups', '.product-actions', 'От выбора сразу к покупке', 'Готовый товар можно оформить через корзину или купить сразу.'],
  ['product/plate', '.production-time', 'Сначала согласуем детали', 'Покупатель заранее видит максимальный срок и обсуждает заказ с мастером.'],
  ['cart', '.cart-line', 'Несколько товаров — один заказ', 'Количество и состав можно изменить перед оформлением.'],
  ['checkout/tour-stock', '.delivery-fields', 'Добавили выбор получения', 'Самовывоз или пункт выдачи. Стоимость и срок видны до оплаты.'],
  ['checkout/tour-custom', '.checkout-summary .checkout-block', 'Два срока показаны отдельно', 'Когда мастер закончит работу и когда покупатель получит заказ.'],
  ['checkout/tour-stock', '.payment-choices', 'Способ оплаты выбирает покупатель', 'Карта, СБП и VK Кошелёк доступны на одном экране.'],
  ['checkout/tour-stock', '#cashback-preview', 'Выгода видна в рублях', 'Сумма кешбэка показана перед оплатой.'],
  ['checkout/tour-paid', '.payment-panel .inline-actions', 'Результат покупки под рукой', 'Подтверждение оплаты и чек доступны в заказе.'],
  ['receipt/tour-paid', '.receipt-panel h2', 'Чек можно открыть снова', 'Состав покупки, сумма и способ оплаты сохранены в деталях заказа.'],
  ['purchases', '.purchase-record .registry-head', 'История покупки сохраняется', 'Можно вернуться к заказу, проверить статус и открыть чек.'],
  ['chat', '.chat-order', 'Договорённость превращается в заказ', 'Мастер фиксирует цену и дату. Покупатель переходит к оплате из переписки.'],
  ['seller', '.progress', 'Подключение по шагам', 'Продавец видит, что уже готово и что нужно сделать дальше.'],
  ['price', '#fee-preview .detail-row.emphasis', 'Продавец заранее видит расчёт', 'Комиссии и ожидаемая выплата показаны до сохранения цены.'],
  ['orders', '.registry tbody tr', 'Все заказы в одном реестре', 'Видно, какие покупки оплачены и что нужно подготовить или выдать.'],
  ['analytics', '.metrics.four', 'Понятно, как идут продажи', 'Продавец видит доход, долю оплат и конверсию.'],
  ['analytics', '.funnel-steps', 'Видно, где покупатели останавливаются', 'Воронка показывает путь от открытия товара до оплаты.'],
  ['post', '.post-suggestion', 'Пост помогает перейти к покупке', 'Продавцу предлагаем прикрепить готовый товар, когда каталог и оплата подключены.'],
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
  let target;
  let frame;

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
      store: {...store, eligible: true}, merchant, posts: [], faq: [],
      seller: {...merchant.seller, stage: 'connected', payouts: true, receipts: true, registered: true},
      questions: [], chatOrders: [custom], purchases: [paid],
      cart: {lines: base.lines, total: base.total, revision: 'tour'},
      orders: {'tour-stock': base, 'tour-custom': custom, 'tour-paid': paid},
    };
  }

  function dataFor(field, key) {
    if (!active || !preview) return undefined;
    return field === 'order' ? preview.orders[key] : preview[field];
  }

  function pointArrow(card, ring) {
    const path = root.querySelector('.tour-arrow path');
    if (!path) return;
    const c = card.getBoundingClientRect();
    const r = ring.getBoundingClientRect();
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
      path.setAttribute('d', '');
      return;
    }
    const [sx, sy] = start;
    const [ex, ey] = end;
    const [dx, dy] = direction;
    const gap = Math.abs((ex - sx) * dx + (ey - sy) * dy);
    const bend = Math.min(36, gap / 2);
    const c1x = sx + dx * bend;
    const c1y = sy + dy * bend;
    const c2x = ex - dx * bend;
    const c2y = ey - dy * bend;
    const angle = Math.atan2(dy, dx);
    const wing = (offset) => [ex - 11 * Math.cos(angle+offset), ey - 11 * Math.sin(angle+offset)];
    const a = wing(.5);
    const b = wing(-.5);
    path.setAttribute('d', `M ${sx} ${sy} C ${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey} M ${a[0]} ${a[1]} L ${ex} ${ey} L ${b[0]} ${b[1]}`);
  }

  function place() {
    if (!active || !target?.isConnected) return;
    const ring = root.querySelector('.tour-marker');
    const card = root.querySelector('.tour-card');
    if (!ring || !card) return;
    const rect = target.getBoundingClientRect();
    const padX = Math.max(18, rect.width * .05);
    const padY = Math.max(16, rect.height * .05);
    Object.assign(ring.style, {left: rect.left - padX + 'px', top: rect.top - padY + 'px', width: rect.width + 2 * padX + 'px', height: rect.height + 2 * padY + 'px'});
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const gap = Math.max(padX, padY) + 48;
    const positions = [
      [rect.right + gap, rect.top],
      [rect.left - width - gap, rect.top],
      [rect.right - width, rect.bottom + gap],
      [rect.right - width, rect.top - height - gap],
    ];
    const fits = ([x,y]) => x >= 16 && x + width <= innerWidth - 16 && y >= 70 && y + height <= innerHeight - 16;
    const [x,y] = positions.find(fits) ?? [innerWidth - width - 20, innerHeight - height - 20];
    card.style.left = Math.max(16,x) + 'px';
    card.style.top = Math.max(70,y) + 'px';
    pointArrow(card, ring);
  }

  async function show(next) {
    root.classList.remove('tour-positioned');
    index = next;
    const ticket = ++version;
    target = null;
    root.innerHTML = '<div class="tour-shade"></div><p class="tour-loading" role="status">Открываем следующий раздел…</p>';
    const [route, selector, title, description] = steps[index];
    await navigate(route);
    if (!active || ticket !== version) return;
    if (index === 8) {
      state.method = 'wallet';
      const radio = document.querySelector('[name="method"][value="wallet"]');
      if (radio) radio.checked = true;
      document.querySelector('#cashback-preview').hidden = false;
    }
    target = document.querySelector(selector);
    const shape = target ? markerShape(target) : 'circle';
    root.innerHTML = `<div class="tour-shade"></div>
      <img class="tour-marker" data-shape="${shape}" src="${markerAssets[shape]}" alt="" aria-hidden="true">
      <svg class="tour-arrow" aria-hidden="true"><path pathLength="1" /></svg>
      <section class="tour-card" role="dialog" aria-label="Обзор улучшений" aria-modal="true" tabindex="-1">
        <div class="tour-card-head"><span>Что мы улучшили · ${index + 1} / ${steps.length}</span><button type="button" data-tour="close" aria-label="Закрыть обзор">×</button></div>
        <h2>${title}</h2><p>${description}</p>
        <div class="tour-controls"><button type="button" data-tour="back" ${index ? '' : 'disabled'}>Назад</button><button type="button" class="tour-next" data-tour="next">${index === steps.length - 1 ? 'Завершить' : 'Дальше'} <span aria-hidden="true">→</span></button></div>
      </section>`;
    if (target) {
      const rect = target.getBoundingClientRect();
      if (rect.top < 100 || rect.bottom > innerHeight - 60) {
        const y = Math.max(0, scrollY + rect.top - 100);
        window.scrollTo({left: 0, top: y, behavior: 'instant'});
      }
    }
    if (target) {
      const rect = target.getBoundingClientRect();
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
        <div class="tour-card-head"><span>Что мы улучшили</span><button type="button" data-tour="close" aria-label="Закрыть обзор">×</button></div>
        <h2>${failed ? 'Не удалось открыть обзор' : 'Готовим обзор улучшений'}</h2>
        <p role="status">${message}</p>
        ${failed ? '<div class="tour-controls"><button type="button" data-tour="retry">Попробовать снова</button></div>' : '<div class="tour-load-progress" aria-hidden="true"></div>'}
      </section>`;
    root.querySelector('.tour-card').focus({preventScroll: true});
  }

  async function start() {
    if (active || trigger.disabled) return;
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
    target = null;
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
  trigger.addEventListener('click', () => void start());
  return {dataFor, get active() {return active;}};
}
