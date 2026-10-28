import {useAnalysisActive} from '../lib/analysisActivity';
import React, { useEffect, useId, useRef, useState } from 'react';

type Item={id:string;name:string};
export default function MatrixViewport({label,rows,columns,onRowJump,children,className=''}:{label:string;rows:Item[];columns:Item[];onRowJump?:(id:string)=>void;children:React.ReactNode;className?:string}) {
  const active=useAnalysisActive();
  const root=useRef<HTMLDivElement>(null),scroll=useRef<HTMLDivElement>(null),id=useId();
  const [expanded,setExpanded]=useState(false),[compact,setCompact]=useState(false),[pan,setPan]=useState(false);
  const [row,setRow]=useState(''),[column,setColumn]=useState(''),[pending,setPending]=useState<{kind:'row'|'column';id:string}|null>(null);
  const [availableHeight,setAvailableHeight]=useState(420);
  const gesture=useRef<{x:number;y:number;left:number;top:number}|null>(null),space=useRef(false),suppressClick=useRef(false);
  useEffect(()=>{
    if(!active)return;
    let frame=0;
    const measure=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(scroll.current)setAvailableHeight(Math.max(180,window.innerHeight-scroll.current.getBoundingClientRect().top-44));});};
    const observer=new ResizeObserver(measure);if(root.current)observer.observe(root.current);
    window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);measure();
    return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
  },[expanded,active]);
  useEffect(()=>{if(!expanded||!active)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setExpanded(false);e.stopPropagation();}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[expanded,active]);
  useEffect(()=>{if(!pending||!active)return;const frame=requestAnimationFrame(()=>{
    const target=Array.from(scroll.current?.querySelectorAll<HTMLElement>(pending.kind==='row'?'[data-matrix-row]':'[data-matrix-column]')||[]).find(el=>(pending.kind==='row'?el.dataset.matrixRow:el.dataset.matrixColumn)===pending.id);
    if(target&&scroll.current){const box=target.getBoundingClientRect(),container=scroll.current.getBoundingClientRect();scroll.current.scrollBy({left:pending.kind==='column'?box.left-container.left-180:0,top:pending.kind==='row'?box.top-container.top-90:0,behavior:'smooth'});setPending(null);}
  });return()=>cancelAnimationFrame(frame);},[pending,children,active]);
  function jump(kind:'row'|'column') {const query=(kind==='row'?row:column).toLocaleLowerCase(),items=kind==='row'?rows:columns;const item=items.find(i=>i.name.toLocaleLowerCase()===query||i.id===query)||items.find(i=>i.name.toLocaleLowerCase().includes(query));if(!query||!item)return;if(kind==='row')onRowJump?.(item.id);setPending({kind,id:item.id});}
  function move(x:number,y:number){scroll.current?.scrollBy({left:x*(scroll.current.clientWidth*.75),top:y*(scroll.current.clientHeight*.75),behavior:'smooth'});}
  return <div ref={root} className={`analysis-matrix-viewport${expanded?' is-expanded':''}${compact?' is-compact':''} ${className}`}>
    <div className="matrix-navigation" aria-label={label+' navigation'}>
      <div className="matrix-jump"><input aria-label={'Find row in '+label} list={id+'-rows'} value={row} placeholder="Find row…" onChange={e=>setRow(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')jump('row');}}/><datalist id={id+'-rows'}>{rows.map(r=><option key={r.id} value={r.name}/>)}</datalist><button onClick={()=>jump('row')} title="Jump to row">Go</button></div>
      <div className="matrix-jump"><input aria-label={'Find column in '+label} list={id+'-columns'} value={column} placeholder="Find column…" onChange={e=>setColumn(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')jump('column');}}/><datalist id={id+'-columns'}>{columns.map(c=><option key={c.id} value={c.name}/>)}</datalist><button onClick={()=>jump('column')} title="Jump to column">Go</button></div>
      <button aria-pressed={pan} onClick={()=>setPan(!pan)} title="Drag the matrix to pan; turn off to select cells">Pan</button><button aria-pressed={compact} onClick={()=>setCompact(!compact)}>Compact</button><button aria-label={(expanded?'Restore ':'Expand ')+label} onClick={()=>setExpanded(!expanded)}>{expanded?'Restore':'Expand'}</button>
    </div>
    <div className={`matrix-wrap matrix-viewport-scroll${pan?' pan-enabled':''}`} style={expanded?undefined:{maxHeight:availableHeight}} ref={scroll} role="region" aria-label={label} tabIndex={0}
      onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key===' '){space.current=true;e.preventDefault();}const directions:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],PageDown:[0,1],PageUp:[0,-1]};if(directions[e.key]){e.preventDefault();move(...directions[e.key]);}}}
      onKeyUp={e=>{if(e.key===' ')space.current=false;}} onBlur={()=>space.current=false}
      onPointerDownCapture={e=>{if(!(pan||space.current||e.button===1)||![0,1].includes(e.button)){suppressClick.current=false;return;}e.preventDefault();suppressClick.current=true;gesture.current={x:e.clientX,y:e.clientY,left:e.currentTarget.scrollLeft,top:e.currentTarget.scrollTop};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{if(!gesture.current)return;e.currentTarget.scrollLeft=gesture.current.left+gesture.current.x-e.clientX;e.currentTarget.scrollTop=gesture.current.top+gesture.current.y-e.clientY;}}
      onPointerUp={()=>gesture.current=null} onPointerCancel={()=>gesture.current=null}
      onClickCapture={e=>{if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false;}}}>
      {children}
    </div><p className="matrix-navigation-hint">Frozen labels · Arrow keys to navigate · Shift + wheel to scroll sideways · Pan to drag</p>
  </div>;
}
