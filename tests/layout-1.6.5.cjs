// Run against the local Vite dev server; uses synthetic data, never the user's database.
const { chromium } = require(process.env.EQC_PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const project = { id: 'layout-test', name: 'Research demonstration', createdAt: 1, folders: [],
      docs: Array.from({ length: 6 }, (_, i) => ({ id: `d${i}`, folderId: null, name: `Interview ${i + 1}`, content: 'Researchers describe experiences and discuss access to care.', addedAt: 1, sizeBytes: 60 })),
      codes: Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, name: ['Access to care', 'Transport', 'Availability', 'Cost of treatment', 'Support networks', 'Family', 'Community', 'Information', 'Service quality', 'Communication', 'Trust', 'Continuity'][i], parentId: i > 0 && i < 4 ? 'c0' : i > 4 && i < 8 ? 'c4' : null, summary: 'Analytic memo with supporting observations.', definition: 'Include passages describing this topic.', color: '#2563eb', createdAt: 1 })),
      codedSegments: [{ id: 's1', docId: 'd0', codeId: 'c0', start: 0, end: 11, text: 'Researchers', coder: 'Ann', source: 'manual', createdAt: 1 },
        { id: 's2', docId: 'd0', codeId: 'c0', start: 0, end: 11, text: 'Researchers', coder: 'Bob', source: 'manual', createdAt: 1 }], images: [], codedRegions: [], frameworkCells: [], relationNotes: [], mapEdgeStyles: [], mapAnnotations: [] };
    window.__qaProject = project;
    window.__qaExports = [];
    const noOp = () => {};
    window.qv = new Proxy({
      listProjects: async () => [{ id: project.id, name: project.name, createdAt: 1 }],
      loadProject: async () => window.__qaProject,
      saveProject: async p => { window.__qaProject = p; return p; },
      lan: new Proxy({}, { get: (_, name) => String(name).startsWith('on') ? noOp : async () => ({ ok: true }) })
    }, { get: (target, name) => target[name] || (String(name).startsWith('on') ? noOp : async (...args) => { window.__qaExports.push({ name, payload: args[0], args }); return null; }) });
  });
  const navigate = async label => { await page.locator('.tabs').getByRole('button', { name: label, exact: true }).click(); };
  await page.goto(process.env.EQC_PREVIEW_URL || 'http://127.0.0.1:5173');
  await page.locator('.app-shell').waitFor();
  const out = path.resolve('release/layout-qa'); fs.mkdirSync(out, { recursive: true });
  const overflow = selector => page.locator(selector).evaluate(el => ({ x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight, width: el.clientWidth, height: el.clientHeight }));
  const checks = [];
  for (const [width, height] of [[1920, 1080], [1366, 768], [1200, 800], [1024, 720], [800, 600], [640, 480]]) {
    await page.setViewportSize({ width, height });
    await navigate('Workspace');
    assert.ok((await overflow('body')).x <= 1, 'body overflow');
    checks.push({ size: `${width}x${height}`, workspace: await overflow('.workspace-sources') });
    await page.locator('.workspace-sources .doc-row').first().click();
    await page.screenshot({ path: path.join(out, `workspace-${width}.png`) });
    await page.locator('.workspace-sources summary').getByText('+ Add source', { exact: true }).click();
    await page.getByRole('button', { name: '+ Scanned PDF (OCR)', exact: true }).isVisible().then(assert.ok);
    const popup = await page.locator('.workspace-sources .tool-menu-content').boundingBox();
    assert.ok(popup.x >= 0 && popup.x + popup.width <= width && popup.y + popup.height <= height + 1, 'source menu clipped');
    await page.keyboard.press('Escape');
    await navigate('Codebook');
    await page.locator('.codebook-grid .code-row').first().click();
    const tools = page.locator('.codebook-tools');
    await tools.getByRole('tab', { name: 'Details', exact: true }).click();
    checks[checks.length - 1].details = await overflow('.codebook-tools');
    await page.screenshot({ path: path.join(out, `codebook-${width}.png`) });
    await tools.getByRole('tab', { name: 'Export', exact: true }).click();
    await tools.getByRole('button', { name: '⬇️ CSV', exact: true }).isVisible().then(assert.ok);
    checks[checks.length - 1].export = await overflow('.codebook-tools');
    await navigate('Analysis');
    await page.getByRole('button', { name: 'Reliability', exact: true }).isVisible().then(assert.ok);
    await page.getByRole('button', { name: 'Consensus', exact: true }).isVisible().then(assert.ok);
    assert.ok((await overflow('.analysis-navigation')).x <= 1, 'analysis nav overflow');
    await page.screenshot({ path: path.join(out, `analysis-${width}.png`) });
    await navigate('Code Map');
    await page.waitForTimeout(150);
    const map = await overflow('.map-viewport'); checks[checks.length - 1].map = map;
    assert.ok(map.x <= 2 && map.y <= 2, `Fit leaves map overflow at ${width}: ${JSON.stringify(map)}`);
    await page.screenshot({ path: path.join(out, `map-${width}.png`) });
    await navigate('About');
    checks[checks.length - 1].about = await overflow('.about-panel');
    await page.screenshot({ path: path.join(out, `about-${width}.png`) });
    if (width >= 1200) {
      assert.ok(checks[checks.length - 1].details.y <= 1, 'code details default overflow');
      assert.ok(checks[checks.length - 1].export.y <= 1, 'export default overflow');
      assert.ok(checks[checks.length - 1].about.y <= 1, 'About desktop overflow');
    }
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await navigate('Codebook');
  const tools = page.locator('.codebook-tools');
  await tools.getByRole('tab', { name: 'Merge', exact: true }).click();
  const merge = page.locator('#task-panel-merge');
  await merge.getByRole('textbox', { name: 'Find codes to select' }).fill('Transport');
  await merge.getByRole('checkbox').check();
  await tools.getByRole('tab', { name: 'Export', exact: true }).click();
  await tools.getByRole('combobox', { name: 'Codes to include' }).selectOption('selected');
  assert.equal(await page.locator('#task-panel-export').getByRole('checkbox', { name: /Transport/ }).isChecked(), true, 'shared selection lost');
  await tools.getByRole('button', { name: '⬇️ CSV', exact: true }).click();
  assert.match(await page.evaluate(() => window.__qaExports.at(-1).payload.content), /Transport/);
  await tools.getByRole('tab', { name: 'Details', exact: true }).click();
  await page.locator('#task-panel-details summary').getByText('More colors', { exact: true }).click();
  await page.locator('#task-panel-details button[title="#22c55e"]').click();
  assert.equal(await page.evaluate(() => window.__qaProject.codes[0].color), '#22c55e', 'color palette no longer works');
  const nameInput = page.locator('#task-panel-details input').first();
  await nameInput.fill('Edited access code');
  await tools.getByRole('tab', { name: 'Import', exact: true }).click();
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__qaProject.codes[0].name), 'Edited access code', 'draft lost on task switch');
  await tools.getByRole('tab', { name: 'Import', exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await tools.getByRole('tab', { name: 'Export', exact: true }).getAttribute('aria-selected'), 'true');
  await navigate('Code Map');
  await page.getByRole('button', { name: '100%', exact: true }).click();
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.map-zoom span').innerText(), '100%', 'resize changed manual zoom');
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await page.waitForTimeout(150);
  assert.ok((await overflow('.map-viewport')).x <= 2, 'Fit failed after manual zoom');
  await page.locator('.map-toolbar summary').getByText('Canvas', { exact: true }).click();
  await page.locator('.map-toolbar select[title^="Canvas size"]').selectOption('2');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  assert.ok((await overflow('.map-viewport')).y <= 2, 'A4 fit overflow');
  await page.locator('.map-toolbar summary').getByText('Export', { exact: true }).click();
  await page.getByRole('button', { name: '⬇️ SVG', exact: true }).click();
  assert.match(await page.evaluate(() => window.__qaExports.at(-1).payload.content), /width="794"/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '⛶ Fullscreen', exact: true }).click();
  await page.waitForTimeout(150);
  assert.ok((await overflow('.map-viewport')).y <= 2, 'fullscreen fit overflow');
  await page.keyboard.press('Escape');
  await navigate('Analysis');
  await page.getByRole('button', { name: 'Reliability', exact: true }).click();
  await page.locator('.analysis-scope summary').click();
  await page.locator('.analysis-scope').getByRole('checkbox', { name: /Bob/ }).uncheck();
  await page.locator('.analysis-scope summary').click();
  await page.getByRole('button', { name: '⬇️ HTML Report', exact: true }).click();
  const html = await page.evaluate(() => window.__qaExports.at(-1).args[1]);
  assert.match(html, /Coders: Ann\./, 'HTML report lost collapsed scope');
  assert.match(await page.locator('.analysis-scope summary').innerText(), /1 coders/);
  await page.locator('.header-bottom-row summary').getByText('Reading', { exact: true }).click();
  await page.getByRole('button', { name: '☀️ Light', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: path.join(out, 'analysis-light.png') });
  await navigate('Codebook');
  await page.screenshot({ path: path.join(out, 'codebook-light.png') });
  assert.deepEqual(errors, [], 'renderer errors');
  fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(checks, null, 2));
  console.log(JSON.stringify({ result: 'passed', checks, screenshotDirectory: out }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
