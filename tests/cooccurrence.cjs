const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {cooccurrenceData,buildCooccurrenceNetwork}=require('../src/lib/cooccurrence.ts');
const {buildVisualization}=require('../src/lib/visualizations.ts');
const {visualizationTypes}=require('../src/lib/visualizations.ts');
const {sankeyData}=require('../src/lib/sankey.ts');
const {applyCodeMapSuggestion}=require('../src/lib/mapSuggestions.ts');
const {saveMapDraft,restoreMapDraft}=require('../src/lib/mapDrafts.ts');
const data={id:'p',name:'Recovery',codes:['a','b','c','d'].map((id,i)=>({id,name:['Water and access','Care work','Cost','Isolated'][i],color:'#2563eb',summary:'',parentId:null})),docs:['d1','d2'].map(id=>({id,name:id,content:'0123456789'.repeat(10)})),codedSegments:[
 ...['A','B'].flatMap(coder=>[{id:'a'+coder,codeId:'a',docId:'d1',start:0,end:20,coder},{id:'b'+coder,codeId:'b',docId:'d1',start:10,end:30,coder}]),
 {id:'c1',codeId:'c',docId:'d1',start:30,end:40,coder:'A'},
 {id:'b2',codeId:'b',docId:'d1',start:50,end:60,coder:'A'},
 {id:'a2',codeId:'a',docId:'d1',start:55,end:65,coder:'A'},
 {id:'a3',codeId:'a',docId:'d2',start:0,end:10,coder:'A'},
 {id:'b3',codeId:'b',docId:'d2',start:20,end:30,coder:'A'},
 {id:'c2',codeId:'c',docId:'d2',start:0,end:10,coder:'A'}]};
