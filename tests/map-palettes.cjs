const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {mapPalettes,recolorMap,readableInk}=require('../src/lib/mapPalettes.ts'),{buildVisualization,visualizationTypes}=require('../src/lib/visualizations.ts'),{applyCodeMapSuggestion}=require('../src/lib/mapSuggestions.ts');
const project=require('../demo/climate-resilience/dataset/03_READY_TO_IMPORT_EQC.json');
test('all seventeen palettes apply to all sixteen types without changing source records or layout',()=>{
 assert.equal(mapPalettes.length,17);assert.equal(new Set(mapPalettes.map(p=>p.id)).size,17);
 const options={cloudWords:[{word:'Water',count:3,x:150,y:200,width:180,height:70,fontSize:40,rotation:0}],title:'Palette review',preset:'documents',codeIds:project.codes.map(c=>c.id),docIds:project.docs.map(d=>d.id),limit:8,phrase:'water',labels:'Individual\nCommunity\nInstitutions',ratings:'2,3,5',colour:'#2563eb',periods:project.analysisPeriods,coder:'Amina'};
 for(const type of visualizationTypes){const generated=applyCodeMapSuggestion(project,buildVisualization(project,type.id,options)),before=JSON.stringify(generated);
  for(const palette of mapPalettes){const next=recolorMap(generated,palette);assert.equal(JSON.stringify(generated),before);assert.equal(next.docs,generated.docs);assert.equal(next.codedSegments,generated.codedSegments);assert.deepEqual({...next.mapDesign,paletteId:undefined,paletteInverted:undefined},{...generated.mapDesign,paletteId:undefined,paletteInverted:undefined});assert.deepEqual(next.codes.map(c=>[c.id,c.color,c.summary,c.mapPosition,c.mapLabel]),generated.codes.map(c=>[c.id,c.color,c.summary,c.mapPosition,c.mapLabel]));assert.deepEqual(next.mapAnnotations.map(a=>[a.id,a.x,a.y,a.text,a.polygonPoints,a.sourceDocIds,a.sourceCodeIds]),generated.mapAnnotations.map(a=>[a.id,a.x,a.y,a.text,a.polygonPoints,a.sourceDocIds,a.sourceCodeIds]));}
 }
});
test('sequential heat-map colours preserve equal values, ordered lightness, and readable numbers',()=>{
 const canvas={codes:[],mapDesign:{family:'heat-map'},mapAnnotations:[0,2,4,2].map((n,i)=>({id:String(i),kind:'rect',text:String(n),fill:'#000000',color:'#ffffff'}))};
 for(const palette of mapPalettes){const cells=recolorMap(canvas,palette).mapAnnotations;assert.equal(cells[1].fill,cells[3].fill);assert.notEqual(cells[0].fill,cells[2].fill);const brightness=c=>[1,3,5].reduce((n,i)=>n+parseInt(c.slice(i,i+2),16),0);const direction=palette.ramp?-1:1;assert.ok((brightness(cells[0].fill)-brightness(cells[1].fill))*direction>0);assert.ok((brightness(cells[1].fill)-brightness(cells[2].fill))*direction>0);assert.equal(cells[2].textColor,readableInk(cells[2].fill));}
});
test('histomap bands and keys stay matched through repeated palette changes and grayscale',()=>{
 const d=project.mapDrafts.find(d=>d.design.family==='histomap'),canvas={codes:project.codes,mapAnnotations:d.annotations,mapDesign:d.design};
 const once=recolorMap(canvas,mapPalettes.find(p=>p.id==='grayscale')),next=recolorMap(once,mapPalettes[0]);
 const bands=next.mapAnnotations.filter(a=>a.legendLabel),keys=next.mapAnnotations.filter(a=>a.kind==='rect'&&a.width===30);
 for(const key of keys){const original=d.annotations.find(a=>a.id===key.id);const band=d.annotations.find(a=>a.legendLabel&&a.fill===original.fill);assert.equal(next.mapAnnotations.find(a=>a.id===band.id).fill,key.fill);}
 assert.ok(new Set(bands.map(a=>a.fill)).size>3);
});
