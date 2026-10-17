import {normalizeCoderName} from '../domain';
import type {MapAnnotation} from '../domain';
import type {MapSuggestion} from './mapSuggestions';
import type {VisualizationData,VisualizationOptions} from './visualizations';

type Axis={id:string;name:string;kind:'code'|'document';key:string};
export function retainHeatmapEdits(next:MapSuggestion,baseline:MapSuggestion,current:MapAnnotation[]):MapSuggestion {
 const originals=new Map(baseline.annotations.map(a=>[a.id,a])),saved=new Map(current.map(a=>[a.id,a]));
 const cellKey=(a:MapAnnotation)=>a.kind==='rect'&&a.sourceCodeIds?JSON.stringify([a.sourceCodeIds,a.sourceDocIds]):undefined;
 const oldCells=new Map(current.filter(a=>cellKey(a)).map(a=>[cellKey(a),a]));
 const fields=['text','fontFamily','fontSize','bold','italic','underline','textColor','color','fill','fillOpacity','rotation','writingMode','textDirection'] as const;
 const annotations=next.annotations.flatMap(a=>{
  const original=originals.get(a.id),edited=saved.get(a.id)||oldCells.get(cellKey(a));
  if(original&&!edited&&(a.id==='suggested:viz:0'||a.id==='suggested:viz:1'))return [];
  if(!edited)return [a];
  const patch:Partial<MapAnnotation>={};for(const field of fields)if(original&&edited[field]!==original[field])Object.assign(patch,{[field]:edited[field]});
  return [{...a,...patch}];
 });
 return {...next,annotations:[...annotations,...current.filter(a=>!a.id.startsWith('suggested:'))]};
}
export function buildHeatmap(data:VisualizationData,o:VisualizationOptions):MapSuggestion {
 const selectedCodes=new Set(o.codeIds),selectedDocs=new Set(o.docIds),codes=data.codes.filter(c=>selectedCodes.has(c.id)).slice(0,Math.min(200,Math.max(1,o.limit))),docs=data.docs.filter(d=>selectedDocs.has(d.id)).slice(0,o.docLimit||24),pair=o.preset==='shared',mode=o.countMode||'passages';
 const codeSet=new Set(codes.map(c=>c.id)),docSet=new Set(docs.map(d=>d.id)),counts=new Map<string,number>(),presence=new Map<string,Set<string>>(),seen=new Set<string>();
 for(const [index,s] of data.codedSegments.entries()){
  if(!docSet.has(s.docId)||!codeSet.has(s.codeId)||(o.coder&&o.coder!=='all'&&normalizeCoderName(s.coder)!==normalizeCoderName(o.coder)))continue;
  const identity=s.start!==undefined&&s.end!==undefined?[s.codeId,s.docId,s.start,s.end].join('::'):s.id||'entry:'+index;
  if(mode==='passages'&&seen.has(identity))continue;seen.add(identity);
  const key=s.codeId+'::'+s.docId;counts.set(key,(counts.get(key)||0)+1);
  if(!presence.has(s.codeId))presence.set(s.codeId,new Set());presence.get(s.codeId)!.add(s.docId);
 }
 const codeAxis:Axis[]=codes.map((c,i)=>({id:c.id,name:c.name,kind:'code',key:'C'+(i+1)}));
 const docAxis:Axis[]=docs.map((d,i)=>({id:d.id,name:d.name.replace(/\.[^.]+$/,'').replace(/_/g,' '),kind:'document',key:'D'+(i+1)})),cols=pair?codeAxis:docAxis;
 if(codes.length*cols.length>2500)throw new Error('This heat map exceeds 2,500 cells. Reduce the code/document limits or selected items.');
 const original=codes.map(code=>cols.map(col=>pair?docs.filter(d=>presence.get(code.id)?.has(d.id)&&presence.get(col.id)?.has(d.id)).length:mode==='presence'?(presence.get(code.id)?.has(col.id)?1:0):counts.get(code.id+'::'+col.id)||0));
 const rowAxis=o.heatTranspose?cols:codeAxis,columnAxis=o.heatTranspose?codeAxis:cols,values=o.heatTranspose?cols.map((_,c)=>codes.map((_,r)=>original[r][c])):original;
 const rows=rowAxis.map((item,index)=>({item,index})).filter(r=>!o.heatHideZeroRows||values[r.index].some(v=>v>0));
 const columns=columnAxis.map((item,index)=>({item,index})).filter(c=>!o.heatHideZeroColumns||values.some(row=>row[c.index]>0));
 const max=Math.max(0,...original.flat()),cellW=120,cellH=74,gridX=400,gridY=240,bottom=gridY+rows.length*cellH,width=Math.max(pair?1400:1100,gridX+columns.length*cellW+60),height=Math.max(750,bottom+160+columns.length*38);
 const annotations:MapAnnotation[]=[];
 const mark=(id:string,kind:MapAnnotation['kind'],text:string,x:number,y:number,w:number,h:number,extra:Partial<MapAnnotation>={})=>annotations.push({id,kind,text,x,y,width:w,height:h,color:'#253047',lineStyle:'solid',fontSize:24,textColor:'#253047',labelInside:kind!=='text',...extra});
 const measure=pair?'Number of shared documents; diagonal = documents containing each code':mode==='passages'?'Unique coded passages (same code/document/range counted once across coders)':mode==='presence'?'Code present (1) or absent (0)':'Coding decisions (includes repeated coding by different coders)';
 const description=measure+'. Direct codes only. '+docs.length+' selected documents; '+(o.coder&&o.coder!=='all'?'coder: '+normalizeCoderName(o.coder):'all coders')+'.'+(o.heatTranspose?' Rows and columns swapped.':'')+(o.heatHideZeroRows||o.heatHideZeroColumns?' Hidden zero-only axes: '+(rowAxis.length-rows.length)+' rows; '+(columnAxis.length-columns.length)+' columns.':'');
 mark('suggested:viz:0','text',o.title||data.name,50,35,width-100,55,{fontSize:30});mark('suggested:viz:1','text',description,50,96,width-100,70,{fontSize:20,bold:false});
 const source=(item:Axis)=>item.kind==='code'?{sourceCodeIds:[item.id]}:{sourceDocIds:[item.id]};
 const key=(prefix:string,item:Axis)=>'suggested:heat:'+prefix+':'+item.kind+':'+encodeURIComponent(item.id);
 columns.forEach(({item},i)=>mark(key('column',item),'text',item.key,gridX+i*cellW+12,190,cellW-20,40,source(item)));
 const shade=(value:number)=>{const ratio=value/Math.max(1,max);return value?`rgb(${Math.round(219-190*ratio)},${Math.round(234-156*ratio)},${Math.round(254-75*ratio)})`:'#f1f5f9';};
 rows.forEach(({item,index:r},row)=>{
  mark(key('row',item),'text',(pair?item.key+' · ':'')+item.name,45,gridY+row*cellH+8,335,cellH-14,source(item));
  columns.forEach(({item:col,index:c},column)=>{const value=values[r][c],code=o.heatTranspose?col:item,other=o.heatTranspose?item:col;
   mark('suggested:heat:cell:'+encodeURIComponent(code.id)+':'+encodeURIComponent(other.id),'rect',String(value),gridX+column*cellW,gridY+row*cellH,cellW-4,cellH-4,{fill:shade(value),color:'#ffffff',textColor:value/Math.max(1,max)>.55?'#ffffff':'#172554',fontSize:26,sourceCodeIds:pair?[code.id,other.id]:[code.id],sourceDocIds:pair?docs.filter(d=>presence.get(code.id)?.has(d.id)&&presence.get(other.id)?.has(d.id)).map(d=>d.id):[other.id]});
  });
 });
 const ticks=max>1?[0,Math.ceil(max/2),max]:max===1?[0,1]:[0];ticks.forEach((value,i)=>mark('suggested:heat:scale:'+i,'rect',String(value),gridX+i*160,bottom+35,140,48,{fill:shade(value),textColor:value/Math.max(1,max)>.55?'#ffffff':'#172554',color:'#cbd5e1'}));
 mark('suggested:heat:scale-label','text',max?'Colour scale: '+(pair?'shared documents':mode==='presence'?'presence':'count'):'No matching coding in this selection',45,bottom+40,330,65,{fontSize:20,bold:false});
 if(!rows.length||!columns.length)mark('suggested:heat:empty','text','No non-zero rows or columns to display. Change the filters or selection.',45,gridY,width-90,70);
 columns.forEach(({item},i)=>mark(key('key',item),'text',item.key+' — '+item.name,45,bottom+115+i*38,width-90,34,{fontSize:20,bold:false,...source(item)}));
 return {design:{family:'heat-map',mode:'manual',width,height,maxLinks:0,rootIds:[],generatedAt:Date.now(),description,options:{...o}},replaceCanvas:true,codes:[],hiddenIds:data.codes.map(c=>c.id),annotations,edges:[]};
}
