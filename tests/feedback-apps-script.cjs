const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {appsScriptSource}=require('../services/feedback/apps-script/build.cjs');
const {sendFeedback,feedbackEndpoint,googleContentRedirect}=require('../electron/feedback.cjs');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1cAAAAASUVORK5CYII=';
const fixture=(patch={})=>({schemaVersion:1,id:crypto.randomUUID(),kind:'bug',senderName:'Researcher',replyTo:'researcher@example.org',subject:'Graph label',description:'A label disappears.',steps:'Open graph.',expected:'The label stays.',device:{'App version':'1.8.2',Username:'Excluded'},screenshot:{base64:png},project:{private:'Excluded'},to:'attacker@example.org',...patch});
const {appsScriptHarness:harness}=require('./helpers/feedbackAppsScript.cjs');
test('paste-ready Apps Script stays generated from shared validation; authorization sends no email',()=>{
  assert.equal(fs.readFileSync(path.resolve(__dirname,'../services/feedback/apps-script/Code.gs'),'utf8').replace(/\r\n/g,'\n'),appsScriptSource());
  assert.doesNotMatch(appsScriptSource(),/module\.exports|require\(/);
  const h=harness();assert.equal(h.context.authorizeFeedback().dailyReportCap,50);assert.equal(h.mails.length,0);assert.equal(JSON.parse(h.context.doGet().text).backend,'google-apps-script');
});
test('Apps Script sends only to fixed Gmail with reply-to, selected fields and bounded PNG',()=>{
  const h=harness(),report=fixture(),result=h.send(report);assert.equal(result.ok,true);assert.equal(result.reportId,report.id);assert.equal(h.mails.length,1);
  const mail=h.mails[0];assert.equal(mail.to,'anisur.rahman.bayazid@gmail.com');assert.equal(mail.replyTo,report.replyTo);assert.equal(mail.attachments[0].name,'screenshot.png');assert.equal(mail.attachments[0].type,'image/png');assert.deepEqual(Array.from(mail.attachments[0].value,byte=>(byte+256)%256),Array.from(Buffer.from(png,'base64')));assert.doesNotMatch(mail.body,/Excluded|attacker/);
  assert.doesNotMatch(JSON.stringify([...h.records]),/researcher@example.org|label disappears|iVBOR/);
  const noExtras=h.send(fixture({device:undefined,screenshot:undefined,kind:'feature'}));assert.equal(noExtras.ok,true);assert.equal(h.mails[1].attachments,undefined);assert.doesNotMatch(h.mails[1].body,/Device information/);
});
test('accepted retries deduplicate, changed content conflicts and uncertain delivery is never resent automatically',()=>{
  const h=harness(),report=fixture();assert.equal(h.send(report).ok,true);assert.equal(h.send(report).duplicate,true);assert.equal(h.mails.length,1);assert.equal(h.send({...report,subject:'Changed'}).code,'id_conflict');
  const uncertain=fixture();h.setFail(true);assert.equal(h.send(uncertain).code,'delivery_uncertain');h.setFail(false);assert.equal(h.send(uncertain).code,'delivery_uncertain');assert.equal(h.mails.length,2);
});
test('persistent daily cap, remaining Google quota, minute/sender limits and lock are enforced',()=>{
  const h=harness();h.setLocked(true);assert.equal(h.send(fixture()).code,'busy');h.setLocked(false);
  for(let i=0;i<3;i++)assert.equal(h.send(fixture()).ok,true);assert.equal(h.send(fixture()).code,'rate_limited');
  for(let i=0;i<2;i++)assert.equal(h.send(fixture({replyTo:`other${i}@example.org`})).ok,true);
  assert.equal(h.send(fixture({replyTo:'new@example.org'})).code,'rate_limited');h.advance(61000);assert.equal(h.send(fixture({replyTo:'new@example.org'})).ok,true);
  h.setQuota(0);assert.equal(h.send(fixture({replyTo:'quota@example.org'})).code,'daily_limit');
  const capped=harness();for(let i=0;i<50;i++){assert.equal(capped.send(fixture({replyTo:`person${i}@example.org`})).ok,true);capped.advance(61000);}assert.equal(capped.send(fixture({replyTo:'next@example.org'})).code,'daily_limit');assert.equal(capped.mails.length,50);capped.advance(24*60*60*1000);assert.equal(capped.send(fixture()).ok,true);
});
test('Apps Script rejects invalid/oversized requests and cleans expired ID records',()=>{
  const h=harness();assert.equal(h.send(fixture({replyTo:'invalid'})).code,'invalid_report');assert.equal(h.send(fixture({screenshot:{base64:'bad'}})).code,'invalid_report');
  for(const patch of [{senderName:undefined},{senderName:''},{senderName:'  '},{replyTo:undefined},{replyTo:''}])assert.equal(h.send(fixture(patch)).code,'invalid_report');
  assert.deepEqual(JSON.parse(h.context.doGet().text).requiredFields,['senderName','replyTo']);
  assert.equal(JSON.parse(h.context.doPost({postData:{type:'text/plain',contents:'{}'}}).text).code,'invalid_report');
  assert.equal(JSON.parse(h.context.doPost({postData:{type:'application/json',contents:'x'.repeat(4300001)}}).text).code,'invalid_report');
  assert.equal(h.mails.length,0);const report=fixture();h.send(report);h.advance(49*60*60*1000);h.send(fixture());assert.equal(h.records.has('eqc.report.'+report.id),false);
});
test('desktop follows only the Google content redirect with a GET and no report body',async()=>{
  const url='https://script.google.com/macros/s/TEST_DEPLOYMENT/exec',report=fixture(),calls=[];
  const accepted=await sendFeedback(report,url,async(target,options)=>{
    calls.push({target,options});if(calls.length===1){assert.equal(options.method,'POST');assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://script.googleusercontent.com/macros/echo?user_content_key=test'}});}
    assert.equal(options.method,'GET');assert.equal(options.body,undefined);assert.equal(options.redirect,'error');return Response.json({ok:true,reportId:report.id});
  });assert.equal(accepted.ok,true);assert.equal(calls.length,2);
  for(const location of ['https://accounts.google.com/login','https://script.googleusercontent.com.evil.example/macros/echo','http://script.googleusercontent.com/macros/echo','https://user:pass@script.googleusercontent.com/macros/echo','https://script.googleusercontent.com/other','https://evil.example/reports']){
    let count=0;assert.equal((await sendFeedback(report,url,async()=>{count++;return new Response(null,{status:302,headers:{Location:location}});})).ok,false);assert.equal(count,1);assert.equal(googleContentRedirect(location),null);
  }
  assert.equal(feedbackEndpoint('https://script.google.com/macros/s/TEST/dev'),null);assert.equal(feedbackEndpoint('https://script.google.com/other'),null);
});
test('Google JSON limit/uncertainty responses and HTML login pages never produce false success',async()=>{
  const url='https://script.google.com/macros/s/TEST_DEPLOYMENT/exec';
  for(const [code,pattern] of [['daily_limit',/daily limit/],['rate_limited',/busy/],['busy',/busy/],['delivery_uncertain',/could not be confirmed/]])assert.match((await sendFeedback(fixture(),url,async()=>Response.json({ok:false,code}))).error,pattern);
  assert.equal((await sendFeedback(fixture(),url,async()=>new Response('<html>Sign in</html>',{headers:{'Content-Type':'text/html'}}))).ok,false);
});
