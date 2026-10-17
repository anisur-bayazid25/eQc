const os = require('node:os');
const {RECIPIENT,MAX_SCREENSHOT_BYTES,validateFeedback,feedbackText} = require('./feedbackSchema.cjs');

function feedbackEndpoint(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if(url.protocol !== 'https:' || url.username || url.password || url.hash || url.search)return null;
    if(url.hostname === 'script.google.com' && (url.port || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)))return null;
    return url.href;
  } catch { return null; }
}
function appsScriptEndpoint(value) {return new URL(value).hostname === 'script.google.com';}
function googleContentRedirect(value) {
  try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='script.googleusercontent.com'&&!url.port&&!url.username&&!url.password&&!url.hash&&url.pathname.startsWith('/macros/')?url.href:null;}catch{return null;}
}
async function sendFeedback(input, endpoint, request = fetch) {
  const report = validateFeedback(input), url = feedbackEndpoint(endpoint);
  if (!url) return {ok:false,error:'Direct reporting is not available in this build yet. You can save the report below.'};
  const google=appsScriptEndpoint(url);
  const controller = new AbortController(), timer = setTimeout(()=>controller.abort(),google?45000:25000);
  try {
    let response = await request(url,{method:'POST',redirect:google?'manual':'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(report),signal:controller.signal});
    // ContentService redirects only the response to Google's one-time content URL.
    // Never replay the report body, follow a login redirect or follow another host.
    if(google && [302,303].includes(response.status)){
      const target=googleContentRedirect(response.headers.get('Location'));
      await response.body?.cancel();
      if(!target)throw Error('Unexpected reporting redirect.');
      response=await request(target,{method:'GET',redirect:'error',headers:{Accept:'application/json'},signal:controller.signal});
    }
    const data = await response.json().catch(()=>null);
    if (response.ok && data?.ok === true && data.reportId === report.id) return {ok:true,reportId:report.id};
    if(data?.code==='daily_limit')return {ok:false,error:'The reporting service has reached its daily limit. Save this report and try again later.'};
    if(data?.code==='rate_limited'||data?.code==='busy')return {ok:false,error:'The reporting service is busy. Your draft is still here; please try again in a few minutes.'};
    if(data?.code==='delivery_uncertain')return {ok:false,error:'Delivery could not be confirmed. Save this draft instead of sending it again.'};
    return {ok:false,error:response.status === 429 ? 'Too many reports were submitted recently. Please try again in a minute.' : 'The report could not be accepted. Your draft is still here; please try again or save it.'};
  } catch { return {ok:false,error:'Could not reach the reporting service. Check your connection and try again, or save the report.'}; }
  finally { clearTimeout(timer); }
}
function imageAttachment(image) {
  if (image.isEmpty()) throw Error('This image could not be read. Choose a PNG or JPEG screenshot.');
  let size = image.getSize();
  const scale = Math.min(1,1800/Math.max(size.width,size.height));
  if (scale < 1) image = image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale)),quality:'better'});
  let buffer = image.toPNG();
  for (let attempt=0;buffer.length>MAX_SCREENSHOT_BYTES && attempt<8;attempt++) {
    size=image.getSize();image=image.resize({width:Math.max(1,Math.round(size.width*.8)),height:Math.max(1,Math.round(size.height*.8)),quality:'better'});buffer=image.toPNG();
  }
  if (buffer.length>MAX_SCREENSHOT_BYTES) throw Error('This screenshot is too large. Please choose a smaller image.');
  return {name:'screenshot.png',base64:buffer.toString('base64')};
}
function installFeedback({ipcMain,app,BrowserWindow,dialog,nativeImage,screen,fs,JSZip,getWindow,endpoint}) {
  const trusted = event => {
    const win=getWindow();
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw Error('Feedback is available only from the main app window.');
    return win;
  };
  let sending=false;
  ipcMain.handle('feedback:context',event=>{
    const win=trusted(event), display=screen.getDisplayMatching(win.getBounds());
    return {recipient:RECIPIENT,configured:!!feedbackEndpoint(endpoint),device:{
      'App version':app.getVersion(),'Operating system':`${os.type()} ${os.release()}`,'Architecture':os.arch(),
      'Memory':`${(os.totalmem()/1024**3).toFixed(1)} GB`,'Display':`${display.size.width} × ${display.size.height}`,
      'Scale factor':String(display.scaleFactor),'Electron':process.versions.electron||'Unknown','Chromium':process.versions.chrome||'Unknown'
    }};
  });
  ipcMain.handle('feedback:capture',async event=>imageAttachment(await trusted(event).webContents.capturePage()));
  ipcMain.handle('feedback:pickScreenshot',async event=>{
    const {canceled,filePaths}=await dialog.showOpenDialog(trusted(event),{title:'Attach a screenshot',properties:['openFile'],filters:[{name:'Screenshots',extensions:['png','jpg','jpeg']}]});
    if(canceled||!filePaths[0])return null;
    if(fs.statSync(filePaths[0]).size>10*1024*1024)throw Error('Choose a screenshot smaller than 10 MB.');
    return imageAttachment(nativeImage.createFromBuffer(fs.readFileSync(filePaths[0])));
  });
  ipcMain.handle('feedback:send',async(event,input)=>{
    trusted(event);if(sending)return {ok:false,error:'A report is already being sent.'};
    sending=true;try{return await sendFeedback(input,endpoint);}finally{sending=false;}
  });
  ipcMain.handle('feedback:save',async(event,input)=>{
    const win=trusted(event),report=validateFeedback(input);
    const {canceled,filePath}=await dialog.showSaveDialog(win,{title:'Save feedback report',defaultPath:`eQc-report-${report.id.slice(0,8)}.zip`,filters:[{name:'Feedback report',extensions:['zip']}]});
    if(canceled||!filePath)return null;
    const zip=new JSZip();zip.file('report.txt',feedbackText(report));
    if(report.screenshot)zip.file('screenshot.png',Buffer.from(report.screenshot.base64,'base64'));
    fs.writeFileSync(filePath,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));return filePath;
  });
}
module.exports = {installFeedback,feedbackEndpoint,sendFeedback,imageAttachment,googleContentRedirect};
