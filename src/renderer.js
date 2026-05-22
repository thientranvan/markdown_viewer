(function () {
  const api = window.mdApi;
  const editor = document.getElementById('editor');
  const preview = document.getElementById('preview');
  const previewPane = document.querySelector('.preview-pane');
  const workspace = document.getElementById('workspace');
  const title = document.getElementById('documentTitle');
  const pathLabel = document.getElementById('documentPath');
  const status = document.getElementById('status');
  const toast = document.getElementById('toast');
  const openButton = document.getElementById('openButton');
  const saveButton = document.getElementById('saveButton');
  const saveAsButton = document.getElementById('saveAsButton');
  const modeButtons = Array.from(document.querySelectorAll('[data-mode]'));

  let filePath = null;
  let fileName = 'Untitled';
  let lastSavedContent = '';
  let dirty = false;
  let renderTimer = null;
  let toastTimer = null;
  let editorScrollFrame = null;
  let previewScrollFrame = null;
  let scrollLock = null;
  let scrollLockTimer = null;
  let mode = 'split';

  function countNewlines(value) {
    const matches = value.match(/\n/g);
    return matches ? matches.length : 0;
  }

  function getParser() {
    if (window.marked?.parse) {
      return window.marked;
    }

    if (window.marked?.marked?.parse) {
      return window.marked.marked;
    }

    return null;
  }

  function fileNameFromPath(value) {
    if (!value) {
      return 'Untitled';
    }

    return value.split(/[\\/]/).filter(Boolean).pop() || value;
  }

  function setToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3200);
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function setScrollLock(source) {
    scrollLock = source;
    window.clearTimeout(scrollLockTimer);
    scrollLockTimer = window.setTimeout(() => {
      scrollLock = null;
    }, 160);
  }

  function lineHeightOfEditor() {
    const styles = window.getComputedStyle(editor);
    const lineHeight = Number.parseFloat(styles.lineHeight);
    if (Number.isFinite(lineHeight)) {
      return lineHeight;
    }

    const fontSize = Number.parseFloat(styles.fontSize);
    return Number.isFinite(fontSize) ? fontSize * 1.65 : 23;
  }

  function visibleEditorLine() {
    return Math.max(1, Math.floor(editor.scrollTop / lineHeightOfEditor()) + 1);
  }

  function scrollEditorToLine(line) {
    const nextTop = Math.max(0, (Math.max(1, line) - 1) * lineHeightOfEditor());
    if (Math.abs(editor.scrollTop - nextTop) > 1) {
      setScrollLock('preview');
      editor.scrollTop = nextTop;
    }
  }

  function elementTopInScroller(element, scroller) {
    const elementRect = element.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    return elementRect.top - scrollerRect.top + scroller.scrollTop;
  }

  function previewAnchors() {
    return Array.from(preview.querySelectorAll('[data-source-start]'))
      .map((element) => ({
        element,
        start: Number.parseInt(element.dataset.sourceStart, 10),
        end: Number.parseInt(element.dataset.sourceEnd, 10)
      }))
      .filter((anchor) => Number.isFinite(anchor.start) && Number.isFinite(anchor.end));
  }

  function findAnchorForLine(line) {
    const anchors = previewAnchors();
    if (anchors.length === 0) {
      return null;
    }

    let nearest = anchors[0];
    for (const anchor of anchors) {
      if (line >= anchor.start && line <= anchor.end) {
        return anchor;
      }

      if (anchor.start <= line) {
        nearest = anchor;
      }
    }

    return nearest;
  }

  function syncPreviewToEditor() {
    if (mode !== 'split') {
      return;
    }

    const line = visibleEditorLine();
    const anchor = findAnchorForLine(line);
    if (!anchor) {
      return;
    }

    const elementTop = elementTopInScroller(anchor.element, previewPane);
    const elementHeight = Math.max(1, anchor.element.getBoundingClientRect().height);
    const lineSpan = Math.max(1, anchor.end - anchor.start + 1);
    const ratio = Math.min(1, Math.max(0, (line - anchor.start) / lineSpan));
    const nextTop = Math.max(0, elementTop + elementHeight * ratio - 24);

    if (Math.abs(previewPane.scrollTop - nextTop) > 2) {
      setScrollLock('editor');
      previewPane.scrollTop = nextTop;
    }
  }

  function findAnchorForPreviewPosition() {
    const anchors = previewAnchors();
    if (anchors.length === 0) {
      return null;
    }

    const targetY = previewPane.scrollTop + 32;
    let selected = anchors[0];

    for (const anchor of anchors) {
      const top = elementTopInScroller(anchor.element, previewPane);
      if (top <= targetY) {
        selected = anchor;
      } else {
        break;
      }
    }

    return selected;
  }

  function syncEditorToPreview() {
    if (mode !== 'split') {
      return;
    }

    const anchor = findAnchorForPreviewPosition();
    if (!anchor) {
      return;
    }

    const elementTop = elementTopInScroller(anchor.element, previewPane);
    const elementHeight = Math.max(1, anchor.element.getBoundingClientRect().height);
    const targetY = previewPane.scrollTop + 32;
    const ratio = Math.min(1, Math.max(0, (targetY - elementTop) / elementHeight));
    const lineSpan = Math.max(1, anchor.end - anchor.start + 1);
    const line = anchor.start + Math.floor(ratio * (lineSpan - 1));
    scrollEditorToLine(line);
  }

  function annotateTokenLines(tokens, startLine) {
    let currentLine = startLine;

    tokens.forEach((token) => {
      const raw = token.raw || '';
      const newlines = countNewlines(raw);
      token.sourceStartLine = currentLine;
      token.sourceEndLine = currentLine + Math.max(0, newlines - (raw.endsWith('\n') ? 1 : 0));

      if (token.type === 'list' && Array.isArray(token.items)) {
        annotateTokenLines(token.items, token.sourceStartLine);
      }

      if (token.type === 'blockquote' && Array.isArray(token.tokens)) {
        annotateTokenLines(token.tokens, token.sourceStartLine);
      }

      currentLine += newlines;
    });
  }

  function addSourceAttributes(html, token) {
    if (!token || !Number.isFinite(token.sourceStartLine)) {
      return html;
    }

    const start = token.sourceStartLine;
    const end = token.sourceEndLine || start;
    const attrs = ` data-source-start="${start}" data-source-end="${end}"`;
    return html.replace(/^<([a-z][a-z0-9-]*)(\s|>)/i, `<$1${attrs}$2`);
  }

  function buildSourceAwareRenderer(parser) {
    const renderer = new parser.Renderer();
    const methods = ['blockquote', 'code', 'heading', 'hr', 'html', 'list', 'listitem', 'paragraph', 'table'];

    methods.forEach((method) => {
      const original = renderer[method];
      renderer[method] = function (token) {
        return addSourceAttributes(original.call(this, token), token);
      };
    });

    return renderer;
  }

  function renderMarkdownToHtml(markdown, parser) {
    const options = {
      gfm: true,
      breaks: false,
      pedantic: false
    };
    const tokens = parser.lexer(markdown, options);
    annotateTokenLines(tokens, 1);

    return parser.Parser.parse(tokens, {
      ...options,
      renderer: buildSourceAwareRenderer(parser)
    });
  }

  function markdownWordCount(content) {
    const words = content.match(/[\p{L}\p{N}_'-]+/gu);
    return words ? words.length : 0;
  }

  function updateStats() {
    const content = editor.value;
    const lineCount = content.length === 0 ? 1 : content.split('\n').length;
    const wordCount = markdownWordCount(content);
    const changeState = dirty ? 'Unsaved' : 'Saved';
    setStatus(`${changeState} - ${lineCount} lines - ${wordCount} words`);
  }

  function updateTitle() {
    const marker = dirty ? '*' : '';
    title.textContent = `${marker}${fileName}`;
    pathLabel.textContent = filePath || 'No file selected';
    document.title = `${marker}${fileName} - MD Viewer`;
  }

  function setDirty(nextDirty) {
    dirty = Boolean(nextDirty);
    api.setDirty(dirty);
    updateTitle();
    updateStats();
  }

  function rewriteRelativeReferences() {
    preview.querySelectorAll('img[src], video[src], audio[src], source[src]').forEach((element) => {
      const attribute = element.getAttribute('src');
      const resolved = api.resolveReference(filePath, attribute);
      if (resolved.href && (resolved.type === 'file' || resolved.type === 'external')) {
        element.setAttribute('src', resolved.href);
      }
    });

    preview.querySelectorAll('a[href]').forEach((anchor) => {
      const attribute = anchor.getAttribute('href');
      const resolved = api.resolveReference(filePath, attribute);
      anchor.dataset.referenceType = resolved.type;
      if (resolved.path) {
        anchor.dataset.path = resolved.path;
      }
      if (resolved.href) {
        anchor.setAttribute('href', resolved.href);
      }
      if (resolved.type === 'external') {
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noreferrer');
      }
    });
  }

  function highlightCodeBlocks() {
    if (!window.hljs) {
      return;
    }

    preview.querySelectorAll('pre code').forEach((block) => {
      window.hljs.highlightElement(block);
    });
  }

  function renderMarkdown() {
    const parser = getParser();
    if (!parser) {
      preview.innerHTML = '<p>Markdown parser failed to load.</p>';
      return;
    }

    const rawHtml = renderMarkdownToHtml(editor.value, parser);
    const cleanHtml = window.DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['checked', 'disabled', 'target', 'rel', 'data-source-start', 'data-source-end']
    });

    preview.innerHTML = cleanHtml || '<p class="empty-preview">Empty document</p>';
    rewriteRelativeReferences();
    highlightCodeBlocks();
    window.requestAnimationFrame(syncPreviewToEditor);
  }

  function scheduleRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderMarkdown, 120);
  }

  function setMode(nextMode) {
    mode = nextMode;
    workspace.dataset.mode = mode;
    modeButtons.forEach((button) => {
      const selected = button.dataset.mode === mode;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });

    if (mode === 'edit') {
      editor.focus();
    }
  }

  function applyFile(payload) {
    filePath = payload.filePath;
    fileName = payload.name || fileNameFromPath(payload.filePath);
    editor.value = payload.content || '';
    lastSavedContent = editor.value;
    setDirty(false);
    renderMarkdown();
    updateTitle();
    updateStats();
    setToast(`Opened ${fileName}`);
  }

  async function saveCurrent() {
    try {
      const payload = filePath
        ? await api.saveFile(filePath, editor.value)
        : await api.saveAsFile(editor.value, `${fileName}.md`);

      if (!payload) {
        return false;
      }

      applyFile(payload);
      setToast(`Saved ${payload.name}`);
      return true;
    } catch (error) {
      setToast(`Save failed: ${error.message}`);
      return false;
    }
  }

  async function saveCurrentAs() {
    try {
      const payload = await api.saveAsFile(editor.value, filePath || `${fileName}.md`);
      if (!payload) {
        return false;
      }

      applyFile(payload);
      setToast(`Saved ${payload.name}`);
      return true;
    } catch (error) {
      setToast(`Save failed: ${error.message}`);
      return false;
    }
  }

  async function confirmReplaceCurrent() {
    if (!dirty) {
      return true;
    }

    const action = await api.askUnsaved(fileName);
    if (action === 'cancel') {
      return false;
    }

    if (action === 'save') {
      return saveCurrent();
    }

    return true;
  }

  async function loadPath(nextPath, shouldPrompt) {
    if (shouldPrompt && !(await confirmReplaceCurrent())) {
      return;
    }

    try {
      const payload = await api.loadFile(nextPath);
      applyFile(payload);
    } catch (error) {
      setToast(`Open failed: ${error.message}`);
    }
  }

  async function openFromDialog() {
    if (!(await confirmReplaceCurrent())) {
      return;
    }

    try {
      const payload = await api.openDialog();
      if (payload) {
        applyFile(payload);
      }
    } catch (error) {
      setToast(`Open failed: ${error.message}`);
    }
  }

  function activateAnchor(anchor) {
    const type = anchor.dataset.referenceType;
    const targetPath = anchor.dataset.path;
    const href = anchor.getAttribute('href');

    if (type === 'anchor') {
      const target = preview.querySelector(href);
      if (target) {
        target.scrollIntoView({ block: 'start' });
      }
      return;
    }

    if (targetPath && /\.(md|markdown|mdown|mkd)$/i.test(targetPath)) {
      loadPath(targetPath, true);
      return;
    }

    if (targetPath) {
      api.openPath(targetPath).catch((error) => setToast(`Open failed: ${error.message}`));
      return;
    }

    if (href) {
      api.openExternal(href).catch((error) => setToast(`Open failed: ${error.message}`));
    }
  }

  editor.addEventListener('input', () => {
    setDirty(editor.value !== lastSavedContent);
    scheduleRender();
  });

  editor.addEventListener('scroll', () => {
    if (scrollLock === 'preview') {
      return;
    }

    window.cancelAnimationFrame(editorScrollFrame);
    editorScrollFrame = window.requestAnimationFrame(syncPreviewToEditor);
  });

  previewPane.addEventListener('scroll', () => {
    if (scrollLock === 'editor') {
      return;
    }

    window.cancelAnimationFrame(previewScrollFrame);
    previewScrollFrame = window.requestAnimationFrame(syncEditorToPreview);
  });

  preview.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href]');
    if (!anchor) {
      return;
    }

    event.preventDefault();
    activateAnchor(anchor);
  });

  openButton.addEventListener('click', openFromDialog);
  saveButton.addEventListener('click', saveCurrent);
  saveAsButton.addEventListener('click', saveCurrentAs);
  modeButtons.forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });

  api.onOpenPath((nextPath, shouldPrompt) => loadPath(nextPath, shouldPrompt));
  api.onCommand((command) => {
    if (command === 'open') {
      openFromDialog();
    } else if (command === 'save') {
      saveCurrent();
    } else if (command === 'save-as') {
      saveCurrentAs();
    } else if (command === 'mode-preview') {
      setMode('preview');
    } else if (command === 'mode-split') {
      setMode('split');
    } else if (command === 'mode-edit') {
      setMode('edit');
    }
  });

  window.addEventListener('keydown', (event) => {
    const modifier = event.metaKey || event.ctrlKey;
    if (!modifier) {
      return;
    }

    if (event.key === 's' && !event.shiftKey) {
      event.preventDefault();
      saveCurrent();
    } else if (event.key === 'S' || (event.key === 's' && event.shiftKey)) {
      event.preventDefault();
      saveCurrentAs();
    } else if (event.key === 'o') {
      event.preventDefault();
      openFromDialog();
    }
  });

  window.__mdViewerGetState = function () {
    return {
      filePath,
      name: fileName,
      content: editor.value,
      dirty
    };
  };

  setMode(mode);
  renderMarkdown();
  updateTitle();
  updateStats();
  api.rendererReady();
}());
