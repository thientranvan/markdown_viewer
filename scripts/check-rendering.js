const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Marked } = require('marked');
const markedKatex = require('marked-katex-extension');

const parser = new Marked();
const context = {
  window: { marked: parser, markedKatex },
  document: { getElementById() {}, querySelector() {}, querySelectorAll() { return []; } }
};
const source = fs.readFileSync(require.resolve('../src/renderer.js'), 'utf8');
vm.runInNewContext(source.slice(0, source.indexOf("  editor.addEventListener('input'")) +
  'window.render = (text) => renderMarkdownToHtml(text, getParser()); }());', context);
const render = context.window.render;
const formula = String.raw`$$ \boxed{n_{2D}\approx\frac{\varepsilon_0\varepsilon_b}{e^2},\frac{\Delta E_c-E_{DD}}{s+h+\tfrac14 a_B}}\qquad(9.16) $$`;
assert.match(render('$$ N_D L = n_{2D} $$'), /class="katex-display"/);
assert.match(render(formula), /class="katex-display"/);
assert.doesNotMatch(render(formula), /katex-error/);
assert.match(render('$n_{2D}$'), /class="katex"/);
assert.match(render('$$\nN_D L = n_{2D}\n$$'), /data-source-start="1" data-source-end="3"/);
assert.doesNotMatch(render('`$x$`\n\n```tex\n$$ x $$\n```'), /class="katex/);
assert.match(render('$\\invalidcommand$'), /invalidcommand/);
const metadata = '\ufeff---\r\nmarp: true\r\nstyle: |\r\n  section { color: red; }\r\n---\r\n# 2DEG';
const html = render(metadata);
assert.doesNotMatch(html, /marp:|section \{/);
assert.match(html, /data-source-start="6".*2DEG/);
assert.match(render('# Heading\n\n---\n\nBody'), /<hr/);
assert.match(render('---\nUnclosed metadata'), /Unclosed metadata/);
console.log('Markdown math and frontmatter checks passed.');
