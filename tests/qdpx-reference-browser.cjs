// Optional read-only comparison with a supplied real QDE/QDC. Never saves research data.
const { chromium } = require(process.env.EQC_PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
(async () => {
  if (!process.env.EQC_ATLAS_REFERENCE) throw new Error('Set EQC_ATLAS_REFERENCE to the supplied project.qde path.');
  const reference = path.resolve(process.env.EQC_ATLAS_REFERENCE);
  const xml = fs.readFileSync(reference, 'utf8');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.EQC_PREVIEW_URL || 'http://127.0.0.1:5173');
    const inventory = await page.evaluate(xml => {
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const paths = [];
      for (const el of doc.querySelectorAll('[plainTextPath], [richTextPath], [path]')) for (const attr of ['plainTextPath', 'richTextPath', 'path']) {
        const value = el.getAttribute(attr);
        if (value?.startsWith('internal://')) paths.push(value.slice('internal://'.length));
      }
      return { paths, codes: doc.querySelectorAll('Code').length, codings: doc.querySelectorAll('Coding').length, docs: doc.querySelectorAll('TextSource').length };
    }, xml);
    const payload = { fileName: path.basename(reference), qdeXml: xml, sourceFiles: {}, sourceBytes: {} };
    for (const name of inventory.paths) {
      const location = path.resolve(path.dirname(reference), 'sources', name);
      assert.ok(location.startsWith(path.resolve(path.dirname(reference), 'sources') + path.sep));
      const bytes = fs.readFileSync(location);
      if (/\.txt$/i.test(name)) payload.sourceFiles[`sources/${name}`] = bytes.toString('utf8').replace(/^\uFEFF/, '');
      else payload.sourceBytes[`sources/${name}`] = bytes.toString('base64');
    }
    const result = await page.evaluate(async payload => {
      const { newProject } = await import('/src/domain.ts');
      const { importQdpx } = await import('/src/lib/qdpxImport.ts');
      const { buildQdpxExport } = await import('/src/lib/qdpxExport.ts');
      const imported = newProject('Reference QA');
      const summary = await importQdpx(imported, payload);
      const repeat = await importQdpx(imported, payload);
      const exported = await buildQdpxExport(imported);
      return { summary, repeat, exported, counts: { codes: imported.codes.length, docs: imported.docs.length, segments: imported.codedSegments.length, originals: imported.docs.filter(d => d.original).length } };
    }, payload);
    assert.equal(result.counts.codes, inventory.codes);
    assert.equal(result.counts.docs, inventory.docs);
    assert.equal(result.summary.segmentsSkipped, 0);
    assert.equal(result.counts.segments, inventory.codings);
    assert.equal(result.repeat.segmentsCreated, 0);
    const validation = spawnSync(process.env.EQC_PYTHON || 'python', [path.join(__dirname, 'validate-qdpx.py')], { input: JSON.stringify(result.exported), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    assert.equal(validation.status, 0, validation.stderr);
    if (process.env.EQC_ATLAS_CODEBOOK) {
      const qdcXml = fs.readFileSync(process.env.EQC_ATLAS_CODEBOOK, 'utf8');
      const count = await page.evaluate(async xml => {
        const { newProject } = await import('/src/domain.ts');
        const { importQdpx } = await import('/src/lib/qdpxImport.ts');
        const imported = newProject('Codebook QA');
        await importQdpx(imported, { fileName: 'Reference.qdc', qdeXml: xml, sourceFiles: {} });
        return imported.codes.length;
      }, qdcXml);
      assert.equal(count, inventory.codes);
    }
    console.log(JSON.stringify({ result: 'passed', ...result.counts, skipped: result.summary.segmentsSkipped, schema: 'valid', repeatImport: 'no additional coding' }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
