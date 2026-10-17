const test=require('node:test'),assert=require('node:assert/strict');
const {validateFeedback,feedbackText,RECIPIENT}=require('../electron/feedbackSchema.cjs');
const {sendFeedback,feedbackEndpoint,installFeedback,imageAttachment}=require('../electron/feedback.cjs');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1cAAAAASUVORK5CYII=';
const fixture=()=>({schemaVersion:1,id:'0a123456-1234-4123-8123-123456789012',kind:'bug',senderName:'Researcher',replyTo:'researcher@example.org',subject:'Graph label',description:'A label disappears.',steps:'Open the graph.',expected:'Label stays visible.',device:{'App version':'1.8.2','Operating system':'Windows','Username':'Must not leak'},screenshot:{name:'private-path.png',base64:png},project:{secret:'Must not leak'},to:'attacker@example.org'});
test('feedback accepts only reviewed fields and bounded PNG screenshots, rejecting header injection and invalid payloads',()=>{
  const report=validateFeedback(fixture());assert.equal(report.project,undefined);assert.equal(report.to,undefined);assert.equal(report.device.Username,undefined);assert.equal(report.screenshot.name,'screenshot.png');assert.doesNotMatch(feedbackText(report),/Must not leak|attacker|private-path/);
  for(const patch of [{senderName:undefined},{senderName:''},{senderName:'   '},{senderName:'x'.repeat(121)},{senderName:'Injected\r\nName'},{replyTo:''},{replyTo:undefined},{replyTo:'a@example.org\nBcc: other@example.org'},{subject:'Injected\r\nheader'},{kind:'unsupported'},{description:' '},{subject:'x'.repeat(161)},{id:'bad'},{screenshot:{base64:Buffer.from('not an image').toString('base64')}},{screenshot:{base64:png.repeat(60000)}}])assert.throws(()=>validateFeedback({...fixture(),...patch}));
  assert.match(feedbackText(report),/Sender name: Researcher/);
  const noExtras=validateFeedback({...fixture(),device:undefined,screenshot:undefined});assert.equal(noExtras.device,undefined);assert.equal(noExtras.screenshot,undefined);
});
test('desktop posts sanitized payload only to configured HTTPS and requires matching accepted report ID',async()=>{
  assert.equal(feedbackEndpoint('http://example.org/reports'),null);assert.equal(feedbackEndpoint('https://user:pass@example.org/reports'),null);assert.equal(feedbackEndpoint('https://example.org/reports?q=key'),null);
  let called=0;const accept=async(url,options)=>{called++;assert.equal(url,'https://reports.example.org/reports');assert.equal(options.redirect,'error');const data=JSON.parse(options.body);assert.equal(data.project,undefined);assert.equal(data.to,undefined);return Response.json({ok:true,reportId:data.id});};
  assert.equal((await sendFeedback(fixture(),'',accept)).ok,false);assert.equal(called,0);
  assert.equal((await sendFeedback(fixture(),'https://reports.example.org/reports',accept)).ok,true);assert.equal(called,1);
  assert.equal((await sendFeedback(fixture(),'https://reports.example.org/reports',async()=>Response.json({ok:true,reportId:'other'}))).ok,false);
  assert.match((await sendFeedback(fixture(),'https://reports.example.org/reports',async()=>new Response('',{status:429}))).error,/minute/);
  assert.equal((await sendFeedback(fixture(),'https://reports.example.org/reports',async()=>{throw Error('private-network-info');})).ok,false);
});
test('hosted email service fixes recipient, reply-to, attachment and idempotency without forwarding project data',async()=>{
  const {handleFeedback}=await import('../services/feedback/worker.mjs');
  const report=fixture(),keys=[];const env={RESEND_API_KEY:'test-server-secret',FEEDBACK_FROM:'eQc <reports@example.org>',REPORT_LIMIT:{limit:async({key})=>{keys.push(key);return {success:true};}}};
  const request=()=>new Request('https://worker.example.org/reports',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(report)});
  const response=await handleFeedback(request(),env,async(url,options)=>{
    assert.equal(url,'https://api.resend.com/emails');const mail=JSON.parse(options.body);assert.deepEqual(mail.to,[RECIPIENT]);assert.equal(mail.reply_to,report.replyTo);assert.equal(mail.attachments[0].content,png);assert.equal(options.headers['Idempotency-Key'],`eqc-feedback/${report.id}`);assert.equal(options.headers.Authorization,'Bearer test-server-secret');assert.doesNotMatch(mail.text,/Must not leak|attacker/);return Response.json({id:'test-provider-id'});
  });
  assert.deepEqual(await response.json(),{ok:true,reportId:report.id,delivery:'accepted'});assert.ok(keys.every(key=>!key.includes('researcher@')&&!key.includes('192.0.2.1')));
  assert.equal((await handleFeedback(request(),{...env,REPORT_LIMIT:{limit:async()=>({success:false})}},()=>{throw Error('Must not send');})).status,429);
  assert.equal((await handleFeedback(request(),{},()=>{throw Error('Must not send');})).status,503);
  assert.equal((await handleFeedback(new Request('https://worker.example.org/reports',{method:'POST',headers:{Origin:'https://untrusted.example'}}),env)).status,403);
  assert.equal((await handleFeedback(request(),env,async()=>Response.json({error:'private-provider-details'},{status:403}))).status,502);
  const invalid=new Request('https://worker.example.org/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...report,replyTo:'invalid'})});assert.equal((await handleFeedback(invalid,env)).status,400);
});
test('hosted service rejects oversized bodies, unexpected routes, methods and content types',async()=>{
  const {handleFeedback}=await import('../services/feedback/worker.mjs'),env={RESEND_API_KEY:'test',FEEDBACK_FROM:'reports@example.org',REPORT_LIMIT:{limit:async()=>({success:true})}};
  assert.equal((await handleFeedback(new Request('https://worker.example.org/health'),env)).status,200);
  assert.equal((await handleFeedback(new Request('https://worker.example.org/unknown'),env)).status,404);
  assert.equal((await handleFeedback(new Request('https://worker.example.org/reports'),env)).status,405);
  assert.equal((await handleFeedback(new Request('https://worker.example.org/reports',{method:'POST',body:'text'}),env)).status,415);
  assert.equal((await handleFeedback(new Request('https://worker.example.org/reports',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':'5000000'},body:'{}'}),env)).status,400);
});
test('IPC rejects other windows and subframes; saved ZIP contains only selected report fields and screenshot',async()=>{
  const handlers={},JSZip=require('jszip'),writes=[];const win={webContents:{mainFrame:{},capturePage:async()=>({isEmpty:()=>false,getSize:()=>({width:1,height:1}),toPNG:()=>Buffer.from(png,'base64')})},getBounds:()=>({})};const event={sender:win.webContents,senderFrame:win.webContents.mainFrame};
  installFeedback({ipcMain:{handle:(name,fn)=>handlers[name]=fn},app:{getVersion:()=> '1.8.2'},dialog:{showSaveDialog:async()=>({filePath:'test.zip'}),showOpenDialog:async()=>({canceled:true})},nativeImage:{},screen:{getDisplayMatching:()=>({size:{width:1440,height:900},scaleFactor:1})},fs:{writeFileSync:(file,data)=>writes.push(data)},JSZip,getWindow:()=>win,endpoint:''});
  assert.throws(()=>handlers['feedback:context']({sender:{},senderFrame:{}}));assert.throws(()=>handlers['feedback:context']({...event,senderFrame:{}}));
  const context=handlers['feedback:context'](event);assert.equal(context.recipient,RECIPIENT);assert.equal(context.configured,false);assert.equal(context.device.Username,undefined);
  assert.equal((await handlers['feedback:capture'](event)).base64,png);assert.equal(await handlers['feedback:pickScreenshot'](event),null);
  await handlers['feedback:save'](event,fixture());const zip=await JSZip.loadAsync(writes[0]);assert.deepEqual(Object.keys(zip.files).sort(),['report.txt','screenshot.png']);assert.doesNotMatch(await zip.file('report.txt').async('string'),/Must not leak|attacker/);
  assert.throws(()=>imageAttachment({isEmpty:()=>true}));
});
