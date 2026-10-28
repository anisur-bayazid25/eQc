const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {demographicCases,demographicSummary}=require('../src/lib/demographics.ts'),{sortSources}=require('../src/lib/sourceSorting.ts');
const p={folders:[{id:'parent',parentId:null},{id:'child',parentId:'parent'}],docs:[{id:'d1',folderId:'parent'},{id:'d2',folderId:'child'},{id:'d3'}],groups:[{id:'g',kind:'documents',memberIds:['d2','d3']}],cases:[{id:'a',attributes:{Gender:'Woman'},links:[{docId:'d1'},{docId:'d2'}]},{id:'b',attributes:{Gender:'Man'},links:[{docId:'d2'}]},{id:'c',attributes:{Gender:''},links:[{docId:'d3'}]},{id:'u',attributes:{Gender:'Woman'},links:[]}]};
test('demographics scopes combine descendants, documents and groups without counting a case twice',()=>{
 const scope={folderIds:['parent'],docIds:['d2'],groupIds:[]};assert.deepEqual(demographicCases(p,scope).map(c=>c.id),['a','b']);
 assert.deepEqual(demographicCases(p,{...scope,groupIds:['g']}).map(c=>c.id),['a','b','c']);
 assert.equal(demographicCases(p,{folderIds:[],docIds:[],groupIds:[]}).length,4);
 assert.equal(demographicCases(p,{folderIds:['deleted'],docIds:[],groupIds:[]}).length,0);
 assert.equal(demographicCases(p,{folderIds:[],docIds:['deleted'],groupIds:[]}).length,0);
});
test('demographic percentages include missing attributes and retain zero-case scope',()=>{
 const rows=demographicSummary(p.cases,['Gender']);assert.equal(rows.reduce((s,r)=>s+r.n,0),4);assert.equal(rows.find(r=>r.value==='Woman').percent,50);assert.equal(rows.find(r=>r.missing).n,1);assert.equal(rows.find(r=>r.missing).percent,25);assert.deepEqual(demographicSummary([],['Gender']),[]);
});
test('every source sort has ascending/descending order and never mutates source data',()=>{
 const docs=[{id:'a',name:'Alpha',addedAt:1,sizeBytes:10},{id:'b',name:'Beta',addedAt:2,sizeBytes:20}];
 for(const by of ['name','date','size','coded']){assert.deepEqual(sortSources(docs,by,id=>id==='a'?1:2,'asc').map(d=>d.id),['a','b']);assert.deepEqual(sortSources(docs,by,id=>id==='a'?1:2,'desc').map(d=>d.id),['b','a']);}
 assert.deepEqual(docs.map(d=>d.id),['a','b']);
});
