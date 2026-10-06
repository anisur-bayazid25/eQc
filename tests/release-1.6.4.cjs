const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, filename);
const { mergeCodes } = require('../src/lib/mergeCodes.ts');
const { buildScopedExport, SCOPE_LABELS } = require('../src/lib/exportBuilders.ts');
const { buildReportHtml } = require('../src/lib/report.ts');
const { computePairwiseIcr } = require('../src/lib/icr.ts');
function fixture() {
  const code = (id, parentId = 'p') => ({ id, name: id, parentId, color: '#123456', summary: `memo ${id}`, definition: `rule ${id}`, createdAt: 1 });
  const seg = (id, codeId, coder, start = 0, end = 5) => ({ id, codeId, coder, docId: 'd', start, end, text: 'quote', note: `note ${id}`, source: 'manual', createdAt: 1 });
  return { id: 'project', name: '<Project>', createdAt: 1, folders: [], docs: [{ id: 'd', name: 'Interview <one>', content: 'quote solo', addedAt: 1, sizeBytes: 10 }],
    codes: [code('p', null), code('a'), code('b'), code('c'), code('child', 'b'), code('empty')],
    codedSegments: [seg('s1', 'a', 'Ann'), seg('s2', 'b', 'Bob'), seg('s3', 'a', 'Carol', 6, 10), seg('s4', 'c', undefined)],
    images: [{ id: 'i', name: 'Photo <one>', dataUrl: '', addedAt: 1, sizeBytes: 1 }],
    codedRegions: [{ id: 'r', imageId: 'i', codeId: 'c', x: .1, y: .2, width: .3, height: .4, note: 'image memo', coder: 'Ann', starred: true, createdAt: 1 }],
    frameworkCells: [{ id: 'f1', docId: 'd', codeId: 'a', text: 'A text', updatedAt: 1 }, { id: 'f2', docId: 'd', codeId: 'b', text: 'B text', updatedAt: 2 }],
    relationNotes: [{ id: 'n', codeAId: 'a', codeBId: 'b', note: 'internal memo', updatedAt: 1 }, { id: 'n2', codeAId: 'b', codeBId: 'child', note: 'external memo', updatedAt: 2 }],
    mapEdgeStyles: [{ id: 'e', fromCodeId: 'b', toCodeId: 'child', kind: 'custom' }], hiddenMapCodeIds: ['b'], mapAnnotations: [{ id: 'annotation' }] };
}
test('merge three siblings keeps codings, children, memos and analysis without mutating input', () => {
  const original = fixture(); const before = JSON.stringify(original);
  const p = mergeCodes(original, ['a', 'b', 'c'], 'a');
  assert.equal(p.codes.length, original.codes.length - 2);
  assert.equal(p.codes.find(c => c.id === 'child').parentId, 'a');
  assert.equal(p.codedSegments.length, original.codedSegments.length);
  assert.deepEqual(p.codedSegments.map(s => s.coder), original.codedSegments.map(s => s.coder));
  assert.equal(p.codedRegions[0].codeId, 'a'); assert.equal(p.codedRegions[0].note, 'image memo');
  assert.equal(p.frameworkCells.length, 1); assert.match(p.frameworkCells[0].text, /A text\n\nB text/);
  assert.match(p.codes.find(c => c.id === 'a').summary, /memo b/);
  assert.match(p.codes.find(c => c.id === 'a').summary, /internal memo/);
  assert.match(p.codes.find(c => c.id === 'a').definition, /rule c/);
  assert.equal(p.relationNotes[0].codeAId, 'a'); assert.equal(p.mapEdgeStyles[0].fromCodeId, 'a');
  assert.deepEqual(p.hiddenMapCodeIds, []); assert.deepEqual(p.mapAnnotations, original.mapAnnotations);
  assert.equal(JSON.stringify(original), before);
});
test('ancestor merge is rejected, merging a descendant into ancestor is safe', () => {
  assert.throws(() => mergeCodes(fixture(), ['b', 'child'], 'child'), /ancestor/);
  const p = mergeCodes(fixture(), ['b', 'child'], 'b');
  assert.equal(p.codes.find(c => c.id === 'b').parentId, 'p');
  assert.throws(() => mergeCodes(fixture(), ['a'], 'b'), /must be selected/);
  assert.throws(() => mergeCodes(fixture(), ['a'], 'a'), /at least two/);
});
test('every scope includes document names, image coding and uncoded codes', () => {
  for (const scope of Object.keys(SCOPE_LABELS)) {
    const data = buildScopedExport(fixture(), scope);
    assert.equal(data.headers[0], 'Document');
    assert.match(data.csv, /Interview <one>/); assert.match(data.csv, /Photo <one>/); assert.match(data.csv, /empty/);
    assert.ok(data.rows.every(r => r.length === data.headers.length));
    if (scope !== 'codesOnly') { assert.match(data.csv, /Image region/); assert.match(data.csv, /image memo/); assert.equal(data.imageRows.length, 1); }
  }
  assert.equal(Object.keys(SCOPE_LABELS).length, 3);
});
test('exact code selection excludes other excerpts and retains hierarchy', () => {
  const data = buildScopedExport(fixture(), 'codesExcerptsSummaries', new Set(['child', 'c']));
  assert.match(data.csv, /p,b,child/); assert.match(data.csv, /rule c/); assert.doesNotMatch(data.csv, /memo a/);
  const empty = buildScopedExport(fixture(), 'codesExcerpts', new Set()); assert.equal(empty.rows.length, 0);
});
test('CSV quotes delimiters, quotes and carriage returns', () => {
  const p = fixture(); p.docs[0].name = 'one,"two"\rthree';
  const data = buildScopedExport(p, 'codesExcerpts');
  assert.match(data.csv, /"one,""two""\rthree"/);
});
test('HTML includes every analysis, scope, ICR values, consensus and escaped image sources', () => {
  const p = fixture(); const scope = { docIds: ['d'], includeImages: true };
  const html = buildReportHtml(p, { icr: { coders: ['Ann', 'Bob', 'Carol'], scope, coderA: 'Ann', coderB: 'Bob' },
    wordFrequencies: [{ word: 'quote', count: 2 }], kwicKeyword: 'missing', kwicResults: [], imageExcerpts: [{ regionId: 'r', base64: 'aGVsbG8=' }] });
  for (const label of ['Coding Frequency', 'Code x Document Matrix', 'Code Co-occurrence Matrix', 'Framework Matrix', 'Word Frequencies', 'KWIC', 'Inter-Coder Reliability', 'Fleiss', 'c-Alpha-binary', 'Cu-Alpha', 'Consensus Summary', 'Image Coding']) assert.ok(html.includes(label), label);
  assert.ok(html.includes(computePairwiseIcr(p, 'Ann', 'Bob', scope).percent.toFixed(1) + '% agreement'));
  assert.match(html, /1 review passages: 0 agreements, 1 disagreements/); assert.match(html, /1 single-coder passages excluded/);
  assert.match(html, /Interview &lt;one&gt;/); assert.match(html, /Photo &lt;one&gt;/); assert.match(html, /data:image\/png;base64,aGVsbG8=/);
  assert.match(html, /no matches/); assert.doesNotMatch(html, /<Project>/);
});
test('HTML handles empty scopes and no coder projects explicitly', () => {
  const p = fixture();
  const html = buildReportHtml(p, { icr: { coders: [], scope: { docIds: [], includeImages: false }, coderA: '', coderB: '' } });
  assert.match(html, /Coders: None/); assert.match(html, /0 review passages/); assert.match(html, /Requires at least three/);
  p.codedSegments = []; p.codedRegions = []; assert.match(buildReportHtml(p), /No coded image regions/);
});
test('DOCX embeds table image and image-only manuscript without requiring text quotes', async () => {
  const docx = require('docx'); const JSZip = require('jszip');
  const main = fs.readFileSync(require.resolve('../electron/main.cjs'), 'utf8');
  const definitions = main.slice(main.indexOf('function buildTableDocx'), main.indexOf("ipcMain.handle('export:docx'"));
  const ctx = { ...docx, Buffer, Math }; vm.createContext(ctx); vm.runInContext(definitions, ctx);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1kAAAAASUVORK5CYII=';
  for (const doc of [ctx.buildTableDocx('Images', ['Document', 'Quote'], [['Photo', 'region']], [{ row: 0, column: 1, base64: png, width: 1, height: 1 }]),
    ctx.buildOutlineDocx('Manuscript', [{ name: 'Image code', depth: 0, summary: 'Memo', quotes: [], imageQuotes: [{ base64: png, width: 1, height: 1, caption: 'Photo' }] }])]) {
    const zip = await JSZip.loadAsync(await docx.Packer.toBuffer(doc));
    assert.ok(Object.keys(zip.files).some(f => f.startsWith('word/media/') && !zip.files[f].dir));
    assert.match(await zip.file('word/document.xml').async('string'), /Photo/);
  }
});
