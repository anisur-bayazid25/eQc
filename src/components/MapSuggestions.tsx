import VisualizationLimit from './VisualizationLimit';
import { fitMapText } from '../lib/mapTextFit';
import React, {useEffect,useMemo,useRef,useState} from 'react';
import {Code,CodedSegment,MapDesign} from '../domain';
import {ellipseEndpoint,mapLabelLines,MapSuggestion,suggestCodeMap} from '../lib/mapSuggestions';

export default function MapSuggestions({projectId,name,codes,segments,onApply,onClose,initialDesign}:{projectId:string;name:string;codes:Code[];segments:CodedSegment[];onApply:(s:MapSuggestion)=>void;onClose:()=>void;initialDesign?:MapDesign}) {
  const dialogRef=useRef<HTMLElement>(null);
  const [previewZoom,setPreviewZoom]=useState(1);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const dialog=dialogRef.current;const focusable=()=>Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select')||[]).filter(el=>el.getClientRects().length);focusable()[0]?.focus();const trap=(event:KeyboardEvent)=>{if(event.key!=='Tab')return;const nodes=focusable(),first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}};dialog?.addEventListener('keydown',trap);return()=>{dialog?.removeEventListener('keydown',trap);previous?.focus();};},[]);
  const [mode,setMode]=useState<'simple'|'detailed'>(initialDesign?.mode==='detailed'?'detailed':'simple'),[title,setTitle]=useState(name);
  const [roots,setRoots]=useState(8),[children,setChildren]=useState(5),[links,setLinks]=useState(initialDesign?.maxLinks??6);
  const suggestion=useMemo(()=>suggestCodeMap({id:projectId,name,codes,codedSegments:segments},mode,{title,roots,children,links}),[projectId,name,codes,segments,mode,title,roots,children,links]);
  const positions=new Map(suggestion.codes.map(c=>[c.id,c.patch.mapPosition!]));
  const styles=new Map(suggestion.codes.map(c=>[c.id,c.patch.mapAppearance!]));
  const byId=new Map(codes.map(c=>[c.id,c]));
  const {width,height}=suggestion.design;
  const hub=suggestion.annotations[0],center={x:hub.x+hub.width!/2,y:hub.y+hub.height!/2};
  const apply=()=>{onApply(suggestion);onClose();};
  return <div className="modal-overlay map-suggestion-overlay" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}}}>
    <section ref={dialogRef} className="modal map-suggestion-dialog" role="dialog" aria-modal="true" aria-labelledby="map-suggestion-title">
      <header><h2 id="map-suggestion-title">Design your code map</h2><button onClick={onClose} aria-label="Close map designer">×</button></header>
      <div className="map-design-tabs" role="tablist" aria-label="Map designs">{(['simple','detailed'] as const).map(m=><button key={m} role="tab" aria-selected={mode===m} onClick={()=>{setMode(m);setLinks(m==='detailed'?12:6);}}>{m==='simple'?'Simple code map':'Detailed code map'}</button>)}</div>
      <p>{mode==='simple'?'An overview of major themes, arranged around your study topic.':'Theme clusters with selected subcodes, coloured branches and the strongest shared-document links between themes.'}</p>
      <div className="map-design-options"><label>Central topic<input autoFocus maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></label><VisualizationLimit label="Theme limit" ariaLabel="Code map theme limit" max={100} value={roots} suggestions={[4,6,8,12,24,48,100]} onChange={setRoots}/>{mode==='detailed'&&<VisualizationLimit label="Subcodes per theme" ariaLabel="Code map subcode limit" max={200} value={children} suggestions={[3,5,8,12,24,48,100,200]} onChange={setChildren}/>}<label>Shared-document links<select value={links} onChange={e=>setLinks(+e.target.value)}>{[0,3,6,12,20,30].map(n=><option key={n}>{n}</option>)}</select></label></div>
      <p className="section-hint">Enter custom limits or choose suggestions. Generated maps show up to 200 code nodes; use focused selections for readable figures. To draw from scratch, choose Blank canvas in the visualization library.</p><div className="research-actions"><button disabled={previewZoom<=1} onClick={()=>setPreviewZoom(Math.max(1,previewZoom-.5))}>Preview zoom out</button><span>{Math.round(previewZoom*100)}%</span><button disabled={previewZoom>=3} onClick={()=>setPreviewZoom(Math.min(3,previewZoom+.5))}>Preview zoom in</button><button onClick={()=>setPreviewZoom(1)}>Fit preview</button></div><div className="map-design-preview"><svg style={{width:previewZoom*100+'%',maxHeight:previewZoom===1?'50vh':'none'}} viewBox={`0 0 ${width} ${height}`} aria-label="Suggested code map preview" role="img">
        <rect width={width} height={height} fill="#fffcf6"/>
        {suggestion.design.rootIds.map(id=>{const end=positions.get(id)!;const a=ellipseEndpoint(center,end,320,210),b=ellipseEndpoint(end,center,styles.get(id)!.width,styles.get(id)!.height);return <path key={id} d={`M${a.x},${a.y} Q${(a.x+b.x)/2+30},${(a.y+b.y)/2} ${b.x},${b.y}`} fill="none" stroke={styles.get(id)!.stroke} strokeWidth={4}/>;})}
        {suggestion.edges.map(edge=>{const from=positions.get(edge.fromCodeId)!,to=positions.get(edge.toCodeId)!;const a=ellipseEndpoint(from,to,styles.get(edge.fromCodeId)!.width,styles.get(edge.fromCodeId)!.height),b=ellipseEndpoint(to,from,styles.get(edge.toCodeId)!.width,styles.get(edge.toCodeId)!.height);return <path key={edge.id} d={`M${a.x},${a.y} Q${(a.x+b.x)/2+35},${(a.y+b.y)/2-30} ${b.x},${b.y}`} fill="none" stroke={edge.color} strokeWidth={edge.width} strokeDasharray={edge.kind==='cooccurrence'?'10 7':undefined} opacity={edge.kind==='cooccurrence'?.6:1}/>;})}
        <ellipse cx={center.x} cy={center.y} rx={160} ry={105} fill={hub.fill} stroke={hub.color} strokeWidth={4}/>
        <MapLabel text={hub.text!} x={center.x} y={center.y} fontSize={hub.fontSize||24} width={320*.78} height={210*.72}/>
        {suggestion.codes.map(c=>{const pos=positions.get(c.id)!,style=styles.get(c.id)!;return <g key={c.id}><title>{byId.get(c.id)!.name}</title><ellipse cx={pos.x} cy={pos.y} rx={style.width/2} ry={style.height/2} fill={style.fill} stroke={style.stroke} strokeWidth={suggestion.design.rootIds.includes(c.id)?3.5:1.8}/><MapLabel text={byId.get(c.id)!.mapLabel??byId.get(c.id)!.name} x={pos.x} y={pos.y} fontSize={style.fontSize} width={style.width*.78} height={style.height*.72}/></g>;})}
      </svg></div>
      <p className="section-hint">{`${suggestion.codes.length} of ${codes.length} codes shown. Other codes remain available through Add codes. Solid branches show hierarchy; dashed links count shared documents, including hidden descendants. `}Applying replaces the current map layout and generated styling. Your research text, coding, codebook colours and manual notes are retained. Use Undo to restore the previous map.</p>
      <footer><button onClick={onClose}>Cancel</button><button className="primary-btn" disabled={!codes.length} onClick={apply}>Use this design</button></footer>
    </section>
  </div>;
}

