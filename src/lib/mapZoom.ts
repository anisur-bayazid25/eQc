import {RefObject,useEffect,useLayoutEffect,useRef} from 'react';

export function useMapZoom(viewportRef:RefObject<HTMLDivElement>,svgRef:RefObject<SVGSVGElement>,zoom:number,setZoom:(zoom:number)=>void,onFit:()=>void,enabled=true) {
  const latest=useRef({zoom,setZoom,onFit});latest.current={zoom,setZoom,onFit};
  const anchor=useRef<{x:number;y:number;worldX:number;worldY:number}|null>(null);
  useLayoutEffect(()=>{
    const point=anchor.current,viewport=viewportRef.current,svg=svgRef.current;
    if(!point||!viewport||!svg)return;
    anchor.current=null;
    const rect=svg.getBoundingClientRect(),view=viewport.getBoundingClientRect();
    viewport.scrollLeft+=rect.left-view.left+point.worldX*zoom-point.x;
    viewport.scrollTop+=rect.top-view.top+point.worldY*zoom-point.y;
  },[zoom,viewportRef,svgRef]);
  useEffect(()=>{
    const viewport=viewportRef.current;if(!viewport||!enabled)return;
    const change=(factor:number,clientX:number,clientY:number)=>{
      const svg=svgRef.current;if(!svg)return;
      const current=latest.current.zoom,next=Math.max(.1,Math.min(4,current*factor));if(next===current)return;
      const rect=svg.getBoundingClientRect(),view=viewport.getBoundingClientRect();
      anchor.current={x:clientX-view.left,y:clientY-view.top,worldX:(clientX-rect.left)/current,worldY:(clientY-rect.top)/current};
      latest.current.setZoom(next);
    };
    const wheel=(event:WheelEvent)=>{
      if(event.defaultPrevented||!event.deltaY)return;
      if(event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
      event.preventDefault();event.stopPropagation();
      const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?viewport.clientHeight:1);
      change(Math.exp(-Math.max(-240,Math.min(240,delta))*.0015),event.clientX,event.clientY);
    };
    const key=(event:KeyboardEvent)=>{
      if(event.defaultPrevented||event.isComposing||!(event.ctrlKey||event.metaKey)||event.altKey)return;
      const target=event.target;
      if(target instanceof Element&&target.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(document.querySelector('[role="dialog"]'))return;
      const plus=event.key==='+'||event.key==='='||event.code==='NumpadAdd';
      const minus=event.key==='-'||event.key==='_'||event.code==='NumpadSubtract';
      if(!plus&&!minus&&event.key!=='0')return;
      event.preventDefault();
      if(event.key==='0'){anchor.current=null;latest.current.onFit();return;}
      const rect=viewport.getBoundingClientRect();change(plus?1.2:1/1.2,rect.left+viewport.clientWidth/2,rect.top+viewport.clientHeight/2);
    };
    viewport.addEventListener('wheel',wheel,{passive:false});window.addEventListener('keydown',key);
    return()=>{viewport.removeEventListener('wheel',wheel);window.removeEventListener('keydown',key);anchor.current=null;};
  },[viewportRef,svgRef,enabled]);
}
