// Test actual main/preload registration with isolated SQLite, without desktop windows.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module'),{DatabaseSync}=require('node:sqlite');
test('main/preload history, checkpoint and recovery handlers work together after startup',async()=>{
 const directory=fs.mkdtempSync(path.join(__dirname,'bridge-qa-'));assert.ok(path.resolve(directory).startsWith(path.resolve(__dirname)+path.sep));
 const connections=[],handlers=new Map(),externalUrls=[],copied=[],menus=[],mainEvents=new Map(),rendererEvents=new Map();
 class Database {constructor(file){this.db=new DatabaseSync(file);connections.push(this.db);}exec(sql){return this.db.exec(sql);}prepare(sql){const s=this.db.prepare(sql);s.setAllowUnknownNamedParameters(true);return s;}pragma(sql){return this.db.prepare('PRAGMA '+sql).all();}transaction(task){return(...args)=>{this.db.exec('BEGIN');try{const result=task(...args);this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}};}}
 class Window {constructor(){Window.current=this;this.events=new Map();this.closed=false;this.webContents={send:(name,...args)=>rendererEvents.get(name)?.({},...args),openDevTools(){},on:(name,fn)=>this.events.set('web:'+name,fn)};}on(name,fn){this.events.set(name,fn);}close(){let stopped=false;this.events.get('close')?.({preventDefault:()=>stopped=true});if(!stopped)this.closed=true;}loadFile(){}loadURL(){}static getAllWindows(){return[];}}
 const app={getPath:()=>directory,whenReady:()=>Promise.resolve(),on(){},getVersion:()=> require('../package.json').version,quit(){}};
 const electron={app,clipboard:{writeText:text=>copied.push(text)},shell:{openExternal:async url=>{externalUrls.push(url);}},BrowserWindow:Window,ipcMain:{handle:(name,fn)=>handlers.set(name,fn),on:(name,fn)=>mainEvents.set(name,fn)},dialog:{showMessageBox:async()=>({response:1})},Menu:{setApplicationMenu(){},buildFromTemplate:items=>({popup:()=>menus.push(items)})}};
 const mainFile=path.resolve(__dirname,'../electron/main.cjs'),realRequire=createRequire(mainFile);
 try {
  vm.runInNewContext(fs.readFileSync(mainFile,'utf8'),{require:name=>name==='electron'?electron:name==='better-sqlite3'?Database:name==='electron-updater'?{autoUpdater:{on(){}}}:name==='./lan.cjs'?()=>{}:realRequire(name),__dirname:path.dirname(mainFile),process,Buffer,console,setTimeout:()=>0,clearTimeout(){},module:{exports:{}},exports:{}},{filename:mainFile});
  await new Promise(resolve=>setImmediate(resolve));
  let bridge;const preloadFile=path.resolve(__dirname,'../electron/preload.cjs');
  vm.runInNewContext(fs.readFileSync(preloadFile,'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_,api)=>bridge=api},ipcRenderer:{invoke:async(name,...args)=>{if(!handlers.has(name))throw new Error('Missing handler '+name);return handlers.get(name)({},...args);},send:(name,...args)=>mainEvents.get(name)?.({sender:Window.current.webContents},...args),on:(name,fn)=>rendererEvents.set(name,fn),removeListener:(name)=>rendererEvents.delete(name)}}),console},{filename:preloadFile});
  await bridge.openContactEmail();assert.deepEqual(externalUrls,['mailto:anisur.rahman.bayazid@gmail.com']);Window.current.events.get('web:context-menu')({}, {linkURL:'mailto:anisur.rahman.bayazid@gmail.com'});menus[0][0].click();Window.current.events.get('web:context-menu')({}, {linkURL:'https://github.com/anisur-bayazid25/eQc'});menus[1][0].click();assert.deepEqual(copied,['anisur.rahman.bayazid@gmail.com','https://github.com/anisur-bayazid25/eQc']);
  const p={id:'qa',name:'History bridge QA',createdAt:1,folders:[],docs:[],codes:[],codedSegments:[]};const receipt=await bridge.saveProject(p,{actor:'QA'});assert.deepEqual(Object.keys(receipt).sort(),['id','updatedAt']);assert.equal(receipt.id,p.id);assert.equal((await bridge.loadProject(p.id)).name,p.name);const before=await bridge.projectHistory(p.id);assert.equal(before.activity.length,1);const points=await bridge.createCheckpoint(p.id,'Checkpoint');assert.equal(points.snapshots.length,1);assert.equal((await bridge.readSnapshot(p.id,points.snapshots[0].id)).name,p.name);await assert.rejects(bridge.readSnapshot('other',points.snapshots[0].id));
  const content='Water access affects work and care. Neighbours share resources.\n'.repeat(300);
  const large={...p,id:'large-save',docs:Array.from({length:80},(_,i)=>({id:'d'+i,name:'Interview '+i,content,addedAt:1})),codes:Array.from({length:600},(_,i)=>({id:'c'+i,name:'Theme '+i,parentId:null,summary:'Interpretation '.repeat(50),createdAt:1})),codedSegments:Array.from({length:4000},(_,i)=>({id:'s'+i,docId:'d'+i%80,codeId:'c'+i%600,start:0,end:5,text:'Water',createdAt:1,coder:'QA'}))};
  await bridge.saveProject(large);
  const timings=[];
  for(let i=0;i<5;i++){
    large.codedSegments.push({id:'new'+i,docId:'d0',codeId:'c0',start:6,end:12,text:'access',createdAt:2,coder:'QA'});
    const start=performance.now();await bridge.saveProject(large,{actor:'QA'});timings.push(performance.now()-start);
  }
  const persisted=await bridge.loadProject(large.id);assert.equal(persisted.codedSegments.length,4005);assert.equal(persisted.docs[0].content,content);
  const largeHistory=await bridge.projectHistory(large.id);assert.equal(largeHistory.activity.length,6);assert.equal(largeHistory.snapshots.length,1);assert.equal((await bridge.readSnapshot(large.id,largeHistory.snapshots[0].id)).codedSegments.length,4000);
  console.log('Isolated main/preload SQLite save, 600 codes / 4005 excerpts: median '+timings.sort((a,b)=>a-b)[2].toFixed(1)+' ms (IPC simulated; snapshots/activity retained).');
  const legacy={version:2,activeId:'person',profiles:[{id:'person',details:{name:'Amina',email:'',designation:'Researcher',organization:'',photo:'',paused:false},records:[],updatedAt:1,lastWorkedAt:0}]};
  const opened=await bridge.profileTime.open(legacy);assert.equal(opened.profile.id,'person');assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory,'profile-time-before-sqlite.json'),'utf8')),legacy);
  const final={id:'final',day:'2026-10-08',projectId:'qa',projectName:'History bridge QA',start:100,end:12100,appMs:12000,codingMs:12000,firstCoding:100,lastCoding:100};
  const unsubscribe=bridge.profileTime.onPrepareClose(()=>{void (async()=>{await bridge.profileTime.write({profileId:'person',records:[final]});bridge.profileTime.completeClose({ok:true});})();});
  Window.current.close();assert.equal(Window.current.closed,false);await new Promise(resolve=>setImmediate(resolve));assert.equal(Window.current.closed,true);assert.equal((await bridge.profileTime.backup('person')).profile.records[0].end,12100);unsubscribe();
 }finally{connections.forEach(db=>db.close());fs.rmSync(directory,{recursive:true,force:true});}
});
