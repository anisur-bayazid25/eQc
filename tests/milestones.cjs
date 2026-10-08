const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {awardMilestones,mergeAwards,MILESTONES}=require('../src/lib/milestones.ts');
const {newProfile,mergeProfile}=require('../src/lib/profileStore.ts');
const now=new Date('2026-10-08T10:00:00').getTime();
const row=(day='2026-10-08',projectId='a',codingMs=60000)=>({day,projectId,projectName:projectId,appMs:codingMs,codingMs});
const ids=rows=>awardMilestones(rows,[],now).map(a=>a.id);
test('five lifetime thresholds accumulate across dates/projects, excluding app-only time',()=>{
 assert.deepEqual(ids([row(undefined,'a',29*60000),{...row(undefined,'b',0),appMs:99999999}]),[]);
 assert.deepEqual(ids([row('2026-10-01','a',15*60000),row('2026-10-08','b',15*60000)]),['time-30']);
 const all=ids([row(undefined,'a',480*60000)]);assert.equal(all.filter(id=>id.startsWith('time-')).length,5);assert.equal(ids([row(undefined,'a',6000*60000)]).filter(id=>id.startsWith('time-')).length,8);
 assert.equal(new Set(MILESTONES.map(m=>m.character)).size,15);
});
test('distinct coded projects and calendar-day streak ignore repeat rows and app-only projects',()=>{
 assert.ok(ids([row(undefined,'a'),row(undefined,'b'),row(undefined,'c'),row(undefined,'a')]).includes('projects-3'));
 assert.equal(ids([row(undefined,'a'),row(undefined,'b'),row(undefined,'c',0)]).includes('projects-3'),false);
 assert.ok(ids(Array.from({length:50},(_,i)=>row(undefined,'p'+i))).includes('projects-50'));
 const streak=['2026-03-07','2026-03-08','2026-03-09','2026-03-10','2026-03-11'].map(d=>row(d));assert.ok(ids(streak).includes('days-5'));
 assert.equal(ids([...streak.slice(0,4),row('2026-03-12')]).includes('days-5'),false);
 assert.ok(ids(streak.map(r=>({...r,codingMs:0,firstCoding:1}))).includes('days-5'));
});
test('Sunday weeks: each partial/full week needs coding within a completed month',()=>{
 const days=['2026-09-01','2026-09-07','2026-09-14','2026-09-21','2026-09-28'];assert.ok(ids(days.map(d=>row(d))).includes('weeks-month'));
 assert.equal(ids(days.slice(1).map(d=>row(d))).includes('weeks-month'),false);
 // Sunday Sep 6 is a different week from Saturday Sep 5.
 assert.ok(ids(['2026-09-05','2026-09-06','2026-09-13','2026-09-20','2026-09-27'].map(d=>row(d))).includes('weeks-month'));
 assert.equal(awardMilestones(days.map(d=>row(d)),[],new Date('2026-09-30T23:59:59').getTime()).some(a=>a.id==='weeks-month'),false);
 const leap=['2024-02-01','2024-02-04','2024-02-11','2024-02-18','2024-02-29'];assert.ok(ids(leap.map(d=>row(d))).includes('weeks-month'));
});
test('all twelve months of a completed year; earned awards never disappear',()=>{
 const year=Array.from({length:12},(_,i)=>row(`2025-${String(i+1).padStart(2,'0')}-15`));assert.ok(ids(year).includes('months-year'));
 assert.equal(ids(year.slice(0,11)).includes('months-year'),false);
 assert.equal(awardMilestones(year,[],new Date('2025-12-31T23:59:59').getTime()).some(a=>a.id==='months-year'),false);
 const earned=awardMilestones(year,[],now),seen=earned.map(a=>({...a,seenAt:now+1}));assert.deepEqual(awardMilestones([],seen,now+86400000),seen);
});
test('profile imports union earned/seen states, preserve unknown-profile separation and repeated import safety',()=>{
 const p=newProfile('A',now);p.milestones=[{id:'time-30',earnedAt:now,seenAt:now+1}];
 const store={version:2,activeId:p.id,profiles:[p]},incoming={...p,milestones:[{id:'time-30',earnedAt:now-1},{id:'projects-3',earnedAt:now+2}]};
 const result=mergeProfile(store,{version:1,profile:incoming}).store;assert.equal(result.profiles[0].milestones[0].seenAt,now+1);assert.equal(result.profiles[0].milestones.length,2);
 assert.deepEqual(mergeProfile(result,{version:1,profile:incoming}).store.profiles[0].milestones,result.profiles[0].milestones);
 const other=newProfile('A',now);const isolated=mergeProfile(result,{version:1,profile:other}).store;assert.equal(isolated.profiles.find(p=>p.id===other.id).milestones.length,0);
 assert.deepEqual(mergeAwards([{id:'unknown',earnedAt:now},{id:'time-30',earnedAt:NaN}]),[]);
});
