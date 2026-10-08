// Run against Vite. Uses real browser XML/Image APIs and synthetic data only.
const { chromium } = require(process.env.EQC_PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.EQC_PREVIEW_URL || 'http://127.0.0.1:5173');
    const result = await page.evaluate(async () => {
      const { buildQdpxExport } = await import('/src/lib/qdpxExport.ts');
      const { importQdpx } = await import('/src/lib/qdpxImport.ts');
      const { newProject } = await import('/src/domain.ts');
      const { hashSourceText } = await import('/src/lib/sourceOriginal.ts');
      const project = newProject('Unicode roundtrip');
      project.codes = [{ id: 'p', name: 'Parent', parentId: null, color: '#123456', definition: 'Rule', summary: 'Parent memo' }, { id: 'c', name: 'Child', parentId: 'p', color: '#654321', definition: 'Child rule', summary: 'Child memo' }];
      project.docs = [{ id: 'd', name: 'Interview', content: '😀 শুরু\r\nশুরু\tWater', notes: 'Document memo' }];
      project.docs[0].original = { name: 'Interview.docx', format: 'docx', base64: btoa('PK retained original'), textHash: await hashSourceText(project.docs[0].content) };
      project.codedSegments = [
        { id: 'a', docId: 'd', codeId: 'c', start: 3, end: 7, text: 'শুরু', coder: 'Ann', note: 'Ann memo', createdAt: 1 },
        { id: 'b', docId: 'd', codeId: 'c', start: 3, end: 7, text: 'শুরু', coder: 'Bob', createdAt: 2 },
        { id: 'c', docId: 'd', codeId: 'c', start: 9, end: 13, text: 'শুরু', coder: 'Ann', createdAt: 3 }
      ];
      project.images = [{ id: 'i', name: 'GIF source', notes: 'Image memo', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' }];
      project.codedRegions = [{ id: 'r', codeId: 'c', imageId: 'i', x: 0, y: 0, width: 1, height: 1, coder: 'Ann', note: 'Region memo', createdAt: 1 }];
      const payload = await buildQdpxExport(project);
      const imported = newProject('Imported');
      const summary = await importQdpx(imported, payload);
      const repeat = await importQdpx(imported, payload);
      const oldXml = new DOMParser().parseFromString(payload.qdeXml.replaceAll('urn:QDA-XML:project:1.0', 'urn:QDA-XML:project:2.0'), 'application/xml');
      oldXml.querySelectorAll('PlainTextSelection').forEach((selection, i) => {
        selection.setAttribute('startPosition', String(project.codedSegments[i].start));
        selection.setAttribute('endPosition', String(project.codedSegments[i].end));
      });
      const legacy = newProject('Legacy');
      await importQdpx(legacy, { ...payload, qdeXml: new XMLSerializer().serializeToString(oldXml) });
      project.docs[0].original = { ...project.docs[0].original, name: 'Interview.pdf', format: 'pdf', base64: btoa('%PDF retained original') };
      const pdfPayload = await buildQdpxExport(project);
      const pdfImported = newProject('PDF imported');
      await importQdpx(pdfImported, pdfPayload);
      const qdc = newProject('Codebook');
      await importQdpx(qdc, { fileName: 'reference.qdc', qdeXml: '<CodeBook xmlns="urn:QDA-XML:codebook:0:4" origin="ATLAS.ti Win 26.1.1"><Codes><Code guid="p" name="Parent" isCodable="true"><Description>Comment</Description><Code guid="c" name="Child" isCodable="true"/></Code></Codes></CodeBook>', sourceFiles: {} });
      return { payload, imported, summary, repeat, legacy, pdfPayload, pdfImported, qdc };
    });
    const validated = spawnSync(process.env.EQC_PYTHON || 'python', [path.join(__dirname, 'validate-qdpx.py')], { input: JSON.stringify(result.payload), encoding: 'utf8' });
    assert.equal(validated.status, 0, validated.stderr);
    assert.equal(result.imported.codes.length, 2);
    assert.equal(result.imported.codes[1].summary, 'Child memo');
    assert.equal(result.imported.codes[1].definition, 'Child rule');
    assert.equal(result.imported.docs[0].content, '😀 শুরু\r\nশুরু\tWater');
    assert.deepEqual(result.imported.codedSegments.map(s => [s.start, s.end, s.coder, s.text]), [[3, 7, 'Ann', 'শুরু'], [3, 7, 'Bob', 'শুরু'], [9, 13, 'Ann', 'শুরু']]);
    assert.equal(result.imported.codedSegments[0].note, 'Ann memo');
    assert.equal(result.imported.codedRegions[0].coder, 'Ann');
    assert.equal(result.imported.codedRegions[0].note, 'Region memo');
    assert.equal(result.repeat.segmentsCreated, 0);
    assert.equal(result.repeat.codesCreated, 0);
    assert.equal(result.imported.images.length, 1);
    assert.match(result.imported.images[0].dataUrl, /^data:image\/png;base64,/);
    assert.equal(result.legacy.codedSegments.length, 3);
    assert.equal(result.legacy.codedSegments[0].text, 'শুরু');
    assert.equal(result.imported.docs[0].original.base64, Buffer.from('PK retained original').toString('base64'));
    assert.equal(result.pdfImported.docs[0].original.format, 'pdf');
    assert.equal(result.pdfImported.codedSegments.length, 3);
    assert.equal(result.pdfImported.docs[0].notes, 'Document memo');
    assert.equal(result.qdc.codes.length, 2);
    assert.equal(result.qdc.codes[1].parentId, result.qdc.codes[0].id);
    console.log('QDPX schema, browser conversion, text/image/memo/coder roundtrip, repeat import and legacy compatibility passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
