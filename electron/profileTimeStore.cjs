const crypto=require('node:crypto');
const IDS=['time-30','time-60','time-120','time-240','time-480','time-1200','time-3000','time-6000','days-5','weeks-month','months-year','projects-3','projects-5','projects-10','projects-50'];
const defaults={name:'',email:'',designation:'',organization:'',photo:'',paused:false,workspaceAnimations:false};
function details(value) {
  if(!value || typeof value.name!=='string')throw new Error('Invalid profile details.');
  const text=key=>typeof value[key]==='string'?value[key]:'';
  const photo=text('photo');if(photo && (!/^data:image\/(png|jpeg|webp);base64,/.test(photo)||photo.length>1500000))throw new Error('Invalid profile picture.');
  return {...defaults,name:text('name'),email:text('email'),designation:text('designation'),organization:text('organization'),photo,paused:!!value.paused,workspaceAnimations:value.workspaceAnimations===true,identityUpdatedAt:Number(value.identityUpdatedAt)||0};
}
function validateRecord(r) {
  if(!r || typeof r.id!=='string'||!r.id||typeof r.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.day)||typeof r.projectId!=='string'||typeof r.projectName!=='string'||![r.start,r.end,r.appMs,r.codingMs].every(Number.isFinite)||r.end<r.start||r.appMs<0||r.codingMs<0||r.codingMs>r.appMs||(r.firstCoding!==undefined&&!Number.isFinite(r.firstCoding))||(r.lastCoding!==undefined&&!Number.isFinite(r.lastCoding)))throw new Error('Invalid profile time session.');
}
function validateBackup(b) {
  const p=b?.profile;if(b?.version!==1||!p||typeof p.id!=='string'||!p.id||!Array.isArray(p.records)||!Number.isFinite(p.updatedAt)||!Number.isFinite(p.lastWorkedAt))throw new Error('Invalid JSON profile.');
  details(p.details);p.records.forEach(validateRecord);return p;
}
function createProfileTimeStore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS research_profiles(id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, details TEXT NOT NULL, updated_at INTEGER NOT NULL, last_worked INTEGER NOT NULL DEFAULT 0,photo TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS research_time_sessions(profile_id TEXT NOT NULL REFERENCES research_profiles(id) ON DELETE CASCADE,id TEXT NOT NULL,day TEXT NOT NULL,project_id TEXT NOT NULL,project_name TEXT NOT NULL,start REAL NOT NULL,end REAL NOT NULL,app_ms REAL NOT NULL,coding_ms REAL NOT NULL,first_coding REAL,last_coding REAL,PRIMARY KEY(profile_id,id));
    CREATE TABLE IF NOT EXISTS research_time_days(profile_id TEXT NOT NULL REFERENCES research_profiles(id) ON DELETE CASCADE,day TEXT NOT NULL,project_id TEXT NOT NULL,project_name TEXT NOT NULL,app_ms REAL NOT NULL,coding_ms REAL NOT NULL,first_coding REAL,last_coding REAL,PRIMARY KEY(profile_id,day,project_id));
    CREATE TABLE IF NOT EXISTS research_milestones(profile_id TEXT NOT NULL REFERENCES research_profiles(id) ON DELETE CASCADE,id TEXT NOT NULL,earned_at INTEGER NOT NULL,seen_at INTEGER,PRIMARY KEY(profile_id,id));
    CREATE TABLE IF NOT EXISTS research_profile_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  if(!db.prepare('PRAGMA table_info(research_profiles)').all().some(c=>c.name==='photo'))db.exec("ALTER TABLE research_profiles ADD COLUMN photo TEXT NOT NULL DEFAULT ''");
  db.exec("UPDATE research_profiles SET photo=COALESCE(json_extract(details,'$.photo'),photo),details=json_remove(details,'$.photo') WHERE json_type(details,'$.photo') IS NOT NULL");
  const get=db.prepare('SELECT * FROM research_profiles WHERE id=?');
  const getLight=db.prepare('SELECT id,updated_at,last_worked FROM research_profiles WHERE id=?');
  const list=db.prepare('SELECT id,name,email,last_worked AS lastWorkedAt FROM research_profiles ORDER BY rowid');
  const setSetting=db.prepare('INSERT INTO research_profile_settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  const setting=key=>db.prepare('SELECT value FROM research_profile_settings WHERE key=?').get(key)?.value;
  const upsertProfile=db.prepare(`INSERT INTO research_profiles(id,name,email,details,updated_at,last_worked,photo) VALUES(@id,@name,@email,@details,@updatedAt,@lastWorkedAt,@photo) ON CONFLICT(id) DO UPDATE SET name=CASE WHEN excluded.updated_at>updated_at THEN excluded.name ELSE name END,email=CASE WHEN excluded.updated_at>updated_at THEN excluded.email ELSE email END,details=CASE WHEN excluded.updated_at>updated_at THEN excluded.details ELSE details END,photo=CASE WHEN excluded.updated_at>updated_at AND @photoProvided=1 THEN excluded.photo ELSE photo END,updated_at=MAX(updated_at,excluded.updated_at),last_worked=MAX(last_worked,excluded.last_worked)`);
  const getSession=db.prepare('SELECT id,day,project_id AS projectId,project_name AS projectName,start,end,app_ms AS appMs,coding_ms AS codingMs,first_coding AS firstCoding,last_coding AS lastCoding FROM research_time_sessions WHERE profile_id=? AND id=?');
  const putSession=db.prepare(`INSERT INTO research_time_sessions VALUES(@profileId,@id,@day,@projectId,@projectName,@start,@end,@appMs,@codingMs,@firstCoding,@lastCoding) ON CONFLICT(profile_id,id) DO UPDATE SET project_name=excluded.project_name,end=excluded.end,app_ms=excluded.app_ms,coding_ms=excluded.coding_ms,first_coding=excluded.first_coding,last_coding=excluded.last_coding`);
  const addDay=db.prepare(`INSERT INTO research_time_days VALUES(@profileId,@day,@projectId,@projectName,@appDelta,@codingDelta,@firstCoding,@lastCoding) ON CONFLICT(profile_id,day,project_id) DO UPDATE SET project_name=excluded.project_name,app_ms=app_ms+excluded.app_ms,coding_ms=coding_ms+excluded.coding_ms,first_coding=CASE WHEN first_coding IS NULL THEN excluded.first_coding WHEN excluded.first_coding IS NULL THEN first_coding ELSE MIN(first_coding,excluded.first_coding) END,last_coding=CASE WHEN last_coding IS NULL THEN excluded.last_coding WHEN excluded.last_coding IS NULL THEN last_coding ELSE MAX(last_coding,excluded.last_coding) END`);
  const worked=db.prepare('UPDATE research_profiles SET last_worked=MAX(last_worked,?) WHERE id=?');
  const putAward=db.prepare('INSERT INTO research_milestones VALUES(?,?,?,?) ON CONFLICT(profile_id,id) DO UPDATE SET earned_at=MIN(earned_at,excluded.earned_at),seen_at=MAX(COALESCE(seen_at,0),COALESCE(excluded.seen_at,0))');
  const awards=id=>db.prepare('SELECT id,earned_at AS earnedAt,seen_at AS seenAt FROM research_milestones WHERE profile_id=?').all(id).map(a=>({id:a.id,earnedAt:a.earnedAt,...(a.seenAt?{seenAt:a.seenAt}:{})})).sort((a,b)=>IDS.indexOf(a.id)-IDS.indexOf(b.id));
  function profile(p){const d=details(p.details),{photo,...metadata}=d;upsertProfile.run({id:p.id,name:d.name,email:d.email,details:JSON.stringify(metadata),photo,photoProvided:Object.hasOwn(p.details,'photo')?1:0,updatedAt:p.updatedAt,lastWorkedAt:Math.max(0,p.lastWorkedAt||0)});}
  function session(id,r,validateOnly=false){validateRecord(r);const prior=getSession.get(id,r.id);if(prior&&(prior.day!==r.day||prior.projectId!==r.projectId||prior.start!==r.start))throw new Error('A time-session identifier has conflicting data. No profile time was imported.');if(validateOnly)return;
    const first=Math.min(prior?.firstCoding??Infinity,r.firstCoding??Infinity),last=Math.max(prior?.lastCoding??-Infinity,r.lastCoding??-Infinity);
    const merged={...r,profileId:id,projectName:prior&&prior.end>=r.end?prior.projectName:r.projectName,end:Math.max(prior?.end||0,r.end),appMs:Math.max(prior?.appMs||0,r.appMs),codingMs:Math.max(prior?.codingMs||0,r.codingMs),firstCoding:Number.isFinite(first)?first:null,lastCoding:Number.isFinite(last)?last:null};
    if(prior&&prior.end===merged.end&&prior.appMs===merged.appMs&&prior.codingMs===merged.codingMs&&prior.firstCoding===merged.firstCoding&&prior.lastCoding===merged.lastCoding)return;
    const codingChanged=merged.codingMs>(prior?.codingMs||0),newCodingDate=!(prior&&(prior.codingMs>0||prior.firstCoding!=null))&&(merged.codingMs>0||merged.firstCoding!=null);
    putSession.run(merged);addDay.run({...merged,appDelta:merged.appMs-(prior?.appMs||0),codingDelta:merged.codingMs-(prior?.codingMs||0)});worked.run(merged.end,id);return {codingChanged,newCodingDate};
  }
  function importAwards(id,values){for(const a of Array.isArray(values)?values:[])if(a&&IDS.includes(a.id)&&Number.isFinite(a.earnedAt)&&a.earnedAt>=0)putAward.run(id,a.id,a.earnedAt,Number.isFinite(a.seenAt)?a.seenAt:null);}
  const localMonth=now=>{const d=new Date(now);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};
  const week=day=>Math.floor((Date.parse(day+'T00:00:00Z')/86400000+4)/7);
  const calendarChecked=new Map();
  function evaluate(id,now=Date.now(),refreshDates=false){
    const existing=new Set(awards(id).map(a=>a.id));if(existing.size===IDS.length)return;
    const total=db.prepare('SELECT COALESCE(SUM(coding_ms),0) AS n FROM research_time_days WHERE profile_id=?').get(id).n,earned=[];
    for(const m of [30,60,120,240,480,1200,3000,6000])if(total>=m*60000)earned.push('time-'+m);
    const count=db.prepare('SELECT COUNT(DISTINCT project_id) AS n FROM research_time_days WHERE profile_id=? AND project_id<>\'\' AND (coding_ms>0 OR first_coding IS NOT NULL)').get(id).n;
    for(const n of [3,5,10,50])if(count>=n)earned.push('projects-'+n);
    const checkDay=new Date(now).toDateString();
    if(refreshDates||calendarChecked.get(id)!==checkDay){
    const days=db.prepare('SELECT DISTINCT day FROM research_time_days WHERE profile_id=? AND (coding_ms>0 OR first_coding IS NOT NULL) ORDER BY day').all(id),months=new Map(),years=new Map();let streak=0,previous=-Infinity;
    for(const {day} of days){const num=Date.parse(day+'T00:00:00Z')/86400000;streak=num===previous+1?streak+1:1;previous=num;if(streak>=5)earned.push('days-5');const m=day.slice(0,7),y=day.slice(0,4);if(!months.has(m))months.set(m,new Set());months.get(m).add(week(day));if(!years.has(y))years.set(y,new Set());years.get(y).add(m);}
    const current=localMonth(now);for(const [m,w] of months)if(m<current){const [y,month]=m.split('-').map(Number),end=new Date(Date.UTC(y,month,0)).getUTCDate();if(w.size===week(m+'-'+end)-week(m+'-01')+1)earned.push('weeks-month');}
    for(const [y,m] of years)if(y<current.slice(0,4)&&m.size===12)earned.push('months-year');
    calendarChecked.set(id,checkDay);}
    for(const earnedId of new Set(earned))if(!existing.has(earnedId))putAward.run(id,earnedId,now,null);
  }
  function snapshot(id=setting('active')){const p=get.get(id);if(!p)throw new Error('Profile not found.');return {profile:{id:p.id,details:{...JSON.parse(p.details),photo:p.photo||''},updatedAt:p.updated_at,lastWorkedAt:p.last_worked,milestones:awards(id)},profiles:list.all(),rows:db.prepare('SELECT day,project_id AS projectId,project_name AS projectName,app_ms AS appMs,coding_ms AS codingMs,first_coding AS firstCoding,last_coding AS lastCoding FROM research_time_days WHERE profile_id=? ORDER BY day,project_id').all(id).map(r=>({...r,firstCoding:r.firstCoding??undefined,lastCoding:r.lastCoding??undefined}))};}
  function newProfile(bootstrap=false){const now=Date.now(),p={id:crypto.randomUUID(),details:{...defaults,identityUpdatedAt:bootstrap?0:now},updatedAt:now,lastWorkedAt:0};profile(p);return p.id;}
  const migrate=db.transaction(legacy=>{
    if(setting('migrated')!=='1'){
      if(legacy){if(legacy.version!==2||!Array.isArray(legacy.profiles)||!legacy.profiles.length)throw new Error('Invalid legacy profile storage.');for(const p of legacy.profiles){validateBackup({version:1,profile:p});profile(p);for(const r of p.records)session(p.id,r);importAwards(p.id,p.milestones);evaluate(p.id);}
        if(get.get(legacy.activeId))setSetting.run('active',legacy.activeId);
      }
      setSetting.run('migrated','1');
    }
    if(!setting('active')||!get.get(setting('active')))setSetting.run('active',list.all()[0]?.id||newProfile(true));
  });
  return {
    needsMigration:()=>setting('migrated')!=='1',
    open(legacy){migrate(legacy);evaluate(setting('active'),Date.now(),true);return snapshot();},
    write:db.transaction(payload=>{const p=getLight.get(payload.profileId);if(!p)throw new Error('Profile not found.');if(payload.details)profile({id:p.id,details:payload.details,updatedAt:payload.updatedAt,lastWorkedAt:p.last_worked});let codingChanged=false,datesChanged=false;for(const r of payload.records||[]){const change=session(p.id,r);codingChanged ||= !!change?.codingChanged;datesChanged ||= !!change?.newCodingDate;}if(payload.unlockAll===true)for(const id of IDS)putAward.run(p.id,id,Date.now(),Date.now());if(payload.seenId&&IDS.includes(payload.seenId))db.prepare('UPDATE research_milestones SET seen_at=CASE WHEN seen_at IS NULL OR seen_at=0 THEN ? ELSE seen_at END WHERE profile_id=? AND id=?').run(Date.now(),p.id,payload.seenId);if(codingChanged||datesChanged||payload.checkMilestones)evaluate(p.id,Date.now(),datesChanged||payload.checkMilestones);return {milestones:awards(p.id),lastWorkedAt:getLight.get(p.id).last_worked};}),
    select(id){if(!get.get(id))throw new Error('Profile not found.');setSetting.run('active',id);evaluate(id,Date.now(),true);return snapshot(id);},
    create:db.transaction(()=>{const id=newProfile();setSetting.run('active',id);return snapshot(id);}),
    delete:db.transaction(id=>{db.prepare('DELETE FROM research_profiles WHERE id=?').run(id);const next=list.all()[0]?.id||newProfile();setSetting.run('active',next);return snapshot(next);}),
    backup(id){const p=snapshot(id).profile;return {version:1,exportedAt:Date.now(),profile:{...p,records:db.prepare('SELECT id,day,project_id AS projectId,project_name AS projectName,start,end,app_ms AS appMs,coding_ms AS codingMs,first_coding AS firstCoding,last_coding AS lastCoding FROM research_time_sessions WHERE profile_id=? ORDER BY start,id').all(id).map(r=>({...r,firstCoding:r.firstCoding??undefined,lastCoding:r.lastCoding??undefined}))}};},
    validate(b){const p=validateBackup(b);for(const r of p.records)session(p.id,r,true);return true;},
    import:db.transaction(b=>{const p=validateBackup(b),added=!get.get(p.id);profile(p);for(const r of p.records)session(p.id,r);importAwards(p.id,p.milestones);evaluate(p.id,Date.now(),true);setSetting.run('active',p.id);return {added,snapshot:snapshot(p.id)};}),
  };
}
module.exports={createProfileTimeStore};
