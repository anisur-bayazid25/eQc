import {Project} from '../domain';
export function exchangeInventory(p:Project,format:'json'|'qdpx') {
  return [
    ['Sources and coding',p.docs.length+(p.images?.length||0),format==='json'?'Native backup':'Structured REFI-QDA sources and coding'],
    ['Cases / attributes / groups',(p.cases?.length||0)+(p.groups?.length||0),format==='json'?'Native backup':'Structured REFI-QDA cases, variables and sets; eQc appendix retains case types'],
    ['Memos / annotations / queries',(p.memos?.length||0)+(p.annotations?.length||0)+(p.queries?.length||0),format==='json'?'Native backup':'Readable notes and eQc appendix; saved queries are not portable executable queries'],
    ['Saved ICR runs / review status',p.icrRuns?.length||0,format==='json'?'Native backup':'eQc appendix; readable snapshot results'],
    ['Graph drafts / visualization notes',(p.mapDrafts?.length||0)+(p.visualizationNotes?.length||0),format==='json'?'Native backup':'eQc appendix; other apps do not reconstruct the eQc graph editor'],
    ['Framework summaries',(p.frameworkCells?.length||0)+(p.caseFrameworkCells?.length||0),format==='json'?'Native backup':'Readable notes and eQc appendix'],
    ['Local recovery history',0,'Not included; remains on this computer'],
  ] as Array<[string,number,string]>;
}
