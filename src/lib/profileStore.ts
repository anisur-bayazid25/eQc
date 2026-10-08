import { defaultProfile, LocalProfile, TimeRecord } from './timeTracking';
import { awardMilestones, mergeAwards, MilestoneAward } from './milestones';
export type StoredProfile = { id:string; details:LocalProfile; records:TimeRecord[]; updatedAt:number; lastWorkedAt:number; milestones?:MilestoneAward[] };
export type ProfileStore = { version:2; activeId:string; profiles:StoredProfile[] };
export type ProfileBackup = { version:1; exportedAt:number; profile:StoredProfile };
export function newProfile(name='',now=Date.now()):StoredProfile { return {id:crypto.randomUUID(),details:{...defaultProfile,name,identityUpdatedAt:now},records:[],updatedAt:now,lastWorkedAt:0}; }
export function mergeRecords(local:TimeRecord[], incoming:TimeRecord[]):TimeRecord[] {
  const records=new Map(local.map(r=>[r.id,{...r}]));
  for(const r of incoming) { const prior=records.get(r.id);if(!prior){records.set(r.id,{...r});continue;}
    if(prior.day!==r.day || prior.projectId!==r.projectId || prior.start!==r.start)throw new Error('A time-session identifier has conflicting data. The profile was not imported.');
    const updated={...prior,projectName:r.end>prior.end?r.projectName:prior.projectName,end:Math.max(prior.end,r.end),appMs:Math.max(prior.appMs,r.appMs),codingMs:Math.max(prior.codingMs,r.codingMs)};
    if(r.firstCoding!==undefined)updated.firstCoding=Math.min(prior.firstCoding??Infinity,r.firstCoding);if(r.lastCoding!==undefined)updated.lastCoding=Math.max(prior.lastCoding??0,r.lastCoding);records.set(r.id,updated);
  }
  return [...records.values()].sort((a,b)=>a.start-b.start || a.id.localeCompare(b.id));
}
export function parseProfileBackup(value:unknown):ProfileBackup {
  const backup=value as ProfileBackup, p=backup?.profile;
  if(backup?.version!==1 || !p || typeof p.id!=='string' || !p.id || !p.details || typeof p.details.name!=='string' || !Array.isArray(p.records) || !Number.isFinite(p.updatedAt) || !Number.isFinite(p.lastWorkedAt))throw new Error('The JSON profile is invalid. No profile time was imported.');
  for(const r of p.records) {
    if(!r || typeof r.id!=='string' || !r.id || typeof r.day!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.day) || typeof r.projectId!=='string' || typeof r.projectName!=='string' || !Number.isFinite(r.start) || !Number.isFinite(r.end) || r.end<r.start || !Number.isFinite(r.appMs) || r.appMs<0 || !Number.isFinite(r.codingMs) || r.codingMs<0 || r.codingMs>r.appMs || (r.firstCoding!==undefined && !Number.isFinite(r.firstCoding)) || (r.lastCoding!==undefined && !Number.isFinite(r.lastCoding)))throw new Error('The JSON has an invalid time session. No profile time was imported.');
  }
  const text=(field:keyof LocalProfile)=>typeof p.details[field]==='string'?String(p.details[field]):'';
  const photo=text('photo');if(photo && (!/^data:image\/(png|jpeg|webp);base64,/.test(photo) || photo.length>1500000))throw new Error('The JSON profile picture is invalid.');
  const details:LocalProfile={...defaultProfile,name:text('name'),email:text('email'),designation:text('designation'),organization:text('organization'),photo,paused:!!p.details.paused,workspaceAnimations:p.details.workspaceAnimations===true,identityUpdatedAt:Number(p.details.identityUpdatedAt)||p.updatedAt};
  const records=mergeRecords([],p.records);
  return {version:1,exportedAt:Number(backup.exportedAt)||0,profile:{id:p.id,details,records,milestones:mergeAwards(Array.isArray(p.milestones)?p.milestones:[]),updatedAt:p.updatedAt,lastWorkedAt:records.reduce((last,r)=>Math.max(last,r.end),Math.max(0,p.lastWorkedAt))}};
}
export function mergeProfile(store:ProfileStore,backup:ProfileBackup):{store:ProfileStore;added:boolean} {
  const incoming=parseProfileBackup(backup).profile, existing=store.profiles.find(p=>p.id===incoming.id);
  const profile=existing?{...existing,details:incoming.updatedAt>existing.updatedAt?incoming.details:existing.details,updatedAt:Math.max(existing.updatedAt,incoming.updatedAt),lastWorkedAt:Math.max(existing.lastWorkedAt,incoming.lastWorkedAt),records:mergeRecords(existing.records,incoming.records)}:incoming;
  profile.milestones=awardMilestones(profile.records,mergeAwards(existing?.milestones,incoming.milestones));
  return {store:{...store,activeId:profile.id,profiles:[...store.profiles.filter(p=>p.id!==profile.id),profile]},added:!existing};
}
