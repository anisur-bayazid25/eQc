const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events');
test('LAN own-name updates refresh presence and authenticated peer identity without relabeling history',()=>{
 const handlers=new Map(),events=[],module={exports:{}};const source=fs.readFileSync('electron/lan.cjs','utf8').replace('  function pushToRenderer','  module.exports.inspect={state,connect:handleClientConnection};\n  function pushToRenderer');
 vm.runInNewContext(source,{module,require:name=>name==='ws'?{Server:class{},WebSocket:class{}}:require(name),Buffer,console,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){}});
 module.exports({handle:(name,fn)=>handlers.set(name,fn)},{getWindow:()=>({isDestroyed:()=>false,webContents:{send:(name,payload)=>events.push({name,payload})}})});
 const {state,connect}=module.exports.inspect;state.role='host';state.host={hostName:'Before',projectId:'p',projectName:'Study',clients:new Map(),password:'',clientSeq:0,seq:0,log:[{seq:1,coderName:'Historical author'}],currentProject:null,activeDocId:null};
 handlers.get('lan:updateName')({},'Amina');assert.equal(state.host.hostName,'Amina');assert.equal(events.at(-1).payload.myName,'Amina');assert.equal(state.host.log[0].coderName,'Historical author');
 class Socket extends EventEmitter {constructor(){super();this.readyState=1;this.sent=[];}send(message){this.sent.push(JSON.parse(message));}close(){}}
 const guest=new Socket();connect(guest,{});guest.emit('message',JSON.stringify({type:'SET_CODER_NAME',name:'Unauthenticated'}));assert.equal(guest.coderName,'Coder');assert.equal(state.host.clients.size,0);
 guest.emit('message',JSON.stringify({type:'AUTH_REQUEST',password:'',coderName:'Old guest'}));guest.emit('message',JSON.stringify({type:'SET_CODER_NAME',name:'Ravi'}));assert.equal(guest.coderName,'Ravi');assert.equal(state.host.clients.get(guest).coderName,'Ravi');assert.equal(guest.sent.filter(m=>m.type==='PRESENCE').at(-1).payload.myName,'Ravi');
 state.role='client';state.client={coderName:'Before',ws:guest};handlers.get('lan:updateName')({},'Leena');assert.equal(state.client.coderName,'Leena');assert.equal(guest.sent.at(-1).type,'SET_CODER_NAME');assert.equal(guest.sent.at(-1).name,'Leena');
});
