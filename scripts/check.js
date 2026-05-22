const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  'index.html',
  'src/main.js',
  'src/preload.js',
  'src/renderer.js',
  'src/styles.css',
  'assets/mdviewer.svg',
  'bin/mdviewer',
  'README.md',
  'LICENSE',
  '.gitignore',
  'node_modules/marked/lib/marked.umd.js',
  'node_modules/dompurify/dist/purify.min.js',
  'node_modules/@highlightjs/cdn-assets/highlight.min.js',
  'node_modules/@highlightjs/cdn-assets/styles/github.min.css',
  'node_modules/github-markdown-css/github-markdown-light.css',
  'node_modules/lucide-static/icons/folder-open.svg',
  'node_modules/lucide-static/icons/save.svg',
  'node_modules/lucide-static/icons/save-all.svg',
  'scripts/install-desktop.js',
  'scripts/uninstall-desktop.js'
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));

if (missing.length > 0) {
  console.error(`Missing required files:\n${missing.map((file) => `- ${file}`).join('\n')}`);
  process.exit(1);
}

console.log('MD Viewer check passed.');
