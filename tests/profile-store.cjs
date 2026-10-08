const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {newProfile,mergeProfile,parseProfileBackup,mergeRecords}=require('../src/lib/profileStore.ts');
const {TimeTracker,aggregateRecords}=require('../src/lib/timeTracking.ts');
const time=new Date('2026-10-08T10:00:00').getTime();
const record=(id,ms=30000)=>({id,day:'2026-10-08',projectId:'p',projectName:'Study',appMs:ms,codingMs:ms,start:time,end:time+ms,firstCoding:time,lastCoding:time+1000});
const profile=()=>({...newProfile('Amina',time),id:'person-a',records:[record('session-a')],lastWorkedAt:time+30000});
test('workspace animations default off and follow profile JSON metadata without leaking to new profiles',()=>{
 const p=profile();assert.equal(p.details.workspaceAnimations,false);
 const opted={...p,updatedAt:time+1,details:{...p.details,workspaceAnimations:true}};
 const parsed=parseProfileBackup(JSON.parse(JSON.stringify({version:1,profile:opted})));assert.equal(parsed.profile.details.workspaceAnimations,true);
 const merged=mergeProfile({version:2,activeId:p.id,profiles:[p]},parsed).store;
 assert.equal(merged.profiles[0].details.workspaceAnimations,true);assert.equal(newProfile().details.workspaceAnimations,false);
 assert.equal(parseProfileBackup({version:1,profile:{...p,details:{...p.details,workspaceAnimations:undefined}}}).profile.details.workspaceAnimations,false);
 assert.equal(mergeProfile(merged,{version:1,profile:p}).store.profiles[0].details.workspaceAnimations,true);
});
test('same session repeated, older and incremental exports never duplicate or lose time',()=>{
 const p=profile(),store={version:2,activeId:p.id,profiles:[p]};
 const incoming={version:1,exportedAt:time+60000,profile:{...p,records:[record('session-a',60000),record('session-b',10000)],lastWorkedAt:time+60000}};
 let result=mergeProfile(store,incoming);assert.equal(result.added,false);assert.equal(result.store.profiles[0].records.length,2);assert.equal(aggregateRecords(result.store.profiles[0].records)[0].codingMs,70000);
 result=mergeProfile(result.store,incoming);assert.equal(aggregateRecords(result.store.profiles[0].records)[0].codingMs,70000);
 result=mergeProfile(result.store,{version:1,profile:p});assert.equal(aggregateRecords(result.store.profiles[0].records)[0].codingMs,70000);assert.equal(result.store.profiles[0].lastWorkedAt,time+60000);
 assert.equal(store.profiles[0].records[0].appMs,30000);
});
test('unknown identity creates a separate profile even with the same display name; last updated details win',()=>{
 const p=profile(),store={version:2,activeId:p.id,profiles:[p]},other={...profile(),id:'person-b'};
 const result=mergeProfile(store,{version:1,profile:other});assert.equal(result.added,true);assert.equal(result.store.profiles.length,2);assert.equal(result.store.activeId,'person-b');
 const newer={...p,updatedAt:time+10000,details:{...p.details,name:'Ravi'}};const renamed=mergeProfile(store,{version:1,profile:newer});assert.equal(renamed.store.profiles[0].details.name,'Ravi');assert.equal(mergeProfile(renamed.store,{version:1,profile:p}).store.profiles[0].details.name,'Ravi');
});
test('independent computers retain separate sessions while malformed/conflicting records reject atomically',()=>{
 const local=[record('laptop')],other=[record('desktop')];assert.equal(aggregateRecords(mergeRecords(local,other))[0].appMs,60000);assert.equal(mergeRecords(local,[...local,...other]).length,2);
 assert.throws(()=>mergeRecords(local,[{...record('laptop'),projectId:'wrong'}]),/conflicting/);assert.equal(local[0].projectId,'p');
 const p=profile();assert.throws(()=>parseProfileBackup({version:1,profile:{...p,records:[{...record('bad'),codingMs:-1}]}}),/invalid time/);
 assert.throws(()=>parseProfileBackup({version:1,profile:{...p,details:{...p.details,photo:'https://example.com/user.png'}}}),/picture/);
});
test('fresh session IDs after relaunch/import/profile switch preserve incremental snapshots',()=>{
 const t=new TimeTracker([],time);t.switchProject('p','Study',time);t.markCoding(time);t.flush(time+10000);const early=structuredClone(t.records);t.flush(time+20000);assert.equal(t.records[0].id,early[0].id);assert.equal(mergeRecords(t.records,early)[0].codingMs,20000);
 const reopened=new TimeTracker([],time+20000,t.records);reopened.switchProject('p','Study',time+20000);reopened.markCoding(time+20000);reopened.flush(time+30000);assert.equal(reopened.records.length,2);assert.notEqual(reopened.records[1].id,reopened.records[0].id);assert.equal(aggregateRecords(mergeRecords(t.records,reopened.records))[0].codingMs,30000);
});
