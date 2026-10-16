const { chromium } = require(process.env.EQC_PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: process.env.EQC_BROWSER_CHANNEL || 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      const p = { id: 'reader-keys', name: 'Reader keyboard QA', createdAt: 1, folders: [],
        docs: [{ id: 'd', name: 'Interview', addedAt: 1, content: 'Water access affects care and work. '.repeat(12) + '\nNeighbours share tools.\nবাংলা জলবায়ু.' }],
        codes: [{ id: 'c', name: 'Water', parentId: null, color: '#2563eb', summary: '', createdAt: 1 }], codedSegments: [] };
      window.__qaProject = p; localStorage.setItem('qda-document-view', 'text');
      localStorage.setItem('eqc-code-shortcuts-reader-keys', '["c"]');
      window.qv = new Proxy({ listProjects: async () => [{ id: p.id, name: p.name }], loadProject: async () => p,
        saveProject: async p => { window.__qaProject = structuredClone(p); return { id: p.id, updatedAt: p.updatedAt }; },
        lan: new Proxy({}, { get: (_, key) => String(key).startsWith('on') ? () => {} : async () => ({ ok: true }) }) },
        { get: (t, key) => t[key] || (String(key).startsWith('on') ? () => {} : async () => null) });
    });
    await page.goto(process.env.EQC_PREVIEW_URL || 'http://127.0.0.1:5179');
    await page.locator('.workspace-sources .doc-row').first().click();
    const root = page.locator('.doc-editor'); await root.waitFor();
    const content = await root.textContent();
    const point = await root.evaluate(root => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), node = walker.nextNode();
      const range = document.createRange(); range.setStart(node, 6); range.setEnd(node, 7);
      const r = range.getBoundingClientRect(); return { x: r.x + 1, y: r.y + r.height / 2 };
    });
    await page.mouse.click(point.x, point.y);
    assert.equal(await root.evaluate(el => document.activeElement === el), true);
    const anchor = await page.evaluate(() => getSelection().focusOffset);
    await page.keyboard.press('Shift+ArrowRight');
    assert.equal(await page.evaluate(() => getSelection().toString()), content.slice(anchor, anchor + 1));
    await page.keyboard.press('Shift+ArrowRight');
    assert.equal(await page.evaluate(() => getSelection().toString()), content.slice(anchor, anchor + 2));
    await page.keyboard.press('Shift+ArrowLeft');
    assert.equal(await page.evaluate(() => getSelection().toString()), content.slice(anchor, anchor + 1));
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Shift+ArrowLeft');
    assert.equal(await page.evaluate(() => getSelection().toString()), content.slice(anchor - 1, anchor));
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowDown');
    const down = await page.evaluate(() => getSelection().toString()); assert.ok(down.length > 10);
    await page.keyboard.press('Shift+ArrowUp'); assert.equal(await page.evaluate(() => getSelection().isCollapsed), true);
    await page.keyboard.press('Home'); await page.keyboard.press('Control+Shift+ArrowRight');
    assert.ok((await page.evaluate(() => getSelection().toString())).startsWith('Water'));
    await page.keyboard.press('Control+Home'); await page.keyboard.press('Control+Shift+End');
    assert.equal(await page.evaluate(() => getSelection().toString()), content);
    await page.keyboard.press('Control+Home'); await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Control+1'); await page.waitForFunction(() => window.__qaProject.codedSegments.length === 1);
    const saved = await page.evaluate(() => window.__qaProject);
    assert.equal(saved.codedSegments[0].text, 'W'); assert.equal(saved.codedSegments[0].start, 0);
    assert.equal(saved.docs[0].content, content); assert.equal(await root.textContent(), content);
    const tabs=page.locator('.tabs');
    await tabs.getByRole('button',{name:'Visualization',exact:true}).click();await page.getByRole('button',{name:'Open current canvas',exact:true}).click();
    await page.locator('.codemap-panel svg title').filter({hasText:'Water (1 coded)'}).waitFor({state:'attached'});
    await tabs.getByRole('button',{name:'Workspace',exact:true}).click();
    await root.evaluate(root=>{root.focus();const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);walker.nextNode();const node=walker.nextNode();getSelection().collapse(node,6);});
    await page.keyboard.press('Shift+ArrowRight');
    await page.locator('.right-panel .code-tree .code-row').filter({hasText:'Water'}).click();
    await page.waitForFunction(()=>window.__qaProject.codedSegments.length===2);
    assert.equal((await page.evaluate(()=>window.__qaProject.codedSegments[1].text)).length,1);
    await tabs.getByRole('button',{name:'Visualization',exact:true}).click();await page.locator('.map-viewport svg').waitFor();
    await page.locator('.codemap-panel svg title').filter({hasText:'Water (2 coded)'}).waitFor({state:'attached'});
    assert.deepEqual(errors, []);
    console.log('Read-only reader: real click, Shift arrows in both directions, wrapped lines, Home/End, word selection and exact coding offsets passed.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
