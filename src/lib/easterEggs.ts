import { Code, Project } from '../domain';
export type WorkspaceSurprise = 'jiji' | 'totoro';

export function workspaceSurprises(before: Project | null, after: Project): WorkspaceSurprise[] {
  if (!before || before.id !== after.id) return [];
  const knownCodes = new Set(before.codes.map(code => code.id));
  const siblingCounts = new Map<string, number>();
  after.codes.forEach(code => { if (code.parentId) siblingCounts.set(code.parentId, (siblingCounts.get(code.parentId) || 0) + 1); });
  const result: WorkspaceSurprise[] = [];
  if (after.codes.some(code => !knownCodes.has(code.id) && code.parentId && (siblingCounts.get(code.parentId) || 0) > 5)) result.push('jiji');
  // PDF page snapshots represent existing documents, rather than new interviews/photos.
  const sources = (project: Project) => [...project.docs, ...(project.images || []).filter(image => !image.pdfPage)];
  const knownSources = new Set(sources(before).map(source => source.id)), current = sources(after);
  if (current.length > 10 && current.some(source => !knownSources.has(source.id))) result.push('totoro');
  return result;
}

export function codeTreeLeaves(codes: Code[]) {
  const byId = new Map(codes.map(code => [code.id, code])), children = new Map<string | null, Code[]>();
  codes.forEach(code => { const parent = code.parentId && byId.has(code.parentId) ? code.parentId : null; children.set(parent, [...(children.get(parent) || []), code]); });
  const ordered: Code[] = [], visited = new Set<string>();
  function visit(code: Code) { if (visited.has(code.id)) return; visited.add(code.id); ordered.push(code); (children.get(code.id) || []).forEach(visit); }
  (children.get(null) || []).forEach(visit); codes.forEach(visit);
  return ordered.map((code, index) => ({ code, x: 85 + (index % 8) * 118, y: 70 + Math.floor(index / 8) * 64 }));
}
