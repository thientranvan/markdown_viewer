const { contextBridge, ipcRenderer } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function splitReference(rawReference) {
  const hashIndex = rawReference.indexOf('#');
  if (hashIndex === -1) {
    return { pathname: rawReference, hash: '' };
  }

  return {
    pathname: rawReference.slice(0, hashIndex),
    hash: rawReference.slice(hashIndex)
  };
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isExternalReference(reference) {
  return /^(https?:|mailto:|data:|file:|blob:)/i.test(reference);
}

function resolveReference(baseFilePath, rawReference) {
  if (!rawReference) {
    return { type: 'empty', href: rawReference };
  }

  if (rawReference.startsWith('#')) {
    return { type: 'anchor', href: rawReference };
  }

  if (isExternalReference(rawReference)) {
    return { type: 'external', href: rawReference };
  }

  if (!baseFilePath) {
    return { type: 'relative', href: rawReference };
  }

  const { pathname, hash } = splitReference(rawReference);
  const absolutePath = path.resolve(path.dirname(baseFilePath), safeDecode(pathname));
  const href = `${pathToFileURL(absolutePath).href}${hash}`;

  return {
    type: 'file',
    href,
    path: absolutePath,
    exists: fs.existsSync(absolutePath)
  };
}

contextBridge.exposeInMainWorld('mdApi', {
  openDialog: () => ipcRenderer.invoke('file:open-dialog'),
  loadFile: (filePath) => ipcRenderer.invoke('file:load', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('file:save', { filePath, content }),
  saveAsFile: (content, suggestedPath) => ipcRenderer.invoke('file:save-as', { content, suggestedPath }),
  exportPdf: (settings) => ipcRenderer.invoke('file:export-pdf', settings),
  askUnsaved: (name) => ipcRenderer.invoke('dialog:unsaved', name),
  setDirty: (dirty) => ipcRenderer.send('app:set-dirty', dirty),
  openExternal: (target) => ipcRenderer.invoke('shell:open-external', target),
  openPath: (targetPath) => ipcRenderer.invoke('shell:open-path', targetPath),
  resolveReference,
  rendererReady: () => ipcRenderer.send('app:renderer-ready'),
  onOpenPath: (callback) => {
    const listener = (_event, payload) => callback(payload.filePath, payload.prompt);
    ipcRenderer.on('file:open-path', listener);
    return () => ipcRenderer.removeListener('file:open-path', listener);
  },
  onCommand: (callback) => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('app:command', listener);
    return () => ipcRenderer.removeListener('app:command', listener);
  }
});
