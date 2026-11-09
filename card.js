// Kartvizit bilgileri — tek kaynak.
// Bir bilgiyi değiştirmek için burayı düzenleyin, sonra:  node kartvizit/build.mjs
// (index.html, .vcf dosyası, QR içerikleri ve ikonlar buradan üretilir.)

export const CARD = {
  // Yayınlanan adres. Sayfa https üzerinden açıldığında QR kendi adresini kullanır;
  // bu değer yalnızca yerel testte ve önizlemede yedek olarak kullanılır.
  url: 'https://turkotr58-lang.github.io/kartvizit/',

  firstName: 'Tuncay',
  lastName: 'Türkoğlu',
  // Unvan: boş bırakılırsa hiçbir yerde gösterilmez. İsmin altında şirket adı (company) yazar.
  title: '',
  company: 'Türkoğlu İnternet ve Yazılım San. Tic. Ltd. Şti.',
  companyShort: 'Türkoğlu İnt. ve Yaz. Ltd. Şti.',
  org: 'immoviewer Türkiye',

  phone: '+905555548172',
  phoneDisplay: '+90 555 554 81 72',
  whatsapp: '905555548172',
  whatsappText: 'Merhaba Tuncay Bey, kartvizitinizden ulaşıyorum.',
  // Sayfadaki metinler, marka açıklamaları ve paylaşım mesajı 6 dilde src/i18n.js içinde.
  email: 'turkiye@immoviewer.tech',

  address: {
    street: 'Kızılırmak Mah., Ufuk Üniversitesi Cad.',
    building: 'Next Level Loft Ofis 4/72-76, Kat 27',
    district: 'Çankaya',
    city: 'Ankara',
    postal: '06510',
    country: 'Türkiye',
  },
  // Google işletme profili (immoviewer | Türkiye)
  mapsUrl: 'https://maps.google.com/?cid=7182467155729219089',

  brands: {
    immoviewer: {
      name: 'immoviewer Türkiye',
      url: 'https://www.immoviewer.tech',
      urlDisplay: 'www.immoviewer.tech',
    },
    bottimmo: {
      name: 'BOTTIMMO® Türkiye',
      url: 'https://turkotr58-lang.github.io/bottimmo-tr/',
    },
  },

  social: [
    { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/immoviewerturkiye/' },
    { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/immoviewer-t%C3%BCrkiye-115481299/' },
    { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@immoviewertech' },
    { id: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/immoviewerturkiye' },
    { id: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@immoviewer_turkiye' },
    { id: 'x', label: 'X', url: 'https://x.com/immoviewertech' },
  ],
};

export const fullName = (c = CARD) => `${c.firstName} ${c.lastName}`;

// vCard 3.0 metin kaçışı (virgül, noktalı virgül, ters bölü, satır sonu)
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

// 75 baytı aşan satırları RFC 2425'e göre katla (UTF-8 karakterlerini bölmeden)
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const max = out.length === 0 ? 75 : 74; // devam satırları baştaki boşlukla başlar
    if (len + n > max) {
      out.push(cur);
      cur = '';
      len = 0;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/**
 * vCard üretir.
 * compact: QR içine gömülecek kısa sürüm (fotoğraf, not ve sosyal hesaplar olmadan).
 * photo:   base64 JPEG (yalnızca indirilen .vcf için).
 * t:       src/i18n.js'teki dil sözlüğü (not ve etiket o dilde yazılır).
 */
export function toVCard(c = CARD, { compact = false, photo = '', t = null } = {}) {
  const a = c.address;
  if (compact) {
    // QR'a sığması için en kısa hâli: telefon kamerası bunu doğrudan "Kişi ekle" olarak açar.
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${esc(c.lastName)};${esc(c.firstName)}`,
      `FN:${esc(fullName(c))}`,
      `ORG:${esc(c.company)}`,
      c.title && `TITLE:${esc(c.title)}`,
      `TEL;TYPE=CELL:${c.phone}`,
      `EMAIL:${c.email}`,
      `URL:${c.brands.immoviewer.url}`,
      `ADR:;;${esc(a.street.split(',').pop().trim())} ${esc(a.building.match(/\d[\d/-]*/)?.[0] || '')};${esc(a.district)};${esc(a.city)};${esc(a.postal)};${esc(a.country)}`,
      'END:VCARD',
    ].filter(Boolean).join('\r\n');
  }
  const L = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(c.lastName)};${esc(c.firstName)};;;`,
    `FN:${esc(fullName(c))}`,
    // Şirket (asıl) ; bölüm/marka
    `ORG:${esc(c.company)};${esc(c.org)}`,
    ...(c.title ? [`TITLE:${esc(c.title)}`] : []),
    `TEL;TYPE=CELL,VOICE:${c.phone}`,
    `EMAIL;TYPE=INTERNET,WORK:${c.email}`,
    `item1.URL:${c.brands.immoviewer.url}`,
    'item1.X-ABLabel:immoviewer',
  ];
  if (!compact) {
    L.push(`item2.URL:${c.brands.bottimmo.url}`, 'item2.X-ABLabel:BOTTIMMO');
    L.push(`item3.URL:${c.url}`, `item3.X-ABLabel:${esc(t?.vcardLabel || 'Dijital kartvizit')}`);
  }
  L.push(
    `ADR;TYPE=WORK:;${esc(a.building)};${esc(a.street)};${esc(a.district)};${esc(a.city)};${esc(a.postal)};${esc(a.country)}`
  );
  if (!compact) {
    if (t) L.push(`NOTE:${esc(`${c.brands.immoviewer.name}: ${t.ivTagline}\n${c.brands.bottimmo.name}: ${t.btTagline}`)}`);
    for (const s of c.social) L.push(`X-SOCIALPROFILE;TYPE=${s.id}:${s.url}`);
    if (photo) L.push(`PHOTO;ENCODING=b;TYPE=JPEG:${photo}`);
  }
  L.push('END:VCARD');
  return L.map(fold).join('\r\n') + '\r\n';
}
