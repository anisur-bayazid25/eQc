const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const JSZip = require('jszip');
const { Packer } = require('docx');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, filename);
const { buildCodeReport, codeExportFilename } = require('../src/lib/codeReport.ts');
const { buildCodeReportDocx, safeFilename } = require('../electron/codeReport.cjs');

const fixture = () => ({
  id: 'p', name: 'Waterlogging study', docs: [{ id: 'd', name: 'FGD Male Khalilnagar', notes: 'Source context', content: 'sample' }],
  images: [{ id: 'i', name: 'Drainage photograph', notes: 'Image context' }],
  codes: [
    { id: 'parent', name: 'Environment', parentId: null },
    { id: 'c', name: 'Cause of Waterlogging', parentId: 'parent', definition: 'Factors preventing drainage', summary: 'Blocked drains and uneven land contribute to persistent waterlogging.' },
    { id: 'empty', name: 'Uncoded theme', parentId: null, summary: 'Memo without coding' }
  ],
  codedSegments: [
    { id: 's2', docId: 'd', codeId: 'c', start: 12, end: 20, text: 'A second excerpt\nwith a separate line.', note: 'Second passage memo', coder: 'Bob', createdAt: 2 },
    { id: 's1', docId: 'd', codeId: 'c', start: 0, end: 10, text: 'R3: সরতে পারেনা নদীতে সরতে পারেনা পানি।\nR2: Water remains for weeks.', note: 'First passage memo', starred: true, coder: 'Ann', createdAt: 1 },
    { id: 's3', docId: 'd', codeId: 'c', start: 0, end: 10, text: 'Same passage coded separately', createdAt: 3 }
  ],
  codedRegions: [{ id: 'r', imageId: 'i', codeId: 'c', x: .1, y: .2, width: .3, height: .4, note: 'Image passage memo', coder: 'Ann', starred: true, createdAt: 1 }],
  frameworkCells: [{ docId: 'd', codeId: 'c', text: 'Case and theme summary' }]
});

test('source/code grouping preserves selected text, images, attribution and memos without mutation', () => {
  const p = fixture(); const before = JSON.stringify(p);
  const report = buildCodeReport(p, 'codesExcerptsSummaries', new Set(['c', 'empty']));
  assert.equal(report.sources.length, 2);
  const text = report.sources[0].codes[0];
  assert.equal(text.path, 'Environment > Cause of Waterlogging');
  assert.equal(text.excerptCount, 3);
  assert.deepEqual(text.excerpts.map(e => e.coder), ['Ann', 'Unattributed', 'Bob']);
  assert.equal(text.frameworkMemo, 'Case and theme summary');
  assert.equal(report.sources[0].memo, 'Source context');
  assert.equal(report.sources[1].memo, 'Image context');
  assert.equal(report.sources[1].codes[0].excerpts[0].region.id, 'r');
  assert.equal(report.uncoded.length, 1);
  assert.equal(JSON.stringify(p), before);
});

test('scopes, empty selections and missing sources keep their intended content', () => {
  const p = fixture();
  const only = buildCodeReport(p, 'codesOnly', new Set(['c']));
  assert.equal(only.sources.length, 2);
  assert.equal(only.sources[0].codes[0].excerptCount, 3);
  assert.equal(only.sources[0].codes[0].excerpts.length, 0);
  assert.ok(only.sources[0].codes[0].definition);
  const excerpts = buildCodeReport(p, 'codesExcerpts', new Set(['c']));
  assert.equal(excerpts.sources[0].codes[0].summary, undefined);
  assert.equal(excerpts.sources[0].memo, undefined);
  assert.equal(excerpts.sources[0].codes[0].excerpts[0].note, 'First passage memo');
  assert.deepEqual(buildCodeReport(p, 'codesExcerpts', new Set()).sources, []);
  p.docs = []; p.images = [];
  assert.deepEqual(buildCodeReport(p, 'codesExcerpts').sources.map(s => s.name), ['Missing source d', 'Missing source i']);
});

test('project/code filenames preserve Unicode and remain safe and bounded', () => {
  const p = fixture();
  assert.equal(codeExportFilename(p, new Set(['c'])), 'Waterlogging study_Cause of Waterlogging');
  assert.equal(codeExportFilename(p), 'Waterlogging study_All codes');
  assert.match(codeExportFilename(p, new Set(['c', 'empty'])), /Cause of Waterlogging \+ Uncoded theme$/);
  p.name = 'জলাবদ্ধতা'; p.codes[1].name = 'পানির কারণ';
  assert.equal(safeFilename(codeExportFilename(p, new Set(['c']))), 'জলাবদ্ধতা_পানির কারণ');
  p.name = 'A'.repeat(300); p.codes[1].name = 'B'.repeat(300);
  const long = codeExportFilename(p, new Set(['c']));
  assert.equal(long.length, 180); assert.match(long, /_B/);
  assert.equal(safeFilename('CON'), '_CON');
  assert.equal(safeFilename('a/b:*?<>"|. '), 'a_b_______');
});

test('actual Word package has no tables, correct source/code/excerpt order, Bengali text and image media', async () => {
  const report = buildCodeReport(fixture(), 'codesExcerptsSummaries', new Set(['c', 'empty']));
  report.sources[1].codes[0].excerpts[0].image = {
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1cAAAAASUVORK5CYII=', width: 1, height: 1
  };
  const buffer = await Packer.toBuffer(buildCodeReportDocx(report));
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml').async('string');
  assert.doesNotMatch(xml, /<w:tbl[ >]/);
  assert.ok(xml.indexOf('FGD Male Khalilnagar') < xml.indexOf('Environment &gt; Cause of Waterlogging'));
  assert.ok(xml.indexOf('Environment &gt; Cause of Waterlogging') < xml.indexOf('Excerpt 1'));
  for (const value of ['সরতে পারেনা', 'Second passage memo', 'Code summary', 'Source memo', 'Framework memo', 'Image passage memo', 'Unattributed', 'Key excerpt', 'Memo without coding']) assert.ok(xml.includes(value), value);
  assert.doesNotMatch(xml, /Coverage|Files\\|references coded/);
  assert.ok(Object.keys(zip.files).some(name => name.startsWith('word/media/') && name.endsWith('.png')));
  assert.ok(zip.file('word/footer1.xml'));
  if (process.env.EQC_DOCX_QA) {
    const out = path.resolve('release/docx-qa'); fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, `${report.filenameBase}.docx`), buffer);
  }
});
