// Arbitrary-depth codebook import: the import dialog maps one column per code
// level, each with an optional definition and summary, and the importer must
// build the same tree the file describes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React }
}).outputText, filename);
// The dialog module is .tsx; it is only imported for its exported detectors.
require.extensions['.tsx'] = require.extensions['.ts'];
const { importCsvDataset } = require('../src/lib/csvImport.ts');
const { detectLevels } = require('../src/components/TableImportDialog.tsx');
const { newProject } = require('../src/domain.ts');

const blank = () => newProject('Import');
const byName = project => new Map(project.codes.map(code => [code.name, code]));
const depthOf = (project, code) => {
  const byId = new Map(project.codes.map(item => [item.id, item]));
  let depth = 0;
  let current = code;
  while (current && current.parentId) {
    current = byId.get(current.parentId);
    depth += 1;
  }
  return depth;
};

function parsed(rows, extra = {}) {
  return {
    fileName: 'codebook.csv',
    fields: Object.keys(rows[0] || {}),
    rows,
    columns: { source: null, quote: null, parent: null, child1: null, child2: null, coder: null },
    summaryFields: [],
    definitionFields: [],
    metadataFields: [],
    errors: [],
    ...extra,
  };
}

test('six code levels import with their own definition and summary columns', () => {
  const rows = [{
    'Theme': 'Environmental disruption',
    'Child code 1': 'Flooding',
    'Child code 2': 'Salt water intrusion',
    'Child code 3': 'Crop damage',
    'Child code 4': 'Soil salinity',
    'Child code 5': 'Yield collapse',
    'Theme definition': 'Umbrella theme',
    'Child 2 definition': 'Salt water reaching soil',
    'Child 5 definition': 'Two failed harvests',
    'Theme summary': 'How the environment became unstable',
    'Child 1 summary': 'Water entering homes',
    'Child 3 summary': 'Kitchen gardens lost',
    'Child 5 summary': 'Harvests failed twice',
  }];
  const levels = ['Theme', 'Child code 1', 'Child code 2', 'Child code 3', 'Child code 4', 'Child code 5'];
  const project = blank();
  const summary = importCsvDataset(project, parsed(rows, {
    columns: { source: null, quote: null, parent: 'Theme', child1: 'Child code 1', child2: 'Child code 2', coder: null, levels },
    summaryColumns: [
      { field: 'Theme summary', level: 0 }, { field: 'Child 1 summary', level: 1 },
      { field: 'Child 3 summary', level: 3 }, { field: 'Child 5 summary', level: 5 },
    ],
    definitionColumns: [
      { field: 'Theme definition', level: 0 }, { field: 'Child 2 definition', level: 2 },
      { field: 'Child 5 definition', level: 5 },
    ],
  }));

  assert.equal(summary.codesCreated, 6);
  const code = byName(project);
  assert.equal(depthOf(project, code.get('Yield collapse')), 5, 'deepest level is six levels down from the root');
  assert.equal(code.get('Soil salinity').parentId, code.get('Crop damage').id);
  assert.equal(code.get('Yield collapse').definition, 'Two failed harvests');
  assert.equal(code.get('Yield collapse').summary, 'Harvests failed twice');
  assert.equal(code.get('Salt water intrusion').definition, 'Salt water reaching soil');
  assert.equal(code.get('Environmental disruption').summary, 'How the environment became unstable');
  assert.equal(code.get('Flooding').summary, 'Water entering homes');
  assert.equal(code.get('Crop damage').summary, 'Kitchen gardens lost');
  assert.equal(code.get('Soil salinity').definition || '', '', 'levels without a column keep empty text');
});

test('an empty cell in the middle attaches deeper codes to the nearest ancestor', () => {
  const project = blank();
  importCsvDataset(project, parsed(
    [{ A: 'Theme', B: '', C: 'Deep under theme' }, { A: 'Theme', B: 'Child', C: '' }, { A: '', B: '', C: 'Root code' }],
    { columns: { source: null, quote: null, parent: 'A', child1: 'B', child2: 'C', coder: null, levels: ['A', 'B', 'C'] } }
  ));
  const code = byName(project);
  assert.equal(project.codes.length, 4);
  assert.equal(code.get('Deep under theme').parentId, code.get('Theme').id);
  assert.equal(code.get('Child').parentId, code.get('Theme').id);
  assert.equal(code.get('Root code').parentId, null);
});

test('header-routed definition and summary columns map to their own level', () => {
  // Regression: "Definition of Child Node 2" belongs to the third level
  // (parent -> child 1 -> child 2), not the second.
  const project = blank();
  importCsvDataset(project, parsed(
    [{ 'Parent Node': 'P', 'Child Node 1': 'C1', 'Child Node 2': 'C2', 'Parent Node Summary': 'theme memo', 'Definition of Child Node 2': 'third level rule' }],
    {
      columns: { source: null, quote: null, parent: 'Parent Node', child1: 'Child Node 1', child2: 'Child Node 2', coder: null },
      summaryFields: ['Parent Node Summary'],
      definitionFields: ['Definition of Child Node 2'],
    }
  ));
  const code = byName(project);
  assert.equal(code.get('P').summary, 'theme memo');
  assert.equal(code.get('C2').definition, 'third level rule');
  assert.equal(code.get('C1').definition || '', '');
});

test('the import dialog detects a level list and per-level text columns', () => {
  const detected = detectLevels([
    'Theme', 'Theme summary', 'Theme definition',
    'Child code 1', 'Child 1 summary',
    'Child code 2', 'Child 2 definition',
    'Child code 3',
    'Document', 'Quote', 'Coder',
  ]);
  assert.deepEqual(detected.map(level => level.code), ['Theme', 'Child code 1', 'Child code 2', 'Child code 3']);
  assert.deepEqual(detected.map(level => level.summary), ['Theme summary', 'Child 1 summary', '', '']);
  assert.deepEqual(detected.map(level => level.definition), ['Theme definition', '', 'Child 2 definition', '']);
});
