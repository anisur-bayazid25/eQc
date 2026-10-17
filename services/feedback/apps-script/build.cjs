const fs=require('node:fs'),path=require('node:path');
function appsScriptSource() {
  const schema=fs.readFileSync(path.resolve(__dirname,'../../../electron/feedbackSchema.cjs'),'utf8').replace(/\r\n/g,'\n')
    .replace(/^module\.exports\s*=.*;\s*$/m,'')
    .replace('atob(base64.slice(0,44))','eqcDecodeHead(base64.slice(0,44))');
  const decoder='function eqcDecodeHead(value) { return Utilities.base64Decode(value).map(byte=>String.fromCharCode((byte+256)%256)).join(\'\'); }\n';
  return '// eQc feedback for Google Apps Script. Paste this entire file into Code.gs.\n// Generated from the shared report schema and backend.gs; no passwords or API keys.\n\n'+schema+'\n'+decoder+'\n'+fs.readFileSync(path.join(__dirname,'backend.gs'),'utf8').replace(/\r\n/g,'\n');
}
if(require.main===module){fs.writeFileSync(path.join(__dirname,'Code.gs'),appsScriptSource());console.log('Apps Script Code.gs generated.');}
module.exports={appsScriptSource};
