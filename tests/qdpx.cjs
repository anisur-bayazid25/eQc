const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const JSZip = require('jszip');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, filename);
const { buildQdpxExport, buildQdpxCodebookExport } = require('../src/lib/qdpxExport.ts');
const { utf16ToQdaRange, qdaToUtf16Range } = require('../src/lib/qdpxOffsets.ts');
const { captureOriginalSource } = require('../electron/sourceOriginal.cjs');

const fixture = () => ({ name: 'Water & drainage', coderName: 'Owner', docs: [{ id: 'd', name: 'Bengali interview.docx', content: '😀 শুরু\r\nWater\twater', notes: 'Source memo' }], images: [], codedRegions: [],
  codes: [{ id: 'p', name: 'Parent', parentId: null, color: '#abc', summary: 'Parent summary\nSecond line', definition: 'Parent rule' }, { id: 'c', name: 'Child', parentId: 'p', color: '#badcolor', summary: 'Child memo', definition: 'Child rule' }],
  codedSegments: [{ id: 's', docId: 'd', codeId: 'c', start: 3, end: 7, coder: 'Ann', note: 'Excerpt memo', createdAt: 1 }, { id: 's2', docId: 'd', codeId: 'c', start: 3, end: 7, coder: 'Bob', createdAt: 2 }]
});
function validate(payload) {
  const result = spawnSync(process.env.EQC_PYTHON || 'python', [path.join(__dirname, 'validate-qdpx.py')], { input: JSON.stringify(payload), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
}

test('full export validates against actual XSD with hierarchy, memos, coders and exact Unicode selections', async () => {
  const p = fixture(); const before = JSON.stringify(p);
  const payload = await buildQdpxExport(p);
  const result = validate(payload);
  assert.deepEqual(result.selectedText, ['শুরু', 'শুরু']);
  assert.match(payload.qdeXml, /project:1\.0/);
  assert.doesNotMatch(payload.qdeXml, /SubCodes|CodeBook guid|Project[^>]* guid=/);
  assert.match(payload.qdeXml, /color="#aabbcc"/);
  assert.doesNotMatch(payload.qdeXml, /badcolor/);
  assert.ok(Object.values(payload.sourceFiles).includes('Child memo'));
  assert.ok(Object.values(payload.sourceFiles).includes('Parent summary\nSecond line'));
  const zip = new JSZip(); zip.file('project.qde', payload.qdeXml);
  for (const [name, text] of Object.entries(payload.sourceFiles)) zip.file(name, text);
  const loaded = await JSZip.loadAsync(await zip.generateAsync({ type: 'nodebuffer' }));
  for (const name of Object.keys(payload.sourceFiles)) assert.equal(await loaded.file(name).async('string'), payload.sourceFiles[name]);
  assert.equal(JSON.stringify(p), before);
});

test('codebook-only and empty projects omit invalid empty containers and preserve memo sources', async () => {
  const p = fixture();
  const codebook = buildQdpxCodebookExport(p);
  validate(codebook); assert.doesNotMatch(codebook.qdeXml, /<Sources>/);
  for (const builder of [buildQdpxExport, buildQdpxCodebookExport]) validate(await builder({ name: 'Empty', codes: [], docs: [], codedSegments: [] }));
});

test('single characters, emoji, Bengali and CRLF ranges use inclusive Unicode codepoints', () => {
  const text = 'A😀বাংলা\r\nZ';
  for (const [start, end] of [[0, 1], [1, 3], [3, 8], [8, 10], [10, 11], [0, text.length]]) {
    const qda = utf16ToQdaRange(text, start, end);
    assert.deepEqual(qdaToUtf16Range(text, qda.start, qda.end), { start, end });
  }
  assert.equal(qdaToUtf16Range(text, 0, 999), null);
  assert.equal(qdaToUtf16Range(text, 3, 2), null);
});

test('corrupt hierarchies and invalid coding fail explicitly rather than losing data', async () => {
  const p = fixture(); p.codes[0].parentId = 'c';
  assert.throws(() => buildQdpxCodebookExport(p), /cyclic/);
  const bad = fixture(); bad.codedSegments[0].end = 1000;
  await assert.rejects(buildQdpxExport(bad), /invalid text positions/);
  const missing = fixture(); missing.docs = [];
  await assert.rejects(buildQdpxExport(missing), /source is missing/);
});

test('picture export uses valid PNG/JPEG paths, positive bounded regions and coder references', async () => {
  const original = global.Image;
  global.Image = class { naturalWidth = 100; naturalHeight = 50; set src(value) { queueMicrotask(() => this.onload()); } };
  try {
    const p = fixture(); p.images = [{ id: 'i', name: 'Photo', dataUrl: 'data:image/png;base64,aGVsbG8=', notes: 'Image memo' }];
    p.codedRegions = [{ imageId: 'i', codeId: 'c', x: .999, y: .999, width: .0001, height: .0001, coder: 'Ann', note: 'Region memo', createdAt: 1 }];
    const payload = await buildQdpxExport(p); validate(payload);
    assert.match(payload.qdeXml, /firstX="99" firstY="49" secondX="100" secondY="50"/);
    assert.ok(Object.keys(payload.sourceBytes).every(name => name.startsWith('sources/') && name.endsWith('.png')));
  } finally { global.Image = original; }
});

test('unchanged Word and PDF originals use standard richTextPath and PDF Representation; edits fall back to current text', async () => {
  const p = fixture();
  p.docs[0].original = captureOriginalSource(Buffer.from('PK retained Word'), 'Original.docx', 'docx', p.docs[0].content);
  let payload = await buildQdpxExport(p); validate(payload);
  assert.match(payload.qdeXml, /richTextPath="internal:\/\/[^"]+\.docx"/);
  assert.ok(Object.values(payload.sourceBytes).includes(p.docs[0].original.base64));
  p.docs[0].content += '\nEdited text';
  payload = await buildQdpxExport(p); validate(payload);
  assert.doesNotMatch(payload.qdeXml, /richTextPath/);
  p.docs[0].original = captureOriginalSource(Buffer.from('%PDF retained PDF'), 'Original.pdf', 'pdf', p.docs[0].content);
  payload = await buildQdpxExport(p); validate(payload);
  assert.match(payload.qdeXml, /<PDFSource/); assert.match(payload.qdeXml, /<Representation/);
  assert.ok(Object.keys(payload.sourceBytes).some(name => name.endsWith('.pdf')));
});