export function MapLabel({text,x,y,fontSize,max=22,color='#253047',fontFamily='Segoe UI, Arial, sans-serif',bold=true,italic=false,underline=false,width,height,rotation=0,writingMode='horizontal-tb',textDirection}:{text:string;x:number;y:number;fontSize:number;max?:number;color?:string;fontFamily?:string;bold?:boolean;italic?:boolean;underline?:boolean;width?:number;height?:number;rotation?:number;writingMode?:'horizontal-tb'|'vertical-rl'|'vertical-lr';textDirection?:'ltr'|'rtl'}){
  if(!text.trim())return null;
  const fitted=width&&height?fitMapText(text,writingMode==='horizontal-tb'?width:height,writingMode==='horizontal-tb'?height:width,fontSize,fontFamily,bold,italic):null;
  const lines=fitted?.lines||mapLabelLines(text,max);fontSize=fitted?.fontSize||fontSize;
  return <text transform={rotation?`rotate(${rotation} ${x} ${y})`:undefined} style={{writingMode,direction:textDirection,unicodeBidi:'plaintext'}} x={x} y={writingMode==='horizontal-tb'?y-(lines.length-1)*fontSize*.58:y} fontSize={fontSize} fontFamily={fontFamily} fontWeight={bold?600:400} fontStyle={italic?'italic':undefined} textDecoration={underline?'underline':undefined} textAnchor="middle" dominantBaseline="middle" fill={color} pointerEvents="auto">{lines.map((line,i)=><tspan key={i} x={writingMode==='horizontal-tb'?x:x+(i-(lines.length-1)/2)*fontSize*1.16*(writingMode==='vertical-rl'?-1:1)} y={writingMode==='horizontal-tb'?undefined:y} dy={writingMode==='horizontal-tb'&&i?fontSize*1.16:0}>{line}</tspan>)}</text>;
}
