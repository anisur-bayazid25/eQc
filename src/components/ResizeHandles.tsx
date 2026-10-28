import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

type Rail={target:HTMLElement;axis:'horizontal'|'vertical';side:number;x:number;y:number;width:number;height:number;name:string;size:number;min:number;max:number};
/** Enhance native CSS resize surfaces without wrapping React-managed controls. */
export default function ResizeHandles() {
  const [rails,setRails]=useState<Rail[]>([]);
  const active=useRef<HTMLTextAreaElement|null>(null),panels=useRef<HTMLElement[]>([]),observer=useRef<ResizeObserver>();
  const refresh=useRef(()=>{}),gesture=useRef<{rail:Rail;x:number;y:number}|null>(null);
  function resize(rail:Rail,size:number){
    const style=getComputedStyle(rail.target),horizontal=rail.axis==='horizontal';
    const extra=style.boxSizing==='border-box'?0:horizontal?parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+parseFloat(style.borderLeftWidth)+parseFloat(style.borderRightWidth):parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);
    rail.target.style[horizontal?'width':'height']=Math.max(0,Math.max(rail.min,Math.min(rail.max,size))-extra)+'px';refresh.current();
  }
  useEffect(()=>{
    let frame=0;
    const measure=()=>{
      frame=0;
      const next:Rail[]=[];
      for(const target of [...panels.current,...(active.current?[active.current]:[])]){
        if(!target.isConnected||!target.getClientRects().length)continue;
        const style=getComputedStyle(target),axis=style.getPropertyValue('--manual-resize').trim();
        if(!['horizontal','vertical'].includes(axis)||target.style.resize==='none'||(target instanceof HTMLTextAreaElement&&target.disabled))continue;
        const box=target.getBoundingClientRect(),horizontal=axis==='horizontal',side=target.classList.contains('right-panel')?-1:1;
        const x=horizontal?(side===-1?box.left-5:box.right-5):box.left+box.width/2-34,y=horizontal?box.top+8:box.bottom-7,width=horizontal?10:68,height=horizontal?box.height-16:12;
        if(!box.width||height<=0||y<0||y>=innerHeight||x<0||x>=innerWidth)continue;
        const hit=document.elementsFromPoint(Math.min(innerWidth-1,x+(horizontal?(side===1?2:8):width/2)),Math.min(innerHeight-1,y+(horizontal?height/2:2))).find(el=>!el.closest('.custom-resize-handle'));
        if(hit&&!target.contains(hit))continue;
        const name=horizontal?(target.classList.contains('right-panel')?'Resize codes panel':'Resize sources panel'):'Resize '+(target.getAttribute('aria-label')||target.getAttribute('placeholder')?.slice(0,45)||'text area');
        next.push({target,axis:axis as Rail['axis'],side,x,y,width,height,name,size:horizontal?box.width:box.height,min:Math.max(horizontal?150:60,parseFloat(horizontal?style.minWidth:style.minHeight)||0),max:horizontal?innerWidth*.5:Math.max(300,innerHeight*1.5)});
      }
      setRails(old=>old.length===next.length&&old.every((r,i)=>Object.keys(r).every(k=>r[k as keyof Rail]===next[i][k as keyof Rail]))?old:next);
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};refresh.current=schedule;
    observer.current=new ResizeObserver(schedule);
    const scan=()=>{
      for(const old of panels.current)observer.current?.unobserve(old);
      panels.current=Array.from(document.querySelectorAll<HTMLElement>('.left-panel,.right-panel'));
      for(const panel of panels.current)observer.current?.observe(panel);
      schedule();
    };
    const find=(e:Event)=>{if(e.target instanceof HTMLTextAreaElement){if(active.current!==e.target){if(active.current)observer.current?.unobserve(active.current);active.current=e.target;observer.current?.observe(e.target);}schedule();}else if(e.type==='focusin'&&!(e.target as HTMLElement)?.closest('.custom-resize-handle')){if(active.current)observer.current?.unobserve(active.current);active.current=null;schedule();}};
    const click=()=>requestAnimationFrame(scan);
    scan();document.addEventListener('pointerover',find);document.addEventListener('focusin',find);document.addEventListener('click',click,true);window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);
    return()=>{cancelAnimationFrame(frame);observer.current?.disconnect();document.removeEventListener('pointerover',find);document.removeEventListener('focusin',find);document.removeEventListener('click',click,true);window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);refresh.current=()=>{};};
  },[]);
  return createPortal(<>{rails.map((rail,i)=><div key={i} className={'custom-resize-handle '+(rail.axis==='horizontal'?'resize-panel-edge':'resize-field-edge')} role="separator" tabIndex={0} aria-label={rail.name} aria-orientation={rail.axis==='horizontal'?'vertical':'horizontal'} aria-valuenow={Math.round(rail.size)} aria-valuemin={rail.min} aria-valuemax={Math.round(rail.max)} title="Drag to resize · Arrow keys for small adjustments" style={{left:rail.x,top:rail.y,width:rail.width,height:rail.height}}
    onPointerDown={e=>{e.preventDefault();e.stopPropagation();gesture.current={rail,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}}
    onPointerMove={e=>{const g=gesture.current;if(g)resize(g.rail,g.rail.size+(g.rail.axis==='horizontal'?(e.clientX-g.x)*g.rail.side:e.clientY-g.y));}}
    onPointerUp={()=>gesture.current=null} onPointerCancel={()=>gesture.current=null} onLostPointerCapture={()=>gesture.current=null}
    onKeyDown={e=>{const decrease=rail.axis==='horizontal'?'ArrowLeft':'ArrowUp',increase=rail.axis==='horizontal'?'ArrowRight':'ArrowDown';if(e.key===decrease||e.key===increase){e.preventDefault();e.stopPropagation();resize(rail,rail.size+(e.key===increase?1:-1)*(rail.axis==='horizontal'?rail.side:1)*(e.shiftKey?48:16));}}}
  />)}</>,document.body);
}
