const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {buildVisualization,visualizationTypes}=require('../src/lib/visualizations.ts');
const data={analysisPeriods:[{id:'before',label:'Before',order:0},{id:'after',label:'After',order:1}],id:'p',name:'Climate recovery',codes:[{id:'a',name:'Water',color:'#112233',parentId:null},{id:'b',name:'Cost',color:'#445566',parentId:'a'},{id:'c',name:'Care',color:'#778899',parentId:null}],docs:[{id:'d1',periodId:'before',name:'Interview A',content:'Water is scarce. Water costs time.'},{id:'d2',periodId:'after',name:'Interview B',content:'Water costs time. Care is shared.'}],codedSegments:[{codeId:'a',docId:'d1'},{codeId:'a',docId:'d1'},{codeId:'b',docId:'d1'},{codeId:'a',docId:'d2'},{codeId:'c',docId:'d2'}]};
const options={cloudWords:[{word:'Water',count:3,x:150,y:200,width:180,height:70,fontSize:40,rotation:0}],title:'Climate recovery',preset:'documents',codeIds:['a','b','c'],docIds:['d1','d2'],limit:12,phrase:'Water',labels:'Individual\nCommunity\nInstitutions',ratings:'2,3,5',colour:'#2563eb'};
test('all gallery types generate bounded editable snapshots without mutating research data',()=>{
 const original=JSON.stringify(data);assert.equal(visualizationTypes.length,16);
 for(const {id} of visualizationTypes){const s=buildVisualization(data,id,options);assert.equal(s.design.family,id);assert.ok(s.design.width>=1000);assert.ok(s.annotations.length<1000);assert.ok(s.annotations.every(a=>Number.isFinite(a.x)&&Number.isFinite(a.y)));assert.equal(JSON.stringify(data),original);}
});
test('heat maps use direct excerpt counts and selected shared-document counts with source IDs',()=>{
 const s=buildVisualization(data,'heat-map',options),cells=s.annotations.filter(a=>a.kind==='rect'&&a.sourceCodeIds);assert.equal(cells.length,6);assert.equal(cells[0].text,'2');assert.deepEqual(cells[0].sourceDocIds,['d1']);
 const shared=buildVisualization(data,'heat-map',{...options,preset:'shared',docIds:['d1']});const match=shared.annotations.find(a=>a.sourceCodeIds?.join(',')==='a,b');assert.equal(match.text,'1');assert.deepEqual(match.sourceDocIds,['d1']);
 const changed=buildVisualization({...data,codedSegments:[...data.codedSegments,{codeId:'a',docId:'d1'}]},'heat-map',options);assert.equal(changed.annotations.filter(a=>a.kind==='rect'&&a.sourceCodeIds)[0].text,'3');
});
test('word trees group actual phrase contexts, include source links and change direction',()=>{
 const s=buildVisualization(data,'word-tree',{...options,preset:'after'});assert.ok(s.annotations.some(a=>a.text==='costs time. (2)'&&a.sourceDocIds.length===2));assert.ok(s.annotations.some(a=>a.text.includes('3 phrase occurrences')));
 const before=buildVisualization(data,'word-tree',{...options,preset:'before'});assert.ok(before.annotations.filter(a=>a.kind==='arrow').every(a=>a.toAnnotationId===before.annotations.find(a=>a.text==='Water').id));
 assert.throws(()=>buildVisualization(data,'word-tree',{...options,phrase:''}));
});
test('interpretive diagrams have bounded polygon geometry and attached relationships, with validated ratings',()=>{
 for(const id of ['pyramid','honeycomb']){const s=buildVisualization(data,id,options);assert.equal(s.annotations.filter(a=>a.polygonPoints).length,3);assert.ok(s.annotations.flatMap(a=>a.polygonPoints||[]).every(v=>v>=0&&v<=1));}
 const cycle=buildVisualization(data,'process',{...options,preset:'cycle'});assert.equal(cycle.annotations.filter(a=>a.kind==='arrow').length,3);assert.ok(cycle.annotations.filter(a=>a.kind==='arrow').every(a=>cycle.annotations.some(b=>b.id===a.fromAnnotationId)&&cycle.annotations.some(b=>b.id===a.toAnnotationId)));
 assert.throws(()=>buildVisualization(data,'journey',{...options,ratings:'1,9'}));assert.throws(()=>buildVisualization(data,'venn',{...options,labels:'Only one'}));
});

test('multi-coder heat maps default to unique ranges and support explicit coder/count choices',()=>{
 const coded={...data,codedSegments:[{id:'s1',codeId:'a',docId:'d1',start:0,end:5,coder:'Amina'},{id:'s2',codeId:'a',docId:'d1',start:0,end:5,coder:'Ravi'},{id:'s3',codeId:'a',docId:'d1',start:10,end:15,coder:'Ravi'}]};
 const cell=opts=>buildVisualization(coded,'heat-map',{...options,...opts}).annotations.find(a=>a.kind==='rect'&&a.sourceCodeIds?.[0]==='a'&&a.sourceDocIds?.[0]==='d1');
 assert.equal(cell({}).text,'2');assert.equal(cell({countMode:'decisions'}).text,'3');assert.equal(cell({countMode:'presence'}).text,'1');assert.equal(cell({coder:'Amina'}).text,'1');
});
test('mind-map limits retain theme coverage; generated snapshots clear unrelated manual drawings',()=>{
 const demo=require('../demo/climate-resilience/dataset/03_READY_TO_IMPORT_EQC.json'),s=buildVisualization(demo,'mind-map',{...options,codeIds:demo.codes.map(c=>c.id),limit:12,preset:'detailed'}),shown=new Set(s.codes.map(c=>c.id));
 assert.ok(demo.codes.filter(c=>!c.parentId).every(c=>shown.has(c.id)));assert.equal(s.codes.length,12);assert.equal(s.replaceCanvas,true);
});

test('coded-only phrase trees merge coder/overlap ranges rather than repeating source words',()=>{
 const p={...data,docs:[{id:'d1',name:'Interview',content:'Water question. Water costs time.'}],codedSegments:[{docId:'d1',codeId:'a',start:16,end:33},{docId:'d1',codeId:'b',start:16,end:33}]};const s=buildVisualization(p,'word-tree',{...options,preset:'after',textScope:'coded'});assert.ok(s.annotations.some(a=>a.text?.includes('1 phrase occurrences')));assert.ok(s.annotations.some(a=>a.text==='costs time. (1)'));assert.ok(!s.annotations.some(a=>a.text==='question. (1)'));
});
