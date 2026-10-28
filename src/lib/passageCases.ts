import { Project } from '../domain';

export interface CasePassage { docId: string; start: number; end: number }
export function passageCaseIds(project: Project, passage: CasePassage): string[] {
  return (project.cases || []).filter(c => c.links.some(l => l.docId === passage.docId &&
    (l.start === undefined || (l.start < passage.end && l.end! > passage.start)))).map(c => c.id);
}

/** Change only explicitly toggled cases; retain attribution outside the selected text. */
export function updatePassageCases(project: Project, passage: CasePassage, changes: Record<string, boolean>): Project {
  const doc = project.docs.find(d => d.id === passage.docId);
  if (!doc || !Number.isInteger(passage.start) || !Number.isInteger(passage.end) || passage.start < 0 || passage.end > doc.content.length || passage.end <= passage.start) throw new Error('Choose a passage inside a document.');
  return { ...project, cases: (project.cases || []).map(c => {
    if (!(c.id in changes)) return c;
    if (changes[c.id]) {
      if (c.links.some(l => l.docId === passage.docId && (l.start === undefined || l.start <= passage.start && l.end! >= passage.end))) return c;
      return { ...c, links: [...c.links, { ...passage }] };
    }
    return { ...c, links: c.links.flatMap(l => {
      if (l.docId !== passage.docId) return [l];
      const start = l.start ?? 0, end = l.end ?? doc.content.length;
      if (start >= passage.end || end <= passage.start) return [l];
      return [...(start < passage.start ? [{ docId: l.docId, start, end: passage.start }] : []),
        ...(end > passage.end ? [{ docId: l.docId, start: passage.end, end }] : [])];
    }) };
  }) };
}
