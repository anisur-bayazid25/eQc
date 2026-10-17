import {normalizeCoderName} from '../domain';
import type {Code,MapAnnotation} from '../domain';
import type {VisualizationData,VisualizationOptions} from './visualizations';
import type {MapSuggestion} from './mapSuggestions';
import {buildCooccurrenceChord} from './cooccurrenceChord';

export type CooccurrenceUnit = 'overlap'|'documents';
export interface CooccurrencePair {a:string;b:string;value:number;docs:string[];ranges:Array<{docId:string;start:number;end:number}>;}
export const cooccurrenceKey=(a:string,b:string)=>JSON.stringify([a,b].sort());

/** Direct text codes only. Each unordered coding-range pair is counted once. */
export function cooccurrenceData(data:VisualizationData,o:VisualizationOptions){
 const codeIds=new Set(o.codeIds),docIds=new Set(o.docIds);
 const codes=data.codes.filter(c=>codeIds.has(c.id)).slice(0,Math.max(1,Math.min(200,o.limit||12)));
 const docs=data.docs.filter(d=>docIds.has(d.id)).slice(0,o.docLimit||24),selectedCodes=new Set(codes.map(c=>c.id)),selectedDocs=new Set(docs.map(d=>d.id));
 const unit:CooccurrenceUnit=o.coocUnit||'overlap',frequency=new Map(codes.map(c=>[c.id,0])),presence=new Map(codes.map(c=>[c.id,new Set<string>()]));
 const seen=new Set<string>(),byDoc=new Map<string,typeof data.codedSegments>();let invalid=0,assignments=0;
 for(const s of data.codedSegments){
  if(!selectedCodes.has(s.codeId)||!selectedDocs.has(s.docId)||(o.coder&&o.coder!=='all'&&normalizeCoderName(s.coder)!==normalizeCoderName(o.coder)))continue;
  presence.get(s.codeId)!.add(s.docId);
  const valid=Number.isInteger(s.start)&&Number.isInteger(s.end)&&s.start>=0&&s.end>s.start&&s.end<=(docs.find(d=>d.id===s.docId)?.content.length||0);
  if(!valid){invalid++;continue;}
  const key=JSON.stringify([s.docId,s.codeId,s.start,s.end]);
  if(o.countMode!=='decisions'&&seen.has(key))continue;seen.add(key);
  frequency.set(s.codeId,frequency.get(s.codeId)!+1);assignments++;
  if(assignments>20000)throw new Error('This selection exceeds 20,000 coding assignments. Narrow the documents, codes or coder before generating co-occurrence.');
  if(!byDoc.has(s.docId))byDoc.set(s.docId,[]);byDoc.get(s.docId)!.push(s);
 }
 const pairMap=new Map<string,CooccurrencePair>();
 const add=(a:string,b:string,docId:string,start?:number,end?:number)=>{
  if(a===b)return;const key=cooccurrenceKey(a,b),pair=pairMap.get(key)||{a,b,value:0,docs:[],ranges:[]};pair.value++;
  if(!pair.docs.includes(docId))pair.docs.push(docId);
  if(start!==undefined&&end!==undefined&&pair.ranges.length<30&&!pair.ranges.some(r=>r.docId===docId&&r.start===start&&r.end===end))pair.ranges.push({docId,start,end});
  pairMap.set(key,pair);
 };
 if(unit==='documents'){
  for(const doc of docs){const present=codes.filter(c=>presence.get(c.id)!.has(doc.id));for(let i=0;i<present.length;i++)for(let j=i+1;j<present.length;j++)add(present[i].id,present[j].id,doc.id);}
 }else{
  let comparisons=0;
  for(const [docId,segments] of byDoc){const sorted=segments.slice().sort((a,b)=>a.start-b.start||a.end-b.end);
   for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length&&sorted[j].start<sorted[i].end;j++){
    if(++comparisons>2000000)throw new Error('Too many overlapping coding pairs for one figure. Narrow the documents, codes or coder.');
    const a=sorted[i],b=sorted[j];add(a.codeId,b.codeId,docId,Math.max(a.start,b.start),Math.min(a.end,b.end));
   }
  }
 }
 const index=new Map(codes.map((c,i)=>[c.id,i]));
 const allPairs=[...pairMap.values()].map(p=>index.get(p.a)!<index.get(p.b)!?p:{...p,a:p.b,b:p.a}).sort((a,b)=>b.value-a.value||index.get(a.a)!-index.get(b.a)!||index.get(a.b)!-index.get(b.b)!);
 const minimum=Math.max(1,Math.floor(o.coocMin||1)),qualified=allPairs.filter(p=>p.value>=minimum),maxLinks=Math.max(1,Math.min(500,Math.floor(o.coocMaxLinks||100))),pairs=qualified.slice(0,maxLinks);
 const measure=unit==='documents'?'Shared text documents (each code pair counted once per document)':'Overlapping coding-range pairs ('+(o.countMode==='decisions'?'all coding decisions, including different coders':'identical code/document/ranges deduplicated across coders')+')';
 const description=measure+'. Direct codes only; '+docs.length+' selected text documents; '+(o.coder&&o.coder!=='all'?'coder: '+normalizeCoderName(o.coder):'all coders')+'.'+(unit==='overlap'&&invalid?' '+invalid+' coding assignments with invalid/missing text positions excluded.':'');
 return {codes,docs,frequency,presence,allPairs,pairs,qualified:qualified.length,minimum,maxLinks,unit,description,assignments};
}