const options={title:'Code relationships',preset:'clusters',codeIds:['a','b','c','d'],docIds:['d1','d2'],limit:12,docLimit:24,coder:'all',phrase:'',labels:'',ratings:'',colour:'#2563eb'};
const values=g=>Object.fromEntries(g.allPairs.map(p=>[[p.a,p.b].sort().join(':'),p.value]));
test('overlaps deduplicate coder copies, exclude touching/disjoint ranges, and retain evidence',()=>{
 const before=JSON.stringify(data),g=cooccurrenceData(data,options);assert.deepEqual(values(g),{'a:b':2,'a:c':1});assert.equal(g.frequency.get('a'),3);
 assert.deepEqual(g.pairs[0].ranges,[{docId:'d1',start:10,end:20},{docId:'d1',start:55,end:60}]);assert.deepEqual(g.pairs[0].docs,['d1']);assert.equal(JSON.stringify(data),before);
 assert.deepEqual(values(cooccurrenceData(data,{...options,countMode:'decisions'})),{'a:b':5,'a:c':1});
 assert.deepEqual(values(cooccurrenceData(data,{...options,coder:'B'})),{'a:b':1});
});
test('shared documents count each pair once, without requiring overlapping ranges',()=>{
 assert.deepEqual(values(cooccurrenceData(data,{...options,coocUnit:'documents'})),{'a:b':2,'a:c':2,'b:c':2});
 assert.deepEqual(values(cooccurrenceData(data,{...options,coocUnit:'documents',countMode:'decisions'})),{'a:b':2,'a:c':2,'b:c':2});
});
test('source/code/coder scope and min/max filters are applied explicitly',()=>{
 assert.deepEqual(values(cooccurrenceData(data,{...options,docIds:['d2']})),{'a:c':1});
 assert.deepEqual(values(cooccurrenceData(data,{...options,codeIds:['a','c']})),{'a:c':1});
 const g=cooccurrenceData(data,{...options,coocMin:2,coocMaxLinks:1});assert.equal(g.qualified,1);assert.equal(g.pairs.length,1);assert.equal(g.allPairs.length,2);
 assert.equal(cooccurrenceData(data,{...options,docIds:[]}).pairs.length,0);
});
test('network, heat map and Sankey agree on counts and keep evidence; matrix diagonal is zero',()=>{
 for(const coocUnit of ['overlap','documents']){
  const o={...options,coocUnit},g=cooccurrenceData(data,o),network=buildCooccurrenceNetwork(data,o),heat=buildVisualization(data,'heat-map',{...o,preset:'cooccurrence'}),flow=sankeyData(data,{...o,preset:'cooccurrence'});
  for(const pair of g.pairs){const edge=network.annotations.find(a=>a.coocPair?.codeIds.join(':')===[pair.a,pair.b].join(':'));assert.equal(Number(edge.text),pair.value);assert.ok(edge.strokeWidth>0);
   const cells=heat.annotations.filter(a=>a.kind==='rect'&&a.coocPair&&a.coocPair.codeIds.includes(pair.a)&&a.coocPair.codeIds.includes(pair.b));assert.equal(cells.length,2);assert.ok(cells.every(c=>Number(c.text)===pair.value));
   assert.equal(flow.links.find(l=>l.codes.includes(pair.a)&&l.codes.includes(pair.b)).value,pair.value);
  }
  assert.equal(flow.links.length,g.pairs.length);assert.equal(flow.links.reduce((n,l)=>n+l.value,0),g.pairs.reduce((n,p)=>n+p.value,0));
  assert.ok(heat.annotations.filter(a=>a.kind==='rect'&&a.sourceCodeIds?.length===2&&a.sourceCodeIds[0]===a.sourceCodeIds[1]).every(a=>a.text==='0'));
  const sankey=buildVisualization(data,'sankey',{...o,preset:'cooccurrence'});assert.equal(sankey.annotations.filter(a=>a.flow).length,g.pairs.length);assert.equal(sankey.annotations.filter(a=>a.id.startsWith('suggested:sankey:count:')).length,g.pairs.length);assert.match(sankey.design.description,/not directional or causal/);
 }
});
test('all layouts are deterministic, bounded and nonoverlapping, with optional isolated nodes',()=>{
 for(const preset of ['clusters','circle','sphere']){const o={...options,preset,coocHideIsolates:false},a=buildCooccurrenceNetwork(data,o),b=buildCooccurrenceNetwork(data,o),nodes=a.annotations.filter(a=>a.kind==='circle');assert.equal(nodes.length,4);assert.deepEqual(a.annotations,b.annotations);
  for(const n of nodes){assert.ok(n.x>=0&&n.y>=240);assert.ok(n.x+n.width<a.design.width&&n.y+n.height<a.design.height);for(const m of nodes)if(m!==n)assert.ok(Math.hypot(n.x+n.width/2-m.x-m.width/2,n.y+n.height/2-m.y-m.height/2)>=(n.width+m.width)/2+24);}
 }
 const s=buildCooccurrenceNetwork(data,{...options,coocMin:2});assert.equal(s.annotations.filter(a=>a.kind==='circle').length,2);assert.match(s.design.description,/2 isolated codes hidden/);
 assert.ok(buildCooccurrenceNetwork(data,{...options,docIds:[]}).annotations.some(a=>a.id==='suggested:network:empty'));
});
test('dense layouts stay readable and never change research coding',()=>{
 const p={...data,codes:Array.from({length:60},(_,i)=>({id:'c'+i,name:'A longer code label about recovery '+i,color:'#2563eb',parentId:null,summary:''})),codedSegments:Array.from({length:60},(_,i)=>({id:'s'+i,docId:'d1',codeId:'c'+i,start:0,end:20,coder:'A'}))},o={...options,codeIds:p.codes.map(c=>c.id),limit:60,coocMaxLinks:80};
 for(const preset of ['clusters','sphere']){const s=buildCooccurrenceNetwork(p,{...o,preset}),nodes=s.annotations.filter(a=>a.kind==='circle');assert.equal(nodes.length,60);for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j];assert.ok(Math.hypot(a.x-b.x+(a.width-b.width)/2,a.y-b.y+(a.height-b.height)/2)>=(a.width+b.width)/2+24);}}
});
test('snapshots and draft round trips preserve counts, sources and ball styles',()=>{
 const snapshot=buildCooccurrenceNetwork(data,{...options,preset:'sphere'}),p={...data,createdAt:1,folders:[]};
 const applied=applyCodeMapSuggestion(p,snapshot);assert.deepEqual(applied.codedSegments,p.codedSegments);assert.ok(applied.mapAnnotations.some(a=>a.shapeType==='network-ball'));
 assert.ok(snapshot.annotations.filter(a=>a.coocPair).every(a=>a.fromAnnotationId&&a.toAnnotationId));
 // Standard project JSON storage retains annotation metadata used by the Inspector and exports.
 assert.equal(JSON.stringify(JSON.parse(JSON.stringify(applied)).mapAnnotations),JSON.stringify(applied.mapAnnotations));
 const view={width:snapshot.design.width,height:snapshot.design.height,viewMode:'full',expandedRoots:[],childrenPerRoot:5,showCooc:false,minShared:1,showLegend:false,includeLegendInExport:true,legendPos:{x:10,y:20}};
 const saved=saveMapDraft(applied,'Network',view),restored=restoreMapDraft({...saved,mapAnnotations:[]},saved.mapDrafts[0].id);assert.deepEqual(restored.mapAnnotations,applied.mapAnnotations);assert.deepEqual(restored.mapDesign.options,snapshot.design.options);
});

