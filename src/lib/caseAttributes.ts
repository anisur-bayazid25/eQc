import { Project, ResearchCase } from '../domain';

export const caseAttributeFields = [
  { label: 'Name for quote attribution', key: 'Quote name', aliases: ['Quote name', 'Pseudonym'] },
  { label: 'Age', key: 'Age', aliases: ['Age'] },
  { label: 'Gender', key: 'Gender', aliases: ['Gender', 'Sex'] },
  { label: 'Location / area', key: 'Location', aliases: ['Location', 'Area', 'Setting'] },
  { label: 'Country', key: 'Country', aliases: ['Country'] },
  { label: 'Occupation / livelihood', key: 'Occupation', aliases: ['Occupation', 'Livelihood', 'Occupation/Livelihood', 'Occupation / livelihood'] }
];
export function attributeKey(attributes: Record<string,string>, aliases: string[]) {
  return Object.keys(attributes).find(key => aliases.some(alias => alias.toLowerCase() === key.toLowerCase()));
}
export function caseAttribution(c: ResearchCase): string {
  const value = (aliases: string[]) => c.attributes[attributeKey(c.attributes, aliases) || '']?.trim() || '';
  const age=value(['Age']), gender=value(['Gender','Sex']), occupation=value(['Occupation','Livelihood','Occupation/Livelihood','Occupation / livelihood']);
  const area=value(['Location','Area','Setting']),country=value(['Country']);
  let name=value(['Quote name','Pseudonym'])||c.name.trim();
  // Older demo cases include the country in their case title.
  if(country&&name.endsWith(' — '+country))name=name.slice(0,-country.length-3).trim();
  const genderWord=({woman:'female',man:'male'} as Record<string,string>)[gender.toLowerCase()]||gender;
  const lowerInitial=(text:string)=>text.replace(/^[A-Z](?=[a-z])/,letter=>letter.toLowerCase());
  const description=[age?(/^\d+(\.\d+)?$/.test(age)?age+' year old':'Age '+age):'',genderWord,lowerInitial(occupation)].filter(Boolean).join(' ');
  const areaKey=attributeKey(c.attributes,['Location','Area','Setting']);
  const descriptive=areaKey?.toLowerCase()==='setting'||/^(coastal|urban|rural|mountain|fishing|remote|small|large|residential)\b/i.test(area);
  const areaText=/^(a |an |the )/i.test(area)?lowerInitial(area):descriptive?(/^[aeiou]/i.test(area)?'an ':'a ')+lowerInitial(area):area;
  const place=area?areaText+(country&&!area.toLowerCase().includes(country.toLowerCase())?' in '+country:''):country;
  return [description,name?'['+name+']':'',place?'from '+place:''].filter(Boolean).join(' ');
}
export function quoteAttribution(project:Project,sourceId:string,range?:{start:number;end:number}): string {
  const image=project.images?.find(i=>i.id===sourceId);
  const linked=(project.cases||[]).filter(c=>c.links.some(link=>
    link.docId===sourceId&&(link.start===undefined||!!range&&range.start<(link.end??Infinity)&&range.end>link.start)
    ||link.docId===image?.pdfPage?.docId&&link.start===undefined));
  return linked.length?linked.map(caseAttribution).join('; '):[...project.docs,...(project.images||[])].find(d=>d.id===sourceId)?.name||'Unknown source';
}
