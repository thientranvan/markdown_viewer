const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

const appRoot = path.resolve(__dirname, '..');
const appIcon = path.join(appRoot, 'assets', 'mdviewer.png');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('class', 'mdviewer');
app.setName('MD Viewer');
if (typeof app.setDesktopName === 'function') {
  app.setDesktopName('mdviewer.desktop');
}

let mainWindow = null;
let pendingOpenPath = null;
let pendingPrompt = false;
let rendererReady = false;
let allowClose = false;
let smokePrinted = false;

function normalizeInputArg(arg, cwd) {
  if (!arg || arg.startsWith('-')) {
    return null;
  }

  if (arg.startsWith('file://')) {
    try {
      return fileURLToPath(arg);
    } catch {
      return null;
    }
  }

  return path.resolve(cwd || process.cwd(), arg);
}

function isOpenablePath(candidate) {
  try {
    const stat = fsSync.statSync(candidate);
    return stat.isFile() || stat.isDirectory();
  } catch {
    return false;
  }
}

function findInputPaths(argv, cwd) {
  return argv
    .slice(1)
    .map((arg) => normalizeInputArg(arg, cwd))
    .filter(Boolean)
    .filter((candidate) => candidate !== appRoot && isOpenablePath(candidate));
}

async function findMarkdownInDirectory(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const readme = files.find((name) => /^readme(?:\.(?:md|markdown|mdown|mkd))?$/i.test(name));
  if (readme) {
    return path.join(directoryPath, readme);
  }

  const markdown = files.find((name) => /\.(md|markdown|mdown|mkd)$/i.test(name));
  if (markdown) {
    return path.join(directoryPath, markdown);
  }

  throw new Error('Directory does not contain a Markdown file.');
}

async function resolveMarkdownTarget(inputPath) {
  const absolutePath = path.resolve(inputPath);
  const stat = await fs.stat(absolutePath);

  if (stat.isDirectory()) {
    return findMarkdownInDirectory(absolutePath);
  }

  if (!stat.isFile()) {
    throw new Error('Path is not a file.');
  }

  return absolutePath;
}

async function readMarkdownFile(filePath) {
  const absolutePath = await resolveMarkdownTarget(filePath);
  const stat = await fs.stat(absolutePath);

  let content = await fs.readFile(absolutePath, 'utf8');
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  return {
    filePath: absolutePath,
    name: path.basename(absolutePath),
    content,
    mtimeMs: stat.mtimeMs
  };
}