test('spatial 3D positions are retained while view angles and node styles change independently',()=>{
 const base=buildCooccurrenceNetwork(data,{...options,preset:'spatial',coocNodeStyle:'text'}),rotated=buildCooccurrenceNetwork(data,{...options,preset:'spatial',coocNodeStyle:'flat',coocYaw:90,coocPitch:-30});
 const nodes=s=>s.annotations.filter(a=>a.id.startsWith('suggested:network:node:')),a=nodes(base),b=nodes(rotated);
 assert.ok(a.every(n=>n.kind==='text'&&n.shapeType==='network-text'&&!n.fill));assert.ok(b.every(n=>n.kind==='circle'&&n.shapeType==='network-node'));
 assert.ok(a.every(n=>Number.isFinite(n.networkPoint.z)));assert.ok(new Set(a.map(n=>n.networkPoint.z)).size>1);
 for(const n of a)assert.deepEqual(n.networkPoint,b.find(m=>m.id===n.id).networkPoint);
 assert.ok(a.some(n=>n.x!==b.find(m=>m.id===n.id).x));assert.deepEqual(base.annotations.filter(a=>a.coocPair).map(a=>a.coocPair),rotated.annotations.filter(a=>a.coocPair).map(a=>a.coocPair));
 assert.deepEqual(visualizationTypes.slice(0,4).map(t=>t.id),['code-map','cooccurrence-network','sankey','word-cloud']);
});

test('chord ribbons show each unordered pair once and conserve equal count widths at both endpoints',()=>{
 const graph=cooccurrenceData(data,options),s=buildCooccurrenceNetwork(data,{...options,preset:'chord'}),ribbons=s.annotations.filter(a=>a.shapeType==='chord-ribbon');
 assert.equal(ribbons.length,graph.pairs.length);assert.deepEqual(ribbons.map(r=>r.coocPair.value),graph.pairs.map(p=>p.value));
 assert.equal(s.annotations.filter(a=>a.shapeType==='chord-sector').length,3);assert.ok(ribbons.every(r=>r.polygonPoints.length>60&&r.polygonPoints.every(v=>v>=0&&v<=1)));
 const labels=s.annotations.filter(a=>a.id.startsWith('suggested:chord:label:'));assert.equal(labels.reduce((sum,a)=>sum+Number(a.text.split(' · ').at(-1)),0),graph.pairs.reduce((sum,p)=>sum+2*p.value,0));
 assert.match(s.design.description,/sector totals sum to twice/);assert.ok(s.annotations.every(a=>a.x>=0&&a.y>=0&&a.x+(a.width||0)<=s.design.width&&a.y+(a.height||0)<=s.design.height));
});
