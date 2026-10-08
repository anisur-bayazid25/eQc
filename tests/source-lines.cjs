const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, filename);
const { sourceLines, sourceLineRange } = require('../src/lib/sourceLines.ts');
const { captureOriginalSource, decodeOriginalSource } = require('../electron/sourceOriginal.cjs');
const { mergeProjectInto } = require('../src/lib/merge.ts');
const { buildScopedExport } = require('../src/lib/exportBuilders.ts');
const { buildCodeReport } = require('../src/lib/codeReport.ts');

test('logical lines preserve CRLF, blank lines, Bengali and all offsets', () => {
  const content = 'প্রথম\r\n\r\nthird\nfourth\rfifth\n';
  const lines = sourceLines(content);
  assert.equal(lines.length, 6);
  assert.equal(lines.map(l => l.text).join(''), content);
  assert.equal(sourceLines('').length, 1);
  assert.equal(sourceLineRange(content, 0, 5), 'Line 1');
  assert.equal(sourceLineRange(content, 0, content.indexOf('fourth') + 3), 'Lines 1–4');
  assert.equal(sourceLineRange(content, content.length, content.length), 'Line 6');
});

test('retained Word/PDF bytes survive capture, JSON backups and project merge', () => {
  const bytes = Buffer.from('original bytes with formatting\x00\xff', 'binary');
  const original = captureOriginalSource(bytes, 'Original.docx', 'docx', 'first\nsecond');
  assert.match(original.textHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(decodeOriginalSource(JSON.parse(JSON.stringify(original))), bytes);
  assert.equal(captureOriginalSource(bytes, 'Plain.txt', 'txt', 'text'), undefined);
  assert.throws(() => decodeOriginalSource({ format: 'exe', base64: 'aGVsbG8=' }), /supported/);
  const base = { folders: [], codes: [], docs: [], codedSegments: [] };
  const source = { ...base, docs: [{ id: 'd', name: 'Original.docx', content: 'first\nsecond', original }] };
  const target = structuredClone(base);
  mergeProjectInto(target, source);
  assert.deepEqual(target.docs[0].original, original);
  const existing = { ...base, docs: [{ id: 'other', name: 'Original.docx', content: 'first\nsecond' }] };
  mergeProjectInto(existing, source);
  assert.deepEqual(existing.docs[0].original, original);
});

test('text excerpts carry source-line references in CSV and narrative Word payloads', () => {
  const p = { name: 'Lines', codes: [{ id: 'c', name: 'Theme', parentId: null }], docs: [{ id: 'd', name: 'Interview', content: 'first\nsecond\nthird' }], codedSegments: [{ id: 's', docId: 'd', codeId: 'c', start: 6, end: 18, text: 'second\nthird', createdAt: 1 }] };
  const csv = buildScopedExport(p, 'codesExcerpts');
  assert.equal(csv.rows[0][csv.headers.indexOf('Source Lines')], 'Lines 2–3');
  assert.equal(buildCodeReport(p, 'codesExcerpts').sources[0].codes[0].excerpts[0].location, 'Lines 2–3');
});
