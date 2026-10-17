const vm=require('node:vm'),crypto=require('node:crypto');
const {appsScriptSource}=require('../../services/feedback/apps-script/build.cjs');
// Offline Apps Script runtime: never calls Google or sends email.
function appsScriptHarness(){
  let now=1000000,fail=false,locked=false,quota=100;const records=new Map(),mails=[],logs=[];
  const properties={getProperty:key=>records.has(key)?records.get(key):null,getProperties:()=>Object.fromEntries(records),setProperty:(key,value)=>{records.set(key,value);},deleteProperty:key=>records.delete(key),setProperties:values=>Object.entries(values).forEach(([key,value])=>records.set(key,value))};
  const context=vm.createContext({Date:class extends Date{static now(){return now;}},console:{log:value=>logs.push(value)},ContentService:{MimeType:{JSON:'application/json'},createTextOutput:text=>({text,setMimeType(){return this;}})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,value)=>Array.from(crypto.createHash('sha256').update(value).digest()),base64Decode:value=>Array.from(Buffer.from(value,'base64')).map(byte=>byte>127?byte-256:byte),newBlob:(value,type,name)=>({value,type,name,getBytes:()=>Array.from(Buffer.from(value))})},
    LockService:{getScriptLock:()=>({tryLock:()=>!locked,releaseLock:()=>{}})},PropertiesService:{getScriptProperties:()=>properties},MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:mail=>{mails.push(mail);if(fail)throw Error('Uncertain transport');quota--;}}});
  vm.runInContext(appsScriptSource(),context);
  return {context,records,mails,logs,send:report=>JSON.parse(context.doPost({postData:{type:'application/json',contents:JSON.stringify(report)}}).text),advance:ms=>{now+=ms;},setFail:value=>{fail=value;},setLocked:value=>{locked=value;},setQuota:value=>{quota=value;}};
}
module.exports={appsScriptHarness};
