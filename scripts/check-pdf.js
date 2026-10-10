const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { getPrintOptions, renderPdf } = require('../src/pdf');

const defaults = { pageSize: 'A4', orientation: 'portrait', scale: 100, margin: 12, background: true, pageBreaks: false };
if (!process.versions.electron) {
  const options = getPrintOptions(defaults);
  assert.equal(options.landscape, false);
  assert.equal(options.scale, 1);
  assert.ok(Math.abs(options.pageSize.width * 25.4 - 210) < 0.001);
  assert.equal(getPrintOptions({ ...defaults, scale: 75 }).scale, 0.75);
  for (const bad of [{ pageSize: '__proto__' }, { pageSize: 'constructor' }, { scale: NaN }, { scale: '100' }, { scale: 201 }, { margin: -1 }, { margin: 51 }, { orientation: 'sideways' }, { background: 'true' }, { pageBreaks: null }, { pageSize: 'custom', width: 50, height: 50, margin: 25 }]) {
    assert.throws(() => getPrintOptions({ ...defaults, ...bad }));
  }
  assert.throws(() => getPrintOptions(null));
  const wide = getPrintOptions({ ...defaults, pageSize: '16:9', orientation: 'landscape' });
  assert.ok(Math.abs(wide.pageSize.height / wide.pageSize.width - 16 / 9) < 0.00001);
  const custom = getPrintOptions({ ...defaults, pageSize: 'custom', width: 320, height: 180, orientation: 'landscape' });
  assert.ok(Math.abs(custom.pageSize.height * 25.4 - 320) < 0.001);
  console.log('PDF option validation checks passed.');
  if (process.argv[2]) {
    const { spawnSync } = require('node:child_process');
    const result = spawnSync(require('electron'), [__filename, path.resolve(process.argv[2]), ...(process.argv[3] ? [path.resolve(process.argv[3])] : [])], { stdio: 'inherit', timeout: 120000, killSignal: 'SIGKILL' });
    if (result.error) console.error(result.error.message);
    process.exitCode = result.status === 0 ? 0 : 1;
  }
} else {
  const { app, BrowserWindow, ipcMain } = require('electron');
  app.disableHardwareAcceleration();
  setTimeout(() => { console.error('PDF export check timed out'); app.exit(1); }, 110000);
  app.whenReady().then(async () => {
    let temporary;
    let exitCode = 0;
    try {
      const filePath = process.argv[2];
      const original = await fs.readFile(filePath, 'utf8');
      temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'mdviewer-pdf-check-'));
      const output = process.argv[3] || path.join(temporary, 'output');
      await fs.mkdir(output, { recursive: true });
      const root = path.resolve(__dirname, '..');
      const window = new BrowserWindow({ show: false, webPreferences: {
        preload: path.join(root, 'src/preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false
      } });
      ipcMain.handle('file:load', () => ({ filePath, name: path.basename(filePath), content: original }));
      await window.loadFile(path.join(root, 'index.html'));
      window.webContents.send('file:open-path', { filePath, prompt: false });
      for (let i = 0; i < 50; i++) {
        const ready = await window.webContents.executeJavaScript(`window.__mdViewerGetState().filePath === ${JSON.stringify(filePath)}`);
        if (ready) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.equal((await window.webContents.executeJavaScript('window.__mdViewerGetState()')).filePath, filePath);
      const vm = require('node:vm');
      const main = await fs.readFile(path.join(root, 'src/main.js'), 'utf8');
      const start = main.indexOf("ipcMain.handle('file:export-pdf'");
      const end = main.indexOf("ipcMain.handle('dialog:unsaved'", start);
      let handler;
      let selection = { canceled: true };
      let overwriteResponse = 1;
      vm.runInNewContext(main.slice(start, end), {
        ipcMain: { handle(_name, callback) { handler = callback; } }, mainWindow: window,
        getPrintOptions, renderPdf, pdfExportBusy: false, fs, fsSync: require('node:fs'), path,
        randomUUID: require('node:crypto').randomUUID, app,
        dialog: { showSaveDialog: async () => selection, showMessageBox: async () => ({ response: overwriteResponse }) }
      });
      ipcMain.handle('file:export-pdf', handler);
      await assert.rejects(handler({ sender: {} }, defaults), /document window/);
      await assert.rejects(handler({ sender: window.webContents }, { ...defaults, scale: 201 }), /Scale/);
      assert.equal(await handler({ sender: window.webContents }, defaults), null);
      await window.webContents.executeJavaScript('document.getElementById("exportPdfButton").click(); document.getElementById("pdfPageSize").value = "16:9"; document.getElementById("pdfPageSize").dispatchEvent(new Event("change"));');
      const ui = await window.webContents.executeJavaScript('({open: document.getElementById("pdfDialog").open, orientation: document.getElementById("pdfOrientation").value, breaks: document.getElementById("pdfForm").elements.pageBreaks.checked})');
      assert.equal(ui.open, true);
      assert.equal(ui.orientation, 'landscape');
      assert.equal(ui.breaks, true);
      await window.webContents.executeJavaScript('document.getElementById("pdfForm").requestSubmit();');
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(await window.webContents.executeJavaScript('document.getElementById("pdfSubmit").disabled'), false);
      assert.equal(await window.webContents.executeJavaScript('document.getElementById("pdfError").textContent'), '');
      await window.webContents.executeJavaScript('document.getElementById("pdfDialog").close();');
      await window.webContents.executeJavaScript('document.getElementById("editor").value += "\\n\\nUnsaved export check";');
      assert.match((await window.webContents.executeJavaScript('window.__mdViewerGetPdfSnapshot()')).html, /Unsaved export check/);
      await window.webContents.executeJavaScript(`document.getElementById('editor').value = ${JSON.stringify(original)};`);
      const snapshot = await window.webContents.executeJavaScript('window.__mdViewerGetPdfSnapshot()');
      assert.doesNotMatch(snapshot.html, /marp: true|section \{/);
      console.log(`Document loaded: ${path.basename(filePath)}; images: ${(snapshot.html.match(/<img /g) || []).length}; math: ${(snapshot.html.match(/class="katex"/g) || []).length}`);
      const protectedFile = path.join(temporary, 'protected.pdf');
      await fs.writeFile(protectedFile, 'existing PDF');
      selection = { canceled: false, filePath: protectedFile };
      await window.webContents.executeJavaScript('document.getElementById("editor").value = "![Missing](file:///missing/mdviewer-image.png)";');
      await assert.rejects(handler({ sender: window.webContents }, defaults), /image could not be loaded/);
      assert.equal(await fs.readFile(protectedFile, 'utf8'), 'existing PDF');
      assert.equal((await fs.readdir(temporary)).filter(name => name.endsWith('.tmp')).length, 0);
      selection = { canceled: false, filePath: protectedFile.slice(0, -4) };
      assert.equal(await handler({ sender: window.webContents }, defaults), null);
      assert.equal(await fs.readFile(protectedFile, 'utf8'), 'existing PDF');
      await window.webContents.executeJavaScript(`document.getElementById('editor').value = ${JSON.stringify(original)};`);
      const cases = [
        ['a4-portrait-100', defaults],
        ['a4-landscape-80', { ...defaults, orientation: 'landscape', scale: 80 }],
        ['widescreen-16x9-100', { ...defaults, pageSize: '16:9', orientation: 'landscape', pageBreaks: true }],
        ['standard-4x3-100', { ...defaults, pageSize: '4:3', orientation: 'landscape', pageBreaks: true }],
        ['custom-320x180-75', { ...defaults, pageSize: 'custom', width: 320, height: 180, orientation: 'landscape', scale: 75, pageBreaks: true }]
      ];
      for (const [name, settings] of cases) {
        const destination = path.join(output, `${name}.pdf`);
        selection = { canceled: false, filePath: destination };
        const result = await handler({ sender: window.webContents }, settings);
        assert.equal(result.filePath, destination);
        const pdf = await fs.readFile(destination);
        assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
        console.log(`Exported: ${destination} (${pdf.length} bytes)`);
      }
      assert.equal(await fs.readFile(filePath, 'utf8'), original);
      console.log('PDF export checks passed: settings, UI, cancellation, unsaved content, safe overwrite, image errors, and real PDF generation.');
    } catch (error) { console.error(error); exitCode = 1; }
    finally { if (temporary) await fs.rm(temporary, { recursive: true, force: true }); }
    app.exit(exitCode);
  });
}