function sendOpenPath(filePath, prompt) {
  if (!mainWindow || !rendererReady) {
    pendingOpenPath = filePath;
    pendingPrompt = prompt;
    return;
  }

  mainWindow.webContents.send('file:open-path', {
    filePath,
    prompt: Boolean(prompt)
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('app:command', 'open')
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('app:command', 'save')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send('app:command', 'save-as')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Preview',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow?.webContents.send('app:command', 'mode-preview')
        },
        {
          label: 'Split',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow?.webContents.send('app:command', 'mode-split')
        },
        {
          label: 'Edit',
          accelerator: 'CmdOrCtrl+3',
          click: () => mainWindow?.webContents.send('app:command', 'mode-edit')
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function saveState(state) {
  let targetPath = state.filePath;

  if (!targetPath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Markdown',
      defaultPath: path.join(app.getPath('documents'), 'untitled.md'),
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    targetPath = result.filePath;
  }

  await fs.writeFile(targetPath, state.content, 'utf8');
  return targetPath;
}

async function requestClose(window) {
  if (allowClose) {
    return;
  }

  const state = await window.webContents.executeJavaScript('window.__mdViewerGetState && window.__mdViewerGetState()');
  if (!state || !state.dirty) {
    allowClose = true;
    window.close();
    return;
  }

  const result = await dialog.showMessageBox(window, {
    type: 'warning',
    title: 'Unsaved changes',
    message: `${state.name || 'Untitled'} has unsaved changes.`,
    detail: 'Save changes before closing?',
    buttons: ['Save', 'Discard', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  });

  if (result.response === 2) {
    return;
  }

  if (result.response === 0) {
    const savedPath = await saveState(state);
    if (!savedPath) {
      return;
    }
  }

  allowClose = true;
  window.close();
}

function createWindow(initialFilePath) {
  rendererReady = false;
  if (initialFilePath) {
    pendingOpenPath = initialFilePath;
    pendingPrompt = false;
  }

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 760,
    minHeight: 520,
    show: false,
    icon: appIcon,
    backgroundColor: '#f6f7f9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(appRoot, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (allowClose) {
      return;
    }

    event.preventDefault();
    requestClose(mainWindow).catch((error) => {
      dialog.showErrorBox('Close failed', error.message);
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('file:load', async (_event, filePath) => readMarkdownFile(filePath));

ipcMain.handle('file:open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Markdown',
    properties: ['openFile', 'openDirectory'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return readMarkdownFile(result.filePaths[0]);
});

ipcMain.handle('file:save', async (_event, payload) => {
  const targetPath = path.resolve(payload.filePath);
  await fs.writeFile(targetPath, payload.content, 'utf8');
  return readMarkdownFile(targetPath);
});

ipcMain.handle('file:save-as', async (_event, payload) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Markdown',
    defaultPath: payload.suggestedPath || path.join(app.getPath('documents'), 'untitled.md'),
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  await fs.writeFile(result.filePath, payload.content, 'utf8');
  return readMarkdownFile(result.filePath);
});

ipcMain.handle('dialog:unsaved', async (_event, name) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Unsaved changes',
    message: `${name || 'Untitled'} has unsaved changes.`,
    detail: 'Save changes before opening another file?',
    buttons: ['Save', 'Discard', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  });

  return ['save', 'discard', 'cancel'][result.response] || 'cancel';
});

ipcMain.handle('shell:open-external', async (_event, target) => {
  const url = new URL(target);
  if (!['http:', 'https:', 'mailto:', 'file:'].includes(url.protocol)) {
    throw new Error(`Unsupported URL scheme: ${url.protocol}`);
  }

  await shell.openExternal(target);
});

ipcMain.handle('shell:open-path', async (_event, targetPath) => {
  return shell.openPath(targetPath);
});

ipcMain.on('app:set-dirty', (_event, dirty) => {
  if (mainWindow) {
    mainWindow.setDocumentEdited(Boolean(dirty));
  }
});

ipcMain.on('app:renderer-ready', () => {
  rendererReady = true;
  if (!pendingOpenPath) {
    return;
  }

  const filePath = pendingOpenPath;
  const prompt = pendingPrompt;
  pendingOpenPath = null;
  pendingPrompt = false;
  sendOpenPath(filePath, prompt);

  if (process.env.MDVIEWER_SMOKE_STATE === '1' && !smokePrinted) {
    smokePrinted = true;
    setTimeout(async () => {
      try {
        const state = await mainWindow.webContents.executeJavaScript('window.__mdViewerGetState && window.__mdViewerGetState()');
        const renderState = await mainWindow.webContents.executeJavaScript(`(() => {
          const anchors = Array.from(document.querySelectorAll('[data-source-start]'));
          const editor = document.getElementById('editor');
          const previewPane = document.querySelector('.preview-pane');
          const initialPreviewTop = previewPane?.scrollTop || 0;
          if (editor) {
            editor.scrollTop = 220;
            editor.dispatchEvent(new Event('scroll'));
          }
          return new Promise((resolve) => {
            setTimeout(() => {
              const previewAfterEditor = previewPane?.scrollTop || 0;
              const editorBeforePreview = editor?.scrollTop || 0;
              if (previewPane) {
                previewPane.scrollTop = Math.min(900, previewPane.scrollHeight - previewPane.clientHeight);
                previewPane.dispatchEvent(new Event('scroll'));
              }
              setTimeout(() => resolve({
                anchorCount: anchors.length,
                firstAnchor: anchors[0] ? {
                  tag: anchors[0].tagName,
                  start: anchors[0].dataset.sourceStart,
                  end: anchors[0].dataset.sourceEnd
                } : null,
                previewMoved: Boolean(previewPane && Math.abs(previewAfterEditor - initialPreviewTop) > 1),
                editorMoved: Boolean(editor && Math.abs(editor.scrollTop - editorBeforePreview) > 1)
              }), 240);
            }, 240);
          });
        })()`);
        console.log(JSON.stringify({
          filePath: state?.filePath || null,
          name: state?.name || null,
          contentLength: state?.content?.length || 0,
          firstLine: state?.content?.split('\n')[0] || '',
          ...renderState
        }));
      } catch (error) {
        console.error(`Smoke state failed: ${error.message}`);
        process.exitCode = 1;
      } finally {
        allowClose = true;
        app.quit();
      }
    }, 1200);
  }
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();
const startupFiles = findInputPaths(process.argv, process.cwd());

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv, cwd) => {
    const files = findInputPaths(argv, cwd);
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      if (files[0]) {
        sendOpenPath(files[0], true);
      }
    }
  });

  app.whenReady().then(() => {
    createMenu();
    createWindow(startupFiles[0]);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(null);
      }
    });
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (mainWindow) {
      sendOpenPath(filePath, true);
    } else {
      pendingOpenPath = filePath;
      pendingPrompt = false;
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
