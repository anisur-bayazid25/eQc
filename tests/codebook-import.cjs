const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Papa = require('papaparse');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, f);
const { parseCsvDataset } = require('../electron/csvDataset.cjs');
const { importCsvDataset } = require('../src/lib/csvImport.ts');
const rows = [
  ['Parent code', 'Child code', 'Operational definition', 'Include when', 'Exclusion / coding note', 'Study objective', 'Relevant data sources'],
  ['Living conditions', 'Daytime heat', 'Heat, humidity, discomfort, and fatigue during the day.', 'Timing, duration, or intensity is described.', 'Also code symptoms, sleep, and care.', 'Objective A', 'FGD, IDI'],
  ['Living conditions', 'Housing', 'Features affecting heat.', 'Housing is described.', 'Do not infer causation.', 'Objective B', 'KII']
];
test('pasted codebook tables retain hierarchy, definitions and labelled guidance without creating sources', () => {
  for (const delimiter of ['\t', ',', ';']) {
    const parsed = parseCsvDataset('\uFEFF' + Papa.unparse(rows, { delimiter }) + '\r\n\t\t\r\n', 'codebook.txt');
    const project = { codes: [], docs: [], codedSegments: [] };
    const summary = importCsvDataset(project, parsed);
    assert.equal(summary.codesCreated, 3);
    assert.equal(project.docs.length, 0);
    assert.equal(project.codedSegments.length, 0);
    const parent = project.codes.find(c => c.name === 'Living conditions');
    for (const row of rows.slice(1)) {
      const child = project.codes.find(c => c.name === row[1]);
      assert.equal(child.parentId, parent.id);
      assert.equal(child.definition, row[2]);
      for (let i = 3; i < row.length; i++) assert.ok(child.summary.includes(`${rows[0][i]}: ${row[i]}`));
    }
    const before = JSON.stringify(project);
    importCsvDataset(project, parsed);
    assert.equal(JSON.stringify(project), before);
  }
});
test('existing exported codebook column names keep their level routing', () => {
  const parsed = parseCsvDataset('Parent Node,Child Node 1,Child Node 2,Definition of Parent Node,Child 1 Summary\nTheme,Subtheme,Leaf,Parent rule,Child memo', 'legacy.csv');
  const project = { codes: [], docs: [], codedSegments: [] };
  importCsvDataset(project, parsed);
  assert.equal(project.codes[0].definition, 'Parent rule');
  assert.equal(project.codes[1].summary, 'Child memo');
  assert.equal(project.codes[2].parentId, project.codes[1].id);
});
