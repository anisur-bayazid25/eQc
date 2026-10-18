const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Papa=require('papaparse'),path=require('node:path'),{spawnSync}=require('node:child_process');
Papa.default=Papa;
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {caseTableCsv,previewCaseImport}=require('../src/lib/caseExchange.ts');
const {captureIcrRun,icrFingerprint,sourceDisagreements}=require('../src/lib/icrRuns.ts');
const {projectInResearchScope}=require('../src/lib/researchScope.ts');
const {emptyQuery}=require('../src/lib/research.ts');
const {buildVisualization}=require('../src/lib/visualizations.ts');
const {buildQdpxExport}=require('../src/lib/qdpxExport.ts');
const {importQdpx}=require('../src/lib/qdpxImport.ts');
const {mergeProjectInto}=require('../src/lib/merge.ts');
const {buildReportHtml}=require('../src/lib/report.ts');
const {agreementBreakdown}=require('../src/lib/icrStatistics.ts');
const {DOMParser}=require('@xmldom/xmldom');
global.DOMParser=class{parseFromString(...args){const doc=new DOMParser().parseFromString(...args);doc.querySelector=tag=>doc.getElementsByTagNameNS('*',tag)[0]||null;for(const el of Array.from(doc.getElementsByTagName('*')))Object.defineProperty(el,'children',{get(){return Array.from(this.childNodes).filter(c=>c.nodeType===1);}});return doc;}};
const fixture=()=>({id:'p',name:'Research study',createdAt:1,folders:[],docs:[{id:'d',name:'FGD.txt',content:'😀 water costs. Other speaker says school.',addedAt:1}],codes:[{id:'a',name:'Access',parentId:null,color:'#123456',summary:'',createdAt:1},{id:'b',name:'Cost',parentId:null,color:'#123456',summary:'',createdAt:1}],codedSegments:[
 {id:'s1',docId:'d',codeId:'a',start:3,end:8,text:'water',coder:'Ann',createdAt:1},
 {id:'s2',docId:'d',codeId:'a',start:3,end:10,text:'water c',coder:'Bob',createdAt:1},
 {id:'s3',docId:'d',codeId:'b',start:30,end:36,text:'school',coder:'Ann',createdAt:1}],
 cases:[{id:'case',name:'মেরে',kind:'person',attributes:{Age:'39',Gender:'Woman',Participated:'true'},attributeTypes:{Age:'number',Participated:'boolean'},links:[{docId:'d',start:3,end:14}],notes:'Case memo'}],groups:[{id:'g',name:'Interviews',kind:'documents',memberIds:['d']}],memos:[],queries:[]});
const scope={docIds:['d'],includeImages:false};

