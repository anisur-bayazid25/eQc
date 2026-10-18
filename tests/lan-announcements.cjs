const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events');
function fixture(){
 const handlers=new Map(),events=[],saves=[],module={exports:{}};
 const source=fs.readFileSync('electron/lan.cjs','utf8').replace('  function pushToRenderer','  module.exports.inspect={state,connect:handleClientConnection};\n  function pushToRenderer');
 vm.runInNewContext(source,{module,require:name=>name==='ws'?{Server:class{},WebSocket:class{}}:require(name),Buffer,console,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){}});
 module.exports({handle:(name,fn)=>handlers.set(name,fn)},{saveProject:p=>saves.push(JSON.parse(JSON.stringify(p))),getWindow:()=>({isDestroyed:()=>false,webContents:{send:(name,payload)=>events.push({name,payload})}})});
 const {state,connect}=module.exports.inspect;state.role='host';state.host={hostName:'Host',projectId:'p',sessionProjectId:'p',projectName:'Study',clients:new Map(),password:'secret',clientSeq:0,seq:0,log:[],currentProject:{id:'p',name:'Study',createdAt:1,codes:[],docs:[],codedSegments:[]},activeDocId:null,announcementSessionId:'session-1',sessionAnnouncements:[]};
 class Socket extends EventEmitter {constructor(){super();this.readyState=1;this.sent=[];}send(message){this.sent.push(JSON.parse(message));}close(){}}
 const guest=new Socket();connect(guest,{});const send=msg=>guest.emit('message',JSON.stringify(msg)),call=(name,payload)=>handlers.get('lan:'+name)({},payload);
 return {state,connect,Socket,guest,send,call,events,saves,auth:()=>send({type:'AUTH_REQUEST',password:'secret',coderName:'Member'}),result:()=>guest.sent.filter(m=>m.type==='ANNOUNCEMENT_RESULT').at(-1)};
}
test('announcement permission is enforced by the host, authors cannot be spoofed and revocation applies immediately',()=>{
 const f=fixture();f.send({type:'ANNOUNCEMENT_ACTION',requestId:'0',payload:{operation:'post',text:'Hidden',retention:'project'}});assert.equal(f.result().ok,false);f.auth();
 f.send({type:'ANNOUNCEMENT_ACTION',requestId:'1',payload:{operation:'post',text:'No permission',retention:'session'}});assert.equal(f.result().ok,false);assert.equal(f.state.host.sessionAnnouncements.length,0);
 assert.equal(f.call('setAnnouncementPermission',{clientId:'c1',allowed:true}).ok,true);assert.equal(f.guest.sent.filter(m=>m.type==='PRESENCE').at(-1).payload.canAnnounce,true);
 f.send({type:'ANNOUNCEMENT_ACTION',requestId:'2',payload:{operation:'post',text:'Team meeting',retention:'project',authorName:'Forged host',authorId:'host'}});assert.equal(f.result().ok,true);
 const entry=f.state.host.currentProject.announcements[0];assert.equal(entry.authorName,'Member');assert.equal(entry.authorId,'session-1:c1');assert.equal(entry.retention,'project');assert.equal(f.saves.length,1);assert.equal(f.saves[0].announcements[0].text,'Team meeting');
 f.call('setAnnouncementPermission',{clientId:'c1',allowed:false});f.send({type:'ANNOUNCEMENT_ACTION',requestId:'3',payload:{operation:'delete',id:entry.id}});assert.equal(f.result().ok,false);assert.equal(f.state.host.currentProject.announcements.length,1);
 f.state.role='client';assert.equal(f.call('setAnnouncementPermission',{clientId:'c1',allowed:true}).ok,false);
});
test('saved announcements survive stale snapshots and cannot be forged or deleted by normal project edits',()=>{
 const f=fixture();f.auth();assert.equal(f.call('postAnnouncement',{text:'Saved instructions',retention:'project'}).ok,true);const saved=f.state.host.currentProject.announcements[0];
 f.send({type:'ACTION_DISPATCH',project:{...f.state.host.currentProject,name:'Edited study',announcements:[{...saved,id:'forged',text:'Injected'}]}});
 assert.equal(f.state.host.currentProject.name,'Edited study');assert.equal(f.state.host.currentProject.announcements.length,1);assert.equal(f.state.host.currentProject.announcements[0].id,saved.id);assert.equal(f.guest.sent.filter(m=>m.type==='ACTION_DISPATCH').at(-1).project.announcements[0].id,saved.id);
 const stale=JSON.parse(JSON.stringify(f.state.host.currentProject));assert.equal(f.call('deleteAnnouncement',saved.id).ok,true);f.call('sendAction',{coderName:'Host',project:stale});assert.equal(f.state.host.currentProject.announcements.length,0);
});
test('temporary announcements are session-only, available to late joiners, and deletions respect authorship',()=>{
 const f=fixture();f.auth();f.call('setAnnouncementPermission',{clientId:'c1',allowed:true});f.send({type:'ANNOUNCEMENT_ACTION',requestId:'a',payload:{operation:'post',text:'Temporary',retention:'session'}});const entry=f.state.host.sessionAnnouncements[0];assert.equal(f.saves.length,0);assert.equal(f.state.host.currentProject.announcements,undefined);
 const other=new f.Socket();f.connect(other,{});other.emit('message',JSON.stringify({type:'AUTH_REQUEST',password:'secret',coderName:'Member'}));assert.equal(other.sent.filter(m=>m.type==='PRESENCE').at(-1).payload.announcements[0].id,entry.id);
 f.call('setAnnouncementPermission',{clientId:'c2',allowed:true});other.emit('message',JSON.stringify({type:'ANNOUNCEMENT_ACTION',requestId:'b',payload:{operation:'delete',id:entry.id}}));assert.equal(other.sent.filter(m=>m.type==='ANNOUNCEMENT_RESULT').at(-1).ok,false);
 f.send({type:'ANNOUNCEMENT_ACTION',requestId:'c',payload:{operation:'delete',id:entry.id}});assert.equal(f.result().ok,true);assert.equal(f.state.host.sessionAnnouncements.length,0);
 f.call('postAnnouncement',{text:'Temporary again',retention:'session'});assert.equal(f.call('deleteAnnouncement',f.state.host.sessionAnnouncements[0].id).ok,true);assert.equal(f.saves.length,0);
 f.call('postAnnouncement',{text:'Ends now',retention:'session'});f.call('stopHost');assert.equal(f.state.host,null);assert.equal(f.events.filter(e=>e.name==='lan:sessionState').at(-1).payload,null);
});
test('announcement validation rejects invalid storage, empty/oversized messages, and missing deletions',()=>{
 const f=fixture();for(const payload of [{text:' ',retention:'session'},{text:'x'.repeat(2001),retention:'project'},{text:'hello',retention:'invalid'}])assert.equal(f.call('postAnnouncement',payload).ok,false);assert.equal(f.call('deleteAnnouncement','missing').ok,false);assert.equal(f.saves.length,0);
});


