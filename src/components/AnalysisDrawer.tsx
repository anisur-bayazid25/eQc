import React, { useEffect, useRef, useState } from 'react';

/** Shared analysis inspector: resizable with pointer or keyboard, with retained content on collapse. */
export default function AnalysisDrawer({name,title,subtitle,onClose,children,storageKey='eqc-analysis-drawer-width',bodyClassName='analysis-two-column-editor',minWidth=600,maxWidth=1400,defaultWidth=820}:{name:string;title:string;subtitle?:string;onClose:()=>void;children:React.ReactNode;storageKey?:string;bodyClassName?:string;minWidth?:number;maxWidth?:number;defaultWidth?:number}) {
  const [collapsed,setCollapsed]=useState(false),[dragging,setDragging]=useState(false);
  const [width,setWidth]=useState(()=>{const width=Number(localStorage.getItem(storageKey));return width>=minWidth&&width<=maxWidth?width:defaultWidth;});
  const root=useRef<HTMLElement>(null);
  useEffect(()=>setCollapsed(false),[title]);
  useEffect(()=>{if(!dragging)return;const move=(e:PointerEvent)=>setWidth(Math.max(minWidth,Math.min(maxWidth,(root.current?.getBoundingClientRect().right??innerWidth)-e.clientX)));const stop=()=>setDragging(false);window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);};},[dragging,minWidth,maxWidth]);
  useEffect(()=>{if(!dragging)localStorage.setItem(storageKey,String(width));},[width,dragging,storageKey]);
  return <aside ref={root} className={`case-framework-drawer analysis-drawer${collapsed?' is-collapsed':''}${dragging?' is-resizing':''}`} aria-label={name} style={{width:collapsed?48:width}}>
    {!collapsed&&<div className="case-framework-resizer" role="separator" aria-label={'Resize '+name} aria-orientation="vertical" aria-valuemin={minWidth} aria-valuemax={maxWidth} aria-valuenow={width} tabIndex={0} onPointerDown={e=>{e.preventDefault();setDragging(true);}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setWidth(w=>Math.max(minWidth,Math.min(maxWidth,w+(e.key==='ArrowLeft'?24:-24))));}}}/>}
    <header className="case-framework-drawer-header"><div hidden={collapsed}><small>{subtitle||'ANALYSIS'}</small><h3>{title}</h3></div><div><button aria-label={(collapsed?'Expand ':'Collapse ')+name} title={collapsed?'Expand editor':'Collapse editor'} onClick={()=>setCollapsed(!collapsed)}>{collapsed?'‹':'›'}</button>{!collapsed&&<button aria-label={'Close '+name} title="Close editor" onClick={onClose}>×</button>}</div></header>
    <div className={'case-framework-drawer-body '+bodyClassName} hidden={collapsed}>{children}</div>
  </aside>;
}
