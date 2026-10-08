// Safe browser checks against a temporary Vite server; never starts Electron.
const {spawn}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5179';
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5179','--strictPort'],{cwd:root,stdio:'inherit'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{try{
 let ready=false;for(let attempt=0;attempt<100;attempt++){if(server.exitCode!==null)throw new Error('Preview server exited before becoming ready.');try{const response=await fetch(url);if(response.ok){ready=true;break;}}catch{}await sleep(200);}
 if(!ready)throw new Error('Preview server did not become ready.');
 for(const file of ['usability-1.7.0.cjs','data-integrity-browser.cjs']){
  const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(__dirname,file)],{cwd:root,stdio:'inherit',env:{...process.env,EQC_PREVIEW_URL:url}});child.on('error',reject);child.on('exit',resolve);});
  if(code!==0)throw new Error(`${file} failed (${code}).`);
 }
}finally{server.kill();}})().catch(error=>{console.error(error);process.exitCode=1;});
