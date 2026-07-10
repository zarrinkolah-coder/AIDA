'use strict';
const STORAGE_KEY = 'ork_mobile_inventory_backup_v1';
const SERVER_JSON_URL = './data/latest.json';

let allProducts = [];
let lastMeta = null;
let selectedProductKeys = new Set();
const $ = s => document.querySelector(s);
const nf = new Intl.NumberFormat('en-US');
function fa(n){ return nf.format(Number(n || 0)); }
function money(v){ const n = Number(v || 0); return n ? fa(n) + ' تومان' : '—'; }
function amount(v){ const n = Number(v || 0); return n ? fa(n) : '—'; }
function norm(s=''){
  return String(s ?? '')
    .replace(/[ي]/g,'ی').replace(/[ك]/g,'ک')
    .replace(/[\u064B-\u065F\u0670]/g,'')
    .replace(/[‌\s_\-]+/g,' ')
    .trim().toLowerCase();
}
function num(v){
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(/[٬,]/g,'').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  return Number.isFinite(n) ? n : 0;
}
function toast(msg){
  const old = document.querySelector('.toast'); if (old) old.remove();
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el); setTimeout(()=>el.remove(), 3200);
}
function safeArray(x){ return Array.isArray(x) ? x : []; }
function productKey(p){ return norm(p?.name || p?.product || ''); }
function selectedProducts(){
  return allProducts.filter(p => selectedProductKeys.has(productKey(p)));
}
function toJalaliDate(value){
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const hasGregorianDate = /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(raw);
  if (!hasGregorianDate && /[۰-۹٠-٩]/.test(raw)) return raw.slice(0, 10);
  const normalized = raw.includes('T') ? raw : raw.replace(/\//g, '-') + 'T00:00:00';
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date);
  } catch(e) {
    return raw.slice(0, 10);
  }
}
function buildShareText(){
  const rows = selectedProducts();
  const stamp = toJalaliDate(lastMeta?.created_at || lastMeta?.date);
  const lines = ['لیست قیمت فروش کالاها'];
  if (stamp) lines.push('تاریخ: ' + stamp);
  lines.push('');
  rows.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.name}: ${money(p.sellPrice)}`);
  });
  return lines.join('\n').trim();
}

function toFaDigits(value){
  return String(value ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}
function wrapTextByWords(ctx, text, maxWidth){
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let current = '';
  words.forEach(word => {
    const candidate = current ? (current + ' ' + word) : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
      return;
    }
    lines.push(current);
    current = word;
  });
  if (current) lines.push(current);
  return lines;
}
function roundRect(ctx, x, y, w, h, r){
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
function blobFromCanvas(canvas, type='image/jpeg', quality=0.92){
  return new Promise(resolve => {
    if (canvas.toBlob) {
      canvas.toBlob(blob => resolve(blob), type, quality);
      return;
    }
    const dataUrl = canvas.toDataURL(type, quality);
    const base64 = dataUrl.split(',')[1] || '';
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    resolve(new Blob([arr], { type }));
  });
}
async function createShareJpegBlob(){
  const rows = selectedProducts();
  if (!rows.length) throw new Error('ابتدا حداقل یک کالا را انتخاب کنید');
  const title = 'لیست قیمت فروش کالاها';
  const stamp = toJalaliDate(lastMeta?.created_at || lastMeta?.date);
  const width = 1200;
  const padding = 64;
  const gap = 18;
  const indexSize = 58;
  const priceBoxWidth = 270;
  const nameAreaWidth = width - padding * 2 - indexSize - gap * 3 - priceBoxWidth;
  const lineHeight = 40;
  const rowBottomPad = 26;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.direction = 'rtl';
  ctx.textBaseline = 'top';

  ctx.font = '700 34px Tahoma, Arial, sans-serif';
  const prepared = rows.map((p, i) => ({
    index: i + 1,
    nameLines: wrapTextByWords(ctx, p.name || '', nameAreaWidth),
    price: money(p.sellPrice)
  }));

  const headerHeight = stamp ? 176 : 142;
  const footerHeight = 70;
  const rowHeights = prepared.map(item => Math.max(96, item.nameLines.length * lineHeight + rowBottomPad));
  const totalRowsHeight = rowHeights.reduce((a, b) => a + b, 0) + gap * (prepared.length - 1);
  const height = headerHeight + totalRowsHeight + footerHeight;

  canvas.width = width;
  canvas.height = height;

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#241715');
  bg.addColorStop(1, '#1a120f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow1 = ctx.createRadialGradient(200, 120, 20, 200, 120, 300);
  glow1.addColorStop(0, 'rgba(245,158,106,0.22)');
  glow1.addColorStop(1, 'rgba(245,158,106,0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);
  const glow2 = ctx.createRadialGradient(width - 160, 120, 20, width - 160, 120, 260);
  glow2.addColorStop(0, 'rgba(247,200,115,0.18)');
  glow2.addColorStop(1, 'rgba(247,200,115,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#f7c873';
  ctx.font = '800 48px Tahoma, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(title, width - padding, 44);

  ctx.fillStyle = '#fff4ea';
  ctx.font = '700 28px Tahoma, Arial, sans-serif';
  ctx.fillText('تعداد کالا: ' + toFaDigits(rows.length), width - padding, 104);
  if (stamp) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e4cbb8';
    ctx.font = '700 28px Tahoma, Arial, sans-serif';
    ctx.fillText('تاریخ: ' + stamp, padding, 104);
  }

  let y = headerHeight;
  prepared.forEach((item, idx) => {
    const rowHeight = rowHeights[idx];
    ctx.save();
    roundRect(ctx, padding, y, width - padding * 2, rowHeight, 28);
    ctx.fillStyle = 'rgba(54, 34, 28, 0.94)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(247, 200, 115, 0.18)';
    ctx.stroke();
    ctx.restore();

    const bubbleX = width - padding - indexSize - 24;
    const bubbleY = y + 19;
    ctx.save();
    roundRect(ctx, bubbleX, bubbleY, indexSize, indexSize, 18);
    const badge = ctx.createLinearGradient(bubbleX, bubbleY, bubbleX + indexSize, bubbleY + indexSize);
    badge.addColorStop(0, '#f59e6a');
    badge.addColorStop(1, '#f7c873');
    ctx.fillStyle = badge;
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#3a2117';
    ctx.textAlign = 'center';
    ctx.font = '900 27px Tahoma, Arial, sans-serif';
    const idxText = toFaDigits(item.index);
    const idxMetrics = ctx.measureText(idxText);
    const idxHeight = (idxMetrics.actualBoundingBoxAscent || 15) + (idxMetrics.actualBoundingBoxDescent || 8);
    ctx.fillText(idxText, bubbleX + indexSize / 2, bubbleY + (indexSize - idxHeight) / 2 - 2);

    const priceBoxX = padding + 24;
    const priceBoxY = y + 16;
    const priceBoxH = rowHeight - 32;
    ctx.save();
    roundRect(ctx, priceBoxX, priceBoxY, priceBoxWidth, priceBoxH, 22);
    ctx.fillStyle = 'rgba(247, 200, 115, 0.10)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(247, 200, 115, 0.20)';
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#e4cbb8';
    ctx.textAlign = 'center';
    ctx.font = '700 23px Tahoma, Arial, sans-serif';
    ctx.fillText('قیمت فروش', priceBoxX + priceBoxWidth / 2, priceBoxY + 13);
    ctx.fillStyle = '#fff4ea';
    ctx.font = '900 30px Tahoma, Arial, sans-serif';
    const priceMetrics = ctx.measureText(item.price);
    const priceHeight = (priceMetrics.actualBoundingBoxAscent || 16) + (priceMetrics.actualBoundingBoxDescent || 8);
    ctx.fillText(item.price, priceBoxX + priceBoxWidth / 2, priceBoxY + Math.max(48, (priceBoxH - priceHeight) / 2 + 14));

    const nameRight = bubbleX - 22;
    const nameTop = y + 18;
    ctx.fillStyle = '#fff4ea';
    ctx.textAlign = 'right';
    ctx.font = '700 32px Tahoma, Arial, sans-serif';
    item.nameLines.forEach((line, lineIdx) => {
      ctx.fillText(line, nameRight, nameTop + lineIdx * lineHeight);
    });

    y += rowHeight + gap;
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(228, 203, 184, 0.82)';
  ctx.font = '700 24px Tahoma, Arial, sans-serif';
  ctx.fillText('نرم‌افزار مدیریت تولید', width / 2, height - 42);

  return blobFromCanvas(canvas, 'image/jpeg', 0.92);
}
function downloadBlob(blob, fileName){
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1000);
}
function fallbackCopy(text){
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch(e) { ok = false; }
  ta.remove();
  return ok;
}
async function copyText(text){
  if (!text) return false;
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch(e) {}
  }
  return fallbackCopy(text);
}
function updateSharePanel(){
  const panel = $('#sharePanel');
  if (!panel) return;
  const count = selectedProductKeys.size;
  panel.hidden = count === 0;
  const countEl = $('#selectedCount');
  if (countEl) countEl.textContent = fa(count) + ' کالا انتخاب شده';
  const previewEl = $('#selectedPreview');
  if (previewEl) {
    const names = selectedProducts().slice(0, 2).map(p => p.name).join('، ');
    previewEl.textContent = names ? (names + (count > 2 ? ' و ...' : '')) : 'از لیست کالاها انتخاب کنید';
  }
}
async function copySelected(){
  const text = buildShareText();
  if (!selectedProductKeys.size) { toast('ابتدا حداقل یک کالا را انتخاب کنید'); return; }
  const ok = await copyText(text);
  toast(ok ? 'لیست قیمت در کلیپ‌بورد ذخیره شد' : 'کپی خودکار انجام نشد؛ متن را دستی انتخاب کنید');
}
async function shareSelected(){
  const text = buildShareText();
  if (!selectedProductKeys.size) { toast('ابتدا حداقل یک کالا را انتخاب کنید'); return; }
  await copyText(text);
  if (navigator.share) {
    try {
      await navigator.share({ title: 'لیست قیمت کالاها', text });
      return;
    } catch(e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  toast('لیست قیمت کپی شد؛ اگر پنجره اشتراک باز نشد، آن را در پیامک یا شبکه اجتماعی Paste کنید');
  setTimeout(() => {
    try { location.href = 'sms:?body=' + encodeURIComponent(text); } catch(e) {}
  }, 350);
}

async function shareSelectedJpeg(){
  if (!selectedProductKeys.size) { toast('ابتدا حداقل یک کالا را انتخاب کنید'); return; }
  try {
    toast('در حال آماده‌سازی تصویر JPEG...');
    const blob = await createShareJpegBlob();
    const stamp = toJalaliDate(lastMeta?.created_at || lastMeta?.date).replace(/[\/]/g, '-');
    const fileName = `price-list-${stamp || 'products'}.jpg`;
    const file = new File([blob], fileName, { type: 'image/jpeg' });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        await navigator.share({
          title: 'لیست قیمت کالاها',
          text: 'لیست قیمت فروش کالاها',
          files: [file]
        });
        return;
      } catch(e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    downloadBlob(blob, fileName);
    toast('فایل JPEG ساخته و ذخیره شد؛ اگر اشتراک مستقیم پشتیبانی نشود، فایل را از پوشه دانلودها ارسال کنید');
  } catch (err) {
    console.error(err);
    toast(err.message || 'ساخت تصویر JPEG انجام نشد');
  }
}
function extractData(payload){
  if (!payload || typeof payload !== 'object') throw new Error('ساختار فایل معتبر نیست');
  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  if (!data || typeof data !== 'object') throw new Error('داده‌ای برای خواندن یافت نشد');
  return { data, meta: payload.meta || data.meta || {} };
}
function makeProductRows(data){
  const byName = new Map();
  function key(name){ return norm(name); }
  function row(name){
    const k = key(name);
    if (!k) return null;
    if (!byName.has(k)) byName.set(k, { name: String(name || '').trim(), category:'—', unit:'', stock:0, sellPrice:0, buyPrice:0, valueSell:0, valueBuy:0, source:{} });
    return byName.get(k);
  }
  safeArray(data.products).forEach(p => {
    const r = row(p.name || p.product); if (!r) return;
    r.name = p.name || p.product || r.name;
    r.category = p.category || r.category;
    r.unit = p.unit || r.unit;
    if (!r.stock && (p.total_bought !== undefined || p.total_sold !== undefined)) r.stock = num(p.total_bought) - num(p.total_sold);
  });
  safeArray(data.inventory).forEach(i => {
    const r = row(i.product || i.name); if (!r) return;
    r.category = i.category || r.category;
    r.stock = num(i.balance ?? i.stock ?? i.qty ?? r.stock);
    r.buyPrice = num(i.last_buy ?? i.buy_price ?? r.buyPrice);
    r.sellPrice = num(i.last_sell ?? i.price ?? i.sell_price ?? r.sellPrice);
    r.valueBuy = num(i.value_buy ?? r.valueBuy);
    r.valueSell = num(i.value_sell ?? r.valueSell);
  });
  safeArray(data.prices).forEach(p => {
    const r = row(p.product || p.name); if (!r) return;
    r.stock = num(p.stock ?? r.stock);
    r.buyPrice = num(p.buy_price ?? p.last_buy ?? r.buyPrice);
    r.sellPrice = num(p.price ?? p.sell_price ?? p.last_sell ?? r.sellPrice);
  });
  safeArray(data.transactions).forEach(t => {
    const r = row(t.product || t.name); if (!r) return;
    if ((!r.category || r.category === '—') && t.category) r.category = t.category;
    if (!r.unit && t.unit) r.unit = t.unit;
    if (!r.buyPrice && t.buy_price) r.buyPrice = num(t.buy_price);
    if (!r.sellPrice && t.sell_price) r.sellPrice = num(t.sell_price);
  });
  return Array.from(byName.values()).map(r => {
    r.valueBuy = r.valueBuy || (num(r.stock) * num(r.buyPrice));
    r.valueSell = r.valueSell || (num(r.stock) * num(r.sellPrice));
    r.search = norm([r.name, r.category, r.unit, r.stock, r.sellPrice, r.buyPrice].join(' '));
    return r;
  }).filter(r => r.name).sort((a,b) => a.name.localeCompare(b.name, 'fa'));
}

function assignPriceChanges(currentRows, previousRows){
  const prevMap = new Map();
  safeArray(previousRows).forEach(p => {
    const k = norm(p.name || p.product || '');
    if (k && !prevMap.has(k)) prevMap.set(k, p);
  });
  currentRows.forEach(p => {
    const prev = prevMap.get(norm(p.name || ''));
    const oldPrice = prev ? num(prev.sellPrice ?? prev.price ?? prev.sell_price ?? prev.last_sell) : 0;
    const newPrice = num(p.sellPrice);
    const changed = !!prev && oldPrice !== newPrice && (oldPrice !== 0 || newPrice !== 0);
    p.prevSellPrice = changed ? oldPrice : 0;
    p.priceDelta = changed ? (newPrice - oldPrice) : 0;
    p.priceChangeType = p.priceDelta > 0 ? 'up' : (p.priceDelta < 0 ? 'down' : '');
    p.search = norm([p.name, p.category, p.unit, p.stock, p.sellPrice, p.buyPrice, p.priceDelta].join(' '));
  });
  return currentRows;
}
function changedProductsCount(){ return allProducts.filter(p => num(p.priceDelta) !== 0).length; }
function priceChangeBadge(p){
  const d = num(p.priceDelta);
  if (!d) return '';
  const up = d > 0;
  return `<div class="price-change ${up ? 'up' : 'down'}"><span class="change-arrow">${up ? '▲' : '▼'}</span><span>${amount(Math.abs(d))}</span></div>`;
}
function persist(payload){ localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); }
function loadPersisted(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    allProducts = safeArray(saved.products);
    lastMeta = saved.meta || null;
    updateUi();
    updateSharePanel();
    return true;
  } catch(e) { return false; }
}
async function handleFile(file){
  if (!file) return;
  try {
    const previousProducts = allProducts.map(p => ({...p}));
    const previousMeta = lastMeta ? {...lastMeta} : null;
    const text = await file.text();
    const payload = JSON.parse(text);
    const { data, meta } = extractData(payload);
    allProducts = assignPriceChanges(makeProductRows(data), previousProducts);
    selectedProductKeys.clear();
    const changedCount = changedProductsCount();
    lastMeta = {
      fileName: file.name,
      source: 'manual',
      previousFileName: previousMeta?.fileName || '',
      created_at: meta.created_at || meta.date || data?.meta?.date || new Date().toISOString(),
      reason: meta.reason || '',
      changedCount
    };
    persist({ products: allProducts, meta: lastMeta });
    updateUi();
    toast('فایل خوانده شد: ' + fa(allProducts.length) + ' کالا' + (changedCount ? ' · تغییر قیمت: ' + fa(changedCount) : ''));
  } catch (err) {
    console.error(err);
    toast('خطا در خواندن فایل پشتیبان: ' + (err.message || 'فایل نامعتبر'));
  }
}

async function loadServerJson(showToast = false){
  try {
    const previousProducts = allProducts.map(p => ({...p}));
    const previousMeta = lastMeta ? {...lastMeta} : null;
    const sep = SERVER_JSON_URL.includes('?') ? '&' : '?';
    const response = await fetch(SERVER_JSON_URL + sep + 'v=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const payload = await response.json();
    const { data, meta } = extractData(payload);
    const rows = assignPriceChanges(makeProductRows(data), previousProducts);
    if (!rows.length) throw new Error('فایل latest.json خالی است یا کالا ندارد');
    allProducts = rows;
    selectedProductKeys.clear();
    const changedCount = changedProductsCount();
    const serverName = SERVER_JSON_URL.split('/').pop() || 'latest.json';
    lastMeta = {
      fileName: 'سرور: ' + serverName,
      source: 'server',
      previousFileName: previousMeta?.fileName || '',
      created_at: meta.created_at || meta.date || data?.meta?.date || new Date().toISOString(),
      reason: meta.reason || '',
      changedCount
    };
    persist({ products: allProducts, meta: lastMeta });
    updateUi();
    if (showToast) toast('اطلاعات از سرور بروزرسانی شد: ' + fa(allProducts.length) + ' کالا' + (changedCount ? ' · تغییر قیمت: ' + fa(changedCount) : ''));
    return true;
  } catch (err) {
    console.warn('Server JSON was not loaded:', err);
    if (showToast) toast('فایل سرور دریافت نشد؛ داده ذخیره‌شده یا بارگذاری دستی نمایش داده می‌شود');
    return false;
  }
}
function fillCategories(){
  const sel = $('#categoryFilter');
  const current = sel.value;
  const cats = [...new Set(allProducts.map(p => p.category || '—'))].sort((a,b)=>String(a).localeCompare(String(b),'fa'));
  sel.innerHTML = '<option value="">همه دسته‌ها</option>' + cats.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('');
  if (cats.includes(current)) sel.value = current;
}
function filtered(){
  const q = norm($('#searchInput').value || '');
  const cat = $('#categoryFilter').value;
  const stock = $('#stockFilter').value;
  let rows = allProducts.filter(p => (!q || p.search.includes(q)) && (!cat || p.category === cat));
  if (stock === 'positive') rows = rows.filter(p => num(p.stock) > 0);
  if (stock === 'zero') rows = rows.filter(p => num(p.stock) === 0);
  if (stock === 'negative') rows = rows.filter(p => num(p.stock) < 0);
  const sort = $('#sortSelect').value;
  if (sort === 'price_changed') rows = rows.filter(p => num(p.priceDelta) !== 0);
  rows.sort((a,b) => {
    if (sort === 'stock_desc') return num(b.stock) - num(a.stock);
    if (sort === 'stock_asc') return num(a.stock) - num(b.stock);
    if (sort === 'price_desc') return num(b.sellPrice) - num(a.sellPrice);
    if (sort === 'price_asc') return num(a.sellPrice) - num(b.sellPrice);
    if (sort === 'price_changed') return Math.abs(num(b.priceDelta)) - Math.abs(num(a.priceDelta)) || a.name.localeCompare(b.name, 'fa');
    return a.name.localeCompare(b.name, 'fa');
  });
  return rows;
}
function renderList(){
  const list = $('#productsList');
  const rows = filtered();
  $('#resultCount').textContent = fa(rows.length) + ' کالا';
  if (!allProducts.length) {
    list.innerHTML = `<div class="empty-state"><div>📦</div><h2>هنوز فایل پشتیبان بارگذاری نشده است</h2><p>از دکمه بالا آخرین فایل پشتیبان JSON را انتخاب کنید.</p></div>`;
    updateSharePanel();
    return;
  }
  if (!rows.length) {
    list.innerHTML = `<div class="empty-state"><div>🔎</div><h2>نتیجه‌ای پیدا نشد</h2><p>عبارت جستجو یا فیلترها را تغییر دهید.</p></div>`;
    updateSharePanel();
    return;
  }
  list.innerHTML = rows.map((p, idx) => productCard(p, idx)).join('');
  updateSharePanel();
}
function productCard(p, idx){
  const s = num(p.stock);
  const key = productKey(p);
  const checked = selectedProductKeys.has(key);
  const stockClass = s < 0 ? 'negative' : s === 0 ? 'zero' : '';
  return `<article class="product-card ${checked ? 'selected' : ''}" data-key="${escapeAttr(key)}">
    <div class="card-head">
      <label class="select-chip" title="انتخاب برای ارسال">
        <input class="select-product" type="checkbox" data-key="${escapeAttr(key)}" ${checked ? 'checked' : ''}>
        <span>انتخاب</span>
      </label>
      <div class="product-main">
        <h3 class="product-name">${escapeHtml(p.name)}</h3>
        <div class="price-row">
          <span class="price-item price-sell"><small>فروش</small><b>${money(p.sellPrice)}</b></span>
          ${priceChangeBadge(p)}
        </div>
      </div>
      <div class="stock-pill ${stockClass}">${fa(s)}</div>
    </div>
  </article>`;
}
function updateSummary(){
  const total = allProducts.length;
  const inStock = allProducts.filter(p => num(p.stock) > 0).length;
  $('#sumProducts').textContent = fa(total);
  $('#sumInStock').textContent = fa(inStock);
}
function updateMeta(){
  const badge = $('#loadedBadge');
  const hint = $('#fileHint');
  if (!lastMeta) {
    badge.textContent = 'در انتظار اطلاعات';
    hint.textContent = 'برنامه هنگام باز شدن فایل data/latest.json را از سرور می‌خواند؛ بارگذاری دستی فقط برای مواقع اضطراری است';
    return;
  }
  badge.textContent = lastMeta.source === 'server' ? 'بروزرسانی از سرور' : 'بارگذاری دستی';
  const changeText = num(lastMeta.changedCount) ? ` · تغییر قیمت: ${fa(lastMeta.changedCount)}` : '';
  const previousText = lastMeta.previousFileName ? ` · مقایسه با: ${lastMeta.previousFileName}` : '';
  hint.textContent = `${lastMeta.fileName || 'فایل پشتیبان'} · ${String(lastMeta.created_at || '').slice(0,19).replace('T',' ')}${changeText}${previousText}`;
}
function updateUi(){ fillCategories(); updateSummary(); updateMeta(); renderList(); updateSharePanel(); }
function openDetail(index){
  const p = allProducts[index]; if (!p) return;
  $('#detailBody').innerHTML = `<h2 class="detail-title">${escapeHtml(p.name)}</h2>
    <p class="category">${escapeHtml(p.category || '—')}${p.unit ? ' · ' + escapeHtml(p.unit) : ''}</p>
    <div class="detail-grid">
      <div class="metric"><small>موجودی</small><b>${fa(p.stock)}</b></div>
      <div class="metric"><small>قیمت فروش</small><b>${money(p.sellPrice)}</b>${priceChangeBadge(p)}</div>
      <div class="metric"><small>قیمت خرید</small><b>${amount(p.buyPrice)}</b></div>
      ${num(p.priceDelta) ? `<div class="metric"><small>قیمت فروش قبلی</small><b>${money(p.prevSellPrice)}</b></div>` : ''}
    </div>`;
  $('#detailDialog').showModal();
}
function closeDetail(){ $('#detailDialog').close(); }
function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escapeAttr(s=''){ return escapeHtml(s); }
const refreshServerBtn = $('#refreshServerBtn');
if (refreshServerBtn) refreshServerBtn.addEventListener('click', () => loadServerJson(true));
$('#backupFile').addEventListener('change', e => handleFile(e.target.files[0]));
['searchInput','categoryFilter','stockFilter','sortSelect'].forEach(id => $('#'+id).addEventListener('input', renderList));
$('#productsList').addEventListener('change', e => {
  if (!e.target.matches('.select-product')) return;
  const key = e.target.dataset.key || '';
  if (!key) return;
  if (e.target.checked) selectedProductKeys.add(key); else selectedProductKeys.delete(key);
  const card = e.target.closest('.product-card');
  if (card) card.classList.toggle('selected', e.target.checked);
  updateSharePanel();
});
$('#selectVisibleBtn').addEventListener('click', () => {
  const rows = filtered();
  rows.forEach(p => { const k = productKey(p); if (k) selectedProductKeys.add(k); });
  renderList();
  toast(fa(rows.length) + ' کالای نمایش‌داده‌شده انتخاب شد');
});
$('#clearSelectionBtn').addEventListener('click', () => {
  selectedProductKeys.clear();
  renderList();
  toast('انتخاب‌ها پاک شد');
});
$('#copySelectedBtn').addEventListener('click', copySelected);
$('#shareSelectedBtn').addEventListener('click', shareSelected);
if ($('#shareSelectedJpegBtn')) $('#shareSelectedJpegBtn').addEventListener('click', shareSelectedJpeg);
$('#clearDataBtn').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEY); allProducts=[]; lastMeta=null; selectedProductKeys.clear(); updateUi(); toast('داده موبایل پاک شد'); });
if (!loadPersisted()) updateUi();
loadServerJson(false);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('service-worker.js').catch(()=>{});
