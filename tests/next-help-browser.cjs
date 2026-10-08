const assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require(process.env.EQC_PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const p = { id: 'p', name: 'Help QA', createdAt: 1, folders: [], docs: [], codes: [], codedSegments: [], images: [] };
      window.qv = new Proxy({ listProjects: async () => [p], loadProject: async () => p, saveProject: async p => p, projectHistory: async () => ({ activity: [], snapshots: [] }), lan: new Proxy({}, { get: (_, n) => String(n).startsWith('on') ? () => {} : async () => ({ ok: true }) }) }, { get: (t, n) => t[n] || (String(n).startsWith('on') ? () => {} : async () => []) });
    });
    await page.goto(process.env.EQC_PREVIEW_URL || 'http://127.0.0.1:5173');
    await page.locator('.tabs').getByRole('button', { name: 'Help', exact: true }).click();
    assert.equal(await page.locator('.help-sections > details > summary').first().textContent(), 'Table of Contents');
    assert.doesNotMatch(await page.locator('.help-sections').textContent(), /NVivo|ATLAS\.ti|These changes have passed|Interoperability still depends|Version 1\.7\.0|Small surprises/i);
    const contents = page.locator('.help-sections > details').first(); assert.ok(await contents.evaluate(el => el.open));
    await contents.getByRole('link', { name: 'The Workspace Tab (Document Editor & Manual Coding)', exact: true }).click();
    assert.ok(await page.locator('#help-4-the-workspace-tab').evaluate(el => el.open));
    await page.getByLabel('Search documentation').fill('starred');
    await page.getByRole('link', { name: 'Section 5.4', exact: true }).click();
    assert.equal(await page.getByLabel('Search documentation').inputValue(), '');
    await page.waitForTimeout(300);
    await page.locator('[id^="help-54-export-tab"]').waitFor({state:'visible',timeout:5000});
    assert.ok(await page.locator('.help-sections > details').filter({ has: page.locator('summary', { hasText: '5. The Codebook Manager' }) }).evaluate(el => el.open));
    assert.ok(await page.locator('[id^="help-54-export-tab"]').isVisible());
    await page.getByLabel('Search documentation').fill('Standard documents');
    const rows = page.locator('.help-text table tr');
    const standard = rows.filter({ hasText: 'Standard documents' }); assert.ok((await standard.textContent()).includes('.md'));
    assert.ok((await rows.filter({ has: page.getByRole('cell', {name:'Images',exact:true}) }).textContent()).includes('.heic/.heif'));
    assert.equal(await standard.locator('td').count(), 3);
    await page.getByLabel('Documentation to read', { exact: true }).selectOption('documentation');
    await page.getByLabel('Search documentation').fill('');
    assert.equal(await page.locator('.help-sections > details > summary').first().textContent(), 'Table of Contents');
    assert.doesNotMatch(await page.locator('.help-sections').textContent(), /NVivo|ATLAS\.ti|These changes have passed|Interoperability still depends|Version 1\.7\.0|Small surprises/i);
    await page.locator('.tabs').getByRole('button', { name: 'Workspace', exact: true }).click();
    for (const [button, tab, example] of [['Cases & attributes', 'Cases', 'Participant 01'], ['Document & code groups', 'Groups', 'women’s focus groups'], ['Excerpt review & queries', 'Review', 'Water access'], ['Memos/Notes', 'Memos/Notes', 'Distance and safety'], ['History & recovery', 'History', 'Before merging access codes']]) {
      await page.locator('.workspace-sources').getByText('Research tools', { exact: true }).click();
      await page.getByRole('button', { name: button, exact: true }).click();
      const modal = page.getByRole('dialog', { name: 'Research tools', exact: true });
      assert.equal(await modal.getByRole('tab', { name: tab, exact: true }).getAttribute('aria-selected'), 'true');
      await modal.getByText(`Using ${tab}, with an example`, { exact: true }).click();
      assert.ok((await modal.locator('.disclosure').textContent()).includes(example));
      await modal.getByRole('button', { name: 'Close research tools' }).click();
    }
    fs.mkdirSync('release/next-help-qa', { recursive: true });
    for (const width of [1366, 1024, 800, 640]) {
      await page.setViewportSize({ width, height: width === 640 ? 480 : 768 });
      assert.equal(await page.locator('.source-toolbar').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
      await page.locator('.workspace-sources').getByText('Research tools', { exact: true }).click();
      const button = page.getByRole('button', { name: 'Cases & attributes', exact: true });
      assert.ok(await button.isVisible()); const box = await button.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
      await page.keyboard.press('Escape');
      await page.screenshot({ path: `release/next-help-qa/Workspace-${width}.png` });
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.locator('.tabs').getByRole('button', { name: 'Analysis', exact: true }).click();
    await page.getByRole('button', { name: 'ICR', exact: true }).click();
    await page.getByText('How to use ICR, with an example', { exact: true }).click();
    await page.getByText('Amina applies Water access', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Consensus', exact: true }).click();
    await page.getByText('How to review Consensus, with an example', { exact: true }).click();
    await page.getByText('The pump is too far away', { exact: false }).waitFor();
    assert.deepEqual(errors, []);
    console.log('Help contents/links/Markdown tables, five Workspace tools, responsive menus and ICR/Consensus examples passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
