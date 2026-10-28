const test=require('node:test'),assert=require('node:assert/strict'),Papa=require('papaparse'),JSZip=require('jszip');
const {buildSpreadsheetExport}=require('../electron/spreadsheetExport.cjs'),{readWorkbook}=require('../electron/xlsxTable.cjs');
test('tabular exports are genuine Excel workbooks and preserve Unicode, quotes, IDs, blanks and literal formulas',async()=>{
 const rows=[['Case','Quote','N'],['001','বাংলা, "heat"\nAnother line','3'],['=1+1','<literal>&',''],['','','']];
 const bytes=await buildSpreadsheetExport(Papa.unparse(rows));assert.equal(bytes.subarray(0,2).toString(),'PK');
 const sheets=await readWorkbook(bytes);assert.deepEqual(sheets[0].rows.slice(0,3),rows.slice(0,3));
 const zip=await JSZip.loadAsync(bytes),xml=await zip.file('xl/worksheets/sheet1.xml').async('string');assert.doesNotMatch(xml,/<f[ >]/);assert.match(xml,/autoFilter/);assert.match(xml,/state="frozen"/);
});
test('publication title/notes exports retain their complete grid without a one-column auto-filter',async()=>{
 const rows=[['Participant characteristics'],['Category','N','%'],['Age 20–30','5','50.0'],[],['All cases included.']];const bytes=await buildSpreadsheetExport(Papa.unparse(rows)),zip=await JSZip.loadAsync(bytes),xml=await zip.file('xl/worksheets/sheet1.xml').async('string');assert.doesNotMatch(xml,/autoFilter|state="frozen"/);const sheets=await readWorkbook(bytes);assert.equal(sheets[0].rows[2][2],'50.0');assert.equal(sheets[0].rows[4][0],'All cases included.');
});
test('malformed delimited data fails explicitly instead of saving a misleading workbook',async()=>{await assert.rejects(buildSpreadsheetExport('Name,Quote\nA,"unfinished'),/prepare spreadsheet/);});
test('renderer routes spreadsheets through the existing workbook bridge, preserving case import round trips',async()=>{
 const fs=require('node:fs'),ts=require('typescript');require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
 const {saveExport}=require('../src/lib/spreadsheetExport.ts'),{caseTableCsv,previewCaseImport}=require('../src/lib/caseExchange.ts'),{gridToTable}=require('../electron/csvDataset.cjs');let payload;
 global.window={qv:{exportMemoWorkbook:async p=>{payload=p;return 'Cases.xlsx';},exportText:()=>{throw Error('A spreadsheet must never be written as plain text.');}}};
 const project={docs:[{id:'source',name:'FGD',content:'A participant account'}],cases:[{id:'case1',name:'P1',kind:'person',attributes:{Age:'30'},links:[{docId:'source',start:1,end:4}]}]};
 assert.equal(await saveExport({title:'Cases',defaultName:'Cases.xlsx',extension:'xlsx',filterName:'Excel workbook',content:caseTableCsv(project)}),'Cases.xlsx');
 assert.equal(payload.filenameBase,'Cases');const {buildMemoWorkbook}=require('../electron/memoWorkbook.cjs'),sheets=await readWorkbook(await buildMemoWorkbook(payload.sheets)),grid=gridToTable(sheets[0].rows),plan=previewCaseImport(project,grid.rows);
 assert.equal(plan.unchanged+plan.updated,1);assert.deepEqual(plan.cases[0].attributes,project.cases[0].attributes);assert.deepEqual(plan.cases[0].links,project.cases[0].links);delete global.window;
});
