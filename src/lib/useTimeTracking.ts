import { useEffect, useRef, useState } from 'react';
import { defaultProfile, LocalProfile, TimeRow, TimeTracker } from './timeTracking';
import { parseProfileBackup, ProfileBackup } from './profileStore';
import { ProfileSnapshot, ProfileWrite, profileRepository, readLegacyProfiles } from './profileRepository';
import { mergeAwards, MILESTONES, MilestoneAward } from './milestones';

function mergedRows(base:TimeRow[],live:TimeRow[]):TimeRow[] {
  const rows=new Map(base.map(r=>[JSON.stringify([r.day,r.projectId]),{...r}]));
  for(const r of live){const key=JSON.stringify([r.day,r.projectId]),prior=rows.get(key);if(!prior){rows.set(key,{...r});continue;}prior.appMs+=r.appMs;prior.codingMs+=r.codingMs;prior.projectName=r.projectName;if(r.firstCoding!==undefined)prior.firstCoding=Math.min(prior.firstCoding??Infinity,r.firstCoding);if(r.lastCoding!==undefined)prior.lastCoding=Math.max(prior.lastCoding??0,r.lastCoding);}
  return [...rows.values()];
}
const fingerprint=(r:ProfileWrite['records'][number])=>[r.end,r.appMs,r.codingMs,r.lastCoding,r.projectName].join('|');
export function useTimeTracking(project:{id:string;name:string}|null,visible=false) {
  const repository=useRef<ReturnType<typeof profileRepository>>();if(!repository.current)repository.current=profileRepository();
  const projectRef=useRef(project);projectRef.current=project;
  const visibleRef=useRef(visible);visibleRef.current=visible;
  const current=useRef<{meta:ProfileSnapshot['profile'];profiles:ProfileSnapshot['profiles'];base:TimeRow[];engine:TimeTracker;fingerprints:Map<string,string>;dirtyDetails:boolean;savedPhoto:string}>();
  const ready=useRef(false),mounted=useRef(true),queue=useRef<Promise<unknown>>(Promise.resolve()),boot=useRef<Promise<void>>();
  const errorRef=useRef(''),busyRef=useRef(false);
  const [state,setState]=useState({profile:{...defaultProfile},profileId:'',profiles:[] as ProfileSnapshot['profiles'],rows:[] as TimeRow[],milestones:[] as MilestoneAward[],status:'Loading',error:'',ready:false,busy:false});
  function publish(){if(!mounted.current)return;const c=current.current;if(!c){setState(s=>({...s,error:errorRef.current}));return;}setState({profile:{...c.meta.details},profileId:c.meta.id,profiles:c.profiles,rows:visibleRef.current?mergedRows(c.base,c.engine.rows):[],milestones:c.meta.milestones||[],status:c.engine.status(Date.now()),error:errorRef.current,ready:ready.current,busy:busyRef.current});}
  function report(error:unknown){errorRef.current=`Profile/time records could not be saved or loaded: ${error instanceof Error?error.message:String(error)}. Your existing records have not been discarded.`;publish();}
  function enqueue<T>(job:()=>Promise<T>):Promise<T>{const result=queue.current.then(job);queue.current=result.catch(report);return result;}
  function apply(snapshot:ProfileSnapshot){const t=new TimeTracker([],Date.now());t.paused=snapshot.profile.details.paused;t.switchProject(projectRef.current?.id||'',projectRef.current?.name||'No project',Date.now());t.setForeground(document.visibilityState==='visible'&&document.hasFocus(),Date.now());current.current={meta:snapshot.profile,profiles:snapshot.profiles,base:snapshot.rows,engine:t,fingerprints:new Map(),dirtyDetails:false,savedPhoto:snapshot.profile.details.photo};ready.current=true;errorRef.current='';publish();}
  function payload():{c:NonNullable<typeof current.current>;value:ProfileWrite}|null {
    const c=current.current;if(!c||!ready.current)return null;c.engine.flush(Date.now());
    const records=c.engine.records.filter(r=>c.fingerprints.get(r.id)!==fingerprint(r)).map(r=>({...r}));
    const {photo,...fields}=c.meta.details;
    return {c,value:{profileId:c.meta.id,records,...(c.dirtyDetails?{details:{...fields,...(photo!==c.savedPhoto?{photo}:{})},updatedAt:c.meta.updatedAt}:{})}};
  }
  function save(force=false,seenId?:string,unlockAll=false):Promise<void>{const pending=payload();if(!pending)return Promise.resolve();const {c,value}=pending;if(seenId)value.seenId=seenId;if(unlockAll)value.unlockAll=true;if(force)value.checkMilestones=true;
    if(!value.records.length&&!value.details&&!seenId&&!unlockAll&&!value.checkMilestones){if(force||visibleRef.current)publish();return Promise.resolve();}
    value.records.forEach(r=>c.fingerprints.set(r.id,fingerprint(r)));if(value.details)c.dirtyDetails=false;
    if(force||visibleRef.current)publish();
    return enqueue(async()=>{try{const result=await repository.current!.bridge.write(value);c.engine.acknowledgeRecords(value.records);if(value.details?.photo!==undefined)c.savedPhoto=value.details.photo;const kept=new Set(c.engine.records.map(r=>r.id));for(const id of c.fingerprints.keys())if(!kept.has(id))c.fingerprints.delete(id);
      c.meta.lastWorkedAt=Math.max(c.meta.lastWorkedAt,result.lastWorkedAt);c.profiles=c.profiles.map(p=>p.id===c.meta.id?{...p,lastWorkedAt:c.meta.lastWorkedAt}:p);
      const merged=mergeAwards(c.meta.milestones,result.milestones);const awardsChanged=JSON.stringify(c.meta.milestones)!==JSON.stringify(merged);c.meta.milestones=merged;
      if(current.current===c){errorRef.current='';if(force||visibleRef.current||awardsChanged)publish();}
    }catch(error){for(const r of value.records)if(c.fingerprints.get(r.id)===fingerprint(r))c.fingerprints.delete(r.id);if(value.details)c.dirtyDetails=true;throw error;}});
  }
  async function start(){const repo=repository.current!,migrated=repo.sqlite&&localStorage.getItem('eqc-profile-sqlite-migrated')==='1';const legacy=migrated?null:readLegacyProfiles();const snapshot=await repo.bridge.open(legacy);if(repo.sqlite){try{localStorage.setItem('eqc-profile-sqlite-migrated','1');for(const key of ['eqc-profiles-v2','eqc-local-profile-v1','eqc-local-time-v1'])localStorage.removeItem(key);}catch{/* SQLite is authoritative even if browser preference cleanup fails. */}}apply(snapshot);}
  useEffect(()=>{mounted.current=true;boot.current=enqueue(start);return()=>{mounted.current=false;};},[]);
  useEffect(()=>{const c=current.current;if(c){c.engine.switchProject(project?.id||'',project?.name||'No project',Date.now());void save().catch(()=>{});}},[project?.id,project?.name]);
  useEffect(()=>{if(visible)publish();},[visible]);
  useEffect(()=>repository.current!.bridge.onPrepareClose?.(()=>{
    void (async()=>{try{if(ready.current){current.current?.engine.setForeground(false,Date.now());await save();await queue.current;if(errorRef.current)throw new Error(errorRef.current);}repository.current!.bridge.completeClose?.({ok:true});}catch(error){repository.current!.bridge.completeClose?.({ok:false,message:error instanceof Error?error.message:String(error)});}})();
  }),[]);
  useEffect(()=>{
    const activity=()=>current.current?.engine.activity(Date.now());
    const focus=()=>{current.current?.engine.setForeground(document.visibilityState==='visible'&&document.hasFocus(),Date.now());void save().catch(()=>{});};
    const tick=()=>{void save().catch(()=>{});};
    const leave=()=>{const pending=payload();if(pending&&(pending.value.records.length||pending.value.details))repository.current!.bridge.flushOnExit(pending.value);};
    const timer=setInterval(tick,5000);for(const event of ['pointerdown','keydown','wheel'])document.addEventListener(event,activity,{passive:true});
    window.addEventListener('focus',focus);window.addEventListener('blur',focus);document.addEventListener('visibilitychange',focus);window.addEventListener('pagehide',leave);window.addEventListener('beforeunload',leave);
    return()=>{clearInterval(timer);leave();for(const event of ['pointerdown','keydown','wheel'])document.removeEventListener(event,activity);window.removeEventListener('focus',focus);window.removeEventListener('blur',focus);document.removeEventListener('visibilitychange',focus);window.removeEventListener('pagehide',leave);window.removeEventListener('beforeunload',leave);};
  },[]);
  const setProfile=(next:LocalProfile)=>{const c=current.current;if(!c||busyRef.current)return;c.engine.setPaused(next.paused,Date.now());c.meta.details=next;c.meta.updatedAt=Math.max(Date.now(),c.meta.updatedAt+1);c.dirtyDetails=true;c.profiles=c.profiles.map(p=>p.id===c.meta.id?{...p,name:next.name,email:next.email}:p);publish();void save().catch(()=>{});};
  const markCoding=()=>{if(!current.current||busyRef.current)return;current.current.engine.markCoding(Date.now());void save().catch(()=>{});};
  const markMilestoneSeen=(id:string)=>{void save(false,id).catch(()=>{});};
  const unlockMilestones=()=>{const c=current.current;if(!c)return;const now=Date.now();c.meta.milestones=mergeAwards(c.meta.milestones,MILESTONES.map(m=>({id:m.id,earnedAt:now,seenAt:now})));publish();void save(true,undefined,true).catch(()=>{});};
  const refresh=()=>save(true);
  async function transition(job:()=>Promise<ProfileSnapshot>){if(busyRef.current)return;busyRef.current=true;current.current?.engine.setForeground(false,Date.now());publish();try{await save();const snapshot=await enqueue(job);apply(snapshot);}catch(error){report(error);}finally{busyRef.current=false;publish();}}
  const selectProfile=(id:string)=>{if(id!==current.current?.meta.id)void transition(()=>repository.current!.bridge.select(id));};
  const addProfile=()=>{void transition(()=>repository.current!.bridge.create());};
  const deleteProfile=()=>{const id=current.current?.meta.id;if(id)void transition(()=>repository.current!.bridge.delete(id));};
  const exportProfile=async():Promise<ProfileBackup>=>{await boot.current;await save();const id=current.current!.meta.id;return enqueue(()=>repository.current!.bridge.backup(id));};
  const validateProfileImport=async(value:unknown)=>{const b=parseProfileBackup(value);await boot.current;return enqueue(()=>repository.current!.bridge.validate(b));};
  const importProfile=async(value:unknown)=>{const b=parseProfileBackup(value);await boot.current;busyRef.current=true;publish();try{await save();const result=await enqueue(()=>repository.current!.bridge.import(b));apply(result.snapshot);return result.added;}finally{busyRef.current=false;publish();}};
  const retry=()=>{if(!ready.current)boot.current=enqueue(start);else void save(true).catch(()=>{});};
  return {...state,setProfile,markCoding,markMilestoneSeen,unlockMilestones,refresh,selectProfile,addProfile,deleteProfile,exportProfile,importProfile,validateProfileImport,retry};
}
