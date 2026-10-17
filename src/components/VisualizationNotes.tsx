import React,{useEffect,useRef,useState} from 'react';
import {VisualizationNote} from '../domain';

function NoteCard({note,onSave,onRemove,onDrag}:{note:VisualizationNote;onSave:(patch:Partial<VisualizationNote>)=>void;onRemove:()=>void;onDrag:(event:React.MouseEvent)=>void}) {
  const [title,setTitle]=useState(note.title),[text,setText]=useState(note.text);
  useEffect(()=>{setTitle(note.title);setText(note.text);},[note.title,note.text]);
  return <div className="visualization-note" onMouseDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>
    <header onMouseDown={onDrag}>Drag note <button type="button" aria-label={'Delete visualization note '+note.title} onMouseDown={event=>event.stopPropagation()} onClick={onRemove}>×</button></header>
    <input aria-label="Visualization note title" value={title} onChange={event=>setTitle(event.target.value)}/>
    <textarea aria-label="Visualization note text" value={text} placeholder="Interpretation, questions or instructions for the team…" onChange={event=>setText(event.target.value)}/>
    <button type="button" disabled={title===note.title&&text===note.text} onClick={()=>onSave({title:title.trim()||'Visualization note',text})}>Save note</button>
  </div>;
}
export default function VisualizationNotes({notes,onChange,width,height}:{notes:VisualizationNote[];onChange:(notes:VisualizationNote[])=>void;width:number;height:number}) {
  const [drag,setDrag]=useState<{id:string;startX:number;startY:number;x:number;y:number;scaleX:number;scaleY:number}|null>(null),[live,setLive]=useState<{x:number;y:number}|null>(null);
  const latest=useRef({notes,onChange});latest.current={notes,onChange};
  const liveRef=useRef(live);liveRef.current=live;
  const cardWidth=Math.min(320,width),cardHeight=Math.min(240,height);
  useEffect(()=>{if(!drag)return;const move=(event:MouseEvent)=>{const position={x:Math.max(0,Math.min(width-cardWidth,drag.x+(event.clientX-drag.startX)/drag.scaleX)),y:Math.max(0,Math.min(height-cardHeight,drag.y+(event.clientY-drag.startY)/drag.scaleY))};liveRef.current=position;setLive(position);};const end=()=>{const patch=liveRef.current;if(patch)latest.current.onChange(latest.current.notes.map(note=>note.id===drag.id?{...note,...patch,updatedAt:Date.now()}:note));setDrag(null);setLive(null);liveRef.current=null;};window.addEventListener('mousemove',move);window.addEventListener('mouseup',end);return()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',end);};},[drag,width,height]);
  return <g data-visualization-notes>{notes.map(note=><foreignObject key={note.id} x={drag?.id===note.id&&live?live.x:Math.min(note.x,width-cardWidth)} y={drag?.id===note.id&&live?live.y:Math.min(note.y,height-cardHeight)} width={cardWidth} height={cardHeight}>
    <NoteCard note={note} onSave={patch=>onChange(notes.map(item=>item.id===note.id?{...item,...patch,updatedAt:Date.now()}:item))} onRemove={()=>onChange(notes.filter(item=>item.id!==note.id))} onDrag={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();const svg=(event.currentTarget.closest('svg') as SVGSVGElement),matrix=svg.getScreenCTM();if(!matrix)return;setDrag({id:note.id,startX:event.clientX,startY:event.clientY,x:Math.min(note.x,width-cardWidth),y:Math.min(note.y,height-cardHeight),scaleX:Math.hypot(matrix.a,matrix.b),scaleY:Math.hypot(matrix.c,matrix.d)});}}/>
  </foreignObject>)}</g>;
}
