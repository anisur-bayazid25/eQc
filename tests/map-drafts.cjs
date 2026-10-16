const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {saveMapDraft,restoreMapDraft}=require('../src/lib/mapDrafts.ts');
const view={width:1600,height:1000,viewMode:'custom',expandedRoots:['a'],childrenPerRoot:5,showCooc:false,minShared:2,showLegend:true,includeLegendInExport:true,legendPos:{x:10,y:20},legend:{title:'Themes',width:410,height:240,columns:2,hidden:['relation:custom'],order:['node:a'],labels:{'node:a':'Water access'},styles:{'node:a':{fontSize:18,italic:true}}}};
test('drafts retain map/view state, replace names and do not copy research text',()=>{
 const p={id:'p',docs:[{id:'d',content:'Sensitive source'}],codes:[{id:'a',name:'Theme',summary:'Memo',mapLabel:'Water story',mapPosition:{x:10,y:20}}],codedSegments:[],mapAnnotations:[{id:'note',text:'Map note'}],mapEdgeStyles:[],mapDesign:{mode:'manual',width:1000,height:800,maxLinks:0,rootIds:['a','removed']}};
 const saved=saveMapDraft(p,'First',view);assert.equal(p.mapDrafts,undefined);assert.equal(saved.mapDrafts.length,1);assert.equal(saved.mapDrafts[0].nodes[0].name,undefined);assert.ok(!JSON.stringify(saved.mapDrafts).includes('Sensitive source'));
 const updated=saveMapDraft({...saved,codes:[{...p.codes[0],mapPosition:{x:55,y:20}}]},'First',view);assert.equal(updated.mapDrafts.length,1);assert.equal(updated.mapDrafts[0].id,saved.mapDrafts[0].id);
 const restored=restoreMapDraft({...JSON.parse(JSON.stringify(saved)),docs:[{id:'d',content:'Revised source'}],codes:[{id:'a',name:'Renamed',summary:'Revised memo',mapPosition:{x:99,y:99}},{id:'new',name:'New code'}]},saved.mapDrafts[0].id);
 assert.equal(restored.docs[0].content,'Revised source');assert.equal(restored.codes[0].name,'Renamed');assert.equal(restored.codes[0].summary,'Revised memo');assert.equal(restored.codes[0].mapLabel,'Water story');assert.deepEqual(restored.codes[0].mapPosition,{x:10,y:20});assert.deepEqual(restored.hiddenMapCodeIds,['new']);assert.deepEqual(restored.mapView,view);
 assert.equal(saved.mapDrafts[0].design.width,1000);assert.equal(restored.mapDesign.width,1600);assert.equal(restored.mapDesign.height,1000);assert.deepEqual(restored.mapDesign.rootIds,['a']);
 assert.throws(()=>saveMapDraft(p,' ',view));assert.throws(()=>restoreMapDraft(p,'missing'));
});
