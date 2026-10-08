export const IDLE_MS = 5 * 60 * 1000;
export type TimeRow = { day: string; projectId: string; projectName: string; appMs: number; codingMs: number; firstCoding?: number; lastCoding?: number };
export type TimeRecord = TimeRow & { id: string; start: number; end: number };
export function aggregateRecords(records: TimeRecord[]): TimeRow[] {
  const rows=new Map<string,TimeRow>();
  for(const record of records) { const key=JSON.stringify([record.day,record.projectId]);let row=rows.get(key);if(!row){row={day:record.day,projectId:record.projectId,projectName:record.projectName,appMs:0,codingMs:0};rows.set(key,row);}row.appMs+=record.appMs;row.codingMs+=record.codingMs;row.projectName=record.projectName;if(record.firstCoding!==undefined)row.firstCoding=Math.min(row.firstCoding??Infinity,record.firstCoding);if(record.lastCoding!==undefined)row.lastCoding=Math.max(row.lastCoding??0,record.lastCoding); }
  return [...rows.values()];
}
export type LocalProfile = { name: string; email: string; designation: string; organization: string; photo: string; paused: boolean; workspaceAnimations?: boolean; identityUpdatedAt?: number };
export const defaultProfile: LocalProfile = { name:'',email:'',designation:'',organization:'',photo:'',paused:false,workspaceAnimations:false };
export function localDay(time: number) { const d=new Date(time); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function duration(ms: number) { const seconds=Math.floor(ms/1000); return `${Math.floor(seconds/3600)}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`; }
export function inPeriod(day: string, period: string, date: string) {
  const d=new Date(date+'T12:00:00'); if(!Number.isFinite(d.getTime()))return false;
  if(period==='day')return day===date;
  if(period==='month')return day.slice(0,7)===date.slice(0,7);
  if(period==='year')return day.slice(0,4)===date.slice(0,4);
  d.setDate(d.getDate()-d.getDay()); const start=localDay(d.getTime()); d.setDate(d.getDate()+6);
  return day>=start && day<=localDay(d.getTime());
}
// Counts only foreground sessions. Every change is flushed before its state changes.
export class TimeTracker {
  rows: TimeRow[];
  records: TimeRecord[];
  private activeRecord: TimeRecord | undefined;
  private rowsByKey=new Map<string,TimeRow>();
  private cursor: number;
  private lastActivity: number;
  private foreground = true;
  private coding = false;
  private codingDay = '';
  paused = false;
  private project = {id:'',name:'No project'};
  constructor(rows: TimeRow[], now: number, records?: TimeRecord[]) { this.records=records?records.map(r=>({...r})):rows.map(r=>({...r,id:crypto.randomUUID(),start:r.firstCoding??now,end:r.lastCoding??now}));this.rows=aggregateRecords(this.records);this.rowsByKey=new Map(this.rows.map(r=>[JSON.stringify([r.day,r.projectId]),r])); this.cursor=now; this.lastActivity=now; }
  private record(time:number) {
    const day=localDay(time);
    if(!this.activeRecord || this.activeRecord.day!==day || this.activeRecord.projectId!==this.project.id) {
      this.activeRecord={id:crypto.randomUUID(),day,projectId:this.project.id,projectName:this.project.name,appMs:0,codingMs:0,start:time,end:time};this.records.push(this.activeRecord);
    }
    this.activeRecord.projectName=this.project.name;return this.activeRecord;
  }
  private row(time: number) {
    const day=localDay(time),key=JSON.stringify([day,this.project.id]); let row=this.rowsByKey.get(key);
    if(!row){row={day,projectId:this.project.id,projectName:this.project.name,appMs:0,codingMs:0};this.rows.push(row);this.rowsByKey.set(key,row);}
    row.projectName=this.project.name;return row;
  }
  flush(now: number) {
    // Long timer gaps indicate suspension/sleep; never charge the entire gap.
    const end=Math.min(now,this.lastActivity+IDLE_MS);
    if(this.foreground && !this.paused && now-this.cursor<=60000) {
      let start=this.cursor;
      while(start<end) {
        const midnight=new Date(start);midnight.setHours(24,0,0,0);
        const stop=Math.min(end,midnight.getTime()), row=this.row(start);
        const record=this.record(start);record.appMs+=stop-start;record.end=stop;row.appMs+=stop-start;
        if(this.coding && row.day===this.codingDay){row.codingMs+=stop-start;record.codingMs+=stop-start;}start=stop;
      }
    }
    if(localDay(now)!==this.codingDay || now>=this.lastActivity+IDLE_MS || now-this.cursor>60000){this.coding=false;if(now>=this.lastActivity+IDLE_MS || now-this.cursor>60000)this.activeRecord=undefined;}
    this.cursor=now;
  }
  activity(now: number) { this.flush(now);this.lastActivity=now; }
  markCoding(now: number) {
    this.activity(now);if(!this.foreground || this.paused)return;
    this.coding=true;this.codingDay=localDay(now);const row=this.row(now),record=this.record(now);row.firstCoding ??=now;row.lastCoding=now;record.firstCoding ??=now;record.lastCoding=now;record.end=Math.max(record.end,now);
  }
  switchProject(id: string, name: string, now: number) { this.flush(now); if(id!==this.project.id){this.coding=false;this.activeRecord=undefined;}this.project={id,name}; }
  setForeground(value: boolean, now: number) { this.flush(now);this.foreground=value;if(!value){this.coding=false;this.activeRecord=undefined;}else this.lastActivity=now; }
  setPaused(value: boolean, now: number) { this.flush(now);this.paused=value;if(value){this.coding=false;this.activeRecord=undefined;}else this.lastActivity=now; }
  status(now: number) { return this.paused ? 'Paused' : !this.foreground ? 'Away' : now-this.lastActivity>=IDLE_MS ? 'Idle' : this.coding ? 'Coding session' : 'App session'; }
  acknowledgeRecords(saved:TimeRecord[]) {
    const acknowledged=new Map(saved.map(r=>[r.id,r]));
    this.records=this.records.filter(r=>{const prior=acknowledged.get(r.id);return r===this.activeRecord || !prior || r.end!==prior.end || r.appMs!==prior.appMs || r.codingMs!==prior.codingMs || r.lastCoding!==prior.lastCoding;});
  }
}
