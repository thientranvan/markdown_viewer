const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function getPrintOptions(settings) {
  if (!settings || typeof settings !== 'object') throw new Error('PDF settings are required.');
  const sizes = { A4: [210, 297], A3: [297, 420], Letter: [215.9, 279.4], '16:9': [338.6666667, 190.5], '4:3': [254, 190.5] };
  const size = settings.pageSize === 'custom' ? [settings.width, settings.height]
    : typeof settings.pageSize === 'string' && Object.hasOwn(sizes, settings.pageSize) ? sizes[settings.pageSize] : null;
  if (!size || !size.every((value) => Number.isFinite(value) && value >= 50 && value <= 1000)) {
    throw new Error('Choose a supported paper size or dimensions between 50 and 1000 mm.');
  }
  if (!['portrait', 'landscape'].includes(settings.orientation)) throw new Error('Choose portrait or landscape.');
  if (!Number.isFinite(settings.scale) || settings.scale < 25 || settings.scale > 200) throw new Error('Scale must be between 25% and 200%.');
  if (!Number.isFinite(settings.margin) || settings.margin < 0 || settings.margin > 50 || settings.margin * 2 > Math.min(...size) - 10) {
    throw new Error('Margins must be between 0 and 50 mm and leave at least 10 mm of page content.');
  }
  if (typeof settings.background !== 'boolean' || typeof settings.pageBreaks !== 'boolean') throw new Error('Invalid PDF display settings.');
  const margin = settings.margin / 25.4;
  return {
    pageSize: { width: Math.min(...size) / 25.4, height: Math.max(...size) / 25.4 },
    landscape: settings.orientation === 'landscape', scale: settings.scale / 100,
    margins: { top: margin, bottom: margin, left: margin, right: margin },
    printBackground: settings.background, preferCSSPageSize: false, displayHeaderFooter: false,
    generateTaggedPDF: true
  };
}

async function renderPdf(html, settings) {
  const options = getPrintOptions(settings);
  if (typeof html !== 'string') throw new Error('PDF content must be HTML.');
  const { BrowserWindow } = require('electron');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdviewer-pdf-'));
  let window;
  try {
    const root = path.resolve(__dirname, '..');
    const styles = ['node_modules/github-markdown-css/github-markdown-light.css',
      'node_modules/@highlightjs/cdn-assets/styles/github.min.css', 'node_modules/katex/dist/katex.min.css', 'src/styles.css']
      .map((file) => `<link rel="stylesheet" href="${pathToFileURL(path.join(root, file)).href.replace(/&/g, '&amp;')}">`).join('\n');
    const height = options.landscape ? options.pageSize.width : options.pageSize.height;
    // ponytail: reserve 2.5 inches for slide text; add per-section fitting for strict one-page slides.
    const imageHeight = Math.max(0.5, (height - options.margins.top * 2) / options.scale - (settings.pageBreaks ? 2.5 : 1.5));
    const document = `<!doctype html><html lang="en"><head><meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src file: 'unsafe-inline'; img-src file: data: https: http:; font-src file: data:; script-src 'none'">
      ${styles}</head><body class="pdf-export" data-pdf-breaks="${settings.pageBreaks}" data-pdf-background="${settings.background}" style="--pdf-image-height: ${imageHeight}in">
      <article id="preview" class="markdown-body">${html}</article></body></html>`;
    const file = path.join(directory, 'document.html');
    await fs.writeFile(file, document, 'utf8');
    window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event) => event.preventDefault());
    await window.loadFile(file);
    const resourceError = await window.webContents.executeJavaScript(`Promise.race([
      (async () => {
        await document.fonts.ready;
        const images = Array.from(document.images);
        await Promise.all(images.map(image => image.decode().catch(() => {
          throw new Error('An image could not be loaded. Check image paths and your connection, then retry.');
        })));
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('PDF resources took too long to load. Retry after checking images and fonts.')), 15000))
    ]).catch(error => error.message)`);
    if (resourceError) throw new Error(resourceError);
    return await window.webContents.printToPDF(options);
  } finally {
    if (window && !window.isDestroyed()) window.destroy();
    await fs.rm(directory, { recursive: true, force: true });
  }
}

module.exports = { getPrintOptions, renderPdf };
