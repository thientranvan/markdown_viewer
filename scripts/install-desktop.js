const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const appRoot = path.resolve(__dirname, '..');
const home = os.homedir();
const applicationsDir = path.join(home, '.local', 'share', 'applications');
const desktopFile = path.join(applicationsDir, 'mdviewer.desktop');
const launcher = path.join(appRoot, 'bin', 'mdviewer');

if (process.platform !== 'linux') throw new Error('Desktop registration is Linux-only. Use npm run install-app on macOS.');
const icon = path.join(appRoot, 'assets', 'mdviewer.png');
const mimeBaseDir = path.join(home, '.local', 'share', 'mime');
const mimePackagesDir = path.join(mimeBaseDir, 'packages');
const mimeXmlFile = path.join(mimePackagesDir, 'mdviewer-markdown.xml');

function commandExists(command) {
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], {
    stdio: 'ignore'
  });
  return result.status === 0;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} failed: ${result.error?.message || result.status}`);
  }
}

function desktopEscape(value) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '').replace(/\r/g, '');
}

function execQuote(value) {
  return `"${desktopEscape(value.replace(/[\\"`$]/g, '\\$&'))}"`;
}

// Validate tools before writing desktop configuration.
for (const command of ['update-desktop-database', 'update-mime-database', 'xdg-mime', 'gio']) {
  if (!commandExists(command)) throw new Error(`Required desktop tool missing: ${command}`);
}

fs.mkdirSync(applicationsDir, { recursive: true });
fs.mkdirSync(mimePackagesDir, { recursive: true });
fs.chmodSync(launcher, 0o755);

const desktopEntry = [
  '[Desktop Entry]',
  'Type=Application',
  'Name=MD Viewer',
  'Comment=View and edit Markdown files',
  `Exec=${execQuote(launcher)} %F`,
  `Icon=${desktopEscape(icon)}`,
  'Terminal=false',
  'Categories=Utility;TextEditor;',
  'MimeType=text/markdown;text/x-markdown;',
  'StartupWMClass=markdown-viewer',
  'StartupNotify=true',
  ''
].join('\n');

const mimeXml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">',
  '  <mime-type type="text/markdown">',
  '    <comment>Markdown document</comment>',
  '    <glob pattern="*.md"/>',
  '    <glob pattern="*.markdown"/>',
  '    <glob pattern="*.mdown"/>',
  '    <glob pattern="*.mkd"/>',
  '  </mime-type>',
  '  <mime-type type="text/x-markdown">',
  '    <comment>Markdown document</comment>',
  '    <glob pattern="*.md"/>',
  '    <glob pattern="*.markdown"/>',
  '    <glob pattern="*.mdown"/>',
  '    <glob pattern="*.mkd"/>',
  '  </mime-type>',
  '</mime-info>',
  ''
].join('\n');

const configFiles = [desktopFile, mimeXmlFile,
  path.join(home, '.config/mimeapps.list'), path.join(applicationsDir, 'mimeapps.list')];
const previousConfig = configFiles.map((file) => ({
  file, content: fs.existsSync(file) ? fs.readFileSync(file) : null
}));

try {
  fs.writeFileSync(desktopFile, desktopEntry, 'utf8');
  fs.chmodSync(desktopFile, 0o755);
  fs.writeFileSync(mimeXmlFile, mimeXml, 'utf8');

  run('update-desktop-database', [applicationsDir]);
  run('update-mime-database', [mimeBaseDir]);
  run('xdg-mime', ['default', 'mdviewer.desktop', 'text/markdown']);
  run('xdg-mime', ['default', 'mdviewer.desktop', 'text/x-markdown']);
  run('gio', ['mime', 'text/markdown', 'mdviewer.desktop']);
  run('gio', ['mime', 'text/x-markdown', 'mdviewer.desktop']);

  console.log(`Installed desktop entry: ${desktopFile}`);
  console.log('Markdown files should now open with MD Viewer.');
} catch (error) {
  for (const { file, content } of previousConfig) {
    if (content === null) fs.rmSync(file, { force: true });
    else fs.writeFileSync(file, content);
  }
  // Refresh restored configuration without masking the original failure.
  spawnSync('update-desktop-database', [applicationsDir], { stdio: 'ignore' });
  spawnSync('update-mime-database', [mimeBaseDir], { stdio: 'ignore' });
  throw error;
}
