import {fitMapText} from './mapTextFit';
import type {MapAnnotation} from '../domain';
import type {MapSuggestion} from './mapSuggestions';
import type {VisualizationData,VisualizationOptions} from './visualizations';
import type {cooccurrenceData} from './cooccurrence';

/** Unordered pair counts allocate equal-width ribbons at both endpoints. */
export function buildCooccurrenceChord(data:VisualizationData,o:VisualizationOptions,graph:ReturnType<typeof cooccurrenceData>):MapSuggestion{
 const totals=new Map(graph.codes.map(c=>[c.id,0]));for(const p of graph.pairs){totals.set(p.a,totals.get(p.a)!+p.value);totals.set(p.b,totals.get(p.b)!+p.value);}
 const codes=graph.codes.filter(c=>totals.get(c.id)!>0);if(codes.length>40)throw new Error('Use at most 40 connected codes for a readable chord diagram. Reduce the code or link limit.');
 const radius=Math.max(420,codes.length*24),cx=radius+450,cy=radius+330,width=2*cx,height=2*radius+520,inner=radius-32,gap=Math.min(.045,Math.PI/Math.max(1,codes.length)/4),total=[...totals.values()].reduce((a,b)=>a+b,0),scale=(Math.PI*2-gap*codes.length)/Math.max(1,total);
 const palette=['#2563eb','#16803c','#c45d12','#8745bc','#b52a70','#0c8496','#ad7a0a','#475569'],arcs=new Map<string,{start:number;end:number;next:number;color:string}>();let angle=-Math.PI/2;
 codes.forEach((c,i)=>{const start=angle,end=start+totals.get(c.id)!*scale;arcs.set(c.id,{start,end,next:start,color:palette[i%palette.length]});angle=end+gap;});
 const point=(a:number,r=inner)=>({x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r});
 const arc=(start:number,end:number,r=inner)=>{const count=Math.max(3,Math.ceil(Math.abs(end-start)*18));return Array.from({length:count},(_,i)=>point(start+(end-start)*i/(count-1),r));};
 // Standard quadratic chord boundaries avoid the exaggerated central pinch of
 // cubic curves whose two control points both sit at the circle centre.
 const quadratic=(from:{x:number;y:number},to:{x:number;y:number},t:number)=>{const u=1-t;return {x:u*u*from.x+2*u*t*cx+t*t*to.x,y:u*u*from.y+2*u*t*cy+t*t*to.y};};
 const curve=(from:{x:number;y:number},to:{x:number;y:number})=>Array.from({length:40},(_,i)=>quadratic(from,to,(i+1)/40));
 const polygon=(points:Array<{x:number;y:number}>)=>points.flatMap(p=>[(p.x-(cx-radius))/(radius*2),(p.y-(cy-radius))/(radius*2)]);
 const annotations:MapAnnotation[]=[],counts:MapAnnotation[]=[];
 graph.pairs.forEach((p,i)=>{const a=arcs.get(p.a)!,b=arcs.get(p.b)!,a0=a.next,a1=a0+p.value*scale,b0=b.next,b1=b0+p.value*scale;a.next=a1;b.next=b1;
  const ap=arc(a0,a1),bp=arc(b0,b1),points=[...ap,...curve(ap[ap.length-1],bp[0]),...bp,...curve(bp[bp.length-1],ap[0])],metadata:NonNullable<MapAnnotation['coocPair']>={codeIds:[p.a,p.b],value:p.value,unit:graph.unit,ranges:p.ranges};
  annotations.push({id:'suggested:chord:ribbon:'+i,kind:'rect',shapeType:'chord-ribbon',x:cx-radius,y:cy-radius,width:radius*2,height:radius*2,polygonPoints:polygon(points),fill:a.color,color:'none',fillOpacity:.4,lineStyle:'solid',sourceCodeIds:[p.a,p.b],sourceDocIds:p.docs,coocPair:metadata});
  if(o.coocShowValues!==false){
   // Stay on the ribbon's actual centre curve when avoiding other count labels.
   const from={x:(ap[0].x+ap[ap.length-1].x)/2,y:(ap[0].y+ap[ap.length-1].y)/2},to={x:(bp[0].x+bp[bp.length-1].x)/2,y:(bp[0].y+bp[bp.length-1].y)/2};
   const candidates=[.5,.38,.62,.26,.74,.14,.86].map(t=>quadratic(from,to,t));
   const position=candidates.find(p=>counts.every(c=>Math.abs(c.x+24-p.x)>=56||Math.abs(c.y+16-p.y)>=40));
   if(position)counts.push({id:'suggested:chord:count:'+i,kind:'text',text:String(p.value),x:position.x-24,y:position.y-16,width:48,height:32,fontSize:22,color:'#253047',bold:true,lineStyle:'solid',shapeType:'cooc-value',sourceCodeIds:[p.a,p.b],sourceDocIds:p.docs,coocPair:metadata});
  }
 });
 const labels:Array<{code:typeof codes[number];x:number;y:number;outerX:number;outerY:number;right:boolean;text:string;height:number}>=[];
 for(const code of codes){const a=arcs.get(code.id)!,points=[...arc(a.start,a.end,radius),...arc(a.end,a.start,inner+4)];
  annotations.push({id:'suggested:chord:sector:'+code.id,kind:'rect',shapeType:'chord-sector',x:cx-radius,y:cy-radius,width:radius*2,height:radius*2,polygonPoints:polygon(points),fill:a.color,color:'#ffffff',lineStyle:'solid',sourceCodeIds:[code.id],sourceDocIds:graph.docs.filter(d=>graph.presence.get(code.id)?.has(d.id)).map(d=>d.id)});
  const middle=(a.start+a.end)/2,p=point(middle,radius),outer=point(middle,radius+18),text=code.name+' · '+totals.get(code.id),lines=fitMapText(text,382,10000,24,undefined,false).lines;
  labels.push({code,x:p.x,y:p.y,outerX:outer.x,outerY:outer.y,right:Math.cos(middle)>=0,text:lines.join('\n'),height:lines.length*24*1.16+8});
 }
 for(const side of [false,true]){
  const ordered=labels.filter(l=>l.right===side).sort((a,b)=>a.y-b.y);
  // Forward and backward passes reserve real wrapped text heights on both sides.
  let bottom=cy-radius-55;
  for(const label of ordered){label.y=Math.max(label.y,bottom+label.height/2);bottom=label.y+label.height/2+18;}
  let top=Math.max(cy+radius+55,bottom-18);
  for(const label of [...ordered].reverse()){label.y=Math.min(label.y,top-label.height/2);top=label.y-label.height/2-18;}
 }
 for(const label of labels){const targetX=label.right?cx+radius+50:30,w=390,endX=label.right?targetX-8:targetX+w+8,railX=label.right?cx+radius+22:cx-radius-22;
  // Keep the sector anchor independent of label spreading.
  const a=arcs.get(label.code.id)!,anchor=point((a.start+a.end)/2,radius),points=[anchor,{x:label.outerX,y:label.outerY},{x:railX,y:label.outerY},{x:endX,y:label.y}];
  for(let i=0;i<points.length-1;i++)annotations.push({id:'suggested:chord:leader:'+label.code.id+':'+i,kind:'arrow',x:points[i].x,y:points[i].y,x2:points[i+1].x,y2:points[i+1].y,color:'#94a3b8',lineStyle:'solid',arrowHead:false,sourceCodeIds:[label.code.id]});
  annotations.push({id:'suggested:chord:label:'+label.code.id,kind:'text',shapeType:label.right?'chord-label-right':'chord-label-left',text:label.text,x:targetX,y:label.y-label.height/2,width:w,height:label.height,fontSize:24,color:'#253047',bold:false,lineStyle:'solid',sourceCodeIds:[label.code.id],sourceDocIds:graph.docs.filter(d=>graph.presence.get(label.code.id)?.has(d.id)).map(d=>d.id)});
 }
 annotations.push(...counts);
 const bottom=Math.max(height,...labels.map(l=>l.y+l.height/2+140),...counts.map(c=>c.y+180)),description=graph.description+' Chord widths are proportional to pair counts at both ends. '+graph.pairs.length+' of '+graph.qualified+' qualifying pairs shown (minimum '+graph.minimum+'). Each pair is one ribbon, without direction. Outer labels show incident-pair totals, so sector totals sum to twice the displayed pair count. These totals are not people or coding frequencies.';
 annotations.push({id:'suggested:chord:title',kind:'text',text:o.title||'Code co-occurrence chord',x:50,y:35,width:width-100,height:60,fontSize:32,color:'#253047',lineStyle:'solid'},
 {id:'suggested:chord:method',kind:'text',text:description,x:50,y:105,width:width-100,height:135,fontSize:21,bold:false,color:'#475569',lineStyle:'solid'},
 {id:'suggested:chord:legend',kind:'text',text:'Ribbon label = pair count. Outer label = total of connected pair counts. Select a ribbon for source evidence.'+(o.coocShowValues!==false&&counts.length<graph.pairs.length?' Some overlapping number labels are hidden; select their ribbons to see counts.':''),x:50,y:bottom-95,width:width-100,height:65,fontSize:22,bold:false,color:'#475569',lineStyle:'solid'});
 if(!codes.length)annotations.push({id:'suggested:chord:empty',kind:'text',text:'No co-occurrence pairs meet these settings.',x:cx-300,y:cy-40,width:600,height:80,fontSize:28,color:'#475569',lineStyle:'solid'});
 return {design:{family:'cooccurrence-network',mode:'manual',width,height:Math.ceil(bottom),maxLinks:0,rootIds:[],generatedAt:Date.now(),description,options:{...o}},replaceCanvas:true,codes:[],hiddenIds:data.codes.map(c=>c.id),annotations,edges:[]};
}
