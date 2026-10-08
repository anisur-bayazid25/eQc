import { TimeRow } from './timeTracking';

export type MilestoneAward = { id: string; earnedAt: number; seenAt?: number };
export const MILESTONES = [
  {id:'time-30',title:'A little spark',requirement:'30 minutes of active coding',character:'Charmander',quote:'Thirty minutes, one bright spark. Keep the tail alight and the interpretations grounded.'},
  {id:'time-60',title:'An hour of possibilities',requirement:'1 hour of active coding',character:'Eevee',quote:'So many possible evolutions. Your codebook understands the feeling.'},
  {id:'time-120',title:'Quietly finding meaning',requirement:'2 hours of active coding',character:'No-Face',quote:'I brought you a theme. It is mostly silence, but the memo is excellent.'},
  {id:'time-240',title:'The grand coding voyage',requirement:'4 hours of active coding',character:'Luffy',quote:'The treasure was a well-supported theme all along. And possibly lunch.'},
  {id:'time-480',title:'Eight hours, many questions',requirement:'8 hours of active coding',character:'Psyduck',quote:'Eight hours of thinking. I have a headache and three very promising categories.'},
  {id:'time-1200',title:'Twenty hours of perspective',requirement:'20 hours of active coding',character:'Satoru Gojo',quote:'Twenty hours. Limitless possibilities; a very finite deadline. Choose your themes wisely.'},
  {id:'time-3000',title:'Reading between the lines',requirement:'50 hours of active coding',character:'Lucario',quote:'Fifty hours. You can sense the themes now. Still, please cite the excerpts.'},
  {id:'time-6000',title:'A hundred hours of persistence',requirement:'100 hours of active coding',character:'Saitama',quote:'One hundred hours of coding. If only the discussion chapter took one punch.'},
  {id:'days-5',title:'Five days of showing up',requirement:'Code on 5 consecutive dates',character:'Naruto',quote:'Five days in a row! Your research habit has mastered the art of showing up.'},
  {id:'weeks-month',title:'A steady training arc',requirement:'Code in every week of a completed month',character:'Son Goku',quote:'A little training every week. Your analytical power is rising; your coffee level may not be.'},
  {id:'months-year',title:'A year in motion',requirement:'Code in all 12 months of a completed year',character:'Catbus',quote:'Twelve monthly stops. Next destination: a conclusion that actually fits the data.'},
  {id:'projects-3',title:'Three growing studies',requirement:'Code in 3 different projects',character:'Bulbasaur',quote:'Three projects have taken root. Remember to water the memos.'},
  {id:'projects-5',title:'Five projects, one researcher',requirement:'Code in 5 different projects',character:'L',quote:'Five projects. I suspect the common thread is you. Further analysis requires cake.'},
  {id:'projects-10',title:'The delivery route',requirement:'Code in 10 different projects',character:'Dragonite',quote:'Ten projects delivered. Your themes have officially outgrown hand luggage.'},
  {id:'projects-50',title:'A universe of stories',requirement:'Code in 50 different projects',character:"Howl’s moving castle",quote:"Fifty projects. Your research has grown legs. Please check the memos before the castle wanders off."},
] as const;
export type MilestoneId = typeof MILESTONES[number]['id'];
const known = new Set<string>(MILESTONES.map(m=>m.id));
export function mergeAwards(...groups: Array<MilestoneAward[] | undefined>): MilestoneAward[] {
  const merged=new Map<string,MilestoneAward>();
  for(const awards of groups)for(const a of awards||[]) {
    if(!a || !known.has(a.id) || !Number.isFinite(a.earnedAt) || a.earnedAt<0)continue;
    const prior=merged.get(a.id),seenAt=Math.max(prior?.seenAt||0,Number.isFinite(a.seenAt)?a.seenAt||0:0);
    merged.set(a.id,{id:a.id,earnedAt:Math.min(prior?.earnedAt??Infinity,a.earnedAt),...(seenAt>0?{seenAt}:{})});
  }
  return MILESTONES.flatMap(m=>merged.has(m.id)?[merged.get(m.id)!]:[]);
}
// Calendar dates, rather than elapsed milliseconds, keep streaks correct across DST.
const dayNumber=(day:string)=>Date.parse(day+'T00:00:00Z')/86400000;
const weekNumber=(day:string)=>Math.floor((dayNumber(day)+4)/7); // Sunday–Saturday
export function awardMilestones(rows:TimeRow[], existing:MilestoneAward[]=[], now=Date.now()):MilestoneAward[] {
  const earned=new Set<string>(),total=rows.reduce((n,r)=>n+r.codingMs,0);
  for(const minutes of [30,60,120,240,480,1200,3000,6000])if(total>=minutes*60000)earned.add('time-'+minutes);
  const coded=rows.filter(r=>r.codingMs>0 || r.firstCoding!==undefined),projects=new Set(coded.map(r=>r.projectId).filter(Boolean));
  for(const count of [3,5,10,50])if(projects.size>=count)earned.add('projects-'+count);
  const days=[...new Set(coded.map(r=>r.day))].sort(),numbers=days.map(dayNumber);
  let streak=0,previous=-Infinity;for(const day of numbers){streak=day===previous+1?streak+1:1;previous=day;if(streak>=5)earned.add('days-5');}
  const today=new Date(now),currentMonth=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`,currentYear=String(today.getFullYear());
  const months=new Map<string,Set<number>>(),years=new Map<string,Set<string>>();
  for(const day of days){const month=day.slice(0,7),year=day.slice(0,4);if(!months.has(month))months.set(month,new Set());months.get(month)!.add(weekNumber(day));if(!years.has(year))years.set(year,new Set());years.get(year)!.add(month);}
  for(const [month,weeks] of months)if(month<currentMonth){const [y,m]=month.split('-').map(Number),last=new Date(Date.UTC(y,m,0)).getUTCDate();const first=weekNumber(month+'-01'),end=weekNumber(month+'-'+String(last).padStart(2,'0'));if(weeks.size===end-first+1)earned.add('weeks-month');}
  for(const [year,months] of years)if(year<currentYear && months.size===12)earned.add('months-year');
  return mergeAwards(existing,[...earned].map(id=>({id,earnedAt:now})));
}