test('case CSV round-trips IDs, Unicode, typed values and passage links without duplicates',()=>{
 const p=fixture(),rows=Papa.parse(caseTableCsv(p),{header:true}).data;
 const plan=previewCaseImport(p,rows);assert.equal(plan.cases.length,1);assert.equal(plan.cases[0].id,'case');assert.deepEqual(plan.cases[0].links,p.cases[0].links);assert.equal(plan.cases[0].attributes.Age,'39');assert.equal(plan.cases[0].attributeTypes.Age,'number');
 const again=previewCaseImport({...p,cases:plan.cases},rows);assert.equal(again.added,0);assert.equal(again.updated,0);
 const separate=previewCaseImport(p,rows,'add');assert.equal(separate.cases.length,2);assert.notEqual(separate.cases[1].id,'case');
 assert.equal(p.cases.length,1);
});
test('case import rejects ambiguity, duplicate identities, malformed types and invalid calendar dates',()=>{
 const p=fixture();assert.throws(()=>previewCaseImport(p,[{Case:'A','Case ID':'x'},{Case:'B','Case ID':'x'}]),/duplicate/);
 assert.throws(()=>previewCaseImport(p,[{Case:'A',Age:'oops','Attribute types':'{"Age":"number"}'}]),/number/);
 assert.throws(()=>previewCaseImport(p,[{Case:'A',Birth:'2026-02-31','Attribute types':'{"Birth":"date"}'}]),/date/);
 const warnings=previewCaseImport(p,[{Case:'A',Document:'Missing.txt'}]).warnings;assert.match(warnings[0],/unmatched/);
 const bad={...p,cases:[...p.cases,{...p.cases[0],id:'case2'}]};assert.throws(()=>previewCaseImport(bad,[{Case:'মেরে'}]),/ambiguous/);
});
test('case/query scopes retain exact coding entries and cannot broaden an empty selection',()=>{
 const p=fixture(),byCase={label:'Case',query:{...emptyQuery(),caseIds:['case']}},q=projectInResearchScope(p,byCase);
 assert.deepEqual(q.codedSegments.map(s=>s.id),['s1','s2']);assert.equal(p.codedSegments.length,3);
 assert.equal(projectInResearchScope(p,{label:'Empty',excerptIds:[]}).codedSegments.length,0);
 const options={title:'Scoped',preset:'documents',codeIds:['a','b'],docIds:['d'],limit:12,phrase:'',labels:'',ratings:'',colour:'#123456',researchScope:{label:'One passage',excerptIds:['s1']}};
 const graph=buildVisualization(p,'heat-map',options);assert.equal(graph.annotations.filter(a=>a.kind==='rect'&&a.sourceCodeIds&&a.sourceDocIds).reduce((n,a)=>n+Number(a.text),0),1);
 assert.throws(()=>buildVisualization(p,'heat-map',{...options,researchScope:{label:'Empty',excerptIds:[]}}),/no text coding/);
});
test('ICR runs preserve original values after coding changes and ignore purely visual changes',()=>{
 const p=fixture(),run=captureIcrRun(p,'Before consensus',['Ann','Bob'],scope,'source'),before=JSON.stringify(run);
 assert.equal(icrFingerprint({...p,mapAnnotations:[{id:'draw',text:'Note'}]}),run.fingerprint);
 const changed={...p,codedSegments:p.codedSegments.filter(s=>s.id!=='s3'),icrRuns:[run]};assert.notEqual(icrFingerprint(changed),run.fingerprint);
 const html=buildReportHtml(changed,{icrRunId:run.id});assert.match(html,/Historical snapshot/);assert.match(html,/Consensus Summary/);assert.ok(html.includes(run.name));assert.equal(JSON.stringify(run),before);
 assert.throws(()=>buildReportHtml(changed,{icrRunId:'missing'}),/unavailable/);
});
test('disagreement evidence distinguishes presence from boundaries and does not mutate coding',()=>{
 const p=fixture(),before=JSON.stringify(p),rows=sourceDisagreements(p,'Ann','Bob',scope);
 assert.equal(rows.find(r=>r.codeId==='a').kind,'Coding boundaries or regions differ');assert.equal(rows.find(r=>r.codeId==='b').kind,'Code presence differs');assert.equal(JSON.stringify(p),before);
 const breakdown=agreementBreakdown({bothYes:2,aOnly:1,bOnly:1,bothNo:6,n:10});assert.equal(breakdown.codedOnly,50);assert.equal(breakdown.disagreement,20);assert.equal(breakdown.neitherCoded,60);
});
test('QDPX preserves native research records and exports valid standard cases/variables/sets',async()=>{
 const p=fixture();p.caseFrameworkCells=[{id:'cf',caseId:'case',codeId:'a',text:'Case synthesis',updatedAt:1}];p.icrRuns=[captureIcrRun(p,'Independent coding',['Ann','Bob'],scope,'source')];
 const payload=await buildQdpxExport(p);const validation=spawnSync(process.env.EQC_PYTHON||'python',[path.join(__dirname,'validate-qdpx.py')],{input:JSON.stringify(payload),encoding:'utf8'});if(process.env.EQC_PYTHON)assert.equal(validation.status,0,validation.stderr||validation.error?.message);
 assert.match(payload.qdeXml,/<Variables>/);assert.match(payload.qdeXml,/<Cases>/);assert.match(payload.qdeXml,/<Sets>/);assert.match(payload.qdeXml,/<SelectionRef /);
 const target={...fixture(),id:'new',docs:[],codes:[],codedSegments:[],cases:[],groups:[]};await importQdpx(target,payload);
 assert.equal(target.cases.length,1);assert.equal(target.cases[0].name,'মেরে');assert.deepEqual(target.cases[0].links,[{docId:target.docs[0].id,start:3,end:14}]);assert.equal(target.icrRuns.length,1);assert.equal(target.icrRuns[0].result.text,p.icrRuns[0].result.text);assert.equal(target.caseFrameworkCells[0].caseId,target.cases[0].id);
 // Remove eQc's appendix to exercise a genuinely structured-only import.
 const standard={...payload,qdeXml:payload.qdeXml.replace(/<Note[^>]*name="eQc research archive \(JSON, version 1\)"[\s\S]*?<\/Note>/,'')};
 const external={...fixture(),id:'external',docs:[],codes:[],codedSegments:[],cases:[],groups:[],memos:[]};await importQdpx(external,standard);
 assert.equal(external.cases.length,1);assert.equal(external.cases[0].attributes.Age,'39');assert.equal(external.cases[0].attributeTypes.Age,'number');assert.deepEqual(external.cases[0].links,[{docId:external.docs[0].id,start:3,end:14}]);assert.equal(external.groups[0].memberIds[0],external.docs[0].id);
});
test('merging preserves snapshots, case summaries and conflicting setups without overwriting destination settings',()=>{
 const source=fixture(),target={...fixture(),id:'other',cases:[],groups:[],memos:[]};source.icrRuns=[captureIcrRun(source,'Baseline',['Ann','Bob'],scope,'source')];source.caseFrameworkCells=[{id:'cf',caseId:'case',codeId:'a',text:'Summary',updatedAt:1}];source.icrComparison={method:'characters',codeIds:['a'],overlap:90,domains:[],training:[]};target.icrComparison={...source.icrComparison,method:'sentences'};
 mergeProjectInto(target,source);mergeProjectInto(target,source);assert.equal(target.icrRuns.length,1);assert.equal(target.caseFrameworkCells.length,1);assert.equal(target.icrSetups.length,1);assert.equal(target.icrComparison.method,'sentences');assert.equal(target.caseFrameworkCells[0].caseId,target.cases[0].id);
});

test('native merges combine conflicting source summaries once, without appendix duplication',()=>{
 const source=fixture(),target=fixture();source.frameworkCells=[{id:'source',docId:'d',codeId:'a',text:'New synthesis',updatedAt:2}];target.frameworkCells=[{id:'target',docId:'d',codeId:'a',text:'Existing synthesis',updatedAt:1}];mergeProjectInto(target,source);assert.equal(target.frameworkCells.length,1);assert.match(target.frameworkCells[0].text,/Existing synthesis/);assert.match(target.frameworkCells[0].text,/New synthesis/);
});

test('malformed archived ICR runs and setups reject explicitly before display',()=>{
 const source=fixture(),target=fixture();source.icrRuns=[{id:'bad',result:{rows:[{statistic:'invented'}]}}];assert.throws(()=>mergeProjectInto(target,source),/Invalid imported ICR run/);
 const bad={...fixture(),icrComparison:{method:'invented',codeIds:[],domains:[],training:[]}};assert.throws(()=>mergeProjectInto(fixture(),bad),/Invalid imported ICR comparison/);
});
