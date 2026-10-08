// Test actual main/preload registration with isolated SQLite, without desktop windows.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module'),{DatabaseSync}=require('node:sqlite');
test('main/preload history, checkpoint and recovery handlers work together after startup',async()=>{
 const directory=fs.mkdtempSync(path.join(__dirname,'bridge-qa-'));assert.ok(path.resolve(directory).startsWith(path.resolve(__dirname)+path.sep));
 const connections=[],handlers=new Map(),externalUrls=[],mainEvents=new Map(),rendererEvents=new Map();
 class Database {constructor(file){this.db=new DatabaseSync(file);connections.push(this.db);}exec(sql){return this.db.exec(sql);}prepare(sql){const s=this.db.prepare(sql);s.setAllowUnknownNamedParameters(true);return s;}pragma(sql){return this.db.prepare('PRAGMA '+sql).all();}transaction(task){return(...args)=>{this.db.exec('BEGIN');try{const result=task(...args);this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}};}}
 class Window {constructor(){Window.current=this;this.events=new Map();this.closed=false;this.webContents={send:(name,...args)=>rendererEvents.get(name)?.({},...args),openDevTools(){}};}on(name,fn){this.events.set(name,fn);}close(){let stopped=false;this.events.get('close')?.({preventDefault:()=>stopped=true});if(!stopped)this.closed=true;}loadFile(){}loadURL(){}static getAllWindows(){return[];}}
 const app={getPath:()=>directory,whenReady:()=>Promise.resolve(),on(){},getVersion:()=> require('../package.json').version,quit(){}};
 const electron={app,shell:{openExternal:async url=>{externalUrls.push(url);}},BrowserWindow:Window,ipcMain:{handle:(name,fn)=>handlers.set(name,fn),on:(name,fn)=>mainEvents.set(name,fn)},dialog:{showMessageBox:async()=>({response:1})},Menu:{setApplicationMenu(){}}};
 const mainFile=path.resolve(__dirname,'../electron/main.cjs'),realRequire=createRequire(mainFile);
 try {
  vm.runInNewContext(fs.readFileSync(mainFile,'utf8'),{require:name=>name==='electron'?electron:name==='better-sqlite3'?Database:name==='electron-updater'?{autoUpdater:{on(){}}}:name==='./lan.cjs'?()=>{}:realRequire(name),__dirname:path.dirname(mainFile),process,Buffer,console,setTimeout:()=>0,clearTimeout(){},module:{exports:{}},exports:{}},{filename:mainFile});
  await new Promise(resolve=>setImmediate(resolve));
  let bridge;const preloadFile=path.resolve(__dirname,'../electron/preload.cjs');
  vm.runInNewContext(fs.readFileSync(preloadFile,'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_,api)=>bridge=api},ipcRenderer:{invoke:async(name,...args)=>{if(!handlers.has(name))throw new Error('Missing handler '+name);return handlers.get(name)({},...args);},send:(name,...args)=>mainEvents.get(name)?.({sender:Window.current.webContents},...args),on:(name,fn)=>rendererEvents.set(name,fn),removeListener:(name)=>rendererEvents.delete(name)}}),console},{filename:preloadFile});
  await bridge.openContactEmail();assert.deepEqual(externalUrls,['mailto:anisur.rahman.bayazid@gmail.com']);
  const p={id:'qa',name:'History bridge QA',createdAt:1,folders:[],docs:[],codes:[],codedSegments:[]};await bridge.saveProject(p,{actor:'QA'});const before=await bridge.projectHistory(p.id);assert.equal(before.activity.length,1);const points=await bridge.createCheckpoint(p.id,'Checkpoint');assert.equal(points.snapshots.length,1);assert.equal((await bridge.readSnapshot(p.id,points.snapshots[0].id)).name,p.name);await assert.rejects(bridge.readSnapshot('other',points.snapshots[0].id));
  const legacy={version:2,activeId:'person',profiles:[{id:'person',details:{name:'Amina',email:'',designation:'Researcher',organization:'',photo:'',paused:false},records:[],updatedAt:1,lastWorkedAt:0}]};
  const opened=await bridge.profileTime.open(legacy);assert.equal(opened.profile.id,'person');assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory,'profile-time-before-sqlite.json'),'utf8')),legacy);
  const final={id:'final',day:'2026-10-08',projectId:'qa',projectName:'History bridge QA',start:100,end:12100,appMs:12000,codingMs:12000,firstCoding:100,lastCoding:100};
  const unsubscribe=bridge.profileTime.onPrepareClose(()=>{void (async()=>{await bridge.profileTime.write({profileId:'person',records:[final]});bridge.profileTime.completeClose({ok:true});})();});
  Window.current.close();assert.equal(Window.current.closed,false);await new Promise(resolve=>setImmediate(resolve));assert.equal(Window.current.closed,true);assert.equal((await bridge.profileTime.backup('person')).profile.records[0].end,12100);unsubscribe();
 }finally{connections.forEach(db=>db.close());fs.rmSync(directory,{recursive:true,force:true});}
});
