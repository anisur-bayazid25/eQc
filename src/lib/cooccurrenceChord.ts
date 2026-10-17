import type {MapAnnotation} from '../domain';
import type {MapSuggestion} from './mapSuggestions';
import type {VisualizationData,VisualizationOptions} from './visualizations';
import type {cooccurrenceData} from './cooccurrence';

/** Unordered pair counts allocate equal-width ribbons at both endpoints. */
export function buildCooccurrenceChord(data:VisualizationData,o:VisualizationOptions,graph:ReturnType<typeof cooccurrenceData>):MapSuggestion{
 const totals=new Map(graph.codes.map(c=>[c.id,0]));for(const p of graph.pairs){totals.set(p.a,totals.get(p.a)!+p.value);totals.set(p.b,totals.get(p.b)!+p.value);}
 const codes=graph.codes.filter(c=>totals.get(c.id)!>0);if(codes.length>40)throw new Error('Use at most 40 connected codes for a readable chord diagram. Reduce the code or link limit.');
 const radius=Math.max(420,codes.length*24),cx=radius+450,cy=radius+330,width=2*cx,height=2*radius+650,inner=radius-32,gap=Math.min(.045,Math.PI/Math.max(1,codes.length)/4),total=[...totals.values()].reduce((a,b)=>a+b,0),scale=(Math.PI*2-gap*codes.length)/Math.max(1,total);
 const palette=['#2563eb','#16803c','#c45d12','#8745bc','#b52a70','#0c8496','#ad7a0a','#475569'],arcs=new Map<string,{start:number;end:number;next:number;color:string}>();let angle=-Math.PI/2;
 codes.forEach((c,i)=>{const start=angle,end=start+totals.get(c.id)!*scale;arcs.set(c.id,{start,end,next:start,color:palette[i%palette.length]});angle=end+gap;});
 const point=(a:number,r=inner)=>({x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r});
 const arc=(start:number,end:number,r=inner)=>{const count=Math.max(3,Math.ceil(Math.abs(end-start)*18));return Array.from({length:count},(_,i)=>point(start+(end-start)*i/(count-1),r));};
 const curve=(from:{x:number;y:number},to:{x:number;y:number})=>Array.from({length:16},(_,i)=>{const t=(i+1)/16,u=1-t;return {x:u*u*u*from.x+3*u*u*t*cx+3*u*t*t*cx+t*t*t*to.x,y:u*u*u*from.y+3*u*u*t*cy+3*u*t*t*cy+t*t*t*to.y};});
 const polygon=(points:Array<{x:number;y:number}>)=>points.flatMap(p=>[(p.x-(cx-radius))/(radius*2),(p.y-(cy-radius))/(radius*2)]);
 const annotations:MapAnnotation[]=[],counts:MapAnnotation[]=[];
 graph.pairs.forEach((p,i)=>{const a=arcs.get(p.a)!,b=arcs.get(p.b)!,a0=a.next,a1=a0+p.value*scale,b0=b.next,b1=b0+p.value*scale;a.next=a1;b.next=b1;
  const ap=arc(a0,a1),bp=arc(b0,b1),points=[...ap,...curve(ap[ap.length-1],bp[0]),...bp,...curve(bp[bp.length-1],ap[0])],metadata:NonNullable<MapAnnotation['coocPair']>={codeIds:[p.a,p.b],value:p.value,unit:graph.unit,ranges:p.ranges};
  annotations.push({id:'suggested:chord:ribbon:'+i,kind:'rect',shapeType:'chord-ribbon',x:cx-radius,y:cy-radius,width:radius*2,height:radius*2,polygonPoints:polygon(points),fill:a.color,color:'none',fillOpacity:.4,lineStyle:'solid',sourceCodeIds:[p.a,p.b],sourceDocIds:p.docs,coocPair:metadata});
  if(o.coocShowValues!==false){const aMid=point((a0+a1)/2,inner*.6),bMid=point((b0+b1)/2,inner*.6);let x=(aMid.x+bMid.x)/2-30,y=(aMid.y+bMid.y)/2-18;
   for(let pass=0;pass<50&&counts.some(c=>Math.abs(c.x-x)<65&&Math.abs(c.y-y)<40);pass++)y+=42;
   counts.push({id:'suggested:chord:count:'+i,kind:'text',text:String(p.value),x,y,width:60,height:36,fontSize:24,color:'#253047',bold:true,lineStyle:'solid',shapeType:'cooc-value',sourceCodeIds:[p.a,p.b],sourceDocIds:p.docs,coocPair:metadata});
  }
 });
 const labels:Array<{code:typeof codes[number];x:number;y:number;anchorY:number;right:boolean}>=[];
 for(const code of codes){const a=arcs.get(code.id)!,points=[...arc(a.start,a.end,radius),...arc(a.end,a.start,inner+4)];
  annotations.push({id:'suggested:chord:sector:'+code.id,kind:'rect',shapeType:'chord-sector',x:cx-radius,y:cy-radius,width:radius*2,height:radius*2,polygonPoints:polygon(points),fill:a.color,color:'#ffffff',lineStyle:'solid',sourceCodeIds:[code.id],sourceDocIds:graph.docs.filter(d=>graph.presence.get(code.id)?.has(d.id)).map(d=>d.id)});
  const middle=(a.start+a.end)/2,p=point(middle,radius+35);labels.push({code,x:p.x,y:p.y,anchorY:p.y,right:Math.cos(middle)>=0});
 }
 for(const side of [false,true]){let previous=200;for(const label of labels.filter(l=>l.right===side).sort((a,b)=>a.y-b.y)){label.y=Math.max(label.y,previous+85);previous=label.y;}}
 for(const label of labels){const targetX=label.right?cx+radius+30:30,w=390;
  annotations.push({id:'suggested:chord:leader:'+label.code.id,kind:'arrow',x:label.x,y:label.anchorY,x2:label.right?targetX:targetX+w,y2:label.y,color:'#94a3b8',lineStyle:'solid',arrowHead:false});
  annotations.push({id:'suggested:chord:label:'+label.code.id,kind:'text',text:label.code.name+' · '+totals.get(label.code.id),x:targetX,y:label.y-30,width:w,height:70,fontSize:24,color:'#253047',bold:false,lineStyle:'solid',sourceCodeIds:[label.code.id],sourceDocIds:graph.docs.filter(d=>graph.presence.get(label.code.id)?.has(d.id)).map(d=>d.id)});
 }
 annotations.push(...counts);
 const bottom=Math.max(height,...labels.map(l=>l.y+180),...counts.map(c=>c.y+180)),description=graph.description+' Chord widths are proportional to pair counts at both ends. '+graph.pairs.length+' of '+graph.qualified+' qualifying pairs shown (minimum '+graph.minimum+'). Each pair is one ribbon, without direction. Outer labels show incident-pair totals, so sector totals sum to twice the displayed pair count. These totals are not people or coding frequencies.';
 annotations.push({id:'suggested:chord:title',kind:'text',text:o.title||'Code co-occurrence chord',x:50,y:35,width:width-100,height:60,fontSize:32,color:'#253047',lineStyle:'solid'},
 {id:'suggested:chord:method',kind:'text',text:description,x:50,y:105,width:width-100,height:135,fontSize:21,bold:false,color:'#475569',lineStyle:'solid'},
 {id:'suggested:chord:legend',kind:'text',text:'Ribbon label = pair count. Outer code label = sum of incident pair counts. Zero-link codes omitted. Select a ribbon for source evidence.',x:50,y:bottom-95,width:width-100,height:65,fontSize:22,bold:false,color:'#475569',lineStyle:'solid'});
 if(!codes.length)annotations.push({id:'suggested:chord:empty',kind:'text',text:'No co-occurrence pairs meet these settings.',x:cx-300,y:cy-40,width:600,height:80,fontSize:28,color:'#475569',lineStyle:'solid'});
 return {design:{family:'cooccurrence-network',mode:'manual',width,height:Math.ceil(bottom),maxLinks:0,rootIds:[],generatedAt:Date.now(),description,options:{...o}},replaceCanvas:true,codes:[],hiddenIds:data.codes.map(c=>c.id),annotations,edges:[]};
}
