(() => {
  // ---------------------------------------------------------------------------
  // Hero slider
  // ---------------------------------------------------------------------------
  const heroSlides = [
    {
      image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1600&q=85',
      copy: ['上質なものが、', 'いつもの景色を', '美しく変えていく。']
    },
    {
      image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=1600&q=85',
      copy: ['毎日ふれるものに、', '心地よさという', '小さな贅沢を。']
    },
    {
      image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=85',
      copy: ['いつもの食卓に、', '記憶に残る', 'ひとときを。']
    }
  ];

  function initHeroSlider() {
    const hero = document.querySelector('.hero-visual');
    const count = document.getElementById('heroSlideCount');
    const prev = document.getElementById('heroPrev');
    const next = document.getElementById('heroNext');
    const copy = document.querySelector('.hero-side-copy');
    if (!hero || !count || !prev || !next) return;

    let index = 0;
    let timer = null;

    const render = (newIndex, animate = true) => {
      index = (newIndex + heroSlides.length) % heroSlides.length;
      const slide = heroSlides[index];
      const apply = () => {
        hero.style.backgroundImage = `linear-gradient(0deg,rgba(36,28,22,.06),rgba(36,28,22,.06)),url("${slide.image}")`;
        count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(heroSlides.length).padStart(2, '0')}`;
        if (copy) copy.innerHTML = slide.copy.map(line => `<p>${line}</p>`).join('');
      };
      if (!animate) return apply();
      hero.animate([{ opacity: .72 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
      apply();
    };

    const restart = () => {
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(() => render(index + 1), 7000);
    };

    prev.addEventListener('click', () => { render(index - 1); restart(); });
    next.addEventListener('click', () => { render(index + 1); restart(); });
    hero.addEventListener('mouseenter', () => timer && window.clearInterval(timer));
    hero.addEventListener('mouseleave', restart);
    hero.addEventListener('focusin', () => timer && window.clearInterval(timer));
    hero.addEventListener('focusout', restart);

    render(0, false);
    restart();
  }

  initHeroSlider();

  // ---------------------------------------------------------------------------
  // Supabase products
  // ---------------------------------------------------------------------------
  const cfg = window.ORDINARY_LUXE_DB_CONFIG;
  if (!cfg || !window.supabase) {
    const status = document.getElementById('dbStatus');
    if (status) {
      status.textContent = '商品データベースの接続設定を確認してください。';
      status.classList.add('error');
    }
    return;
  }

  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.publishableKey);
  const money = new Intl.NumberFormat('ja-JP', {
    style: 'currency', currency: 'JPY', maximumFractionDigits: 0
  });

  const oldFavs = JSON.parse(localStorage.getItem('luxeFavorites') || '[]');
  const newFavs = JSON.parse(localStorage.getItem('ordinaryLuxeFavorites') || '[]');
  const favorites = new Set([...oldFavs, ...newFavs]);
  const state = { category: 'すべて', query: '', sort: 'featured', favoritesOnly: false, specialCategory: '' };
  let products = [];

  const $ = id => document.getElementById(id);
  const els = {
    categoryGrid: $('categoryGrid'), featuredGrid: $('featuredGrid'),
    catalogGrid: $('catalogGrid'), specialCategoryTabs: $('specialCategoryTabs'),
    specialNewGrid: $('specialNewGrid'), specialCategoryTitle: $('specialCategoryTitle'),
    specialEmpty: $('specialEmpty'),
    filterRow: $('filterRow'), resultCount: $('resultCount'), dbStatus: $('dbStatus'),
    emptyState: $('emptyState'), catalogSearch: $('catalogSearch'), sortSelect: $('sortSelect'),
    favCount: $('favCount'), productDialog: $('productDialog'), dialogContent: $('dialogContent'),
    searchDialog: $('searchDialog'), globalSearchInput: $('globalSearchInput'), toast: $('toast'),
    mainNav: $('mainNav'), menuToggle: $('menuToggle')
  };

  const pick = (row, ...keys) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
    }
    return null;
  };

  function normalize(row) {
    const price = Number(pick(row, 'price_jpy', '値段', '価格') || 0);
    return {
      id: String(pick(row, 'id', 'product_code', '品番') || crypto.randomUUID()),
      code: pick(row, 'product_code', '商品コード') || '',
      department: pick(row, 'department', '部門', 'category', 'カテゴリ') || 'その他',
      name: pick(row, 'product_name', '品名', '商品名') || '名称未設定',
      country: pick(row, 'origin_country', '原産国') || '',
      price: Number.isFinite(price) ? price : 0,
      description: pick(row, 'description', '商品説明（高い理由）', '商品説明', '高い理由') || '',
      purchaseLink: pick(row, 'purchase_link', '購入リンク') || '',
      imageSource: pick(row, 'image_source') || 'supabase',
      imagePath: pick(row, 'image_path') || '',
      affiliateImageUrl: pick(row, 'affiliate_image_url') || '',
      externalImageUrl: pick(row, 'external_image_url') || '',
      imageUrl: pick(row, 'image_url') || '',
      imageStatus: pick(row, 'image_status') || '',
      affiliate: Boolean(pick(row, 'is_affiliate')),
      shopName: pick(row, 'shop_name') || '',
      checkedAt: pick(row, 'price_checked_at') || '',
      createdAt: pick(row, 'created_at', 'registered_at', '登録日時') || '',
      featured: pick(row, 'featured') !== false,
      status: pick(row, 'status') || ''
    };
  }

  const placeholderImage = () => 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="100%" height="100%" fill="#eee8de"/><text x="50%" y="48%" text-anchor="middle" dominant-baseline="middle" fill="#8b7a67" font-family="serif" font-size="42">ORDINARY LUXE</text><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" fill="#a99b8c" font-family="sans-serif" font-size="22">IMAGE NOT AVAILABLE</text></svg>`
  );

  function edgeImageUrl(p, proxy = false) {
    const fn = cfg.imageFunctionName || 'product-image';
    const endpoint = `${cfg.supabaseUrl}/functions/v1/${fn}`;
    const params = new URLSearchParams();
    if (p.code) params.set('product_code', p.code);
    else params.set('id', p.id);
    if (proxy) params.set('proxy', '1');
    // Refresh cached redirect after product metadata changes.
    if (p.checkedAt) params.set('v', p.checkedAt);
    return `${endpoint}?${params.toString()}`;
  }

  function primaryImageFor(p) {
    if (p.imageSource === 'affiliate' && p.affiliateImageUrl) return p.affiliateImageUrl;
    if (p.externalImageUrl) return p.externalImageUrl;
    if (p.imageUrl) return p.imageUrl;
    if (p.imagePath) return client.storage.from(cfg.storageBucket).getPublicUrl(p.imagePath).data.publicUrl;
    // No image URL is stored: ask Edge Function to resolve purchase page metadata.
    if (p.purchaseLink) return edgeImageUrl(p, false);
    return placeholderImage();
  }

  function imageMarkup(p, extraClass = '') {
    return `<img class="${extraClass}" src="${primaryImageFor(p)}" alt="${escapeHtml(p.name)}" loading="lazy" data-product-image="${escapeAttr(p.id)}">`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[ch]);
  }

  function escapeAttr(value) { return escapeHtml(value); }

  function attachImageFallbacks(root = document) {
    root.querySelectorAll('img[data-product-image]').forEach(img => {
      if (img.dataset.fallbackBound === '1') return;
      img.dataset.fallbackBound = '1';
      img.dataset.imageStage = 'primary';

      img.addEventListener('error', () => {
        const p = products.find(item => item.id === img.dataset.productImage);
        if (!p) {
          img.src = placeholderImage();
          return;
        }

        if (img.dataset.imageStage === 'primary' && p.purchaseLink && !p.affiliate) {
          // Stage 2: resolve og:image / JSON-LD and redirect to it.
          img.dataset.imageStage = 'resolved';
          img.src = edgeImageUrl(p, false);
          return;
        }

        if (img.dataset.imageStage !== 'proxy' && p.purchaseLink && !p.affiliate) {
          // Stage 3: some sites block hotlinking. Proxy through the Edge Function.
          // Use only for sources whose image terms allow display on your site.
          img.dataset.imageStage = 'proxy';
          img.src = edgeImageUrl(p, true);
          return;
        }

        img.dataset.imageStage = 'placeholder';
        img.src = placeholderImage();
      });
    });
  }

  function cats() {
    return [...new Set(products.map(p => p.department))].sort((a, b) => a.localeCompare(b, 'ja'));
  }

  function card(p, options = {}) {
    const fav = favorites.has(p.id);
    const showNew = Boolean(options.showNew);
    return `<article class="product-card">
      <button class="product-thumb" data-open="${escapeAttr(p.id)}">
        ${imageMarkup(p)}
        ${showNew ? '<span class="new-arrival-badge">NEW</span>' : ''}
      </button>
      <div class="product-info"><div>
        <button class="product-name-button" data-open="${escapeAttr(p.id)}">${escapeHtml(p.name)}</button>
        <p class="product-price">${money.format(p.price)}</p>
      </div><button class="heart-btn ${fav ? 'active' : ''}" data-fav="${escapeAttr(p.id)}" aria-label="お気に入り">${fav ? '♥' : '♡'}</button></div>
    </article>`;
  }

  function renderCategories() {
    const list = cats().slice(0, 8);
    els.categoryGrid.innerHTML = list.map(c => {
      const p = products.find(x => x.department === c);
      return `<a class="category-card" href="#catalogCards" data-category="${escapeAttr(c)}">
        ${p ? imageMarkup(p) : `<img src="${placeholderImage()}" alt="${escapeAttr(c)}">`}
        <span>${escapeHtml(c)}</span></a>`;
    }).join('');
    attachImageFallbacks(els.categoryGrid);
  }

  function renderFeatured() {
    els.featuredGrid.innerHTML = products.filter(p => p.featured)
      .sort((a, b) => b.price - a.price).slice(0, 8).map(card).join('');
    attachImageFallbacks(els.featuredGrid);
  }

  function productTimestamp(p) {
    const created = Date.parse(p.createdAt || '');
    if (Number.isFinite(created)) return created;
    const checked = Date.parse(p.checkedAt || '');
    if (Number.isFinite(checked)) return checked;
    return 0;
  }

  function newestDepartment() {
    const latest = [...products].sort((a, b) => productTimestamp(b) - productTimestamp(a))[0];
    return latest?.department || cats()[0] || '';
  }

  function renderSpecial() {
    if (!els.specialCategoryTabs || !els.specialNewGrid) return;
    const categories = cats();
    if (!categories.length) {
      els.specialCategoryTabs.innerHTML = '';
      els.specialNewGrid.innerHTML = '';
      if (els.specialEmpty) els.specialEmpty.hidden = false;
      return;
    }

    if (!state.specialCategory || !categories.includes(state.specialCategory)) {
      state.specialCategory = newestDepartment();
    }

    els.specialCategoryTabs.innerHTML = categories.map(category =>
      `<button class="special-category-tab ${state.specialCategory === category ? 'active' : ''}" data-special-category="${escapeAttr(category)}">${escapeHtml(category)}</button>`
    ).join('');

    const latest = products
      .filter(p => p.department === state.specialCategory)
      .sort((a, b) => productTimestamp(b) - productTimestamp(a))
      .slice(0, 4);

    if (els.specialCategoryTitle) {
      els.specialCategoryTitle.textContent = `${state.specialCategory}の新着商品`;
    }
    els.specialNewGrid.innerHTML = latest.map(p => card(p, { showNew: true })).join('');
    if (els.specialEmpty) els.specialEmpty.hidden = latest.length > 0;
    attachImageFallbacks(els.specialNewGrid);
  }

  function filtered() {
    let list = [...products];
    if (state.favoritesOnly) list = list.filter(p => favorites.has(p.id));
    if (state.category !== 'すべて') list = list.filter(p => p.department === state.category);
    if (state.query) {
      const q = state.query.toLowerCase();
      list = list.filter(p => [p.name, p.department, p.country, p.description, p.shopName].join(' ').toLowerCase().includes(q));
    }
    if (state.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    else if (state.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (state.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    else list.sort((a, b) => Number(b.featured) - Number(a.featured) || b.price - a.price);
    return list;
  }

  function renderFilters() {
    els.filterRow.innerHTML = ['すべて', ...cats()].map(c =>
      `<button class="filter-chip ${state.category === c ? 'active' : ''}" data-filter="${escapeAttr(c)}">${escapeHtml(c)}</button>`
    ).join('');
  }

  function renderCatalog() {
    const list = filtered();
    els.catalogGrid.innerHTML = list.map(card).join('');
    els.resultCount.textContent = `${list.length}件の商品を表示中${state.favoritesOnly ? ' ・ お気に入りのみ' : ''}`;
    els.emptyState.hidden = list.length > 0;
    els.favCount.textContent = favorites.size;
    renderFilters();
    attachImageFallbacks(els.catalogGrid);
  }

  function saveFavs() {
    localStorage.setItem('ordinaryLuxeFavorites', JSON.stringify([...favorites]));
    renderFeatured();
    renderSpecial();
    renderCatalog();
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function openProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const rel = p.affiliate ? 'nofollow sponsored noopener' : 'noopener';
    const label = p.shopName ? `${p.shopName}で見る` : '販売先で見る';
    els.dialogContent.innerHTML = `<div class="dialog-layout">
      ${imageMarkup(p)}
      <div class="dialog-body">
        <p class="dialog-label">${escapeHtml(p.department)}</p>
        <h2>${escapeHtml(p.name)}</h2>
        <p class="dialog-price">${money.format(p.price)}</p>
        <dl class="dialog-grid">
          <dt>原産国</dt><dd>${escapeHtml(p.country || '-')}</dd>
          <dt>価格確認日</dt><dd>${escapeHtml(p.checkedAt || '-')}</dd>
          <dt>販売先</dt><dd>${escapeHtml(p.shopName || '-')}</dd>
        </dl>
        <p class="dialog-description">${escapeHtml(p.description || '')}</p>
        ${p.status ? `<div class="reason-box"><strong>掲載情報</strong><p>${escapeHtml(p.status)}</p></div>` : ''}
        <div><button class="btn" data-fav="${escapeAttr(p.id)}">${favorites.has(p.id) ? '♥ お気に入り済み' : '♡ お気に入り'}</button>
        ${p.purchaseLink ? `<a class="purchase-button" href="${escapeAttr(p.purchaseLink)}" target="_blank" rel="${rel}">${escapeHtml(label)}</a>` : ''}</div>
      </div></div>`;
    attachImageFallbacks(els.dialogContent);
    els.productDialog.showModal();
  }

  async function load() {
    els.dbStatus.textContent = 'Supabaseから商品を読み込んでいます…';
    const { data, error } = await client.from(cfg.table).select('*').eq('is_active', true);
    if (error) {
      els.dbStatus.textContent = `商品データを取得できません: ${error.message}`;
      els.dbStatus.classList.add('error');
      return;
    }
    products = (data || []).map(normalize);
    els.dbStatus.textContent = `Supabaseから${products.length}件の商品を読み込みました。`;
    renderCategories(); renderFeatured(); renderSpecial(); renderCatalog();
  }

  document.addEventListener('click', e => {
    const cat = e.target.closest('[data-category]');
    if (cat) { state.category = cat.dataset.category; state.favoritesOnly = false; renderCatalog(); }

    const filter = e.target.closest('[data-filter]');
    if (filter) { state.category = filter.dataset.filter; state.favoritesOnly = false; renderCatalog(); }

    const specialCategory = e.target.closest('[data-special-category]');
    if (specialCategory) { state.specialCategory = specialCategory.dataset.specialCategory; renderSpecial(); }

    const open = e.target.closest('[data-open]');
    if (open) openProduct(open.dataset.open);

    const fav = e.target.closest('[data-fav]');
    if (fav) {
      e.preventDefault();
      const id = fav.dataset.fav;
      favorites.has(id) ? favorites.delete(id) : favorites.add(id);
      saveFavs();
      if (els.productDialog.open) openProduct(id);
      toast(favorites.has(id) ? 'お気に入りに追加しました' : 'お気に入りから削除しました');
    }

    const link = e.target.closest('[data-product-name]');
    if (link) {
      e.preventDefault(); state.query = link.dataset.productName; els.catalogSearch.value = state.query;
      renderCatalog(); $('catalogCards').scrollIntoView({ behavior: 'smooth' });
    }
  });

  els.catalogSearch.addEventListener('input', e => { state.query = e.target.value.trim(); renderCatalog(); });
  els.sortSelect.addEventListener('change', e => { state.sort = e.target.value; renderCatalog(); });
  $('resetFilters').addEventListener('click', () => {
    state.category = 'すべて'; state.query = ''; state.sort = 'featured'; state.favoritesOnly = false;
    els.catalogSearch.value = ''; els.sortSelect.value = 'featured'; renderCatalog();
  });
  $('favoritesBtn').addEventListener('click', () => {
    state.favoritesOnly = !state.favoritesOnly; renderCatalog(); $('catalogCards').scrollIntoView({ behavior: 'smooth' });
  });
  $('searchBtn').addEventListener('click', () => { els.searchDialog.showModal(); setTimeout(() => els.globalSearchInput.focus(), 20); });
  els.globalSearchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault(); state.query = els.globalSearchInput.value.trim(); els.catalogSearch.value = state.query;
      els.searchDialog.close(); renderCatalog(); $('catalogCards').scrollIntoView({ behavior: 'smooth' });
    }
  });
  $('dialogClose').addEventListener('click', () => els.productDialog.close());
  $('searchDialogClose').addEventListener('click', () => els.searchDialog.close());
  els.menuToggle.addEventListener('click', () => {
    const open = els.mainNav.classList.toggle('open'); els.menuToggle.setAttribute('aria-expanded', String(open));
  });

  saveFavs();
  load();
})();

// -----------------------------------------------------------------------------
// Footer information dialogs
// -----------------------------------------------------------------------------
(() => {
  const dialogButtons = document.querySelectorAll('[data-info-dialog]');
  dialogButtons.forEach(button => {
    button.addEventListener('click', () => {
      const dialog = document.getElementById(button.dataset.infoDialog);
      if (dialog?.showModal) dialog.showModal();
    });
  });

  document.querySelectorAll('.info-dialog-close').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });

  document.querySelectorAll('.info-dialog').forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  });

  const lineLink = document.getElementById('officialLineLink');
  if (lineLink?.getAttribute('aria-disabled') === 'true') {
    lineLink.addEventListener('click', event => event.preventDefault());
  }
})();
