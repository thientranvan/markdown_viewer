const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdviewer-install-check-'));
const root = path.resolve(__dirname, '..');
const desktopSource = fs.readFileSync(path.join(root, 'scripts/install-desktop.js'), 'utf8');
const installerSource = fs.readFileSync(path.join(root, 'scripts/install-app.js'), 'utf8');
try {
  const source = path.join(temp, 'Source with spaces $ and "quotes"');
  fs.mkdirSync(path.join(source, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(source, 'bin/mdviewer'), '#!/bin/bash\n');
  const calls = [];
  const home = path.join(temp, 'desktop-home');
  function desktop(status = 0, missing = false) {
    vm.runInNewContext(desktopSource, {
      __dirname: path.join(source, 'scripts'), process: { platform: 'linux' }, console: { log() {} },
      require(name) {
        if (name === 'node:os') return { homedir: () => home };
        if (name === 'node:child_process') return { spawnSync(command, args) {
          calls.push([command, args]);
          return { status: command === 'sh' ? (missing ? 1 : 0) : status };
        } };
        return require(name);
      }
    });
  }
  desktop();
  const entry = fs.readFileSync(path.join(home, '.local/share/applications/mdviewer.desktop'), 'utf8');
  assert.match(entry, /Exec=".*Source with spaces.*" %F/);
  assert.ok(entry.includes('\\\\$'));
  assert.ok(entry.includes('\\\\"quotes\\\\"'));
  assert.ok(calls.some(([command, args]) => command === 'xdg-mime' && args[0] === 'default'));
  assert.throws(() => desktop(1), /failed/);
  assert.equal(fs.readFileSync(path.join(home, ".local/share/applications/mdviewer.desktop"), "utf8"), entry);
  assert.throws(() => desktop(0, true), /Required desktop tool missing/);

  function linuxCase(shouldFail) {
    const home = path.join(temp, shouldFail ? 'rollback-home' : 'install-home');
    const target = path.join(home, '.local/share/md-viewer/app');
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'old-version'), 'keep me');
    const work = path.join(temp, shouldFail ? 'rollback-source' : 'install-source');
    fs.mkdirSync(path.join(work, 'node_modules/electron/dist'), { recursive: true });
    fs.writeFileSync(path.join(work, 'new-version'), 'new');
    fs.writeFileSync(path.join(work, 'node_modules/electron/dist/chrome-sandbox'), 'sandbox');
    const processMock = { platform: 'linux', execPath: process.execPath, exitCode: 0 };
    let registrations = 0;
    const commands = [];
    vm.runInNewContext(installerSource, {
      __dirname: path.join(work, 'scripts'), process: processMock,
      console: { log() {}, error() {} },
      require(name) {
        if (name === 'node:os') return { homedir: () => home };
        if (name === 'node:child_process') return { spawnSync(command, args) {
          commands.push([command, args]);
          if (command === process.execPath) {
            registrations++;
            if (shouldFail && registrations === 1) return { status: 1 };
          }
          return { status: 0 };
        } };
        return require(name);
      }
    });
    assert.ok(commands.some(([command, args]) => command === 'sudo' && args[0] === 'chown'));
    if (shouldFail) {
      assert.equal(processMock.exitCode, 1);
      assert.equal(fs.readFileSync(path.join(target, 'old-version'), 'utf8'), 'keep me');
      assert.equal(fs.existsSync(path.join(target, 'new-version')), false);
      assert.equal(registrations, 2);
    } else {
      assert.equal(processMock.exitCode, 0);
      assert.equal(fs.readFileSync(path.join(target, 'new-version'), 'utf8'), 'new');
      const backups = fs.readdirSync(path.join(path.dirname(target), '.md-viewer-backups'));
      assert.equal(backups.length, 1);
    }
  }
  linuxCase(false);
  linuxCase(true);
  const launcher = fs.readFileSync(path.join(root, 'bin/mdviewer'), 'utf8');
  assert.match(launcher, /node_modules\/electron\/dist\/electron/);
  assert.doesNotMatch(launcher, /node_modules\/\.bin\/electron/);
  const badArguments = spawnSync('bash', [path.join(root, 'install.sh'), '--bad'], { encoding: 'utf8' });
  assert.notEqual(badArguments.status, 0);
  const bootstrap = fs.readFileSync(path.join(root, 'install.sh'), 'utf8');
  const incomplete = spawnSync('bash', ['-c', bootstrap.slice(0, bootstrap.lastIndexOf('mdviewer_install "$@"'))], { encoding: 'utf8' });
  assert.equal(incomplete.status, 0);
  assert.equal(incomplete.stdout, '');
  console.log('Installer, desktop quoting, and rollback checks passed.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
