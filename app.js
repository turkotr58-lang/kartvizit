import { CARD, toVCard, fullName, billingText } from './card.js?v=d32e2d85c4';

const $ = (s, r = document) => r.querySelector(s);
// Çeviriler: sayfaya gömülü i18n.js telefon dilini seçip self.KV_I18N.dict'e koyar.
const dict = () => self.KV_I18N?.dict ?? self.KV_I18N?.t?.tr ?? {};
const t = (k) => dict()[k] ?? self.KV_I18N?.t?.tr?.[k] ?? k;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* özel pencere vb. */ } },
};

/* ---------- adres ---------- */
// https üzerinde yayınlandığında QR, sayfanın kendi adresini gösterir; yerel testte card.js'deki adres.
function pageUrl() {
  const { protocol, hostname, origin, pathname } = location;
  const local = protocol === 'file:' || /^(localhost|127\.|\[::1\]|10\.|192\.168\.)/.test(hostname) || hostname.endsWith('.localhost');
  if (protocol === 'https:' && !local) return origin + pathname.replace(/index\.html$/, '');
  return CARD.url;
}

/* ---------- QR ---------- */
function qrSvg(text) {
  /* global qrcode */
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  const qr = qrcode(0, text.startsWith('BEGIN:VCARD') ? 'L' : 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const q = 4; // sessiz bölge
  const size = n + q * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!qr.isDark(r, c)) { c++; continue; }
      let run = 1;
      while (c + run < n && qr.isDark(r, c + run)) run++;
      d += `M${c + q} ${r + q}h${run}v1h-${run}z`;
      c += run;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#0B0F1A"/></svg>`;
}

const MODES = {
  web: { text: () => pageUrl(), hint: 'hintWeb', label: 'labelWeb' },
  vcard: { text: () => toVCard(CARD, { compact: true }), hint: 'hintVcard', label: 'labelVcard' },
};

const dlg = $('#qr');
const box = $('#qrBox');
const hint = $('#qrHint');
let mode = MODES[store.get('qrMode')] ? store.get('qrMode') : 'web';
let wake = null;

function render() {
  const m = MODES[mode];
  box.innerHTML = qrSvg(m.text());
  box.setAttribute('aria-label', `${t(m.label)} · ${t('qrAria')}`);
  hint.textContent = t(m.hint);
  for (const b of dlg.querySelectorAll('.seg button')) b.setAttribute('aria-selected', String(b.dataset.mode === mode));
}

async function keepAwake() {
  try { wake = await navigator.wakeLock?.request('screen'); } catch { wake = null; }
}

function openQr({ push = true } = {}) {
  render();
  if (!dlg.open) dlg.showModal();
  keepAwake();
  if (push && location.hash !== '#qr') history.pushState({ qr: 1 }, '', '#qr');
}

function closeQr() {
  if (location.hash === '#qr' && history.state?.qr) { history.back(); return; }
  if (dlg.open) dlg.close();
}

dlg.addEventListener('close', () => {
  try { wake?.release(); } catch { /* */ }
  wake = null;
  if (location.hash === '#qr') history.replaceState(null, '', location.pathname + location.search);
});
addEventListener('popstate', () => { if (location.hash !== '#qr' && dlg.open) dlg.close(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && dlg.open) keepAwake(); });

for (const b of dlg.querySelectorAll('.seg button')) {
  b.addEventListener('click', () => { mode = b.dataset.mode; store.set('qrMode', mode); render(); });
}
$('#qrClose').addEventListener('click', closeQr);
for (const b of document.querySelectorAll('[data-open-qr]')) b.addEventListener('click', () => openQr());

/* ---------- paylaş ---------- */
let toastTimer;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); }
  (bill.open ? bill : dlg.open ? dlg : document.body).appendChild(t);
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add('on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
}

// Paylaşım metni: bağlantı en sonda, WhatsApp vb. önizleme kartını (logo + ad) ondan üretir.
// Mesaj, paylaşan telefonun dilinde yazılır; alıcı bağlantıyı açınca kendi dilinde görür.
const shareText = () => `${t('shareText')}\n${fullName()}\n${CARD.company}\n${CARD.org} · ${CARD.brands.bottimmo.name}`;
const shareMessage = () => `${shareText()}\n${pageUrl()}`;

async function copyLink() {
  try {
    await navigator.clipboard.writeText(pageUrl());
    toast(t('copied'));
  } catch {
    window.prompt(t('linkPrompt'), pageUrl());
  }
}

async function share() {
  if (navigator.share) {
    try {
      await navigator.share({ title: `${fullName()} · ${t('shareTitle')}`, text: shareText(), url: pageUrl() });
    } catch { /* kullanıcı vazgeçti */ }
    return;
  }
  copyLink();
}

