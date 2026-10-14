const email='anisur.rahman.bayazid@gmail.com';
const repository='https://github.com/anisur-bayazid25/eQc';
function aboutLinkMenu(linkURL,clipboard) {
  if(linkURL==='mailto:'+email)return [{label:'Copy email address',click:()=>clipboard.writeText(email)},{label:'Copy link address',click:()=>clipboard.writeText(linkURL)}];
  if(linkURL===repository)return [{label:'Copy link address',click:()=>clipboard.writeText(repository)}];
  return [];
}
module.exports={aboutLinkMenu};
