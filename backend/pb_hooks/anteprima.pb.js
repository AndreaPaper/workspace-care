/// <reference path="../pb_data/types.d.ts" />

// New link: fetch the page and fill the preview before the record is saved,
// so the API response already contains title, site, price and image.
onRecordCreateRequest((e) => {
  // Only web pages make sense as links; reject ftp:, file: and other schemes up front.
  if (!/^https?:\/\//i.test(e.record.getString('url'))) {
    throw new BadRequestError('Il link deve iniziare con http:// o https://');
  }
  const preview = require(`${__hooks}/lib/preview.js`);
  preview.fillPreview(e.record);
  e.next();
}, 'link_idea');

// Manual fallback: when immagine_url changes, download that image into the file field.
onRecordUpdateRequest((e) => {
  const preview = require(`${__hooks}/lib/preview.js`);
  const newUrl = e.record.getString('immagine_url');
  const oldUrl = e.record.original().getString('immagine_url');
  if (newUrl && newUrl !== oldUrl) {
    const file = preview.downloadImage(newUrl);
    if (file) {
      e.record.set('immagine', file);
      e.record.set('stato_anteprima', 'parziale');
    }
  }
  e.next();
}, 'link_idea');
