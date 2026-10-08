// Test actual main/preload registration with isolated SQLite, without desktop windows.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module'),{DatabaseSync}=require('node:sqlite');
test('main/preload history, checkpoint and recovery handlers work together after startup',async()=>{
 const directory=fs.mkdtempSync(path.join(__dirname,'bridge-qa-'));assert.ok(path.resolve(directory).startsWith(path.resolve(__dirname)+path.sep));
 const connections=[],handlers=new Map();
 class Database {constructor(file){this.db=new DatabaseSync(file);connections.push(this.db);}exec(sql){return this.db.exec(sql);}prepare(sql){return this.db.prepare(sql);}pragma(sql){return this.db.prepare('PRAGMA '+sql).all();}transaction(task){return(...args)=>{this.db.exec('BEGIN');try{const result=task(...args);this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}};}}
 class Window {constructor(){this.webContents={send(){},openDevTools(){}};}loadFile(){}loadURL(){}static getAllWindows(){return[];}}
 const app={getPath:()=>directory,whenReady:()=>Promise.resolve(),on(){},getVersion:()=> '1.7.0',quit(){}};
 const electron={app,BrowserWindow:Window,ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},dialog:{},Menu:{setApplicationMenu(){}}};
 const mainFile=path.resolve(__dirname,'../electron/main.cjs'),realRequire=createRequire(mainFile);
 try {
  vm.runInNewContext(fs.readFileSync(mainFile,'utf8'),{require:name=>name==='electron'?electron:name==='better-sqlite3'?Database:name==='electron-updater'?{autoUpdater:{on(){}}}:name==='./lan.cjs'?()=>{}:realRequire(name),__dirname:path.dirname(mainFile),process,Buffer,console,setTimeout:()=>0,module:{exports:{}},exports:{}},{filename:mainFile});
  await new Promise(resolve=>setImmediate(resolve));
  let bridge;const preloadFile=path.resolve(__dirname,'../electron/preload.cjs');
  vm.runInNewContext(fs.readFileSync(preloadFile,'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_,api)=>bridge=api},ipcRenderer:{invoke:async(name,...args)=>{if(!handlers.has(name))throw new Error('Missing handler '+name);return handlers.get(name)({},...args);},on(){}}}),console},{filename:preloadFile});
  const p={id:'qa',name:'History bridge QA',createdAt:1,folders:[],docs:[],codes:[],codedSegments:[]};await bridge.saveProject(p,{actor:'QA'});const before=await bridge.projectHistory(p.id);assert.equal(before.activity.length,1);const points=await bridge.createCheckpoint(p.id,'Checkpoint');assert.equal(points.snapshots.length,1);assert.equal((await bridge.readSnapshot(p.id,points.snapshots[0].id)).name,p.name);await assert.rejects(bridge.readSnapshot('other',points.snapshots[0].id));
 }finally{connections.forEach(db=>db.close());fs.rmSync(directory,{recursive:true,force:true});}
});
