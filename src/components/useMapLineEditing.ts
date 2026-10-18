import {useEffect,useRef,useState} from 'react';
import type {MouseEvent as ReactMouseEvent} from 'react';
export type LinePoints={start:{x:number;y:number};end:{x:number;y:number}};
export function moveLine(points:LinePoints,part:'start'|'end'|'line',dx:number,dy:number,width:number,height:number):LinePoints{
 const clamp=(n:number,max:number)=>Math.max(0,Math.min(max,n));
 if(part==='line'){
  dx=Math.max(-Math.min(points.start.x,points.end.x),Math.min(width-Math.max(points.start.x,points.end.x),dx));
  dy=Math.max(-Math.min(points.start.y,points.end.y),Math.min(height-Math.max(points.start.y,points.end.y),dy));
 }
 const move=(p:{x:number;y:number})=>({x:clamp(p.x+dx,width),y:clamp(p.y+dy,height)});
 return {start:part==='end'?points.start:move(points.start),end:part==='start'?points.end:move(points.end)};
}
export function useMapLineEditing(zoom:number,width:number,height:number,onCommit:(key:string,points:LinePoints)=>void){
 const [drag,setDrag]=useState<{key:string;points:LinePoints;part:'start'|'end'|'line';x:number;y:number}|null>(null);
 const [live,setLive]=useState<({key:string}&LinePoints)|null>(null),latest=useRef({zoom,width,height,onCommit}),pending=useRef<typeof live>(null);
 latest.current={zoom,width,height,onCommit};
 useEffect(()=>{if(!drag)return;
  const move=(event:MouseEvent)=>{const {zoom,width,height}=latest.current;pending.current={key:drag.key,...moveLine(drag.points,drag.part,(event.clientX-drag.x)/zoom,(event.clientY-drag.y)/zoom,width,height)};setLive(pending.current);};
  const up=()=>{if(pending.current)latest.current.onCommit(drag.key,pending.current);pending.current=null;setLive(null);setDrag(null);};
  window.addEventListener('mousemove',move);window.addEventListener('mouseup',up);return()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up);};
 },[drag]);
 return {live,begin:(event:ReactMouseEvent,key:string,points:LinePoints,part:'start'|'end'|'line')=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();pending.current=null;setDrag({key,points,part,x:event.clientX,y:event.clientY});}};
}
