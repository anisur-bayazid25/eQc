import { Project, ID, descendantCodeIds } from '../domain';

/** Consolidate selected codes into an existing survivor without losing coding records. */
export function mergeCodes(project: Project, sourceIds: ID[], targetId: ID): Project {
  const target = project.codes.find(c => c.id === targetId);
  if (!sourceIds.includes(targetId)) throw new Error('The code to keep must be selected.');
  if (!target) throw new Error('Choose a code to keep.');
  const removed = new Set(sourceIds.filter(id => id !== targetId));
  if (!removed.size) throw new Error('Select at least two codes to merge.');
  for (const id of removed) {
    if (!project.codes.some(c => c.id === id)) throw new Error('A selected code no longer exists.');
    if (descendantCodeIds(project.codes, id).has(targetId)) {
      throw new Error('Cannot merge an ancestor into its descendant. Choose the ancestor as the code to keep.');
    }
  }
  const remap = (id: ID) => removed.has(id) ? targetId : id;
  const sources = project.codes.filter(c => removed.has(c.id));
  const combine = (original: string, additions: string[]) => [original, ...additions].filter(Boolean).join('\n\n');
  const internalNotes = (project.relationNotes || []).filter(n => remap(n.codeAId) === remap(n.codeBId));
  const codes = project.codes.filter(c => !removed.has(c.id)).map(c => ({
    ...c,
    parentId: c.parentId ? remap(c.parentId) : null,
    ...(c.id === targetId ? {
      summary: combine(c.summary, [
        ...sources.filter(s => s.summary).map(s => `[Merged from ${s.name}]\n${s.summary}`),
        ...internalNotes.filter(n => n.note).map(n => `[Merged relationship memo]\n${n.note}`)
      ]),
      definition: combine(c.definition || '', sources.filter(s => s.definition).map(s => `[Merged from ${s.name}]\n${s.definition}`))
    } : {})
  }));
  const frameworkCells: NonNullable<Project['frameworkCells']> = [];
  for (const cell of project.frameworkCells || []) {
    const mapped = { ...cell, codeId: remap(cell.codeId) };
    const existing = frameworkCells.find(c => c.docId === mapped.docId && c.codeId === mapped.codeId);
    if (existing) {
      existing.text = combine(existing.text, mapped.text && mapped.text !== existing.text ? [mapped.text] : []);
      existing.updatedAt = Math.max(existing.updatedAt, mapped.updatedAt);
    } else frameworkCells.push(mapped);
  }
  const relationNotes: NonNullable<Project['relationNotes']> = [];
  for (const note of project.relationNotes || []) {
    const pair = [remap(note.codeAId), remap(note.codeBId)].sort();
    if (pair[0] === pair[1]) continue;
    const existing = relationNotes.find(n => n.codeAId === pair[0] && n.codeBId === pair[1]);
    if (existing) {
      existing.note = combine(existing.note, note.note && note.note !== existing.note ? [note.note] : []);
      existing.updatedAt = Math.max(existing.updatedAt, note.updatedAt);
    } else relationNotes.push({ ...note, codeAId: pair[0], codeBId: pair[1] });
  }
  return {
    ...project, codes, frameworkCells, relationNotes,
    codedSegments: project.codedSegments.map(s => ({ ...s, codeId: remap(s.codeId) })),
    codedRegions: (project.codedRegions || []).map(r => ({ ...r, codeId: remap(r.codeId) })),
    mapEdgeStyles: (project.mapEdgeStyles || []).map(e => ({ ...e, fromCodeId: remap(e.fromCodeId), toCodeId: remap(e.toCodeId) }))
      .filter(e => e.fromCodeId !== e.toCodeId),
    hiddenMapCodeIds: (project.hiddenMapCodeIds || []).filter(id => !removed.has(id))
  };
}
