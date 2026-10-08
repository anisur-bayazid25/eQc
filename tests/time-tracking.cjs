const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {TimeTracker,localDay,inPeriod}=require('../src/lib/timeTracking.ts');
const start=new Date('2026-10-08T10:00:00').getTime();
function ticks(t,a,b){for(let n=a+5000;n<=b;n+=5000)t.flush(n);}
test('coding begins on coding, idle stops after five minutes; activity cannot restart coding',()=>{
 const t=new TimeTracker([],start);t.switchProject('a','Alpha',start);ticks(t,start,start+60000);assert.equal(t.rows[0].appMs,60000);assert.equal(t.rows[0].codingMs,0);
 t.markCoding(start+60000);ticks(t,start+60000,start+420000);assert.equal(t.rows[0].codingMs,300000);assert.equal(t.rows[0].appMs,360000);assert.equal(t.status(start+420000),'Idle');
 t.activity(start+420000);ticks(t,start+420000,start+450000);assert.equal(t.rows[0].codingMs,300000);t.markCoding(start+450000);ticks(t,start+450000,start+480000);assert.equal(t.rows[0].codingMs,330000);assert.equal(t.rows[0].lastCoding,start+450000);
});
test('project switches, away, pause, sleep and restart do not create overlapping time',()=>{
 const t=new TimeTracker([],start);t.switchProject('a','Alpha',start);t.markCoding(start);t.flush(start+30000);t.switchProject('b','Beta',start+30000);t.flush(start+45000);assert.equal(t.rows[1].codingMs,0);assert.equal(t.rows[0].codingMs,30000);
 t.markCoding(start+45000);t.setForeground(false,start+60000);ticks(t,start+60000,start+120000);t.setForeground(true,start+120000);t.markCoding(start+120000);t.flush(start+135000);t.setPaused(true,start+135000);t.flush(start+150000);t.setPaused(false,start+150000);t.markCoding(start+150000);t.flush(start+300000);assert.equal(t.rows[1].codingMs,30000);
 const copy=new TimeTracker(t.rows,start+300000);copy.switchProject('b','Beta',start+300000);copy.flush(start+315000);assert.equal(copy.rows[1].codingMs,30000);assert.equal(t.rows[1].appMs+15000,copy.rows[1].appMs);
});
test('midnight splits app time and starts fresh coding only on the next coding action',()=>{
 const s=new Date('2026-12-31T23:59:50').getTime(),t=new TimeTracker([],s);t.switchProject('a','Alpha',s);t.markCoding(s);t.flush(s+20000);assert.equal(t.rows.length,2);assert.equal(t.rows[0].appMs,10000);assert.equal(t.rows[0].codingMs,10000);assert.equal(t.rows[1].appMs,10000);assert.equal(t.rows[1].codingMs,0);t.markCoding(s+20000);t.flush(s+25000);assert.equal(t.rows[1].codingMs,5000);assert.equal(t.rows[1].firstCoding,s+20000);
});
test('period totals use local calendar boundaries, including week/year transitions',()=>{
 assert.equal(localDay(start),'2026-10-08');assert.equal(inPeriod('2026-10-05','week','2026-10-08'),true);assert.equal(inPeriod('2026-10-10','week','2026-10-08'),true);assert.equal(inPeriod('2026-10-04','week','2026-10-08'),true);assert.equal(inPeriod('2026-10-11','week','2026-10-08'),false);assert.equal(inPeriod('2026-10-12','week','2026-10-08'),false);assert.equal(inPeriod('2025-12-29','week','2026-01-01'),true);assert.equal(inPeriod('2026-12-31','year','2026-01-01'),true);assert.equal(inPeriod('2027-01-01','year','2026-01-01'),false);
});
