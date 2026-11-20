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

// Image of the page: og:image first, then the usual alternatives. Shops such as Amazon have no og:image: their
// product page carries the picture in the "landingImage" element and in a "hiRes" script entry.
function jsonLdImage(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const found = findImage(JSON.parse(m[1]));
      if (found) return found;
    } catch (_) {
      // ignore malformed JSON-LD
    }
  }
  return '';
}

function findImage(node) {
  if (!node || typeof node !== 'object') return '';
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findImage(n);
      if (r) return r;
    }
    return '';
  }
  const img = node.image;
  if (typeof img === 'string') return img;
  if (Array.isArray(img) && img.length) return typeof img[0] === 'string' ? img[0] : (img[0] && img[0].url) || '';
  if (img && img.url) return img.url;
  if (node['@graph']) return findImage(node['@graph']);
  return '';
}

function amazonImage(html) {
  const hi = /"hiRes"\s*:\s*"(https?:[^"]+)"/.exec(html);
  if (hi) return hi[1].replace(/\\\//g, '/');
  const tag = /<img[^>]+id=["'](?:landingImage|imgBlkFront|ebooksImgBlkFront)["'][^>]*>/i.exec(html);
  if (tag) {
    const old = /data-old-hires=["'](https?:[^"']+)["']/i.exec(tag[0]);
    if (old) return decodeEntities(old[1]);
    const dyn = /data-a-dynamic-image=["']\{&quot;(https?:[^&]+)&quot;/i.exec(tag[0]) || /data-a-dynamic-image=["']\{"(https?:[^"]+)"/i.exec(tag[0]);
    if (dyn) return decodeEntities(dyn[1]);
    const src = /\ssrc=["'](https?:[^"']+)["']/i.exec(tag[0]);
    if (src) return decodeEntities(src[1]);
  }
  return '';
}

function extractImage(html, pageUrl) {
  const link = /<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/i.exec(html);
  const candidates = [
    meta(html, 'og:image:secure_url'),
    meta(html, 'og:image'),
    meta(html, 'twitter:image'),
    meta(html, 'twitter:image:src'),
    link ? decodeEntities(link[1]) : '',
    jsonLdImage(html),
    amazonImage(html),
  ];
  for (const c of candidates) {
    const abs = absoluteUrl(pageUrl, c);
    if (abs) return abs;
  }
  return '';
}

function extractPrice(html) {
  const amount = meta(html, 'product:price:amount') || meta(html, 'og:price:amount');
  if (amount) {
    const cur = meta(html, 'product:price:currency') || meta(html, 'og:price:currency');
    return amount + (cur ? ' ' + cur : '');
  }
  const fromLd = priceFromJsonLd(html);
  if (fromLd) return fromLd;
  // Amazon: the first displayed price ("6,99€") of the page.
  const shown = /<span class="a-price[^"]*"[^>]*>\s*<span class="a-offscreen">([^<]+)<\/span>/i.exec(html);
  return shown ? decodeEntities(shown[1]).trim() : '';
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
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
      },
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const html = String(res.raw || '').slice(0, 1500000);
      const titolo = meta(html, 'og:title') || decodeEntities((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [, ''])[1]).trim();
      const sito = meta(html, 'og:site_name') || (/^https?:\/\/([^\/]+)/i.exec(url) || [, ''])[1];
      const prezzo = extractPrice(html);
      const imageUrl = extractImage(html, url);
      if (titolo) record.set('titolo', titolo);
      if (sito) record.set('sito', sito);
      if (prezzo) record.set('prezzo', prezzo);
      // A retry keeps the picture that is already there (e.g. a screenshot added by hand).
      let hasImage = !!record.getString('immagine');
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

module.exports = { fillPreview, downloadImage, extractImage, extractPrice };
