import {Project,ResearchQuery} from '../domain';
import {retrieveExcerpts} from './research';
export interface ResearchScopeSelection {label:string;query?:ResearchQuery;excerptIds?:string[];}
/** Select exact coding entries, never every excerpt in their parent documents. */
export function projectInResearchScope(project:Project,selection:ResearchScopeSelection):Project {
  const allowed=new Set(selection.excerptIds??(selection.query?retrieveExcerpts(project,selection.query).map(r=>r.id):[]));
  const segments=project.codedSegments.filter(s=>allowed.has(s.id)),regions=(project.codedRegions||[]).filter(r=>allowed.has(r.id));
  const sources=new Set([...segments.map(s=>s.docId),...regions.map(r=>r.imageId)]);
  return {...project,docs:project.docs.filter(d=>sources.has(d.id)),images:project.images?.filter(i=>sources.has(i.id)),codedSegments:segments,codedRegions:regions};
}
