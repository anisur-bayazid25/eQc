const { chromium } = require(process.env.EQC_PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const content = 'প্রথম line\r\n\r\nthird line with a long sentence which wraps in a narrow window\nfourth';
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({ content }) => {
      localStorage.setItem('qda-source-lines', 'true');
      localStorage.setItem('qda-document-view', 'text');
      const original = { name: 'Interview.docx', format: 'docx', base64: 'c291cmNl', textHash: 'old', textChanged: true };
      const project = { id: 'lines', name: 'Lines', folders: [], images: [], docs: [{ id: 'd', folderId: null, name: 'Interview', content, original }], codes: [{ id: 'c', parentId: null, name: 'Theme', color: '#123456', summary: '' }], codedSegments: [] };
      window.__qaCalls = [];
      window.qv = new Proxy({ listProjects: async () => [{ id: 'lines', name: 'Lines' }], loadProject: async () => project, saveProject: async p => p, lan: new Proxy({}, { get: (_, n) => String(n).startsWith('on') ? () => {} : async () => ({ ok: true }) }) }, { get: (t, n) => t[n] || (String(n).startsWith('on') ? () => {} : async (...args) => { window.__qaCalls.push({ name: n, args }); return null; }) });
    }, { content });
    await page.goto(process.env.EQC_PREVIEW_URL || 'http://127.0.0.1:5173');
    await page.locator('.workspace-sources .doc-row').first().click();
    await page.locator('.doc-source-line').first().waitFor();
    assert.equal(await page.locator('.doc-editor').textContent(), content, 'line numbers polluted the coding text');
    const numbering = await page.locator('.doc-source-line').evaluateAll(rows => rows.map(r => r.dataset.lineNumber));
    const out = path.resolve('release/line-qa'); fs.mkdirSync(out, { recursive: true });
    await page.screenshot({ path: path.join(out, 'source-lines.png') });
    assert.deepEqual(numbering, ['1', '2', '3', '4']);
    const offsets = await page.evaluate(async () => {
      const container = document.querySelector('.doc-editor');
      const rows = container.querySelectorAll('.doc-source-line');
      const start = rows[0].querySelector('span').firstChild;
      const end = rows[3].querySelector('span').firstChild;
      const range = document.createRange(); range.setStart(start, 2); range.setEnd(end, 3);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      const { getSelectionOffsets } = await import('/src/lib/textOffsets.ts');
      return getSelectionOffsets(container);
    });
    assert.equal(offsets.start, 2);
    assert.equal(offsets.text, content.slice(offsets.start, offsets.end));
    await page.setViewportSize({ width: 800, height: 600 });
    assert.deepEqual(await page.locator('.doc-source-line').evaluateAll(rows => rows.map(r => r.dataset.lineNumber)), numbering);
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    assert.equal(await page.locator('.doc-source-line').count(), 0);
    assert.equal(await page.locator('.doc-editor').textContent(), content);
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    await page.locator('.doc-title-row summary').getByText('Original', { exact: true }).click();
    await page.getByRole('button', { name: 'Save original', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__qaCalls.at(-1).name), 'saveOriginalSource');
    assert.equal(await page.evaluate(() => window.__qaCalls.at(-1).args[0].base64), 'c291cmNl');
    assert.deepEqual(errors, []);
    console.log('Stable source line numbering, wrapping, multiline coding offsets, toggle and original-file actions passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