test('announcement RPC works over WebSocket, returns denials/acknowledgements and clears temporary state on a new session',async()=>{
 const actualWs=require('ws');
 const make=()=>{const handlers=new Map(),events=[],saves=[],module={exports:{}};let server;
  class TestServer extends actualWs.Server {constructor(){super({host:'127.0.0.1',port:0});server=this;}}
  const udp={createSocket:()=>{const socket=new EventEmitter();socket.bind=(_port,callback)=>callback?.();socket.setBroadcast=()=>{};socket.send=()=>{};socket.close=()=>{};return socket;}};
  const source=fs.readFileSync('electron/lan.cjs','utf8').replace('  function pushToRenderer','  module.exports.inspect={state};\n  function pushToRenderer');
  vm.runInNewContext(source,{module,require:name=>name==='ws'?{...actualWs,Server:TestServer}:name==='node:dgram'?udp:require(name),Buffer,console,setTimeout,clearTimeout,setInterval,clearInterval});
  module.exports({handle:(name,fn)=>handlers.set(name,fn)},{saveProject:p=>saves.push(JSON.parse(JSON.stringify(p))),getWindow:()=>({isDestroyed:()=>false,webContents:{send:(name,payload)=>events.push({name,payload})}})});
  return{call:(name,payload)=>handlers.get('lan:'+name)({},payload),events,saves,state:module.exports.inspect.state,port:()=>server.address().port};
 };
 const host=make(),client=make(),project={id:'network-test',name:'Network test',createdAt:1,codes:[],docs:[],codedSegments:[]};
 try{
  assert.equal((await host.call('startHost',{hostName:'Host',password:'secret',project})).ok,true);
  assert.equal((await client.call('joinSession',{hostIp:'127.0.0.1',wsPort:host.port(),password:'secret',coderName:'Peer',projectId:project.id,lastSeq:null})).ok,true);
  assert.equal((await client.call('postAnnouncement',{text:'Denied',retention:'project'})).ok,false);
  const peer=[...host.state.host.clients.values()][0];host.call('setAnnouncementPermission',{clientId:peer.clientId,allowed:true});
  assert.equal((await client.call('postAnnouncement',{text:'Saved over the wire',retention:'project'})).ok,true);const saved=host.state.host.currentProject.announcements[0];assert.equal(saved.authorName,'Peer');assert.ok(client.events.some(e=>e.name==='lan:remoteProject'&&e.payload.project.announcements?.some(a=>a.id===saved.id)));
  assert.equal((await client.call('postAnnouncement',{text:'Temporary over the wire',retention:'session'})).ok,true);assert.equal(host.state.host.sessionAnnouncements.length,1);assert.ok(host.saves.every(p=>(p.announcements||[]).every(a=>a.retention==='project')));
  assert.equal((await client.call('deleteAnnouncement',saved.id)).ok,true);assert.equal(host.state.host.currentProject.announcements.length,0);
  await client.call('disconnectSession');await host.call('stopHost');assert.equal((await host.call('startHost',{hostName:'Host',password:'secret',project:host.saves.at(-1)})).ok,true);assert.equal(host.state.host.sessionAnnouncements.length,0);
 }finally{client.call('disconnectSession');host.call('stopHost');}
});


test('disconnecting resolves pending announcement requests instead of leaving the composer busy',async()=>{
 const f=fixture();f.state.role='client';f.state.client={ws:f.guest,coderName:'Peer'};const pending=f.call('postAnnouncement',{text:'Pending',retention:'session'});assert.equal(f.guest.sent.at(-1).type,'ANNOUNCEMENT_ACTION');f.call('disconnectSession');const result=await pending;assert.equal(result.ok,false);assert.match(result.error,/Disconnected/);
});
