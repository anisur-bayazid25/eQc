import React,{useEffect,useRef,useState} from 'react';
import type {Announcement,Project} from '../domain';
import type {LanSessionState} from '../global';

export default function AnnouncementCenter({project,session,profileId,onDeleteSaved}:{project:Project;session:LanSessionState|null;profileId:string;onDeleteSaved:(id:string)=>void}){
 const records=(session?.announcements||project.announcements||[]).filter(a=>a&&typeof a.id==='string'&&typeof a.text==='string'&&typeof a.createdAt==='number'&&Number.isFinite(new Date(a.createdAt).getTime()));
 const context=profileId+':'+(session?.projectId||project.id),readKey='eqc-announcements-read:'+context;
 const [open,setOpen]=useState(false),[read,setRead]=useState<{key:string;ids:string[]}>({key:'',ids:[]}),[text,setText]=useState(''),[retention,setRetention]=useState<'project'|'session'>('session'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [notices,setNotices]=useState<Array<{entry:Announcement;expires:number}>>([]),seen=useRef<{key:string;ids:Set<string>}>({key:'',ids:new Set()}),root=useRef<HTMLDivElement>(null);
 let stored:string[]=[];try{const value=JSON.parse(localStorage.getItem(readKey)||'[]');if(Array.isArray(value))stored=value.filter(v=>typeof v==='string');}catch{}
 const readIds=read.key===context?read.ids:stored,unread=records.filter(a=>!readIds.includes(a.id));
 const ids=records.map(a=>a.id).join('|');
 const markRead=()=>{const ids=records.map(a=>a.id);setRead({key:context,ids});try{localStorage.setItem(readKey,JSON.stringify(ids));}catch{}};
 useEffect(()=>{
  const changed=seen.current.key!==context,old=changed?new Set<string>():seen.current.ids;
  const additions=records.filter(a=>!old.has(a.id)&&!readIds.includes(a.id));
  seen.current={key:context,ids:new Set(records.map(a=>a.id))};
  setNotices(previous=>[...(changed?[]:previous).filter(n=>records.some(a=>a.id===n.entry.id)),...((!changed||session)&&!open?additions.map(entry=>({entry,expires:Date.now()+30000})):[])].slice(-3));
  if(changed){setOpen(false);setText('');setError('');}
  if(open)markRead();
  // IDs/context determine delivery; ordinary presence refreshes do not repeat notices.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[context,ids]);
 useEffect(()=>{if(!notices.length)return;const timer=setTimeout(()=>setNotices(current=>current.filter(n=>n.expires>Date.now())),Math.max(0,Math.min(...notices.map(n=>n.expires))-Date.now()));return()=>clearTimeout(timer);},[notices]);
 useEffect(()=>{if(!open)return;const outside=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);},key=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};document.addEventListener('mousedown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('mousedown',outside);document.removeEventListener('keydown',key);};},[open]);
 const canPost=!!session&&(session.role==='host'||!!session.canAnnounce),self=session?.sessionId+':'+session?.selfClientId;
 const canDelete=(entry:Announcement)=>!session||session.role==='host'||(canPost&&entry.authorId===self);
 async function post(event:React.FormEvent){event.preventDefault();if(!canPost||!text.trim()||busy)return;setBusy(true);setError('');try{if(!window.qv.lan.postAnnouncement)throw Error('Restart eQc to enable announcements.');const result=await window.qv.lan.postAnnouncement({text:text.trim(),retention});if(!result.ok)throw Error(result.error||'Unable to post announcement.');setText('');}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 async function remove(entry:Announcement){if(busy)return;setBusy(true);setError('');try{if(session){if(!window.qv.lan.deleteAnnouncement)throw Error('Restart eQc to enable announcements.');const result=await window.qv.lan.deleteAnnouncement(entry.id);if(!result.ok)throw Error(result.error||'Unable to delete announcement.');}else onDeleteSaved(entry.id);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 return <div className="announcement-center" ref={root}>
  <button className={'announcement-button'+(unread.length?' has-unread':'')} aria-label={'Announcements'+(unread.length?', '+unread.length+' unread':'')} title="Announcements" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{if(!open){markRead();setNotices([]);}setOpen(value=>!value);}}>📣{unread.length>0&&<span className="announcement-badge">{unread.length>99?'99+':unread.length}</span>}</button>
  {open&&<section className="announcement-panel" role="dialog" aria-label="Announcements"><header><strong>Announcements</strong><button aria-label="Close announcements" onClick={()=>setOpen(false)}>✕</button></header>
   {session?<p>LAN session · {session.hostName||session.myName}</p>:<p>Saved with {project.name}. Join or host a LAN session to post.</p>}
   {canPost?<form onSubmit={post}><label>Announcement<textarea aria-label="Announcement text" value={text} maxLength={2000} rows={3} onChange={e=>setText(e.target.value)} placeholder="Information for the team…"/></label><label>Keep this announcement<select aria-label="Announcement storage" value={retention} onChange={e=>setRetention(e.target.value as typeof retention)}><option value="session">This LAN session only</option><option value="project">Save with project</option></select></label><small>{text.length}/2000 · Session-only announcements disappear when the session ends.</small><button className="primary-btn" disabled={busy||!text.trim()} type="submit">Post announcement</button></form>:session&&<p>The host can allow you to post from the LAN participant list.</p>}
   {error&&<p role="alert">{error}</p>}
   <div className="announcement-list">{[...records].sort((a,b)=>b.createdAt-a.createdAt).map(entry=><article key={entry.id} data-announcement-id={entry.id}><div className="announcement-meta"><strong>{entry.authorName}</strong><span>{entry.retention==='project'?'Saved with project':'Session only'}</span></div><p>{entry.text}</p><footer><time dateTime={new Date(entry.createdAt).toISOString()}>{new Date(entry.createdAt).toLocaleString()}</time>{canDelete(entry)&&<button disabled={busy} aria-label={'Delete announcement '+entry.id} onClick={()=>void remove(entry)}>Delete</button>}</footer></article>)}{!records.length&&<p>No announcements yet.</p>}</div>
  </section>}
  {!open&&notices.length>0&&<div className="announcement-notices" aria-live="polite" aria-label="New announcements">{notices.map(({entry})=><article key={entry.id} data-announcement-toast={entry.id}><header><strong>{entry.authorName} · Announcement</strong><button aria-label={'Dismiss announcement '+entry.id} onClick={()=>setNotices(current=>current.filter(n=>n.entry.id!==entry.id))}>✕</button></header><p>{entry.text}</p><small>{entry.retention==='project'?'Saved with project':'This session only'}</small><button onClick={()=>{markRead();setNotices([]);setOpen(true);}}>View announcements</button></article>)}</div>}
 </div>;
}
