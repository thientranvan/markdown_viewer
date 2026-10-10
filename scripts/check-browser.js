const path = require('node:path');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process');
  const result = spawnSync(require('electron'), [__filename, root], { stdio: 'inherit', timeout: 25000, killSignal: 'SIGKILL' });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status === 0 ? 0 : 1;
} else {
  const { app, BrowserWindow } = require('electron');
  const assert = require('node:assert/strict');
  app.disableHardwareAcceleration();
  setTimeout(() => { console.error('Browser check timed out'); app.exit(1); }, 20000);
  app.whenReady().then(async () => {
    try {
      const window = new BrowserWindow({ show: false, webPreferences: {
        preload: path.join(root, 'src/preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false
      } });
      await window.loadFile(path.join(root, 'index.html'));
      const markdown = '---\nmarp: true\nstyle: |\n  section { color: red; }\n---\n# 2DEG\n\n$$ N_D L = n_{2D} $$\n\nMật độ $n_{2D}$.\n\n<img src="missing.png" onerror="window.compromised=true">';
      await window.webContents.executeJavaScript(`document.getElementById('editor').value = ${JSON.stringify(markdown)}; document.getElementById('editor').dispatchEvent(new Event('input'));`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const state = await window.webContents.executeJavaScript(`({
        math: document.querySelectorAll('#preview .katex').length,
        mathML: document.querySelectorAll('#preview math').length,
        text: document.getElementById('preview').textContent,
        unsafe: document.querySelectorAll('#preview [onerror]').length,
        compromised: Boolean(window.compromised),
        source: document.querySelector('#preview h1').dataset.sourceStart
      })`);
      assert.equal(state.math, 2);
      assert.equal(state.mathML, 2);
      assert.doesNotMatch(state.text, /marp:|section \{/);
      assert.equal(state.unsafe, 0);
      assert.equal(state.compromised, false);
      assert.equal(state.source, '6');
      console.log('Browser rendering and HTML sanitization checks passed.');
      app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
  });
}
