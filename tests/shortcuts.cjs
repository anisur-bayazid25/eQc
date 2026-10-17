const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {resolveShortcut,readShortcutProfile}=require('../src/lib/shortcuts.ts'),{helpSections}=require('../src/lib/helpSections.ts');
const key=(key,extra={})=>({key,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,...extra});
test('shortcut profiles separate conflicting keys and match the documented coding aliases',()=>{
 assert.equal(resolveShortcut(key('1',{ctrlKey:true}),'codingBar'),'documents');assert.equal(resolveShortcut(key('1',{ctrlKey:true}),'numbered'),'favorite1');
 assert.equal(resolveShortcut(key('F8',{ctrlKey:true}),'codingBar'),'inVivo');assert.equal(resolveShortcut(key('F9',{ctrlKey:true}),'codingBar'),'lastCode');assert.equal(resolveShortcut(key('a',{ctrlKey:true,shiftKey:true}),'codingBar'),'annotation');
 assert.equal(resolveShortcut(key('k',{ctrlKey:true}),'quickCode'),'newCode');assert.equal(resolveShortcut(key('j',{ctrlKey:true}),'quickCode'),'codePicker');assert.equal(resolveShortcut(key('v',{ctrlKey:true,shiftKey:true}),'quickCode'),'inVivo');
 assert.equal(resolveShortcut(key('l',{altKey:true}),'numbered'),'lastCode');assert.equal(resolveShortcut(key('w',{altKey:true}),'numbered'),'newCodeAndApply');assert.equal(resolveShortcut(key('i',{metaKey:true,altKey:true,code:'KeyI'}),'numbered'),'inVivo');
 assert.equal(resolveShortcut(key(' '),'selection'),'codePicker');assert.equal(resolveShortcut(key('p',{ctrlKey:true}),'selection'),null);assert.equal(resolveShortcut(key(' '),'quickCode'),null);
 assert.equal(resolveShortcut(key('i',{altKey:true,getModifierState:()=>true}),'numbered'),null);assert.equal(resolveShortcut(key('k',{ctrlKey:true,repeat:true}),'quickCode'),null);assert.equal(resolveShortcut(key('k',{ctrlKey:true,isComposing:true}),'quickCode'),null);assert.equal(readShortcutProfile('unknown'),'standard');
});
test('both Help books follow the requested app order and finish with keyboard shortcuts',()=>{
 const order=['Codebook','Auto-Code','Analysis','Memo-Book','Visualization','About','LAN collaboration','Profile and time','Supported files','Keyboard shortcuts'];
 for(const file of ['USER_GUIDE.md','DOCUMENTATION.md']){const titles=helpSections(fs.readFileSync(file,'utf8')).map(s=>s.title.replace(/^\d+\. /,''));const filtered=titles.filter(t=>order.includes(t));assert.deepEqual(filtered,order);}
});

test('feedback shortcut is shared across every profile and suppresses repeats',()=>{
 for(const profile of ['standard','codingBar','quickCode','numbered','selection'])assert.equal(resolveShortcut(key('b',{ctrlKey:true,shiftKey:true}),profile),'feedback');
 assert.equal(resolveShortcut(key('b',{metaKey:true,shiftKey:true}),'standard'),'feedback');
 assert.equal(resolveShortcut(key('b',{ctrlKey:true,shiftKey:true,repeat:true}),'standard'),null);
});
