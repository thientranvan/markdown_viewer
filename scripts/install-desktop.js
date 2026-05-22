const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const appRoot = path.resolve(__dirname, '..');
const home = os.homedir();
const applicationsDir = path.join(home, '.local', 'share', 'applications');
const desktopFile = path.join(applicationsDir, 'mdviewer.desktop');
const launcher = path.join(appRoot, 'bin', 'mdviewer');
const icon = path.join(appRoot, 'assets', 'mdviewer.svg');
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
  if (!commandExists(command)) {
    return false;
  }

  const result = spawnSync(command, args, { stdio: 'inherit' });
  return result.status === 0;
}

function desktopEscape(value) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '');
}

fs.mkdirSync(applicationsDir, { recursive: true });
fs.mkdirSync(mimePackagesDir, { recursive: true });
fs.chmodSync(launcher, 0o755);

const desktopEntry = [
  '[Desktop Entry]',
  'Type=Application',
  'Name=MD Viewer',
  'Comment=View and edit Markdown files',
  `Exec=${desktopEscape(launcher)} %F`,
  `Icon=${desktopEscape(icon)}`,
  'Terminal=false',
  'Categories=Utility;TextEditor;',
  'MimeType=text/markdown;text/x-markdown;',
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
