const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {defaultDemographicTable,defaultDemographicField,demographicNumber,numericDemographics,makeDemographicBands,makeDemographicRule,demographicBandMatches,buildDemographicTable,validateDemographicTable,loadDemographicTable}=require('../src/lib/demographicTable.ts');
const {demographicOutput,demographicFlatRows,demographicHtml}=require('../src/lib/demographicOutput.ts');
const project={folders:[],docs:[{id:'d'}],cases:['20','25','30','35','40','Not reported','about 45'].map((Age,i)=>({id:'p'+i,name:'Person '+i,attributes:{Age,Gender:i%2?'Woman':'Man'},links:[{docId:'d'}]}))};
const draft=()=>({...defaultDemographicTable(project),fields:[defaultDemographicField('Age')]});
test('numeric parsing and sample summaries avoid interpreting uncertain participant data',()=>{
 assert.equal(demographicNumber('২৫'),25);for(const v of ['about 45','20-25','', 'Infinity'])assert.equal(demographicNumber(v),undefined);
 const n=numericDemographics([1,2,3,4]);assert.equal(n.mean,2.5);assert.equal(n.q1,1.75);assert.equal(n.q3,3.25);assert.ok(Math.abs(n.sd-Math.sqrt(5/3))<1e-10);assert.equal(numericDemographics([]).median,null);assert.equal(numericDemographics([4]).sd,null);
});
test('all numeric operators honour exact endpoints including singleton equality',()=>{
 for(const [op,below,equal,above] of [['gt',false,false,true],['gte',false,true,true],['lt',true,false,false],['lte',true,true,false],['eq',false,true,false]]){
  const b=makeDemographicRule(op,30);assert.deepEqual([29,30,31].map(v=>demographicBandMatches(v,b)),[below,equal,above]);
 }
 for(const left of [true,false])for(const right of [true,false])assert.deepEqual([20,25,30].map(v=>demographicBandMatches(v,makeDemographicRule('between',20,30,left,right))),[left,true,right]);
 assert.throws(()=>makeDemographicRule('between',30,20));assert.throws(()=>makeDemographicRule('gt',NaN));
});
test('rules persist, count each case once, expose unmatched/missing, reject overlapping categories',()=>{
 const d=draft(),before=JSON.stringify(project);d.fields[0].mode='bands';d.fields[0].bands=[makeDemographicRule('lt',30),makeDemographicRule('eq',30),makeDemographicRule('gt',30)];
 const rows=buildDemographicTable(project,d).sections[0].rows;assert.deepEqual(rows.map(r=>r.cells[0].n),[2,1,2,2]);assert.equal(JSON.stringify(project),before);
 assert.deepEqual(loadDemographicTable(project,JSON.parse(JSON.stringify(d))).fields[0].bands,d.fields[0].bands);
 d.fields[0].bands=[makeDemographicRule('lte',30),makeDemographicRule('gte',30)];assert.throws(()=>validateDemographicTable(d),/overlap/);
 d.fields[0].bands=[makeDemographicRule('eq',30)];assert.equal(buildDemographicTable(project,d).sections[0].rows.find(r=>r.label==='Other values').cells[0].n,4);
 d.fields[0].bands=[makeDemographicRule('between',20,30,true,false),makeDemographicRule('between',30,40,true,true)];assert.doesNotThrow(()=>validateDemographicTable(d));
});
test('band generators, category recoding, missing rules and comparison denominators',()=>{
 assert.deepEqual(makeDemographicBands([20,40],10).map(b=>[b.min,b.max]),[[20,30],[30,40],[40,50]]);assert.throws(()=>makeDemographicBands([1,1000],1),/50/);assert.throws(()=>makeDemographicBands([],10));
 const d=draft();d.fields[0].categories=[{id:'young',label:'Younger participants',values:['20','25']}];assert.equal(buildDemographicTable(project,d).sections[0].rows[0].cells[0].n,2);
 d.preset='comparison';d.groupBy='__custom';d.customGroups=[{id:'a',label:'A',caseIds:['p0','p0','p1','absent']},{id:'b',label:'B',caseIds:['p0','p2']}];assert.deepEqual(buildDemographicTable(project,d).groups.map(g=>g.cases.length),[2,2]);
});
test('publication output retains merged labels, escapes HTML, and flattens rows consistently',async()=>{
 const d=draft();d.preset='variables';d.title='<Title>';d.style='grid';const output=demographicOutput(project,d),flat=demographicFlatRows(output);assert.ok(output.rows.some(r=>r.cells.some(c=>c.rowSpan>1)));assert.ok(flat.every(r=>r.length===output.columnCount));assert.equal(flat[2][0],'Age');assert.match(demographicHtml(output),/&lt;Title&gt;/);
 const {Packer}=require('docx'),JSZip=require('jszip'),{buildDemographicDocx}=require('../electron/demographicTable.cjs');const zip=await JSZip.loadAsync(await Packer.toBuffer(buildDemographicDocx(output))),xml=await zip.file('word/document.xml').async('string');assert.match(xml,/w:vMerge/);assert.match(xml,/w:tblHeader/);assert.match(xml,/Times New Roman/);assert.match(xml,/&lt;Title&gt;/);
});
test('exchange archive retains table rules and merge remaps source/case scope',async()=>{
 const d=draft();d.fields[0].mode='bands';d.fields[0].bands=[makeDemographicRule('lte',30)];d.scope.docIds=['d'];d.resolvedDocIds=['d'];d.groupBy='__custom';d.customGroups=[{id:'group',label:'Selected',caseIds:['p0']}];
 const p={...project,name:'Study',codes:[],codedSegments:[],docs:[{id:'d',name:'Interview',content:'Transcript'}],demographicTables:[d]};
 const {buildQdpxExport}=require('../src/lib/qdpxExport.ts');const payload=await buildQdpxExport(p),archive=Object.values(payload.sourceFiles).find(s=>s.startsWith('{"format":"eQc-research"'));
 assert.ok(archive);assert.deepEqual(JSON.parse(archive).records.demographicTables,[d]);
 const {mergeResearchExtras}=require('../src/lib/researchExtrasMerge.ts'),target={name:'Target'};mergeResearchExtras(target,p,new Map([['d','new-source'],['p0','new-case']]));
 const restored=target.demographicTables[0];assert.deepEqual(restored.scope.docIds,['new-source']);assert.deepEqual(restored.resolvedDocIds,['new-source']);assert.deepEqual(restored.customGroups[0].caseIds,['new-case']);assert.deepEqual(restored.fields,d.fields);
});
