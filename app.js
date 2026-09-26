(() => {
  const cfg = window.ORDINARY_LUXE_DB_CONFIG;
  if (!cfg || !window.supabase) return;
  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.publishableKey);
  const money = new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0});
  const oldFavs = JSON.parse(localStorage.getItem('luxeFavorites') || '[]');
  const newFavs = JSON.parse(localStorage.getItem('ordinaryLuxeFavorites') || '[]');
  const favorites = new Set([...oldFavs,...newFavs]);
  const state = {category:'すべて',query:'',sort:'featured',favoritesOnly:false};
  let products=[];
  const $ = id => document.getElementById(id);
  const els = {categoryGrid:$('categoryGrid'),featuredGrid:$('featuredGrid'),catalogListPanel:$('catalogListPanel'),catalogGrid:$('catalogGrid'),filterRow:$('filterRow'),resultCount:$('resultCount'),dbStatus:$('dbStatus'),emptyState:$('emptyState'),catalogSearch:$('catalogSearch'),sortSelect:$('sortSelect'),favCount:$('favCount'),productDialog:$('productDialog'),dialogContent:$('dialogContent'),searchDialog:$('searchDialog'),globalSearchInput:$('globalSearchInput'),toast:$('toast'),mainNav:$('mainNav'),menuToggle:$('menuToggle')};
  const pick=(row,...keys)=>{for(const key of keys){if(row[key]!==undefined&&row[key]!==null&&row[key]!=='')return row[key]}return null};
  function normalize(row){
    const price=Number(pick(row,'price_jpy','値段','価格')||0);
    return {
      id:String(pick(row,'id','product_code','品番')||crypto.randomUUID()),
      code:pick(row,'product_code','商品コード'),
      department:pick(row,'department','部門','category','カテゴリ')||'その他',
      name:pick(row,'product_name','品名','商品名')||'名称未設定',
      country:pick(row,'origin_country','原産国')||'',
      price:Number.isFinite(price)?price:0,
      description:pick(row,'description','商品説明（高い理由）','商品説明','高い理由')||'',
      purchaseLink:pick(row,'purchase_link','購入リンク')||'',
      imageSource:pick(row,'image_source')||'supabase',
      imagePath:pick(row,'image_path')||'',
      affiliateImageUrl:pick(row,'affiliate_image_url')||'',
      imageUrl:pick(row,'image_url')||'',
      affiliate:Boolean(pick(row,'is_affiliate')),
      shopName:pick(row,'shop_name')||'',
      checkedAt:pick(row,'price_checked_at')||'',
      featured:pick(row,'featured')!==false,
      status:pick(row,'status')||''
    };
  }
  function imageFor(p){
    if(p.imageSource==='affiliate'&&p.affiliateImageUrl)return p.affiliateImageUrl;
    if(p.imageUrl)return p.imageUrl;
    if(p.imagePath)return client.storage.from(cfg.storageBucket).getPublicUrl(p.imagePath).data.publicUrl;
    return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="100%" height="100%" fill="#eee8de"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#8b7a67" font-size="42">ORDINARY LUXE</text></svg>`);
  }
  function cats(){return [...new Set(products.map(p=>p.department))].sort((a,b)=>a.localeCompare(b,'ja'))}
  function card(p){const fav=favorites.has(p.id);return `<article class="product-card"><button class="product-thumb" data-open="${p.id}"><img src="${imageFor(p)}" alt="${p.name}" loading="lazy"></button><div class="product-info"><div><button class="product-name-button" data-open="${p.id}">${p.name}</button><p class="product-price">${money.format(p.price)}</p></div><button class="heart-btn ${fav?'active':''}" data-fav="${p.id}" aria-label="お気に入り">${fav?'♥':'♡'}</button></div></article>`}
  function renderCategories(){const list=cats().slice(0,8);els.categoryGrid.innerHTML=list.map((c,i)=>{const p=products.find(x=>x.department===c);return `<a class="category-card" href="#catalogCards" data-category="${c}"><img src="${p?imageFor(p):''}" alt="${c}" loading="lazy"><span>${c}</span></a>`}).join('')}
  function renderFeatured(){els.featuredGrid.innerHTML=products.filter(p=>p.featured).sort((a,b)=>b.price-a.price).slice(0,8).map(card).join('')}
  function renderList(){const names=products.map(p=>p.name);const size=Math.max(1,Math.ceil(names.length/4));const cols=[];for(let i=0;i<names.length;i+=size)cols.push(names.slice(i,i+size));els.catalogListPanel.innerHTML=cols.map(col=>`<div class="catalog-column">${col.map(n=>`<a class="catalog-link" href="#catalogCards" data-product-name="${n}"><span>${n}</span><span>〉</span></a>`).join('')}</div>`).join('')}
  function filtered(){let list=[...products];if(state.favoritesOnly)list=list.filter(p=>favorites.has(p.id));if(state.category!=='すべて')list=list.filter(p=>p.department===state.category);if(state.query){const q=state.query.toLowerCase();list=list.filter(p=>[p.name,p.department,p.country,p.description,p.shopName].join(' ').toLowerCase().includes(q))}if(state.sort==='price-desc')list.sort((a,b)=>b.price-a.price);else if(state.sort==='price-asc')list.sort((a,b)=>a.price-b.price);else if(state.sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name,'ja'));else list.sort((a,b)=>Number(b.featured)-Number(a.featured)||b.price-a.price);return list}
  function renderFilters(){els.filterRow.innerHTML=['すべて',...cats()].map(c=>`<button class="filter-chip ${state.category===c?'active':''}" data-filter="${c}">${c}</button>`).join('')}
  function renderCatalog(){const list=filtered();els.catalogGrid.innerHTML=list.map(card).join('');els.resultCount.textContent=`${list.length}件の商品を表示中${state.favoritesOnly?' ・ お気に入りのみ':''}`;els.emptyState.hidden=list.length>0;els.favCount.textContent=favorites.size;renderFilters()}
  function saveFavs(){localStorage.setItem('ordinaryLuxeFavorites',JSON.stringify([...favorites]));renderFeatured();renderCatalog()}
  function toast(msg){els.toast.textContent=msg;els.toast.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>els.toast.classList.remove('show'),1800)}
  function openProduct(id){const p=products.find(x=>x.id===id);if(!p)return;const rel=p.affiliate?'nofollow sponsored noopener':'noopener';const label=p.shopName?`${p.shopName}で見る`:'販売先で見る';els.dialogContent.innerHTML=`<div class="dialog-layout"><img src="${imageFor(p)}" alt="${p.name}"><div class="dialog-body"><p class="dialog-label">${p.department}</p><h2>${p.name}</h2><p class="dialog-price">${money.format(p.price)}</p><dl class="dialog-grid"><dt>原産国</dt><dd>${p.country||'-'}</dd><dt>価格確認日</dt><dd>${p.checkedAt||'-'}</dd><dt>販売先</dt><dd>${p.shopName||'-'}</dd></dl><p class="dialog-description">${p.description||''}</p>${p.status?`<div class="reason-box"><strong>掲載情報</strong><p>${p.status}</p></div>`:''}<div><button class="btn" data-fav="${p.id}">${favorites.has(p.id)?'♥ お気に入り済み':'♡ お気に入り'}</button>${p.purchaseLink?`<a class="purchase-button" href="${p.purchaseLink}" target="_blank" rel="${rel}">${label}</a>`:''}</div></div></div>`;els.productDialog.showModal()}
  async function load(){
    els.dbStatus.textContent='Supabaseから商品を読み込んでいます…';
    const {data,error}=await client.from(cfg.table).select('*').eq('is_active',true);
    if(error){els.dbStatus.textContent=`商品データを取得できません: ${error.message}`;els.dbStatus.classList.add('error');return}
    products=(data||[]).map(normalize);els.dbStatus.textContent=`Supabaseから${products.length}件の商品を読み込みました。`;renderCategories();renderFeatured();renderList();renderCatalog();
  }
  document.addEventListener('click',e=>{const cat=e.target.closest('[data-category]');if(cat){state.category=cat.dataset.category;state.favoritesOnly=false;renderCatalog()}const filter=e.target.closest('[data-filter]');if(filter){state.category=filter.dataset.filter;state.favoritesOnly=false;renderCatalog()}const open=e.target.closest('[data-open]');if(open)openProduct(open.dataset.open);const fav=e.target.closest('[data-fav]');if(fav){e.preventDefault();const id=fav.dataset.fav;favorites.has(id)?favorites.delete(id):favorites.add(id);saveFavs();if(els.productDialog.open)openProduct(id);toast(favorites.has(id)?'お気に入りに追加しました':'お気に入りから削除しました')}const link=e.target.closest('[data-product-name]');if(link){e.preventDefault();state.query=link.dataset.productName;els.catalogSearch.value=state.query;renderCatalog();$('catalogCards').scrollIntoView({behavior:'smooth'})}});
  els.catalogSearch.addEventListener('input',e=>{state.query=e.target.value.trim();renderCatalog()});els.sortSelect.addEventListener('change',e=>{state.sort=e.target.value;renderCatalog()});$('resetFilters').addEventListener('click',()=>{state.category='すべて';state.query='';state.sort='featured';state.favoritesOnly=false;els.catalogSearch.value='';els.sortSelect.value='featured';renderCatalog()});$('favoritesBtn').addEventListener('click',()=>{state.favoritesOnly=!state.favoritesOnly;renderCatalog();$('catalogCards').scrollIntoView({behavior:'smooth'})});$('searchBtn').addEventListener('click',()=>{els.searchDialog.showModal();setTimeout(()=>els.globalSearchInput.focus(),20)});els.globalSearchInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();state.query=els.globalSearchInput.value.trim();els.catalogSearch.value=state.query;els.searchDialog.close();renderCatalog();$('catalogCards').scrollIntoView({behavior:'smooth'})}});$('dialogClose').addEventListener('click',()=>els.productDialog.close());$('searchDialogClose').addEventListener('click',()=>els.searchDialog.close());els.menuToggle.addEventListener('click',()=>{const open=els.mainNav.classList.toggle('open');els.menuToggle.setAttribute('aria-expanded',String(open))});
  saveFavs();load();
})();