export const pairMetadata=(p:CooccurrencePair,unit:CooccurrenceUnit):NonNullable<MapAnnotation['coocPair']>=>({codeIds:[p.a,p.b],value:p.value,unit,ranges:p.ranges});

type Placed={code:Code;x:number;y:number;size:number;depth:number;point?:{x:number;y:number;z:number};};
function spatialLayout(nodes:Placed[],pairs:CooccurrencePair[],o:VisualizationOptions){
 const radius=Math.max(400,Math.sqrt(nodes.length)*130),points=nodes.map((_,i)=>{const z=1-2*(i+.5)/Math.max(1,nodes.length),r=Math.sqrt(1-z*z),a=i*Math.PI*(3-Math.sqrt(5));return {x:Math.cos(a)*r*radius,y:Math.sin(a)*r*radius,z:z*radius};}),byId=new Map(nodes.map((n,i)=>[n.code.id,i]));
 for(let pass=0;pass<120;pass++){
  const delta=points.map(p=>({x:-p.x*.001,y:-p.y*.001,z:-p.z*.001}));
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
   const a=points[i],b=points[j],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d=Math.max(1,Math.hypot(dx,dy,dz)),push=Math.min(12,25000/(d*d));
   for(const [key,value] of [['x',dx],['y',dy],['z',dz]] as const){delta[i][key]-=value/d*push;delta[j][key]+=value/d*push;}
  }
  for(const pair of pairs){const i=byId.get(pair.a)!,j=byId.get(pair.b)!,a=points[i],b=points[j],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d=Math.max(1,Math.hypot(dx,dy,dz)),pull=Math.max(-8,Math.min(8,(d-(nodes[i].size+nodes[j].size)/2-100)*.015*Math.sqrt(pair.value)));
   for(const [key,value] of [['x',dx],['y',dy],['z',dz]] as const){delta[i][key]+=value/d*pull;delta[j][key]-=value/d*pull;}
  }
  points.forEach((p,i)=>{for(const key of ['x','y','z'] as const)p[key]+=Math.max(-15,Math.min(15,delta[i][key]));});
 }
 const yaw=(o.coocYaw||0)*Math.PI/180,pitch=(o.coocPitch??20)*Math.PI/180,camera=Math.max(radius*4,...points.map(p=>Math.hypot(p.x,p.y,p.z)*4));
 nodes.forEach((node,i)=>{const p=points[i],x=p.x*Math.cos(yaw)+p.z*Math.sin(yaw),z=-p.x*Math.sin(yaw)+p.z*Math.cos(yaw),y=p.y*Math.cos(pitch)-z*Math.sin(pitch),depth=p.y*Math.sin(pitch)+z*Math.cos(pitch),scale=camera/(camera-depth);node.point={...p};node.x=x*scale;node.y=y*scale;node.depth=depth;});
}
function separate(nodes:Placed[]){
 for(let pass=0;pass<240;pass++){let moved=false;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
   const a=nodes[i],b=nodes[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),minimum=(a.size+b.size)/2+36;
   if(d>=minimum)continue;const ux=d?dx/d:Math.cos(i+j),uy=d?dy/d:Math.sin(i+j),shift=(minimum-d)/2+.1;
   a.x-=ux*shift;a.y-=uy*shift;b.x+=ux*shift;b.y+=uy*shift;moved=true;
  }
  if(!moved)break;
 }
 // A deterministic grid is the final fallback for unusually dense projections.
 if(nodes.some((a,i)=>nodes.slice(i+1).some(b=>Math.hypot(a.x-b.x,a.y-b.y)<(a.size+b.size)/2+25))){
  const step=Math.max(...nodes.map(n=>n.size))+40,columns=Math.ceil(Math.sqrt(nodes.length));nodes.forEach((n,i)=>{n.x=i%columns*step;n.y=Math.floor(i/columns)*step;});
 }
}

