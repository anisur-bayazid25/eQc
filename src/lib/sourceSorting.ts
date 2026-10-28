export type SourceSort = 'name'|'date'|'size'|'coded';
export type SortDirection = 'asc'|'desc';
export function sortSources<T extends {id:string;name:string;addedAt:number;sizeBytes?:number}>(items:T[],by:SourceSort,count:(id:string)=>number,direction:SortDirection='asc'):T[] {
  const sign=direction==='asc'?1:-1;
  return [...items].sort((a,b)=>sign*(by==='name'?a.name.localeCompare(b.name):by==='date'?a.addedAt-b.addedAt:by==='size'?(a.sizeBytes||0)-(b.sizeBytes||0):count(a.id)-count(b.id))||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}
