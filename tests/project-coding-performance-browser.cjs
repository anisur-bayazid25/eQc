// Runs entirely in a mocked browser session; the supplied JSON is read only.
const {chromium}=require(process.env.EQC_PLAYWRIGHT_PATH||'playwright'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const project=JSON.parse(fs.readFileSync(process.env.EQC_BENCHMARK_PROJECT,'utf8'));
const ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {casesForSegment}=require('../src/lib/research.ts');
const naive=s=>(project.cases||[]).filter(c=>c.links.some(l=>l.docId===s.docId&&(l.start===undefined||s.start<l.end&&s.end>l.start)));
for(const s of project.codedSegments)assert.deepEqual(casesForSegment(project,s).map(c=>c.id),naive(s).map(c=>c.id));
function measure(fn){const times=[];for(let i=0;i<25;i++){const start=performance.now();for(const s of project.codedSegments)fn(s);times.push(performance.now()-start);}return +times.sort((a,b)=>a-b)[12].toFixed(2);}
console.log(JSON.stringify({participantLookupAllQuotesMedianMs:{previousScan:measure(naive),indexed:measure(s=>casesForSegment(project,s))}}));
const server=spawn(process.execPath,[path.resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5192','--strictPort'],{stdio:'ignore'});
(async()=>{let browser;try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5192')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.EQC_CPU_RATE){const cpu=await page.context().newCDPSession(page);await cpu.send('Emulation.setCPUThrottlingRate',{rate:Number(process.env.EQC_CPU_RATE)});}
 await page.addInitScript(p=>{window.__qaProject=p;localStorage.setItem('qda-document-view','text');localStorage.setItem('eqc-code-shortcuts-'+p.id,JSON.stringify([p.codes[0].id]));window.qv=new Proxy({listProjects:async()=>[{id:p.id,name:p.name}],loadProject:async()=>p,saveProject:async next=>{window.__qaProject=structuredClone(next);return structuredClone(next);},lan:new Proxy({},{get:(_,n)=>String(n).startsWith('on')?()=>{}:async()=>({ok:true})})},{get:(t,n)=>t[n]||(String(n).startsWith('on')?()=>{}:async()=>null)});},project);
 await page.goto('http://127.0.0.1:5192');await page.locator('.workspace-sources .doc-row').first().click();await page.locator('.doc-editor').waitFor();
 const timings=[];
 const profiler=process.env.EQC_PROFILE?await page.context().newCDPSession(page):null;
 for(let i=0;i<5;i++){
  await page.evaluate(()=>{document.activeElement?.blur();const root=document.querySelector('.doc-editor'),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){if(n.length<12)continue;const r=document.createRange();r.setStart(n,0);r.setEnd(n,12);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));break;}});
  await page.getByText(/Selected 12 chars/).waitFor();
  if(profiler&&i===0){await profiler.send('Profiler.enable');await profiler.send('Profiler.start');}
  timings.push(await page.evaluate(async()=>{const start=performance.now(),before=window.__qaProject.codedSegments.length;document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'1',code:'Digit1',ctrlKey:true,bubbles:true}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(window.__qaProject.codedSegments.length!==before+1)throw Error('Coding action did not save');return performance.now()-start;}));
  if(profiler&&i===0){const {profile}=await profiler.send('Profiler.stop');const nodes=new Map(profile.nodes.map(n=>[n.id,n])),times=new Map();profile.samples?.forEach((id,i)=>times.set(id,(times.get(id)||0)+(profile.timeDeltas[i]||0)));console.log(JSON.stringify({firstCodingCpuSamples:[...times].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([id,us])=>({name:nodes.get(id).callFrame.functionName,url:nodes.get(id).callFrame.url.split('?')[0],ms:us/1000}))}));}
 }
 console.log(JSON.stringify({cpuRate:Number(process.env.EQC_CPU_RATE)||1,docs:project.docs.length,codes:project.codes.length,cases:project.cases?.length,codingEntries:project.codedSegments.length,applyThroughTwoFramesMs:timings,errors},null,2));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
