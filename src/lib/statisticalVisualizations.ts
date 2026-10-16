import {normalizeCoderName} from '../domain';
import type {AnalysisPeriod,MapAnnotation,VisualizationKind} from '../domain';
import type {MapSuggestion} from './mapSuggestions';
import type {VisualizationData,VisualizationOptions} from './visualizations';
const palette=['#2563eb','#16803c','#c45d12','#8745bc','#b52a70','#0c8496','#ad7a0a','#475569'];
export function jaccardDistance(a:Set<string>,b:Set<string>):number {const union=new Set([...a,...b]);if(!union.size)return 0;let common=0;for(const v of a)if(b.has(v))common++;return 1-common/union.size;}
export interface ClusterNode {id:number;members:number[];distance:number;left?:ClusterNode;right?:ClusterNode;}
export function averageLinkage(vectors:Set<string>[]):ClusterNode|null {
 if(!vectors.length)return null;let next=vectors.length;const distance=vectors.map(a=>vectors.map(b=>jaccardDistance(a,b)));let groups:ClusterNode[]=vectors.map((_,i)=>({id:i,members:[i],distance:0}));
 while(groups.length>1){let ai=0,bi=1,best=Infinity;for(let a=0;a<groups.length;a++)for(let b=a+1;b<groups.length;b++){let total=0;for(const i of groups[a].members)for(const j of groups[b].members)total+=distance[i][j];const d=total/(groups[a].members.length*groups[b].members.length);if(d<best-1e-12){best=d;ai=a;bi=b;}}
 const left=groups[ai],right=groups[bi],merged={id:next++,members:[...left.members,...right.members],distance:best,left,right};groups=groups.filter((_,i)=>i!==ai&&i!==bi);groups.push(merged);groups.sort((a,b)=>Math.min(...a.members)-Math.min(...b.members));}return groups[0];
}
export function histomapTable(data:VisualizationData,o:VisualizationOptions){
 const requested=o.periods||data.analysisPeriods||[];if(requested.some(p=>!p.id||!p.label.trim()))throw new Error('Give every period a non-empty label.');const periods=requested.slice().sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));if(periods.length<2)throw new Error('Define at least two ordered periods.');if(periods.length>12)throw new Error('Use at most twelve periods.');if(new Set(periods.map(p=>p.label.trim().toLocaleLowerCase())).size!==periods.length)throw new Error('Period labels must be distinct.');if(new Set(periods.map(p=>p.id)).size!==periods.length)throw new Error('Period IDs must be unique.');
 const selectedDocs=new Set(o.docIds),selectedCodes=new Set(o.codeIds),docs=data.docs.filter(d=>selectedDocs.has(d.id)).slice(0,o.docLimit||24),docMap=new Map(docs.map(d=>[d.id,d])),codes=data.codes.filter(c=>selectedCodes.has(c.id)).slice(0,Math.min(200,o.limit)),periodIndex=new Map(periods.map((p,i)=>[p.id,i])),codeIndex=new Map(codes.map((c,i)=>[c.id,i])),values=periods.map(()=>codes.map(()=>0)),coverage=periods.map(()=>false),sources=periods.map(()=>new Set<string>()),seen=new Map<string,string>();let excluded=0;
 const docPeriod=(id:string)=>o.docPeriods?.[id]??docMap.get(id)?.periodId;
 for(const d of docs){const p=periodIndex.get(docPeriod(d.id)||'');if(p!==undefined){coverage[p]=true;sources[p].add(d.id);}}
 data.codedSegments.forEach((s,i)=>{if(!docMap.has(s.docId)||(o.coder&&o.coder!=='all'&&normalizeCoderName(s.coder)!==normalizeCoderName(o.coder)))return;const override=o.segmentPeriods?.[s.id],period=override==='__none'?'':override||s.periodId||docPeriod(s.docId),p=periodIndex.get(period||'');if(p!==undefined){coverage[p]=true;sources[p].add(s.docId);}const c=codeIndex.get(s.codeId);if(c===undefined)return;const key=[s.codeId,s.docId,s.start??s.id??i,s.end??''].join('::');if(seen.has(key)){if(seen.get(key)!==(period||''))throw new Error('The same coded range has conflicting period tags. Align the tags or select one coder.');return;}seen.set(key,period||'');if(p===undefined){excluded++;return;}values[p][c]++;});
 return {periods,codes,docs,values,coverage,sources,excluded};
}
export function dendrogramData(data:VisualizationData,o:VisualizationOptions){
 const codeIds=new Set(o.codeIds),docIds=new Set(o.docIds),codes=data.codes.filter(c=>codeIds.has(c.id)).slice(0,Math.min(200,o.limit)),docs=data.docs.filter(d=>docIds.has(d.id)).slice(0,o.docLimit||24),selectedCodes=new Set(codes.map(c=>c.id)),selectedDocs=new Set(docs.map(d=>d.id)),byCode=o.preset==='codes',items=byCode?codes:docs,vectors=items.map(()=>new Set<string>()),indices=new Map(items.map((item,i)=>[item.id,i]));
 for(const s of data.codedSegments){if(!selectedCodes.has(s.codeId)||!selectedDocs.has(s.docId)||(o.coder&&o.coder!=='all'&&normalizeCoderName(s.coder)!==normalizeCoderName(o.coder)))continue;const i=indices.get(byCode?s.codeId:s.docId);if(i!==undefined)vectors[i].add(byCode?s.docId:s.codeId);}
 const kept=items.map((item,i)=>({item,vector:vectors[i]})).filter(row=>row.vector.size),excluded=items.filter((_,i)=>!vectors[i].size);
 return {codes,docs,byCode,items,vectors,indices,kept,excluded};
}
// Inspect selected records only; graph layout and clustering run on Generate.
export function statisticalReadiness(data:VisualizationData,family:'histomap'|'dendrogram',o:VisualizationOptions){
 const issues:string[]=[],warnings:string[]=[];let summary='';
 if(!data.codes.some(c=>o.codeIds.includes(c.id)))issues.push('Select at least one code.');
 if(!data.docs.some(d=>o.docIds.includes(d.id)))issues.push('Select at least one document.');
 try{if(family==='histomap'){
  const t=histomapTable(data,o),totals=t.values.map(row=>row.reduce((a,b)=>a+b,0)),assigned=totals.reduce((a,b)=>a+b,0),populated=totals.filter(n=>n>0).length;
  summary=`${assigned} unique code assignments across ${populated} of ${t.periods.length} periods; ${t.docs.length} documents and ${t.codes.length} codes in scope.`;
  if(!assigned)issues.push('Assign a valid period to coded passages or their documents. Check the selected codes and coder.');
  if(t.excluded)warnings.push(`${t.excluded} unassigned code assignments will be excluded. Use Passage overrides or Document defaults to assign them.`);
  const gaps=t.periods.filter((_,i)=>!t.coverage[i]);if(gaps.length)warnings.push('Periods without assigned data will appear as gaps: '+gaps.map(p=>p.label).join(', ')+'.');
 }else{
  const t=dendrogramData(data,o),noun=t.byCode?'codes':'documents';summary=`${t.kept.length} non-empty ${noun} available to cluster; ${t.docs.length} documents and ${t.codes.length} codes in scope.`;
  if(t.kept.length<2)issues.push('Select at least two '+(t.byCode?'codes with coding in the selected documents':'documents with selected-code coding')+'. Check the coder filter.');
  if(t.kept.length>100)issues.push('Reduce the code or document limit to at most 100 non-empty items.');
  if(t.excluded.length)warnings.push('Empty items will be excluded: '+t.excluded.map(item=>item.name).join('; ')+'.');
 }}catch(error){issues.push(error instanceof Error?error.message:String(error));}
 return {ready:issues.length===0,issues,warnings,summary};
}
export function buildStatisticalVisualization(data:VisualizationData,family:Extract<VisualizationKind,'histomap'|'dendrogram'>,o:VisualizationOptions):MapSuggestion {
 const annotations:MapAnnotation[]=[];let width=1800,height=1100,n=0,description='';
 const mark=(kind:MapAnnotation['kind'],text:string,x:number,y:number,w:number,h:number,extra:Partial<MapAnnotation>={})=>{const a:MapAnnotation={id:'suggested:stat:'+n++,kind,text,x,y,width:w,height:h,color:'#334155',lineStyle:'solid',fontSize:24,textColor:'#253047',labelInside:kind==='rect',...extra};annotations.push(a);return a;};
 const line=(x:number,y:number,x2:number,y2:number,extra:Partial<MapAnnotation>={})=>mark('arrow','',x,y,0,0,{x2,y2,arrowHead:false,...extra});
 const heading=()=>{mark('text',o.title||data.name,50,30,width-100,60,{fontSize:32});mark('text',description,50,100,width-100,105,{fontSize:20,bold:false});};
 if(family==='histomap'){
 const table=histomapTable(data,o),{periods,codes,values,coverage,sources,excluded}=table,totals=values.map(row=>row.reduce((a,b)=>a+b,0)),maximum=Math.max(0,...totals);if(!codes.length)throw new Error('Select at least one code.');if(!maximum)throw new Error('No coded passages have a valid period in this selection. Tag passages or documents and check your code/coder selection.');
 width=1900;height=Math.max(1000,periods.length*155+420,codes.length*90+420);const top=280,step=155,plotX=330,plotW=950,share=o.timeWidth!=='count',boundaries=values.map((row,p)=>{let total=0;return [0,...row.map(v=>{total+=v;return total/(share?Math.max(1,totals[p]):maximum);})];});
 description=(share?'Band widths = share of displayed code assignments within each period.':'Band widths = unique coded-passage counts on one common count scale.')+' Identical code/document/range assignments across coders count once; multi-coded passages contribute to each displayed code. Direct codes only. '+excluded+' unassigned passages excluded.';heading();
 mark('text','Period (ordinal order)',40,218,260,50,{fontSize:22});for(const tick of [0,.5,1])mark('text',share?Math.round(tick*100)+'%':String(Number((tick*maximum).toFixed(1))),plotX+tick*plotW-25,220,95,50,{fontSize:22,bold:false});
 const runs:number[][]=[];for(let p=0;p<periods.length;p++){if(coverage[p]&&totals[p]>0){if(p&&runs.length&&runs[runs.length-1][runs[runs.length-1].length-1]===p-1)runs[runs.length-1].push(p);else runs.push([p]);}}
 codes.forEach((code,c)=>{for(const run of runs){if(!run.some(p=>values[p][c]>0))continue;const first=run[0],last=run[run.length-1],y=top+first*step,h=run.length===1?50:(last-first)*step,points=run.length===1?[boundaries[first][c],0,boundaries[first][c+1],0,boundaries[first][c+1],1,boundaries[first][c],1]:[...run.flatMap(p=>[boundaries[p][c],(p-first)/(last-first)]),...run.slice().reverse().flatMap(p=>[boundaries[p][c+1],(p-first)/(last-first)])];mark('rect','',plotX,y,plotW,h,{polygonPoints:points,fill:palette[c%palette.length],fillOpacity:.72,color:'#ffffff',sourceCodeIds:[code.id],sourceDocIds:Array.from(new Set(run.flatMap(p=>[...sources[p]]))),legendLabel:code.name});}
 mark('rect','',1370,top+c*90,30,30,{fill:palette[c%palette.length],color:palette[c%palette.length]});mark('text',code.name,1420,top-5+c*90,420,70,{sourceCodeIds:[code.id],fontSize:24});});
 periods.forEach((period,p)=>{const y=top+p*step;mark('text',period.label,40,y-10,270,100,{fontSize:24,sourceDocIds:[...sources[p]]});line(plotX,y,plotX+plotW,y,{color:'#cbd5e1',lineStyle:'dashed'});mark('text',coverage[p]?'n = '+totals[p]:'Missing data',plotX+plotW+15,y-10,180,55,{fontSize:20});if(!coverage[p]||!totals[p])mark('rect',coverage[p]?'0 displayed assignments':'No assigned data — gap',plotX,y,plotW,50,{fill:'#f8fafc',color:'#94a3b8',lineStyle:'dashed',fontSize:22});});
 mark('text','n = displayed code assignments, not residents. Gaps are not interpolated. Connectors between periods do not imply continuous measurement.',40,height-95,width-80,70,{fontSize:20,bold:false});
 }else{
 const {codes,docs,byCode,vectors,indices,kept,excluded}=dendrogramData(data,o);if(kept.length<2)throw new Error('Select at least two '+(byCode?'codes with coding':'coded documents')+'. Empty items are excluded; code presence in the chosen sources is required.');
 if(kept.length>100)throw new Error('Cluster at most 100 non-empty items. Reduce the code or document limit.');const root=averageLinkage(kept.map(row=>row.vector))!,order:number[]=[];const leaves=(node:ClusterNode)=>{if(!node.left){order.push(node.members[0]);return;}leaves(node.left);leaves(node.right!);};leaves(root);height=Math.max(850,kept.length*95+390);width=1800;const vertical=o.treeOrientation==='vertical';if(vertical){width=Math.max(1400,kept.length*170+240);height=1200;}const leafOrder=new Map(order.map((id,i)=>[id,i]));
 description='Average-linkage clustering of '+kept.length+' '+(byCode?'codes':'documents')+' using Jaccard distance on direct code presence. '+docs.length+' documents; '+codes.length+' codes; '+(o.coder&&o.coder!=='all'?'coder '+normalizeCoderName(o.coder):'all coders')+'. Empty items excluded: '+excluded.length+'. Equal joining distances are ties, not statistical confidence.';heading();
 const leafAxis=vertical?880:1100,axisMin=vertical?260:220,span=leafAxis-axisMin;
 const point=(node:ClusterNode):{x:number;y:number}=>{const position=node.left?((vertical?point(node.left).x:point(node.left).y)+(vertical?point(node.right!).x:point(node.right!).y))/2:(vertical?160+leafOrder.get(node.members[0])!*170:300+leafOrder.get(node.members[0])!*95),distance=leafAxis-node.distance*span;return vertical?{x:position,y:distance}:{x:distance,y:position};};
 const draw=(node:ClusterNode)=>{const p=point(node);if(node.left){const a=point(node.left),b=point(node.right!);if(vertical){line(a.x,a.y,a.x,p.y);line(b.x,b.y,b.x,p.y);line(a.x,p.y,b.x,p.y);}else{line(a.x,a.y,p.x,a.y);line(b.x,b.y,p.x,b.y);line(p.x,a.y,p.x,b.y);}draw(node.left);draw(node.right!);}else{const {item}=kept[node.members[0]];mark('text',item.name,vertical?p.x-70:leafAxis+35,vertical?leafAxis+25:p.y-30,vertical?150:560,vertical?200:80,{fontSize:24,...(byCode?{sourceCodeIds:[item.id],sourceDocIds:docs.filter(d=>vectors[indices.get(item.id)!].has(d.id)).map(d=>d.id)}:{sourceDocIds:[item.id]})});}};draw(root);
 for(const v of [0,.25,.5,.75,1]){const axis=leafAxis-v*span;if(vertical){line(80,axis,width-50,axis,{color:'#e2e8f0',lineStyle:'dashed'});mark('text',String(v),15,axis-15,60,40,{fontSize:20});}else{line(axis,230,axis,245,{color:'#475569'});mark('text',String(v),axis-25,190,65,40,{fontSize:22});}}
 mark('text','Joining distance: 0 = identical presence; 1 = no shared presence. Excluded empty items: '+(excluded.map(i=>i.name).join('; ')||'none')+'.',40,height-90,width-80,70,{fontSize:20,bold:false});
 }
 return {design:{family,mode:'manual',width,height,maxLinks:0,rootIds:[],generatedAt:Date.now(),description,options:{...o,periods:o.periods||data.analysisPeriods}},replaceCanvas:true,codes:[],hiddenIds:data.codes.map(c=>c.id),annotations:annotations.filter(a=>a.kind==='arrow').concat(annotations.filter(a=>a.kind!=='arrow')),edges:[]};
}
