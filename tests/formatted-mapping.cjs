const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const { mapFormattedText, mappedSelection } = require('../src/lib/formattedMapping.ts');
const { mergeProjectInto } = require('../src/lib/merge.ts');

test('formatted mapping preserves repeated occurrences, table whitespace, heading casing and Unicode offsets', () => {
  const text = 'HEADING\r\n\r\nFirst quote  A\n\nSecond quote  B\n\nFirst quote  C\nবাংলা 😀';
  const rendered = 'HeadingFirst quoteASecond quoteBFirst quoteCবাংলা 😀';
  const map = mapFormattedText(text, rendered);
  const start = rendered.lastIndexOf('First quote');
  const selected = mappedSelection(map, start, start + 'First quote'.length);
  assert.equal(selected.start, text.lastIndexOf('First quote'));
  assert.equal(selected.text, text.slice(selected.start, selected.end));
  const first = rendered.indexOf('quoteA');
  const last = rendered.indexOf('quoteB') + 6;
  const acrossCells = mappedSelection(map, first, last);
  assert.equal(acrossCells.text, 'quote  A\n\nSecond quote  B');
  assert.equal(mappedSelection(map, rendered.indexOf('বাংলা'), rendered.length).text, 'বাংলা 😀');
});
test('unmapped or altered passages fail instead of assigning coding to a guessed range', () => {
  const map = mapFormattedText('First safe phrase\nOriginal sentence\nLast safe phrase', 'First safe phraseChanged sentenceLast safe phrase');
  assert.equal(mappedSelection(map, 17, 33), null);
  assert.equal(mappedSelection(map, 0, 17).text, 'First safe phrase');
  assert.equal(mappedSelection(mapFormattedText('A x B', 'AB'), 0, 2), null);
  assert.equal(mappedSelection(mapFormattedText('unrelated', 'something else'), 0, 14), null);
  assert.equal(mappedSelection(mapFormattedText('quote\nquote', 'quote'), 0, 5), null, 'missing repeated occurrence was guessed');
});
test('PDF page links are remapped when projects are merged and survive JSON backups', () => {
  const project = { id:'p', name:'p', folders:[], docs:[], codes:[], codedSegments:[], images:[], codedRegions:[] };
  const source = { ...project, id:'s', docs:[{id:'d',name:'Paper',content:'text',folderId:null}], images:[{id:'i',name:'Paper — PDF page 2',dataUrl:'data:image/png;base64,a',folderId:null,pdfPage:{docId:'d',page:2,originalHash:'hash'}}] };
  const merged = JSON.parse(JSON.stringify(project));
  mergeProjectInto(merged, JSON.parse(JSON.stringify(source)));
  assert.equal(merged.images[0].pdfPage.docId, merged.docs[0].id);
  assert.equal(merged.images[0].pdfPage.page,2);
  mergeProjectInto(merged, source);
  assert.equal(merged.images.length,1);
  const otherResolution = JSON.parse(JSON.stringify(source));
  otherResolution.images[0].dataUrl = 'data:image/png;base64,differentResolution';
  mergeProjectInto(merged, otherResolution);
  assert.equal(merged.images.length,1,'different zoom created a duplicate linked page');
});
