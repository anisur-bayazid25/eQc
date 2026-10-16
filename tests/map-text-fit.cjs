const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {fitMapText}=require('../src/lib/mapTextFit.ts');
test('resized text wraps and shrinks, while larger boxes retain preferred size',()=>{
 const text='Water access affects care and work.';
 const small=fitMapText(text,60,40,24),large=fitMapText(text,600,200,24);
 assert.ok(small.fontSize<24);assert.ok(small.lines.length*small.fontSize*1.16<=40);assert.equal(small.lines.join(' '),text);assert.equal(large.fontSize,24);assert.equal(large.lines.join(' '),text);
 const multiline=fitMapText('Water\nবাংলা জলবায়ু',120,80,16);assert.equal(multiline.lines[0],'Water');assert.ok(multiline.lines.join(' ').includes('বাংলা'));
});
