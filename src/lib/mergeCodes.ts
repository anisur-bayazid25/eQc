import { Project, ID, MapAnnotation, descendantCodeIds } from '../domain';

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
  // Case × theme framework summaries follow the survivor code exactly like the
  // document framework matrix does. Without this remap the cells kept pointing
  // at a code that no longer existed, and the next save's link cleanup deleted
  // them — consolidating codes silently destroyed case-framework memos.
  const caseFrameworkCells: NonNullable<Project['caseFrameworkCells']> = [];
  for (const cell of project.caseFrameworkCells || []) {
    const mapped = { ...cell, codeId: remap(cell.codeId) };
    const existing = caseFrameworkCells.find(c => c.caseId === mapped.caseId && c.codeId === mapped.codeId);
    if (existing) {
      existing.text = combine(existing.text, mapped.text && mapped.text !== existing.text ? [mapped.text] : []);
      existing.updatedAt = Math.max(existing.updatedAt, mapped.updatedAt);
    } else caseFrameworkCells.push(mapped);
  }

  // Saved ICR settings, domain definitions and adjudication decisions also name
  // codes. Left unremapped they showed "codes (0)" or pointed at a dead id.
  const remapIds = (ids: ID[] | undefined) => (ids ? Array.from(new Set(ids.map(remap))) : ids);
  const remapSettings = (settings: NonNullable<Project['icrComparison']>) => ({
    ...settings,
    codeIds: remapIds(settings.codeIds) || [],
    domains: settings.domains.map(d => ({ ...d, codeIds: remapIds(d.codeIds) || [] })),
    // Training rows reference a code by name, so follow the survivor's name.
    training: settings.training.map(row => {
      const source = sources.find(s => s.name === row.code);
      return source ? { ...row, code: target.name } : row;
    })
  });
  const icrResolutions = project.icrResolutions?.map(r => ({ ...r, codeId: remap(r.codeId) }));

  // Canvas annotations record the code pair behind a co-occurrence ribbon.
  const remapAnnotations = (list: MapAnnotation[] | undefined): MapAnnotation[] | undefined => list?.map(a => ({
    ...a,
    ...(a.coocPair ? {
      coocPair: {
        ...a.coocPair,
        codeIds: [remap(a.coocPair.codeIds[0]), remap(a.coocPair.codeIds[1])] as [ID, ID]
      }
    } : {}),
    ...(a.sourceCodeIds ? { sourceCodeIds: remapIds(a.sourceCodeIds) } : {})
  }));

  const remapMapDesign = <T extends { hubId?: string; rootIds: ID[] } | undefined>(design: T): T =>
    (design ? { ...design, hubId: design.hubId ? remap(design.hubId) : design.hubId, rootIds: Array.from(new Set(design.rootIds.map(remap))) } as T : design);

  const mapDrafts = project.mapDrafts?.map(draft => ({
    ...draft,
    nodes: draft.nodes.map(node => ({ ...node, id: remap(node.id) }))
      .filter((node, index, all) => all.findIndex(n => n.id === node.id) === index),
    hiddenIds: Array.from(new Set(draft.hiddenIds.map(remap))),
    annotations: remapAnnotations(draft.annotations) || [],
    edges: draft.edges.map(e => ({ ...e, fromCodeId: remap(e.fromCodeId), toCodeId: remap(e.toCodeId) }))
      .filter(e => e.fromCodeId !== e.toCodeId),
    design: remapMapDesign(draft.design),
    // view and legend keep geometry; only the code ids inside views change.
    view: draft.view ? { ...draft.view, expandedRoots: Array.from(new Set((draft.view.expandedRoots || []).map(remap))) } : draft.view
  }));

  // Merging two codes that both coded the same passage leaves two identical
  // records for the survivor, which doubles every count. Deduplicate by
  // (document, code, range, coder) — different coders stay separate — while
  // keeping stars and notes from both.
  const keepBest = <T extends { starred?: boolean; note?: string }>(a: T, b: T): T => ({
    ...a,
    starred: a.starred || b.starred,
    note: a.note && b.note && a.note !== b.note ? `${a.note}\n\n${b.note}` : (a.note || b.note)
  });
  const segmentKey = (s: Project['codedSegments'][number]) => [s.docId, s.codeId, s.start, s.end, s.coder || ''].join('\u0000');
  const segmentsByKey = new Map<string, Project['codedSegments'][number]>();
  for (const segment of project.codedSegments) {
    const mapped = { ...segment, codeId: remap(segment.codeId) };
    const key = segmentKey(mapped);
    const existing = segmentsByKey.get(key);
    segmentsByKey.set(key, existing ? keepBest(existing, mapped) : mapped);
  }
  const regionKey = (r: NonNullable<Project['codedRegions']>[number]) => [r.imageId, r.codeId, r.x, r.y, r.width, r.height, r.coder || ''].join('\u0000');
  const regionsByKey = new Map<string, NonNullable<Project['codedRegions']>[number]>();
  for (const region of project.codedRegions || []) {
    const mapped = { ...region, codeId: remap(region.codeId) };
    const key = regionKey(mapped);
    const existing = regionsByKey.get(key);
    regionsByKey.set(key, existing ? keepBest(existing, mapped) : mapped);
  }

  return {
    ...project, codes, frameworkCells, relationNotes,
    caseFrameworkCells,
    icrComparison: project.icrComparison ? remapSettings(project.icrComparison) : project.icrComparison,
    icrSetups: project.icrSetups?.map(setup => ({ ...setup, settings: remapSettings(setup.settings) })),
    icrResolutions,
    groups: project.groups?.map(g => ({...g, memberIds:g.kind==='codes'?Array.from(new Set(g.memberIds.map(remap))):g.memberIds})),
    memos: project.memos?.map(m => ({...m,codeIds:Array.from(new Set(m.codeIds.map(remap)))})),
    queries: project.queries?.map(q => ({...q,codeIds:Array.from(new Set(q.codeIds.map(remap))),excludeCodeIds:Array.from(new Set(q.excludeCodeIds.map(remap)))})),
    codedSegments: Array.from(segmentsByKey.values()),
    codedRegions: Array.from(regionsByKey.values()),
    mapAnnotations: remapAnnotations(project.mapAnnotations),
    mapDesign: remapMapDesign(project.mapDesign),
    mapView: project.mapView ? { ...project.mapView, expandedRoots: Array.from(new Set((project.mapView.expandedRoots || []).map(remap))) } : project.mapView,
    mapDrafts,
    mapEdgeStyles: (project.mapEdgeStyles || []).map(e => ({ ...e, fromCodeId: remap(e.fromCodeId), toCodeId: remap(e.toCodeId) }))
      .filter(e => e.fromCodeId !== e.toCodeId),
    hiddenMapCodeIds: (project.hiddenMapCodeIds || []).filter(id => !removed.has(id))
  };
}
