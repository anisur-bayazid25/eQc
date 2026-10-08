const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {workspaceSurprises,codeTreeLeaves}=require('../src/lib/easterEggs.ts');
const project=()=>({id:'p',name:'Study',createdAt:1,folders:[],docs:[],images:[],codes:[{id:'root',name:'Access',parentId:null,color:'#3a7'}],codedSegments:[]});
test('jiji triggers on the sixth and later direct children at every level, not renaming or reparenting',()=>{
 for(const parent of ['root','child1']) {
  const p=project(); if(parent==='child1')p.codes.push({id:parent,name:'Distance',parentId:'root'});
  for(let i=0;i<5;i++)p.codes.push({id:`c${i}`,name:`Subcode ${i}`,parentId:parent});
  assert.deepEqual(workspaceSurprises(p,p),[]);
  const sixth={...p,codes:[...p.codes,{id:'six',name:'Sixth',parentId:parent}]};assert.deepEqual(workspaceSurprises(p,sixth),['jiji']);
  const seventh={...sixth,codes:[...sixth.codes,{id:'seven',name:'Seventh',parentId:parent}]};assert.deepEqual(workspaceSurprises(sixth,seventh),['jiji']);
  assert.deepEqual(workspaceSurprises(seventh,{...seventh,codes:seventh.codes.map(c=>({...c,name:'Renamed',parentId:'root'}))}),[]);
 }
});
test('totoro counts combined documents/images, excluding PDF snapshots and unchanged/project-switch data',()=>{
 const p=project();p.docs=Array.from({length:8},(_,i)=>({id:`d${i}`}));p.images=[{id:'i1'},{id:'i2'}];
 assert.deepEqual(workspaceSurprises(p,p),[]);
 assert.deepEqual(workspaceSurprises(p,{...p,images:[...p.images,{id:'page',pdfPage:{docId:'d0',page:1}}]}),[]);
 const next={...p,images:[...p.images,{id:'i3'}]};assert.deepEqual(workspaceSurprises(p,next),['totoro']);
 assert.deepEqual(workspaceSurprises(null,next),[]);assert.deepEqual(workspaceSurprises(p,{...next,id:'different'}),[]);
});
test('tree creates one leaf per code, including cycles/orphans, without modifying the project',()=>{
 const p=project();p.codes.push({id:'child',name:'Distance',parentId:'root'},{id:'orphan',name:'Other',parentId:'missing'},{id:'a',name:'A',parentId:'b'},{id:'b',name:'B',parentId:'a'});
 const before=JSON.stringify(p),leaves=codeTreeLeaves(p.codes);assert.equal(leaves.length,p.codes.length);assert.equal(new Set(leaves.map(l=>l.code.id)).size,p.codes.length);assert.equal(JSON.stringify(p),before);
});