// WhatsApp: uygulama yüklüyse doğrudan sohbet seçme ekranı açılır.
function whatsapp() {
  window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage())}`, '_blank', 'noopener');
}

// Kişi kartını (.vcf) dosya olarak gönder; tarayıcı dosya paylaşımını destekliyorsa görünür.
let vcfFile = null;
const vcfBtn = $('#shareVcf');
async function prepareVcf() {
  if (vcfFile || !navigator.canShare) return;
  try {
    const href = $('a.save').getAttribute('href');
    const blob = await (await fetch(href)).blob();
    const file = new File([blob], `${fullName()}.vcf`, { type: 'text/vcard' });
    if (navigator.canShare({ files: [file] })) { vcfFile = file; vcfBtn.hidden = false; }
  } catch { /* dosya paylaşımı yok: düğme gizli kalır */ }
}
vcfBtn.addEventListener('click', async () => {
  if (!vcfFile) return;
  try { await navigator.share({ files: [vcfFile], title: fullName() }); } catch { /* vazgeçti */ }
});

/* ---------- fatura ve banka bilgileri ---------- */
// QR ekranındaki düğmeyle ya da gönderilen ?fatura bağlantısıyla açılır; kartın ana sayfasında görünmez.
const bill = $('#bill');
const billUrl = () => `${pageUrl()}?fatura`;
const billMsg = (bold) => billingText(CARD, dict(), { link: billUrl(), bold });

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* eski tarayıcı */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  (bill.open ? bill : document.body).appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

function openBill({ push = true } = {}) {
  if (!bill.open) bill.showModal();
  bill.scrollTop = 0;
  if (push && location.hash !== '#fatura') {
    // Geri tuşu fatura ekranını kapatıp QR ekranına dönsün (uygulama QR'la açıldığında #qr kaydı yoktur)
    if (dlg.open && location.hash !== '#qr') history.replaceState(history.state, '', `${location.pathname}${location.search}#qr`);
    history.pushState({ bill: 1 }, '', '#fatura');
  }
}
function closeBill() {
  if (location.hash === '#fatura' && history.state?.bill) { history.back(); return; }
  if (bill.open) bill.close();
}
bill.addEventListener('close', () => {
  if (location.hash === '#fatura') history.replaceState(null, '', location.pathname + location.search + (dlg.open ? '#qr' : ''));
});
addEventListener('popstate', () => { if (location.hash !== '#fatura' && bill.open) bill.close(); });
$('#billClose').addEventListener('click', closeBill);
for (const b of document.querySelectorAll('[data-open-bill]')) b.addEventListener('click', () => openBill());

for (const b of document.querySelectorAll('[data-copy-val]')) {
  b.addEventListener('click', async () => {
    if (!(await copyText(b.dataset.copyVal))) return;
    toast(t(b.dataset.copied || 'valCopied'));
    b.classList.add('ok');
    setTimeout(() => b.classList.remove('ok'), 1600);
  });
}
$('[data-bill-wa]').addEventListener('click', () => {
  window.open(`https://wa.me/?text=${encodeURIComponent(billMsg(true))}`, '_blank', 'noopener');
});
$('[data-bill-copy]').addEventListener('click', async () => {
  if (await copyText(billMsg(false))) toast(t('valCopied'));
});
$('[data-bill-share]').addEventListener('click', async () => {
  try { await navigator.share({ title: t('billTitle'), text: billMsg(false) }); } catch { /* vazgeçti */ }
});

for (const b of document.querySelectorAll('[data-share]')) b.addEventListener('click', share);
for (const b of document.querySelectorAll('[data-whatsapp]')) b.addEventListener('click', whatsapp);
for (const b of document.querySelectorAll('[data-copy]')) b.addEventListener('click', copyLink);
if (!navigator.share) for (const b of document.querySelectorAll('[data-native-share]')) b.hidden = true;
prepareVcf();

// Dil değişince (alttaki seçici): QR açıklaması ve dile özel rehber dosyası yenilenir.
document.addEventListener('kv:lang', () => {
  if (dlg.open) render();
  vcfFile = null;
  prepareVcf();
  if (!installNote.hidden) installNote.textContent = t(ios ? 'installIos' : 'installAndroid');
});

/* ---------- ana ekrana ekle (uygulama) ---------- */
const installBtn = $('#installBtn');
const installNote = $('#installNote');
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let deferredPrompt = null;

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
if (!standalone && ios) installBtn.hidden = false;
installBtn.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch { /* */ }
    deferredPrompt = null;
    installBtn.hidden = true;
    return;
  }
  installNote.hidden = false;
  installNote.textContent = t(ios ? 'installIos' : 'installAndroid');
});
addEventListener('appinstalled', () => { installBtn.hidden = true; toast(t('installed')); });

/* ---------- açılış ---------- */
const params = new URLSearchParams(location.search);
if (params.has('qr') || location.hash === '#qr' || standalone) {
  if (location.hash === '#qr') history.replaceState(null, '', location.pathname + location.search);
  openQr({ push: false });
}
if (params.has('fatura') || location.hash === '#fatura') {
  if (location.hash === '#fatura') history.replaceState(null, '', location.pathname + location.search);
  openBill({ push: false });
}

if ('serviceWorker' in navigator && location.protocol === 'https:' && !/^(localhost|127\.)/.test(location.hostname)) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* çevrimdışı önbellek opsiyonel */ });
}
