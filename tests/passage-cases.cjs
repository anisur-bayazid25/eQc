const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {updatePassageCases,passageCaseIds}=require('../src/lib/passageCases.ts'),{casesForSegment,cleanResearchLinks,retrieveExcerpts,emptyQuery}=require('../src/lib/research.ts');
const {passagePreview,notePreview}=require('../src/lib/textPreview.ts');
test('popup previews retain short text and identify long passages without losing stored notes',()=>{
 assert.equal(passagePreview('  Short\nquote here. '),'Short quote here.');
 assert.equal(passagePreview('One two three four five six seven eight nine ten eleven twelve'),'One two three four … nine ten eleven twelve');
 assert.equal(notePreview('One two three four five six seven eight nine ten'),'One two three four five six seven eight nine ten');
 assert.equal(notePreview('One two three four five six seven eight nine ten eleven'),'One two three four five six seven eight …');
 assert.equal(passagePreview('এখানে অনেক মানুষ আছে তাই গরম লাগে এবং ঘরের ভিতরে খুব কষ্ট হয়'),'এখানে অনেক মানুষ আছে … ভিতরে খুব কষ্ট হয়');
});
function fixture(){return {id:'p',name:'New FGD',createdAt:1,folders:[],docs:[{id:'d',name:'FGD',content:'Alice: heat affects work. Bob: water costs.',addedAt:1}],codes:[{id:'c',name:'Heat',parentId:null}],codedSegments:[{id:'s',docId:'d',codeId:'c',start:7,end:24,text:'heat affects work',createdAt:1,source:'manual',coder:'Analyst',note:'retain'}],cases:[{id:'a',name:'Alice',kind:'person',attributes:{Age:'35'},links:[]},{id:'b',name:'Bob',kind:'person',attributes:{Age:'40'},links:[]}]};}
test('new projects link selected text before coding and reuse links across codes and JSON reload',()=>{
 const p=fixture(),range={docId:'d',start:7,end:24},next=updatePassageCases(p,range,{a:true});
 assert.deepEqual(p.cases[0].links,[]);assert.deepEqual(passageCaseIds(next,range),['a']);
 assert.deepEqual(casesForSegment(JSON.parse(JSON.stringify(next)),next.codedSegments[0]).map(c=>c.id),['a']);
 assert.equal(updatePassageCases(next,range,{a:true}).cases[0].links.length,1);
 assert.equal(retrieveExcerpts(next,{...emptyQuery(),caseIds:['a'],codeIds:['c']}).length,1);
 assert.equal(retrieveExcerpts(next,{...emptyQuery(),caseIds:['b']}).length,0);
 assert.deepEqual(next.codedSegments,p.codedSegments);
});
test('removing attribution preserves surrounding turns, other sources, and untouched cases',()=>{
 const p=fixture();p.cases[0].links=[{docId:'d'}, {docId:'other',start:0,end:10}];
 const next=updatePassageCases(p,{docId:'d',start:7,end:24},{a:false,b:true});
 assert.deepEqual(next.cases[0].links,[{docId:'d',start:0,end:7},{docId:'d',start:24,end:p.docs[0].content.length},{docId:'other',start:0,end:10}]);
 assert.deepEqual(passageCaseIds(next,{docId:'d',start:7,end:24}),['b']);
 assert.deepEqual(passageCaseIds(next,{docId:'d',start:0,end:7}),['a']);
 assert.throws(()=>updatePassageCases(p,{docId:'d',start:-1,end:5},{a:true}));
});
test('cleanup retains stable references until links actually become invalid; index refreshes after edits',()=>{
 const p=updatePassageCases(fixture(),{docId:'d',start:7,end:24},{a:true});
 const cleaned=cleanResearchLinks(p);assert.equal(cleaned.cases,p.cases);assert.equal(cleaned.cases[0],p.cases[0]);
 assert.deepEqual(casesForSegment(p,p.codedSegments[0]).map(c=>c.id),['a']);
 const next=updatePassageCases(p,{docId:'d',start:7,end:24},{a:false,b:true});
 assert.deepEqual(casesForSegment(next,next.codedSegments[0]).map(c=>c.id),['b']);
 assert.deepEqual(cleanResearchLinks({...p,docs:[]}).cases[0].links,[]);
});
