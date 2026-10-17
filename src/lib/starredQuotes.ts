import { Project, ID, codeAncestorPath } from '../domain';
import { quoteAttribution } from './caseAttributes';
import { codeExportFilename } from './codeReport';
import { excerptResearch } from './researchDetails';
import type { ManuscriptNode } from './manuscript';

export type StarredQuoteFormat = 'manuscript' | 'details';

/** Text-only evidence export; repeated coding of the same quote is shown once per code. */
export function buildStarredQuotesExport(project: Project, format: StarredQuoteFormat, ids?: ReadonlySet<ID>) {
  const outline: ManuscriptNode[] = [];
  let count = 0;
  for (const code of project.codes) {
    if (ids && !ids.has(code.id)) continue;
    const seen = new Set<string>();
    const attributedQuotes = project.codedSegments
      .filter(s => s.starred && s.codeId === code.id && s.text.trim())
      .filter(s => {
        const key = JSON.stringify([s.docId, s.start, s.end, s.text]);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(s => {
        const research = format === 'details' ? excerptResearch(project, s.id, s.docId, s) : undefined;
        const attribution = format === 'manuscript' ? quoteAttribution(project, s.docId, s)
          : [
            `Document: ${project.docs.find(d => d.id === s.docId)?.name || `Missing source ${s.docId}`}`,
            research?.cases ? `Cases: ${research.cases}` : '',
            research?.attributes ? `Attributes: ${research.attributes}` : ''
          ].filter(Boolean).join('\n');
        return { text: s.text, attribution };
      });
    if (!attributedQuotes.length) continue;
    count += attributedQuotes.length;
    outline.push({ name: [...codeAncestorPath(project.codes, code), code.name].join(' > '), depth: 0, attributedQuotes });
  }
  return {
    count,
    payload: {
      kind: 'outline' as const, manuscript: true,
      title: `${project.name} — Starred quotes`, outline,
      filenameBase: `${codeExportFilename(project, ids)}_Starred quotes_${format === 'manuscript' ? 'Manuscript' : 'Source and case details'}`
    }
  };
}
