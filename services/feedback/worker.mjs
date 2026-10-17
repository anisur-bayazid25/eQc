import schema from '../../electron/feedbackSchema.cjs';
const {RECIPIENT,validateFeedback,feedbackText} = schema;
const MAX_BODY_BYTES = 4300000;
const json = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const ready = env => !!env.RESEND_API_KEY && typeof env.FEEDBACK_FROM === 'string' && env.FEEDBACK_FROM.includes('@') && env.FEEDBACK_FROM.length<=254 && !/[\r\n]/.test(env.FEEDBACK_FROM) && !!env.REPORT_LIMIT?.limit;
async function hash(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function readBody(request) {
  if(Number(request.headers.get('Content-Length'))>MAX_BODY_BYTES)throw Error('Report too large.');
  const reader=request.body?.getReader();if(!reader)throw Error('Missing report.');
  const chunks=[];let length=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_BODY_BYTES){await reader.cancel();throw Error('Report too large.');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export async function handleFeedback(request,env,send=fetch) {
  const path=new URL(request.url).pathname;
  if(path==='/health' && request.method==='GET')return json({service:'eQc feedback',ready:ready(env)},ready(env)?200:503);
  if(path!=='/reports')return json({ok:false,error:'Not found.'},404);
  if(request.method!=='POST')return json({ok:false,error:'Use POST.'},405);
  // Desktop sends through its main process. Browser origins are not accepted.
  if(request.headers.has('Origin'))return json({ok:false,error:'Submit from eQc.'},403);
  if(!ready(env))return json({ok:false,error:'Reporting service unavailable.'},503);
  if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))return json({ok:false,error:'Use JSON.'},415);
  let report;
  try{
    const ip=request.headers.get('CF-Connecting-IP')||'unknown';
    const allowance=await env.REPORT_LIMIT.limit({key:'ip:'+await hash(ip)});
    if(!allowance.success)return json({ok:false,error:'Please try again later.'},429);
    report=validateFeedback(await readBody(request));
    const senderAllowance=await env.REPORT_LIMIT.limit({key:'reply:'+await hash(report.replyTo.toLowerCase())});
    const serviceAllowance=await env.REPORT_LIMIT.limit({key:'service'});
    if(!senderAllowance.success||!serviceAllowance.success)return json({ok:false,error:'Please try again later.'},429);
  }catch{return json({ok:false,error:'Invalid report or reporting temporarily unavailable.'},400);}
  const labels={bug:'Bug report',feature:'Feature request',other:'Feedback'};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
    const response=await send('https://api.resend.com/emails',{
      method:'POST',redirect:'error',signal:controller.signal,
      headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`eqc-feedback/${report.id}`},
      body:JSON.stringify({from:env.FEEDBACK_FROM,to:[RECIPIENT],reply_to:report.replyTo,subject:`[eQc ${labels[report.kind]}] ${report.subject}`,text:feedbackText(report),
        ...(report.screenshot?{attachments:[{filename:'screenshot.png',content:report.screenshot.base64}]}:{})})
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok||typeof data?.id!=='string'||!data.id)return json({ok:false,error:'Email service did not accept this report.'},502);
    return json({ok:true,reportId:report.id,delivery:'accepted'});
  }catch{return json({ok:false,error:'Email service unavailable.'},502);}
  finally{clearTimeout(timer);}
}
export default {fetch:(request,env)=>handleFeedback(request,env)};
