import React,{useEffect,useRef,useState} from 'react';
import type {FeedbackContext,FeedbackReport,FeedbackScreenshot} from '../lib/feedback';

export default function FeedbackDialog({open,profileName,profileEmail,capture,onClose,onSent}:{open:boolean;profileName:string;profileEmail:string;capture:{nonce:number;screenshot?:FeedbackScreenshot}|null;onClose:()=>void;onSent:()=>void}) {
  const [senderName,setSenderName]=useState('');
  const [kind,setKind]=useState<FeedbackReport['kind']>('bug'),[replyTo,setReplyTo]=useState(''),[subject,setSubject]=useState(''),[description,setDescription]=useState(''),[steps,setSteps]=useState(''),[expected,setExpected]=useState('');
  const [id,setId]=useState(()=>crypto.randomUUID()),[context,setContext]=useState<FeedbackContext|null>(null),[includeDevice,setIncludeDevice]=useState(true),[screenshot,setScreenshot]=useState<FeedbackScreenshot|undefined>();
  const [busy,setBusy]=useState(false),[capturing,setCapturing]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[sent,setSent]=useState('');
  const dialog=useRef<HTMLDivElement>(null),form=useRef<HTMLFormElement>(null),started=useRef(false),captureNonce=useRef(0);
  useEffect(()=>{if(capture&&capture.nonce!==captureNonce.current){captureNonce.current=capture.nonce;setScreenshot(capture.screenshot);}},[capture]);
  useEffect(()=>{
    if(!open)return;
    if(!started.current){setSenderName(profileName);setReplyTo(profileEmail);setSubject('');setDescription('');setSteps('');setExpected('');setKind('bug');setIncludeDevice(true);setId(crypto.randomUUID());setSent('');setStatus('');setError('');started.current=true;}
    const previous=document.activeElement as HTMLElement;dialog.current?.focus();let active=true;
    setContext(null);
    if(!window.qv.feedback)setError('Restart eQc to enable the reporting tools in this build.');
    else window.qv.feedback.context().then(value=>{if(active)setContext(value);}).catch(()=>{if(active)setError('Reporting tools could not be loaded. Try reopening this form.');});
    return()=>{active=false;previous?.focus();};
  },[open]);
  function edited(){setId(crypto.randomUUID());setError('');setStatus('');}
  const payload=():FeedbackReport=>({schemaVersion:1,id,kind,senderName:senderName.trim(),replyTo:replyTo.trim(),subject:subject.trim(),description:description.trim(),steps:kind==='bug'?steps.trim():'',expected:kind==='bug'?expected.trim():'',...(includeDevice&&context?{device:context.device}:{}),...(screenshot?{screenshot}: {})});
  async function action(send:boolean){
    if(!form.current?.reportValidity()||!window.qv.feedback)return;
    setBusy(true);setError('');setStatus('');
    try{
      if(send){const result=await window.qv.feedback.send(payload());if(!result.ok){setError(result.error||'Could not send the report. Your draft is still here.');return;}setSent(result.reportId||id);started.current=false;onSent();setScreenshot(undefined);}
      else {const path=await window.qv.feedback.save(payload());if(path)setStatus('Report saved with its selected attachments. You can email the ZIP file when ready.');}
    }catch{setError(send?'Could not send the report. Your draft is still here; try again or save it.':'Could not save the report. Your draft is still here.');}
    finally{setBusy(false);}
  }
  async function attach(){try{const image=await window.qv.feedback?.pickScreenshot();if(image){edited();setScreenshot(image);}}catch{setError('Could not read the screenshot. Choose a PNG or JPEG smaller than 10 MB.');}}
  async function retake(){
    setCapturing(true);setError('');
    try{await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));const image=await window.qv.feedback?.capture();if(image){edited();setScreenshot(image);}}
    catch{setError('Could not capture the eQc window. You can attach a screenshot instead.');}
    finally{setCapturing(false);requestAnimationFrame(()=>dialog.current?.focus());}
  }
  if(!open)return null;
  return <div className="research-overlay feedback-overlay" style={capturing?{visibility:'hidden'}:undefined}><div className="feedback-dialog" role="dialog" aria-modal="true" aria-label="Send feedback" ref={dialog} tabIndex={-1} onKeyDown={event=>{
    if(event.key==='Escape'&&!busy&&!capturing){event.stopPropagation();onClose();}
    if(event.key==='Tab'){const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary')||[]),first=items[0],last=items[items.length-1];if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  }}>
    <header><h2>Send feedback</h2><button type="button" disabled={busy} onClick={onClose}>Close feedback</button></header>
    {sent?<div role="status"><h3>Report accepted for email delivery</h3><p>Thank you. Replies will go to {replyTo}.</p><p>Reference: {sent}</p><button onClick={onClose}>Done</button></div>:<form ref={form} onSubmit={event=>{event.preventDefault();void action(true);}}>
      <p>Report a problem, request a feature or share feedback with the eQc developer.</p>
      <p className="section-hint">To: {context?.recipient||'anisur.rahman.bayazid@gmail.com'}</p>
      <fieldset disabled={busy}><legend>Your report</legend>
        <label>Report type<select aria-label="Report type" value={kind} onChange={event=>{edited();setKind(event.target.value as FeedbackReport['kind']);}}><option value="bug">Bug report</option><option value="feature">Feature request</option><option value="other">Other feedback</option></select></label>
        <div className="feedback-fields"><label>Your name<input required maxLength={120} pattern=".*\S.*" autoComplete="name" value={senderName} onChange={event=>{edited();setSenderName(event.target.value);}}/></label>
        <label>Your email<input type="email" required maxLength={254} autoComplete="email" value={replyTo} onChange={event=>{edited();setReplyTo(event.target.value);}}/></label></div>
        <p className="section-hint">Name and email are required. Filled from your profile when available; used to identify and reply to your report.</p>
        <label>Subject<input required maxLength={160} value={subject} onChange={event=>{edited();setSubject(event.target.value);}}/></label>
        <label>{kind==='feature'?'What would you like to add or improve?':'What happened or what would you like to share?'}<textarea required maxLength={12000} rows={4} value={description} onChange={event=>{edited();setDescription(event.target.value);}}/></label>
        {kind==='bug'&&<details><summary>Steps and expected behaviour (optional)</summary><label>Steps to reproduce<textarea maxLength={6000} rows={3} value={steps} onChange={event=>{edited();setSteps(event.target.value);}}/></label><label>Expected behaviour<textarea maxLength={4000} rows={2} value={expected} onChange={event=>{edited();setExpected(event.target.value);}}/></label></details>}
      </fieldset>
      <fieldset disabled={busy}><legend>Screenshot</legend>
        {screenshot?<><img className="feedback-screenshot" src={'data:image/png;base64,'+screenshot.base64} alt="Screenshot attached to this report"/><p className="section-hint">Check the screenshot for research text you do not want to share. Remove it if needed.</p></>:<p>No screenshot attached.</p>}
        <div className="research-actions"><button type="button" disabled={!window.qv.feedback} onClick={()=>void retake()}>Capture eQc window</button><button type="button" disabled={!window.qv.feedback} onClick={()=>void attach()}>Attach screenshot</button>{screenshot&&<button type="button" onClick={()=>{edited();setScreenshot(undefined);}}>Remove screenshot</button>}</div>
      </fieldset>
      <fieldset disabled={busy||!context}><legend>Device information</legend><label className="check-label"><input type="checkbox" checked={includeDevice} onChange={event=>{edited();setIncludeDevice(event.target.checked);}}/>Include device information</label>
        <details><summary>Review device details</summary><dl>{Object.entries(context?.device||{}).map(([key,value])=><React.Fragment key={key}><dt>{key}</dt><dd>{value}</dd></React.Fragment>)}</dl></details>
      </fieldset>
      <p className="section-hint">Only this form, the selected screenshot and the selected device details are sent. Project files and transcripts are not attached automatically.</p>
      {context&&!context.configured&&<p role="status">Direct reporting is not available in this build yet. You can save the report below.</p>}
      {error&&<p role="alert">{error}</p>}{status&&<p role="status">{status}</p>}
      <div className="research-actions"><button className="primary-btn" type="submit" disabled={busy||!context?.configured}>{busy?'Working…':'Send report'}</button><button type="button" disabled={busy||!context} onClick={()=>void action(false)}>Save report instead</button></div>
    </form>}
  </div></div>;
}
