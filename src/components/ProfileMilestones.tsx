import React, { useEffect, useRef, useState } from 'react';
import { MILESTONES, MilestoneAward } from '../lib/milestones';
import MilestoneArtwork from './MilestoneArtwork';

export default function ProfileMilestones({awards,onSeen}:{awards:MilestoneAward[];onSeen:(id:string)=>void}) {
  const [queue,setQueue]=useState<string[]>([]),[replay,setReplay]=useState<string|null>(null);
  const scheduled=useRef(new Set<string>()),shown=useRef(new Set<string>()),dialog=useRef<HTMLDivElement>(null),previousFocus=useRef<HTMLElement|null>(null);
  const seenCallback=useRef(onSeen);seenCallback.current=onSeen;
  useEffect(()=>{const pending=awards.filter(a=>!a.seenAt && !scheduled.current.has(a.id));if(pending.length){pending.forEach(a=>scheduled.current.add(a.id));setQueue(q=>[...q,...pending.map(a=>a.id)]);}},[awards]);
  const activeId=replay||queue[0],active=MILESTONES.find(m=>m.id===activeId);
  const dismiss=()=>{if(replay)setReplay(null);else setQueue(q=>q.slice(1));};
  useEffect(()=>{
    if(!activeId)return;
    if(!shown.current.has(activeId)){shown.current.add(activeId);seenCallback.current(activeId);}
    const timer=window.setTimeout(()=>{if(replay)setReplay(null);else setQueue(q=>q[0]===activeId?q.slice(1):q);},10000);
    return()=>clearTimeout(timer);
  },[activeId,replay]);
  const visible=!!active;
  useEffect(()=>{if(!visible)return;previousFocus.current=document.activeElement as HTMLElement;dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>previousFocus.current?.focus();},[visible]);
  if(!awards.length)return null;
  return <><section className="milestone-collection" aria-labelledby="milestone-title"><h3 id="milestone-title">Milestones</h3><p>Your earned companions. Choose a badge to replay its celebration.</p><div className="milestone-badges">{MILESTONES.filter(m=>awards.some(a=>a.id===m.id)).map(m=><button className="milestone-badge" key={m.id} onClick={()=>setReplay(m.id)} aria-label={`Replay ${m.title}`}><MilestoneArtwork character={m.character}/><strong>{m.title}</strong><span>{m.requirement}</span><small>{m.character}</small></button>)}</div></section>
  {active&&<div className="milestone-overlay" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setQueue([]);setReplay(null);}if(e.key==='Tab'){const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('button');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}><div ref={dialog} className="milestone-celebration" role="dialog" aria-modal="true" aria-labelledby="celebration-title"><MilestoneArtwork key={active.id} character={active.character} animate/><small>{active.character} · {active.requirement}</small><h2 id="celebration-title">{active.title}</h2><p>“{active.quote}”</p><div className="research-actions"><button onClick={dismiss}>{!replay&&queue.length>1?'Next celebration':'Close'}</button>{!replay&&queue.length>1&&<button onClick={()=>setQueue([])}>View remaining later</button>}</div></div></div>}</>;
}
