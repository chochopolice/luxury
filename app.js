(() => {
  const config = window.LUXE_DB_CONFIG || {};
  const money = new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0
  });

  const categoryImages = {
    'コーラ': 'assets/prod_cola.jpg',
    'コーヒー': 'assets/prod_coffee.jpg',
    '水': 'assets/prod_water.jpg',
    '炭酸水': 'assets/prod_water.jpg',
    '水・炭酸水': 'assets/prod_water.jpg',
    'お茶': 'assets/prod_gyokuro.jpg',
    'お茶・緑茶': 'assets/prod_gyokuro.jpg',
    '紅茶': 'assets/prod_darjeeling.jpg',
    'ビール': 'assets/cat_spirits.jpg',
    '日本酒': 'assets/cat_sake.jpg',
    'ウイスキー': 'assets/cat_spirits.jpg',
    'ウォッカ': 'assets/cat_spirits.jpg',
    'クッキー': 'assets/cat_food.jpg',
    'キャンディ': 'assets/cat_food.jpg',
    'チョコ': 'assets/cat_food.jpg',
    'グミ': 'assets/cat_food.jpg',
    'アイス': 'assets/cat_food.jpg',
    'ガム': 'assets/cat_food.jpg',
    '日用品': 'assets/cat_daily.jpg',
    '食品': 'assets/cat_food.jpg',
    'ギフト': 'assets/cat_gift.jpg'
  };

  const categoryOrder = [
    'コーラ', 'コーヒー', '水', '炭酸水', '水・炭酸水', 'お茶・緑茶', 'お茶', '紅茶',
    'ビール', '日本酒', 'ウイスキー', 'ウォッカ',
    'クッキー', 'キャンディ', 'チョコ', 'グミ', 'アイス', 'ガム',
    '日用品', '食品', 'ギフト'
  ];

  const state = {
    category: 'すべて',
    query: '',
    sort: 'featured',
    favoritesOnly: false
  };

  let products = [];
  let supabaseClient = null;
  const favorites = new Set(JSON.parse(localStorage.getItem('luxeFavorites') || '[]').map(String));

  const refs = {
    categoryGrid: document.getElementById('categoryGrid'),
    featuredGrid: document.getElementById('featuredGrid'),
    catalogListPanel: document.getElementById('catalogListPanel'),
    catalogGrid: document.getElementById('catalogGrid'),
    filterRow: document.getElementById('filterRow'),
    resultCount: document.getElementById('resultCount'),
    dbStatus: document.getElementById('dbStatus'),
    emptyState: document.getElementById('emptyState'),
    catalogSearch: document.getElementById('catalogSearch'),
    sortSelect: document.getElementById('sortSelect'),
    productDialog: document.getElementById('productDialog'),
    dialogContent: document.getElementById('dialogContent'),
    searchDialog: document.getElementById('searchDialog'),
    globalSearchInput: document.getElementById('globalSearchInput'),
    toast: document.getElementById('toast'),
    favCount: document.getElementById('favCount'),
    menuToggle: document.getElementById('menuToggle'),
    mainNav: document.getElementById('mainNav')
  };

  function pick(row, ...keys) {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== null && row[key] !== undefined && row[key] !== '') {
        return row[key];
      }
    }
    return null;
  }

  function toBoolean(value, fallback = false) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return ['true', '1', 'yes', 'on', 'active', '掲載中'].includes(String(value).toLowerCase());
  }

  function toPrice(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
    const normalized = String(value ?? '').replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }

  function safeUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(String(value), window.location.href);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    } catch (_) {}
    return '';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function inferShop(link) {
    const url = safeUrl(link);
    if (!url) return '販売先';
    if (url.includes('rakuten.co.jp')) return '楽天市場';
    if (url.includes('amazon.')) return 'Amazon';
    if (url.includes('yahoo.co.jp')) return 'Yahoo!ショッピング';
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (_) {
      return '販売先';
    }
  }

  function getStorageImageUrl(imagePath) {
    if (!imagePath || !supabaseClient) return '';
    const { data } = supabaseClient.storage
      .from(config.storageBucket || 'product-images')
      .getPublicUrl(String(imagePath));
    return data?.publicUrl || '';
  }

  function normalizeProduct(row, index) {
    const category = String(pick(row, 'department', '部門', 'category', 'カテゴリ', '種類') || 'その他');
    const name = String(pick(row, 'product_name', '品名', '商品名', 'name') || `商品 ${index + 1}`);
    const link = safeUrl(pick(row, 'purchase_link', '購入リンク', 'affiliate_link', 'アフィリエイトリンク', 'link', 'url'));
    const affiliateImageUrl = safeUrl(pick(row, 'affiliate_image_url', 'アフィリエイト画像URL', 'affiliate_image', 'アフィ画像URL'));
    const directImageUrl = safeUrl(pick(row, 'image_url', '画像URL', 'image'));
    const imagePath = pick(row, 'image_path', '画像パス', 'storage_path');
    const imageSource = String(pick(row, 'image_source', '画像種別') || '').toLowerCase();
    const isAffiliate = toBoolean(pick(row, 'is_affiliate', 'アフィリエイト商品', 'affiliate'), false)
      || Boolean(affiliateImageUrl)
      || /hb\.afl\.rakuten\.co\.jp|affiliate/i.test(link);

    let image = '';
    if ((imageSource === 'affiliate' || isAffiliate) && affiliateImageUrl) {
      image = affiliateImageUrl;
    } else if (imageSource === 'supabase' && imagePath) {
      image = getStorageImageUrl(imagePath);
    } else if (directImageUrl) {
      image = directImageUrl;
    } else if (imagePath) {
      image = getStorageImageUrl(imagePath);
    } else if (affiliateImageUrl) {
      image = affiliateImageUrl;
    }

    image = image || categoryImages[category] || 'assets/cat_food.jpg';

    const highReason = String(pick(
      row,
      'high_price_reason', '高い理由', 'reason', '商品説明（高い理由）', 'description', '商品説明'
    ) || '');

    const separateDescription = String(pick(row, 'product_description', '商品概要', 'summary', 'description_detail') || '');
    const checkedAt = pick(row, 'price_checked_at', '価格確認日', 'checked_at');
    const status = String(pick(row, 'status', '販売状況') || '');
    const shopName = String(pick(row, 'shop_name', '販売先', 'ショップ名') || inferShop(link));

    return {
      id: String(pick(row, 'id', 'product_id', '商品ID') ?? `row-${index}-${name}`),
      category,
      name,
      country: String(pick(row, 'origin_country', '原産国', 'country') || '-'),
      price: toPrice(pick(row, 'price_jpy', '値段', '価格', 'price')),
      reason: highReason,
      description: separateDescription,
      link,
      image,
      imageSource,
      isAffiliate,
      shop: shopName,
      tag: String(pick(row, 'tag', 'タグ') || ''),
      status,
      checkedAt: checkedAt ? String(checkedAt) : '',
      featured: toBoolean(pick(row, 'featured', 'おすすめ'), true),
      isActive: pick(row, 'is_active', '掲載中') === null ? true : toBoolean(pick(row, 'is_active', '掲載中'), true)
    };
  }

  async function loadProducts() {
    if (!window.supabase?.createClient) {
      throw new Error('Supabase JavaScript SDKを読み込めませんでした。インターネット接続を確認してください。');
    }
    if (!config.supabaseUrl || !config.publishableKey) {
      throw new Error('config.js にSupabase接続情報が設定されていません。');
    }

    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.publishableKey);
    const { data, error } = await supabaseClient
      .from(config.table || 'products')
      .select('*');

    if (error) throw error;

    return (data || [])
      .map(normalizeProduct)
      .filter(product => product.isActive);
  }

  function uniqueCategories() {
    const found = [...new Set(products.map(product => product.category))];
    return [
      ...categoryOrder.filter(category => found.includes(category)),
      ...found.filter(category => !categoryOrder.includes(category))
    ];
  }

  function chunk(array, count) {
    if (!array.length) return [];
    const size = Math.ceil(array.length / count);
    const result = [];
    for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
    return result;
  }

  function displayPrice(product) {
    return money.format(product.price || 0);
  }

  function productCard(product) {
    const isFav = favorites.has(product.id);
    const purchaseLink = product.link
      ? `<a class="affiliate-link" href="${escapeHtml(product.link)}" target="_blank" rel="${product.isAffiliate ? 'sponsored nofollow noopener' : 'noopener'}">${escapeHtml(product.shop)}で見る →</a>`
      : `<span class="product-status">購入リンク準備中</span>`;

    return `
      <article class="product-card" data-id="${escapeHtml(product.id)}">
        <button class="product-thumb product-open" data-open="${escapeHtml(product.id)}" aria-label="${escapeHtml(product.name)}の詳細を見る">
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling?.classList.add('show')">
          <span class="product-image-placeholder">画像を表示できません</span>
          ${product.tag ? `<span class="product-badge">${escapeHtml(product.tag)}</span>` : ''}
        </button>
        <div class="product-info">
          <div>
            <p class="product-category-label">${escapeHtml(product.category)} / ${escapeHtml(product.country)}</p>
            <button class="product-name-button product-open" data-open="${escapeHtml(product.id)}">${escapeHtml(product.name)}</button>
            <p class="product-price">${displayPrice(product)}</p>
            ${product.status ? `<p class="product-status">${escapeHtml(product.status)}</p>` : ''}
            ${purchaseLink}
          </div>
          <button class="heart-btn ${isFav ? 'active' : ''}" data-fav="${escapeHtml(product.id)}" aria-label="お気に入り">${isFav ? '♥' : '♡'}</button>
        </div>
      </article>
    `;
  }

  function renderCategories() {
    refs.categoryGrid.innerHTML = uniqueCategories().map(category => `
      <a class="category-card" href="#catalogCards" data-category="${escapeHtml(category)}">
        <img src="${escapeHtml(categoryImages[category] || 'assets/cat_food.jpg')}" alt="${escapeHtml(category)}" loading="lazy">
        <span>${escapeHtml(category)}</span>
      </a>
    `).join('');
  }

  function renderFeatured() {
    const list = products
      .filter(product => product.featured)
      .sort((a, b) => b.price - a.price)
      .slice(0, 8);
    refs.featuredGrid.innerHTML = list.map(productCard).join('');
  }

  function renderCatalogList() {
    const columns = chunk(products, 4);
    refs.catalogListPanel.innerHTML = columns.map(column => `
      <div class="catalog-column">
        ${column.map(product => `
          <a class="catalog-link" href="#catalogCards" data-product-name="${escapeHtml(product.name)}">
            <span>${escapeHtml(product.name)}</span>
            <span>〉</span>
          </a>
        `).join('')}
      </div>
    `).join('');
  }

  function filteredProducts() {
    let list = [...products];

    if (state.favoritesOnly) list = list.filter(product => favorites.has(product.id));
    if (state.category !== 'すべて') list = list.filter(product => product.category === state.category);

    if (state.query) {
      const query = state.query.toLowerCase();
      list = list.filter(product => [
        product.name,
        product.category,
        product.country,
        product.reason,
        product.description,
        product.tag,
        product.shop
      ].filter(Boolean).join(' ').toLowerCase().includes(query));
    }

    if (state.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    if (state.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    if (state.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    if (state.sort === 'featured') list.sort((a, b) => Number(b.featured) - Number(a.featured) || b.price - a.price);

    return list;
  }

  function renderFilterChips() {
    const chips = ['すべて', ...uniqueCategories()];
    refs.filterRow.innerHTML = chips.map(category => `
      <button class="filter-chip ${state.category === category ? 'active' : ''}" data-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>
    `).join('');
  }

  function renderCatalogCards() {
    const list = filteredProducts();
    refs.catalogGrid.innerHTML = list.map(productCard).join('');
    refs.resultCount.textContent = `${list.length}件の商品を表示中${state.favoritesOnly ? ' ・ お気に入りのみ' : ''}`;
    refs.emptyState.hidden = list.length > 0;
    renderFilterChips();
    updateCounter();
  }

  function renderAll() {
    renderCategories();
    renderFeatured();
    renderCatalogList();
    renderCatalogCards();
    updateCounter();
  }

  function updateCounter() {
    refs.favCount.textContent = favorites.size;
  }

  function persistFavorites() {
    localStorage.setItem('luxeFavorites', JSON.stringify([...favorites]));
    renderFeatured();
    renderCatalogCards();
  }

  function showToast(message) {
    refs.toast.textContent = message;
    refs.toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => refs.toast.classList.remove('show'), 2200);
  }

  function openProduct(productId) {
    const product = products.find(item => item.id === String(productId));
    if (!product) return;

    const purchaseButton = product.link
      ? `<a class="btn btn-dark affiliate-cta" href="${escapeHtml(product.link)}" target="_blank" rel="${product.isAffiliate ? 'sponsored nofollow noopener' : 'noopener'}">${escapeHtml(product.shop)}で商品を見る ↗</a>`
      : `<span class="btn">購入リンク準備中</span>`;

    refs.dialogContent.innerHTML = `
      <div class="dialog-layout">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
        <div class="dialog-body">
          <p class="dialog-label">${escapeHtml(product.tag || product.category)}</p>
          <h2>${escapeHtml(product.name)}</h2>
          <p class="dialog-price">${displayPrice(product)}</p>
          ${product.status ? `<p class="dialog-status">${escapeHtml(product.status)}</p>` : ''}
          <dl class="dialog-grid">
            <dt>部門</dt><dd>${escapeHtml(product.category)}</dd>
            <dt>原産国</dt><dd>${escapeHtml(product.country)}</dd>
            ${product.checkedAt ? `<dt>価格確認日</dt><dd>${escapeHtml(product.checkedAt)}</dd>` : ''}
          </dl>
          ${product.description ? `<p class="dialog-description">${escapeHtml(product.description)}</p>` : ''}
          <div class="reason-box">
            <strong>商品説明・高い理由</strong>
            <p>${escapeHtml(product.reason || '商品説明を準備中です。')}</p>
          </div>
          <div class="dialog-actions">
            ${purchaseButton}
            <button class="btn" data-fav="${escapeHtml(product.id)}">${favorites.has(product.id) ? '♥ お気に入り済み' : '♡ お気に入り'}</button>
          </div>
          <p class="dialog-note">※ 購入・決済は販売先サイトで行われます。価格や在庫は販売先の表示が優先されます。</p>
        </div>
      </div>
    `;

    refs.productDialog.showModal();
  }

  function setDbStatus(message, type = 'loading') {
    refs.dbStatus.textContent = message;
    refs.dbStatus.classList.toggle('is-ready', type === 'ready');
    refs.dbStatus.classList.toggle('is-error', type === 'error');
  }

  document.addEventListener('click', (event) => {
    const categoryCard = event.target.closest('[data-category]');
    if (categoryCard) {
      state.category = categoryCard.dataset.category;
      state.favoritesOnly = false;
      renderCatalogCards();
    }

    const filterChip = event.target.closest('[data-filter]');
    if (filterChip) {
      state.category = filterChip.dataset.filter;
      state.favoritesOnly = false;
      renderCatalogCards();
    }

    const productOpen = event.target.closest('[data-open]');
    if (productOpen) openProduct(productOpen.dataset.open);

    const favTarget = event.target.closest('[data-fav]');
    if (favTarget) {
      event.preventDefault();
      event.stopPropagation();
      const id = String(favTarget.dataset.fav);
      favorites.has(id) ? favorites.delete(id) : favorites.add(id);
      persistFavorites();
      if (refs.productDialog.open) openProduct(id);
      showToast(favorites.has(id) ? 'お気に入りに追加しました' : 'お気に入りから削除しました');
    }

    const productNameLink = event.target.closest('[data-product-name]');
    if (productNameLink) {
      event.preventDefault();
      state.query = productNameLink.dataset.productName;
      refs.catalogSearch.value = state.query;
      renderCatalogCards();
      document.getElementById('catalogCards').scrollIntoView({ behavior: 'smooth' });
    }
  });

  refs.catalogSearch.addEventListener('input', (event) => {
    state.query = event.target.value.trim();
    renderCatalogCards();
  });

  refs.sortSelect.addEventListener('change', (event) => {
    state.sort = event.target.value;
    renderCatalogCards();
  });

  document.getElementById('resetFilters').addEventListener('click', () => {
    state.category = 'すべて';
    state.query = '';
    state.sort = 'featured';
    state.favoritesOnly = false;
    refs.catalogSearch.value = '';
    refs.sortSelect.value = 'featured';
    renderCatalogCards();
  });

  document.getElementById('favoritesBtn').addEventListener('click', () => {
    state.favoritesOnly = !state.favoritesOnly;
    renderCatalogCards();
    document.getElementById('catalogCards').scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('searchBtn').addEventListener('click', () => {
    refs.searchDialog.showModal();
    setTimeout(() => refs.globalSearchInput.focus(), 20);
  });

  refs.globalSearchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      state.query = refs.globalSearchInput.value.trim();
      refs.catalogSearch.value = state.query;
      refs.searchDialog.close();
      renderCatalogCards();
      document.getElementById('catalogCards').scrollIntoView({ behavior: 'smooth' });
    }
  });

  document.getElementById('dialogClose').addEventListener('click', () => refs.productDialog.close());
  document.getElementById('searchDialogClose').addEventListener('click', () => refs.searchDialog.close());

  refs.menuToggle.addEventListener('click', () => {
    const isOpen = refs.mainNav.classList.toggle('open');
    refs.menuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  refs.mainNav.querySelectorAll('a').forEach(anchor => {
    anchor.addEventListener('click', () => {
      refs.mainNav.classList.remove('open');
      refs.menuToggle.setAttribute('aria-expanded', 'false');
    });
  });

  async function init() {
    setDbStatus('Supabaseから商品を読み込んでいます…');
    updateCounter();

    try {
      products = await loadProducts();
      renderAll();
      if (products.length === 0) {
        setDbStatus('Supabaseへの接続には成功しましたが、表示できる商品が0件です。productsテーブルのデータとRLSを確認してください。', 'error');
      } else {
        setDbStatus(`Supabaseから${products.length}件の商品を読み込みました。`, 'ready');
      }
    } catch (error) {
      console.error('Supabase load error:', error);
      products = [];
      renderAll();
      setDbStatus(`商品データを取得できませんでした：${error.message || error}`, 'error');
    }
  }

  init();
})();
