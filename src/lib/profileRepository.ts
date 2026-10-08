import { defaultProfile, TimeRecord, TimeRow, TimeTracker } from './timeTracking';
import { mergeProfile, newProfile, parseProfileBackup, ProfileBackup, ProfileStore, StoredProfile } from './profileStore';
import { awardMilestones, mergeAwards, MILESTONES, MilestoneAward } from './milestones';
export type ProfileSnapshot={profile:Omit<StoredProfile,'records'>;profiles:Array<{id:string;name:string;email:string;lastWorkedAt:number}>;rows:TimeRow[]};
export type ProfileWrite={profileId:string;records:TimeRecord[];details?:Omit<StoredProfile['details'],'photo'>&{photo?:string};updatedAt?:number;seenId?:string;unlockAll?:boolean;checkMilestones?:boolean};
export interface ProfileRepositoryBridge {
  open(legacy?:ProfileStore|null):Promise<ProfileSnapshot>;
  write(payload:ProfileWrite):Promise<{milestones:MilestoneAward[];lastWorkedAt:number}>;
  select(id:string):Promise<ProfileSnapshot>;create():Promise<ProfileSnapshot>;delete(id:string):Promise<ProfileSnapshot>;
  backup(id:string):Promise<ProfileBackup>;validate(backup:ProfileBackup):Promise<boolean>;
  import(backup:ProfileBackup):Promise<{added:boolean;snapshot:ProfileSnapshot}>;
  flushOnExit(payload:ProfileWrite):void;
  onPrepareClose?(callback:()=>void):()=>void;
  completeClose?(result:{ok:boolean;message?:string}):void;
}
const STORE='eqc-profiles-v2';
function read<T>(key:string,fallback:T):T {const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}
export function readLegacyProfiles():ProfileStore|null {
  const saved=read<ProfileStore|null>(STORE,null);
  if(saved!==null && (saved.version!==2||!Array.isArray(saved.profiles)||!saved.profiles.length))throw new Error('The saved profile registry is invalid. It has been retained for recovery.');
  if(saved?.version===2&&Array.isArray(saved.profiles)&&saved.profiles.length){const profiles=saved.profiles.map(p=>parseProfileBackup({version:1,profile:p}).profile);return {version:2,profiles,activeId:profiles.some(p=>p.id===saved.activeId)?saved.activeId:profiles[0].id};}
  if(!localStorage.getItem('eqc-local-profile-v1')&&!localStorage.getItem('eqc-local-time-v1'))return null;
  const p=newProfile();p.details={...defaultProfile,...read('eqc-local-profile-v1',defaultProfile)};
  const rows=read<TimeRow[]>('eqc-local-time-v1',[]);if(!Array.isArray(rows))throw new Error('The saved profile time history is invalid.');
  p.records=new TimeTracker(rows,Date.now()).records;p.lastWorkedAt=p.records.reduce((n,r)=>Math.max(n,r.end),0);
  return {version:2,activeId:p.id,profiles:[p]};
}
export function profileRepository():{bridge:ProfileRepositoryBridge;sqlite:boolean} {
  if(typeof window.qv?.profileTime?.open==='function')return {bridge:window.qv.profileTime,sqlite:true};
  if(navigator.userAgent.includes('Electron/')){
    const unavailable=async()=>{throw new Error('Close and reopen eQc to activate SQLite profile storage.');};
    return {bridge:{open:unavailable,write:unavailable,select:unavailable,create:unavailable,delete:unavailable,backup:unavailable,validate:unavailable,import:unavailable,flushOnExit(){}},sqlite:true};
  }
  // Browser-only preview/test adapter. Desktop always uses the SQLite bridge;
  // database errors never silently downgrade to localStorage.
  let store:ProfileStore;
  const active=()=>store.profiles.find(p=>p.id===store.activeId)!;
  const persist=()=>localStorage.setItem(STORE,JSON.stringify(store));
  const snapshot=():ProfileSnapshot=>{const {records,...profile}=active();return {profile,profiles:store.profiles.map(p=>({id:p.id,name:p.details.name,email:p.details.email,lastWorkedAt:p.lastWorkedAt})),rows:new TimeTracker([],Date.now(),records).rows};};
  const bridge:ProfileRepositoryBridge={
    async open(legacy){const p=newProfile();store=legacy||{version:2,activeId:p.id,profiles:[p]};active().milestones=awardMilestones(active().records,active().milestones);persist();return snapshot();},
    async write(payload){const p=store.profiles.find(p=>p.id===payload.profileId);if(!p)throw new Error('Profile not found.');const incoming={...p,records:payload.records,details:payload.details?{...p.details,...payload.details}:p.details,updatedAt:payload.updatedAt||p.updatedAt};store=mergeProfile(store,{version:1,exportedAt:Date.now(),profile:incoming}).store;if(payload.seenId)p.milestones=p.milestones?.map(a=>a.id===payload.seenId?{...a,seenAt:a.seenAt||Date.now()}:a);const updated=store.profiles.find(p=>p.id===payload.profileId)!;if(payload.seenId)updated.milestones=updated.milestones?.map(a=>a.id===payload.seenId?{...a,seenAt:a.seenAt||Date.now()}:a);if(payload.unlockAll)updated.milestones=mergeAwards(updated.milestones,MILESTONES.map(m=>({id:m.id,earnedAt:Date.now(),seenAt:Date.now()})));persist();return {milestones:updated.milestones||[],lastWorkedAt:updated.lastWorkedAt};},
    async select(id){store.activeId=id;active().milestones=awardMilestones(active().records,active().milestones);persist();return snapshot();},
    async create(){const p=newProfile();store.profiles.push(p);store.activeId=p.id;persist();return snapshot();},
    async delete(id){store.profiles=store.profiles.filter(p=>p.id!==id);if(!store.profiles.length)store.profiles.push(newProfile());store.activeId=store.profiles[0].id;persist();return snapshot();},
    async backup(id){return {version:1,exportedAt:Date.now(),profile:structuredClone(store.profiles.find(p=>p.id===id)!)};},
    async validate(b){mergeProfile(store,parseProfileBackup(b));return true;},
    async import(b){const merged=mergeProfile(store,parseProfileBackup(b));store=merged.store;persist();return {added:merged.added,snapshot:snapshot()};},
    flushOnExit(payload){void bridge.write(payload);},
  };
  return {bridge,sqlite:false};
}