export function buildCooccurrenceNetwork(data:VisualizationData,o:VisualizationOptions):MapSuggestion{
 const graph=cooccurrenceData(data,o),linked=new Set(graph.pairs.flatMap(p=>[p.a,p.b]));
 if(o.preset==='chord')return buildCooccurrenceChord(data,o,graph);
 const codes=graph.codes.filter(c=>o.coocHideIsolates===false||linked.has(c.id)),maxFrequency=Math.max(1,...graph.frequency.values());
 const nodes:Placed[]=codes.map(code=>({code,x:0,y:0,depth:0,size:Math.max(160+70*Math.sqrt((graph.frequency.get(code.id)||0)/maxFrequency),Math.min(360,100+Math.ceil(code.name.length/18)*29))}));
 const adjacent=new Map(codes.map(c=>[c.id,new Set<string>()]));for(const p of graph.pairs){adjacent.get(p.a)?.add(p.b);adjacent.get(p.b)?.add(p.a);}
 const components:Placed[][]=[],visited=new Set<string>();
 for(const node of nodes){if(visited.has(node.code.id))continue;const component:Placed[]=[],queue=[node.code.id];visited.add(node.code.id);
  while(queue.length){const id=queue.shift()!;component.push(nodes.find(n=>n.code.id===id)!);for(const next of adjacent.get(id)||[])if(!visited.has(next)){visited.add(next);queue.push(next);}}components.push(component);
 }
 if(o.preset==='spatial'){
  spatialLayout(nodes,graph.pairs,o);
 }else if(o.preset==='circle'){
  const radius=Math.max(420,nodes.reduce((sum,n)=>sum+n.size+55,0)/(2*Math.PI));nodes.forEach((n,i)=>{const angle=-Math.PI/2+i*2*Math.PI/Math.max(1,nodes.length);n.x=Math.cos(angle)*radius;n.y=Math.sin(angle)*radius;});
 }else if(o.preset==='sphere'){
  const radius=Math.max(500,Math.sqrt(nodes.length)*180),yaw=(o.coocYaw||0)*Math.PI/180;
  nodes.forEach((n,i)=>{const z=1-2*(i+.5)/Math.max(1,nodes.length),ring=Math.sqrt(1-z*z),angle=i*Math.PI*(3-Math.sqrt(5))+yaw,x=Math.cos(angle)*ring,y=Math.sin(angle)*ring;n.depth=z;n.x=x*radius*(.85+.15*z);n.y=y*radius*(.85+.15*z);});
 }else{
  // Lay out each connected component separately so disconnected groups stay legible.
  let x=0,y=0,rowHeight=0;const targetWidth=Math.max(1500,Math.sqrt(nodes.length)*550);
  for(const component of components.sort((a,b)=>b.length-a.length)){
   const radius=Math.max(150,Math.sqrt(component.length)*135);
   component.forEach((n,i)=>{const angle=i*2*Math.PI/component.length;n.x=Math.cos(angle)*radius;n.y=Math.sin(angle)*radius;});
   for(let pass=0;pass<70;pass++)for(const p of graph.pairs){const a=component.find(n=>n.code.id===p.a),b=component.find(n=>n.code.id===p.b);if(!a||!b)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),desired=(a.size+b.size)/2+90,force=Math.max(-8,Math.min(8,(d-desired)*.025*Math.sqrt(p.value)));a.x+=dx/d*force;a.y+=dy/d*force;b.x-=dx/d*force;b.y-=dy/d*force;}
   separate(component);const left=Math.min(...component.map(n=>n.x-n.size/2)),top=Math.min(...component.map(n=>n.y-n.size/2)),w=Math.max(...component.map(n=>n.x+n.size/2))-left,h=Math.max(...component.map(n=>n.y+n.size/2))-top;
   if(x&&x+w>targetWidth){x=0;y+=rowHeight+180;rowHeight=0;}component.forEach(n=>{n.x+=x-left;n.y+=y-top;});x+=w+180;rowHeight=Math.max(rowHeight,h);
  }
 }
 separate(nodes);
 const left=Math.min(0,...nodes.map(n=>n.x-n.size/2)),top=Math.min(0,...nodes.map(n=>n.y-n.size/2));nodes.forEach(n=>{n.x+=80-left;n.y+=280-top;});
 const width=Math.ceil(Math.max(1400,...nodes.map(n=>n.x+n.size/2+80))),height=Math.ceil(Math.max(950,...nodes.map(n=>n.y+n.size/2+180))),byId=new Map(nodes.map(n=>[n.code.id,n]));
 const palette=['#2563eb','#16803c','#a44d12','#8745bc','#b52a70','#0c8496','#96700a'],groupIndex=new Map(components.flatMap((group,i)=>group.map(n=>[n.code.id,i] as const)));
 const annotations:MapAnnotation[]=graph.pairs.map((p,i)=>{const a=byId.get(p.a)!,b=byId.get(p.b)!;return {id:'suggested:network:edge:'+i,kind:'arrow',shapeType:(o.coocCurves??o.preset==='spatial')?'network-link-curved':undefined,x:a.x,y:a.y,x2:b.x,y2:b.y,fromAnnotationId:'suggested:network:node:'+p.a,toAnnotationId:'suggested:network:node:'+p.b,text:o.coocShowValues===false?'':String(p.value),arrowHead:false,color:'#64748b',textColor:'#334155',fontSize:24,lineStyle:'solid',strokeWidth:1+6*p.value/Math.max(1,graph.pairs[0]?.value||1),sourceDocIds:p.docs,sourceCodeIds:[p.a,p.b],coocPair:pairMetadata(p,graph.unit)};});
 for(const n of nodes.slice().sort((a,b)=>a.depth-b.depth)){const color=palette[(groupIndex.get(n.code.id)||0)%palette.length],text=o.coocNodeStyle==='text',h=text?Math.min(130,n.size*.55):n.size;annotations.push({id:'suggested:network:node:'+n.code.id,kind:text?'text':'circle',shapeType:text?'network-text':o.coocNodeStyle==='flat'?'network-node':'network-ball',networkPoint:n.point,x:n.x-n.size/2,y:n.y-h/2,width:n.size,height:h,text:n.code.name,fill:text?undefined:color,color:text?'#253047':color,textColor:text?'#253047':'#ffffff',labelInside:!text,fontSize:text?Math.round(22+10*Math.sqrt((graph.frequency.get(n.code.id)||0)/maxFrequency)):24,bold:true,lineStyle:'solid',sourceCodeIds:[n.code.id],sourceDocIds:graph.docs.filter(d=>graph.presence.get(n.code.id)?.has(d.id)).map(d=>d.id)});}
 const description=graph.description+' '+graph.pairs.length+' of '+graph.qualified+' qualifying links shown (minimum '+graph.minimum+'); '+(graph.codes.length-codes.length)+' isolated codes hidden. '+(o.coocNodeStyle==='text'?'Text size':'Node size')+' reflects coding frequency with extra space for labels. '+(o.preset==='spatial'?'A force layout in three dimensions, projected at the chosen viewing angles; projected labels are spread to avoid collisions. The depth is illustrative, not a measured variable. ':o.preset==='sphere'?'Projected spherical layout and ball shading are illustrative, not extra data dimensions. ':'')+'Positions are for readability; links do not establish causation.';
 annotations.push({id:'suggested:network:title',kind:'text',text:o.title||'Code co-occurrence network',x:50,y:35,width:width-100,height:60,fontSize:32,color:'#253047',lineStyle:'solid'},
 {id:'suggested:network:method',kind:'text',text:description,x:50,y:105,width:width-100,height:130,fontSize:20,bold:false,color:'#475569',lineStyle:'solid'},
 {id:'suggested:network:legend',kind:'text',text:'Line label = '+(graph.unit==='documents'?'shared documents':'overlapping range pairs')+'. Thicker lines = larger counts. Colours distinguish connected groups, not statistically inferred communities.',x:50,y:height-100,width:width-100,height:75,fontSize:20,bold:false,color:'#475569',lineStyle:'solid'});
 if(!nodes.length)annotations.push({id:'suggested:network:empty',kind:'text',text:'No links meet these settings. Lower the minimum, select more sources, or include isolated codes.',x:100,y:350,width:width-200,height:100,color:'#475569',lineStyle:'solid',fontSize:26});
 return {design:{family:'cooccurrence-network',mode:'manual',width,height,maxLinks:0,rootIds:[],generatedAt:Date.now(),description,options:{...o}},replaceCanvas:true,codes:[],hiddenIds:data.codes.map(c=>c.id),annotations,edges:[]};
}
