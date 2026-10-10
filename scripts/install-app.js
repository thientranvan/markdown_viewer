const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const home = os.homedir();
const bundleId = 'com.thientranvan.markdown-viewer';
const copyOptions = { recursive: true, verbatimSymlinks: true };

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} failed: ${result.error?.message || result.status}`);
  }
}

function backup(target) {
  if (!fs.existsSync(target)) return null;
  const directory = path.join(path.dirname(target), '.md-viewer-backups');
  fs.mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, `${Date.now()}-${path.basename(target)}`);
  fs.renameSync(target, destination);
  console.log(`Previous installation saved: ${destination}`);
  return destination;
}

function installMac() {
  const systemApp = '/Applications/MD Viewer.app';
  let applications = path.join(home, 'Applications');
  if (fs.existsSync(systemApp)) {
    const info = spawnSync('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', path.join(systemApp, 'Contents/Info.plist')], { encoding: 'utf8' });
    if (info.status === 0 && info.stdout.trim() === bundleId) {
      try {
        fs.accessSync('/Applications', fs.constants.W_OK);
        applications = '/Applications';
      } catch {
        console.log('System app is not writable; installing a separate app in ~/Applications.');
      }
    }
  }
  fs.mkdirSync(applications, { recursive: true });
  const target = path.join(applications, 'MD Viewer.app');
  const running = spawnSync('/usr/bin/pgrep', ['-f', `${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/Contents/MacOS/Electron`]);
  if (running.status === 0) throw new Error('Save your documents and close MD Viewer, then run the installer again.');
  const stage = fs.mkdtempSync(path.join(applications, '.md-viewer-install-'));
  const stagedApp = path.join(stage, 'MD Viewer.app');
  let previous = null;
  let installed = false;
  try {
    const electron = require('electron');
    const electronApp = path.resolve(electron, '../../..');
    fs.cpSync(electronApp, stagedApp, copyOptions);
    const contents = path.join(stagedApp, 'Contents');
    const resources = path.join(contents, 'Resources');
    fs.rmSync(path.join(resources, 'default_app.asar'), { force: true });
    const app = path.join(resources, 'app');
    fs.mkdirSync(app);
    for (const file of ['src', 'assets', 'index.html', 'package.json', 'LICENSE']) {
      fs.cpSync(path.join(root, file), path.join(app, file), copyOptions);
    }
    // ponytail: copy runtime browser assets only; use a packager when native modules are added.
    const runtimePackages = Object.keys(require('../package.json').dependencies).filter((name) => name !== 'electron');
    for (const name of runtimePackages) {
      fs.cpSync(path.join(root, 'node_modules', name), path.join(app, 'node_modules', name), copyOptions);
    }
    const iconset = path.join(stage, 'mdviewer.iconset');
    fs.mkdirSync(iconset);
    for (const size of [16, 32, 128, 256, 512]) {
      for (const scale of [1, 2]) {
        run('/usr/bin/sips', ['-z', String(size * scale), String(size * scale), path.join(root, 'assets/mdviewer.png'), '--out', path.join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`)]);
      }
    }
    run('/usr/bin/iconutil', ['-c', 'icns', iconset, '-o', path.join(resources, 'mdviewer.icns')]);
    const plist = path.join(contents, 'Info.plist');
    const version = require('../package.json').version;
    for (const [key, value] of Object.entries({ CFBundleIdentifier: bundleId, CFBundleName: 'MD Viewer', CFBundleDisplayName: 'MD Viewer', CFBundleIconFile: 'mdviewer.icns', CFBundleShortVersionString: version, CFBundleVersion: version })) {
      run('/usr/bin/plutil', ['-replace', key, '-string', value, plist]);
    }
    const extensions = ['md', 'markdown', 'mdown', 'mkd'];
    run('/usr/bin/plutil', ['-replace', 'CFBundleDocumentTypes', '-json', JSON.stringify([{
      CFBundleTypeName: 'Markdown Document', CFBundleTypeRole: 'Editor',
      CFBundleTypeExtensions: extensions, LSItemContentTypes: ['net.daringfireball.markdown'], LSHandlerRank: 'Owner'
    }]), plist]);
    run('/usr/bin/plutil', ['-replace', 'UTImportedTypeDeclarations', '-json', JSON.stringify([{
      UTTypeIdentifier: 'net.daringfireball.markdown', UTTypeDescription: 'Markdown Document',
      UTTypeConformsTo: ['public.plain-text'], UTTypeTagSpecification: { 'public.filename-extension': extensions, 'public.mime-type': 'text/markdown' }
    }]), plist]);
    run('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', stagedApp]);
    run('/usr/bin/codesign', ['--verify', '--deep', '--strict', stagedApp]);
    previous = backup(target);
    fs.renameSync(stagedApp, target);
    installed = true;
    run('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', ['-f', target]);
    run('/usr/bin/osascript', ['-l', 'JavaScript', '-e', `ObjC.import('CoreServices'); const status = $.LSSetDefaultRoleHandlerForContentType($('net.daringfireball.markdown'), $.kLSRolesAll, $('${bundleId}')); if (status !== 0) throw new Error('Markdown file association failed: ' + status);`]);
    console.log(`Installed: ${target}`);
  } catch (error) {
    if (installed) fs.rmSync(target, { recursive: true, force: true });
    if (previous) {
      fs.renameSync(previous, target);
      run('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', ['-f', target]);
    }
    throw error;
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

function installLinux() {
  const parent = path.join(home, '.local/share/md-viewer');
  fs.mkdirSync(parent, { recursive: true });
  const target = path.join(parent, 'app');
  if (root === target) {
    run(process.execPath, [path.join(root, 'scripts/install-desktop.js')]);
    return;
  }
  const stage = fs.mkdtempSync(path.join(parent, '.app-install-'));
  const stagedApp = path.join(stage, 'app');
  let previous = null;
  let installed = false;
  try {
    fs.cpSync(root, stagedApp, {
      ...copyOptions,
      filter: (file) => !['.git', 'dist'].includes(path.relative(root, file).split(path.sep)[0])
    });
    const sandbox = path.join(stagedApp, 'node_modules/electron/dist/chrome-sandbox');
    console.log('Configuring Electron sandbox helper (requires sudo)...');
    run('sudo', ['chown', 'root:root', sandbox]);
    run('sudo', ['chmod', '4755', sandbox]);
    previous = backup(target);
    fs.renameSync(stagedApp, target);
    installed = true;
    run(process.execPath, [path.join(target, 'scripts/install-desktop.js')]);
    console.log(`Installed: ${target}`);
  } catch (error) {
    if (installed) fs.rmSync(target, { recursive: true, force: true });
    if (previous) {
      fs.renameSync(previous, target);
      run(process.execPath, [path.join(target, 'scripts/install-desktop.js')]);
    }
    throw error;
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

try {
  if (process.platform === 'darwin') installMac();
  else if (process.platform === 'linux') installLinux();
  else throw new Error('Supported systems: macOS and Ubuntu/Debian desktop.');
} catch (error) {
  console.error(`Installation failed: ${error.message}`);
  process.exitCode = 1;
}
