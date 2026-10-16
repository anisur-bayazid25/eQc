const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {suggestCodeMap,applyCodeMapSuggestion,mapSharedDocuments,mapLabelLines}=require('../src/lib/mapSuggestions.ts');
function fixture(){const codes=[];for(let r=0;r<6;r++){codes.push({id:'r'+r,name:'Theme '+r,parentId:null,color:'#111111',summary:'Memo',createdAt:1});for(let c=0;c<5;c++)codes.push({id:`r${r}c${c}`,name:'A meaningful subtheme '+c,parentId:'r'+r,color:'#222222',summary:'',createdAt:1});}return {id:'p',name:'Climate resilience',docs:[{id:'d',name:'Interview',content:'Evidence'}],codes,codedSegments:codes.filter(c=>c.parentId).map((c,i)=>({id:'s'+i,codeId:c.id,docId:'d'+i%3,start:0,end:3,text:'Evi'})),mapAnnotations:[{id:'manual',kind:'text',text:'Keep my interpretation',x:10,y:10,color:'#000',lineStyle:'solid'}],mapEdgeStyles:[{id:'manual-edge',kind:'custom',fromCodeId:'r0',toCodeId:'r1',lineStyle:'solid',curve:'curved',arrow:'end',label:'Interpretation'}]};}
test('simple and detailed suggestions are deterministic, bounded and keep the research data immutable',()=>{
 const p=fixture(),original=structuredClone(p);
 for(const mode of ['simple','detailed']){const s=suggestCodeMap(p,mode,{roots:6,children:5,links:6});assert.deepEqual(suggestCodeMap(p,mode,{roots:6,children:5,links:6}),s);assert.equal(s.codes.length,mode==='simple'?6:36);assert.ok(s.edges.filter(e=>e.kind==='cooccurrence').length<=6);
 for(const c of s.codes){const pos=c.patch.mapPosition,style=c.patch.mapAppearance;assert.ok(pos.x-style.width/2>=0);assert.ok(pos.y-style.height/2>=0);assert.ok(pos.x+style.width/2<=s.design.width);assert.ok(pos.y+style.height/2<=s.design.height);}
 const next=applyCodeMapSuggestion(p,s);assert.deepEqual(next.codedSegments,p.codedSegments);assert.equal(next.docs,p.docs);assert.ok(next.mapAnnotations.some(a=>a.id==='manual'));assert.ok(next.mapEdgeStyles.some(e=>e.id==='manual-edge'));for(const code of next.codes){assert.equal(code.color,p.codes.find(c=>c.id===code.id).color);assert.equal(code.summary,p.codes.find(c=>c.id===code.id).summary);}
 assert.equal(applyCodeMapSuggestion(next,s).mapAnnotations.filter(a=>a.id==='suggested:hub').length,1);assert.deepEqual(JSON.parse(JSON.stringify(next)).mapDesign,s.design);
 }
 assert.deepEqual(p,original);
});
test('shared documents deduplicate repeated excerpts and aggregate hidden descendants without inferring causality',()=>{
 const p=fixture(),pairs=mapSharedDocuments(p.codes,[...p.codedSegments,...p.codedSegments],new Set(['r0','r1']));assert.equal(pairs.get('r0::r1'),3);assert.equal(pairs.size,1);
 const cycle=[{id:'a',name:'A',parentId:'b'},{id:'b',name:'B',parentId:'a'}];assert.equal(mapSharedDocuments(cycle,[{docId:'d',codeId:'a'}],new Set()).size,0);assert.ok(suggestCodeMap({...p,codes:cycle,codedSegments:[]},'detailed').codes.length<=2);
 assert.equal(suggestCodeMap({...p,codes:[],codedSegments:[]},'simple').codes.length,0);
});
test('long and Unicode labels wrap without dropping text; large suggestions remain capped',()=>{
 const label='Climate vulnerable coastal communities বাংলা';assert.equal(mapLabelLines(label,15).join(' '),label);assert.ok(mapLabelLines('x'.repeat(50),15).every(s=>s.length<=15));
 const p=fixture();for(let i=0;i<600;i++)p.codes.push({id:'more'+i,parentId:'r0',name:'Extra '+i,color:'#111111'});const s=suggestCodeMap(p,'detailed',{roots:6,children:8});assert.ok(s.codes.length<=54);assert.equal(new Set(s.codes.map(c=>c.id)).size,s.codes.length);
});
test('regenerating a design preserves researcher-added relationship labels',()=>{
 const p=fixture(),s=suggestCodeMap(p,'simple');const next=applyCodeMapSuggestion(p,s),edge=next.mapEdgeStyles.find(e=>e.kind==='cooccurrence');edge.label='Shared pressures';edge.labelDx=17;
 const updated=applyCodeMapSuggestion(next,suggestCodeMap(next,'simple'));
 const retained=updated.mapEdgeStyles.find(e=>e.fromCodeId===edge.fromCodeId&&e.toCodeId===edge.toCodeId&&e.kind===edge.kind);assert.equal(retained.label,'Shared pressures');assert.equal(retained.labelDx,17);
 const noLinks=applyCodeMapSuggestion(updated,suggestCodeMap(updated,'simple',{links:0}));assert.ok(noLinks.mapEdgeStyles.some(e=>e.label==='Shared pressures'));
});
