const test=require('node:test'),assert=require('node:assert/strict');
const {aboutLinkMenu}=require('../electron/aboutLinks.cjs');
test('About right-click copies the email address and canonical links without opening them',()=>{
 const copied=[],clipboard={writeText:text=>copied.push(text)};
 const email=aboutLinkMenu('mailto:anisur.rahman.bayazid@gmail.com',clipboard);assert.deepEqual(email.map(i=>i.label),['Copy email address','Copy link address']);email.forEach(i=>i.click());
 const github=aboutLinkMenu('https://github.com/anisur-bayazid25/eQc',clipboard);github[0].click();assert.deepEqual(copied,['anisur.rahman.bayazid@gmail.com','mailto:anisur.rahman.bayazid@gmail.com','https://github.com/anisur-bayazid25/eQc']);
 assert.deepEqual(aboutLinkMenu('https://unrelated.invalid',clipboard),[]);assert.deepEqual(aboutLinkMenu('',clipboard),[]);
});
