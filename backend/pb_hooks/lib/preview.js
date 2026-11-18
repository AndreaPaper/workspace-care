// Link preview helpers. Loaded with require() inside the hook handlers.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Value of <meta property|name="key" content="...">, attributes in either order.
function meta(html, key) {
  const k = key.replace(/[:.]/g, '\\$&');
  const a = new RegExp('<meta[^>]+(?:property|name)=["\']' + k + '["\'][^>]*content=["\']([^"\']*)["\']', 'i').exec(html);
  if (a) return decodeEntities(a[1]);
  const b = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' + k + '["\']', 'i').exec(html);
  return b ? decodeEntities(b[1]) : '';
}

function absoluteUrl(base, maybe) {
  if (!maybe) return '';
  if (/^https?:\/\//i.test(maybe)) return maybe;
  const origin = /^(https?:\/\/[^\/]+)/i.exec(base);
  if (!origin) return '';
  if (maybe.startsWith('//')) return base.split(':')[0] + ':' + maybe;
  if (maybe.startsWith('/')) return origin[1] + maybe;
  return base.replace(/[^\/]*$/, '') + maybe;
}

function priceFromJsonLd(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const found = findOffer(JSON.parse(m[1]));
      if (found) return found;
    } catch (_) {
      // ignore malformed JSON-LD
    }
  }
  return '';
}

function findOffer(node) {
  if (!node || typeof node !== 'object') return '';
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findOffer(n);
      if (r) return r;
    }
    return '';
  }
  if (node.offers) {
    const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
    const price = offers && (offers.price || offers.lowPrice);
    if (price) return String(price) + (offers.priceCurrency ? ' ' + offers.priceCurrency : '');
  }
  if (node['@graph']) return findOffer(node['@graph']);
  return '';
}

function extractPrice(html) {
  const amount = meta(html, 'product:price:amount') || meta(html, 'og:price:amount');
  if (amount) {
    const cur = meta(html, 'product:price:currency') || meta(html, 'og:price:currency');
    return amount + (cur ? ' ' + cur : '');
  }
  return priceFromJsonLd(html);
}

function extensionFor(contentType) {
  if (/png/i.test(contentType)) return '.png';
  if (/webp/i.test(contentType)) return '.webp';
  if (/gif/i.test(contentType)) return '.gif';
  return '.jpg';
}

// Returns a $filesystem.File or null. Never throws.
function downloadImage(url) {
  try {
    const res = $http.send({ url: url, method: 'GET', timeout: 10, headers: { 'User-Agent': UA, Accept: 'image/*' } });
    if (res.statusCode !== 200 || !res.body || res.body.length === 0 || res.body.length > MAX_IMAGE_BYTES) return null;
    const ct = String((res.headers['Content-Type'] || [''])[0]);
    if (ct && !/^image\//i.test(ct)) return null;
    return $filesystem.fileFromBytes(res.body, 'anteprima' + extensionFor(ct));
  } catch (_) {
    return null;
  }
}

// Fills titolo, sito, prezzo, immagine and stato_anteprima on the record. Never throws.
function fillPreview(record) {
  let status = 'fallita';
  try {
    const url = record.getString('url');
    const res = $http.send({
      url: url,
      method: 'GET',
      timeout: 10,
      headers: { 'User-Agent': UA, 'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8', Accept: 'text/html' },
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const html = String(res.raw || '').slice(0, 1500000);
      const titolo = meta(html, 'og:title') || decodeEntities((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [, ''])[1]).trim();
      const sito = meta(html, 'og:site_name') || (/^https?:\/\/([^\/]+)/i.exec(url) || [, ''])[1];
      const prezzo = extractPrice(html);
      const imageUrl = absoluteUrl(url, meta(html, 'og:image'));
      if (titolo) record.set('titolo', titolo);
      if (sito) record.set('sito', sito);
      if (prezzo) record.set('prezzo', prezzo);
      let hasImage = false;
      if (imageUrl) {
        const file = downloadImage(imageUrl);
        if (file) {
          record.set('immagine', file);
          hasImage = true;
        }
      }
      status = hasImage && titolo ? 'ok' : titolo || hasImage ? 'parziale' : 'fallita';
    }
  } catch (_) {
    status = 'fallita';
  }
  record.set('stato_anteprima', status);
}

module.exports = { fillPreview, downloadImage };
