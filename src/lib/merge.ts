import { Project, Folder, SourceDoc, Code, CodedSegment, CodedRegion, ImageSource, FrameworkCell, CodeRelationNote, MapEdgeStyle, uid, colorForNewCode, CODE_COLORS } from '../domain';
import { mergeResearch } from './researchMerge';

export interface MergeSummary {
  foldersAdded: number;
  docsAdded: number;
  docsMerged: number;   // matched an existing same-name, byte-identical document instead of duplicating it
  codesAdded: number;
  codesReused: number;
  segmentsAdded: number;
  imagesAdded: number;
  imagesMerged: number;
  regionsAdded: number;
  frameworkCellsAdded: number;
  relationNotesAdded: number;
  edgeStylesAdded: number;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

// Assigns one stable color per coder, distinct from colors already present
// in the merged project. All new codes arriving from the same source
// project share that coder's color, so after a multi-coder merge each
// coder's contribution is visually identifiable at a glance.
function buildCoderColorPicker(target: Project) {
  const taken = new Set(target.codes.map(c => c.color));
  const byCoder = new Map<string, string>();
  return (coder: string | undefined): string => {
    if (!coder) return colorForNewCode(target.codes, null, target.codes.length);
    let color = byCoder.get(coder);
    if (color) return color;
    const free = CODE_COLORS.find(c => !taken.has(c));
    if (free) {
      color = free;
    } else {
      let h = 0;
      for (let i = 0; i < coder.length; i++) h = (h * 31 + coder.charCodeAt(i)) >>> 0;
      color = CODE_COLORS[h % CODE_COLORS.length];
    }
    taken.add(color);
    byCoder.set(coder, color);
    return color;
  };
}

// Merges `source` project data into `target` (mutated in place).
// - Documents: reused if a target doc exists with the same name AND
//   byte-identical content (offsets only mean anything against the exact
//   text they were measured on — anything less than exact match is kept
//   as a separate document, same as before, rather than risking
//   mis-located highlights).
// - Codes are unified by matching name + position in the hierarchy, so
//   the same theme coded independently in two files collapses into one
//   code with combined excerpts.
// - Every merged-in segment is tagged with source.coderName (if set).
//   Pre-existing segments in the target are NEVER re-labeled: the stamps
//   they carry were captured when they were created and are the stable
//   source of truth. If a target segment has no coder yet, it stays
//   "Unattributed" until the user explicitly assigns one in Project
//   Settings — never silently attributed to whoever happens to be active.
// - Collaborative artifacts carried across with id remapping: image sources +
//   their coded regions, framework-matrix cells, relationship notes, and
//   manual Code Map edge styles. These are analytic products of the coding
//   effort, so dropping them on merge would silently discard a teammate's
//   analysis. NOT carried: `mapAnnotations` (free-standing drawing marks tied
//   to no code) and `hiddenMapCodeIds` (a view-local "which codes did I hide
//   from my map" preference, not shared analysis).
// - Every carried item is deduped on its remapped key, so re-running Merge on
//   the same file stays idempotent.
export function mergeProjectInto(target: Project, source: Project): MergeSummary {
  const summary: MergeSummary = {
    foldersAdded: 0, docsAdded: 0, docsMerged: 0, codesAdded: 0, codesReused: 0, segmentsAdded: 0,
    imagesAdded: 0, imagesMerged: 0, regionsAdded: 0, frameworkCellsAdded: 0, relationNotesAdded: 0, edgeStylesAdded: 0
  };

  const folderIdMap = new Map<string, string>();
  for (const f of source.folders) {
    const newId = uid('folder');
    folderIdMap.set(f.id, newId);
  }
  for (const f of source.folders) {
    const mapped: Folder = {
      id: folderIdMap.get(f.id)!,
      name: f.name,
      parentId: f.parentId ? folderIdMap.get(f.parentId) || null : null
    };
    target.folders.push(mapped);
    summary.foldersAdded++;
  }

  const docIdMap = new Map<string, string>();
  for (const d of source.docs) {
    const existingMatch = target.docs.find(
      td => normalize(td.name) === normalize(d.name) && td.content === d.content
    );
    if (existingMatch) {
      if (!existingMatch.original && d.original) existingMatch.original = { ...d.original };
      docIdMap.set(d.id, existingMatch.id);
      summary.docsMerged++;
      continue;
    }
    const newId = uid('doc');
    docIdMap.set(d.id, newId);
    const mapped: SourceDoc = {
      id: newId,
      folderId: d.folderId ? folderIdMap.get(d.folderId) || null : null,
      name: d.name,
      content: d.content,
      addedAt: d.addedAt || Date.now(),
      sizeBytes: d.sizeBytes || d.content.length,
      ...(d.original ? { original: { ...d.original } } : {})
    };
    target.docs.push(mapped);
    summary.docsAdded++;
  }

  // Unify codes level by level so parent/child relationships line up
  // even though ids differ between the two project files.
  const codeIdMap = new Map<string, string>();
  const byParent = (codes: Code[], parentId: string | null) => codes.filter(c => c.parentId === parentId);
  const coderColor = buildCoderColorPicker(target);
  const sourceCoderName = source.coderName;

  function mergeLevel(sourceParentId: string | null, targetParentId: string | null) {
    for (const sc of byParent(source.codes, sourceParentId)) {
      let match = target.codes.find(
        tc => tc.parentId === targetParentId && normalize(tc.name) === normalize(sc.name)
      );
      if (match) {
        summary.codesReused++;
        if (sc.summary && !match.summary.includes(sc.summary)) {
          match.summary = match.summary ? `${match.summary}\n\n${sc.summary}` : sc.summary;
        }
        if (sc.definition && !(match.definition && match.definition.trim())) {
          match.definition = sc.definition;
        }
      } else {
        // Root codes arriving from a coder-tagged project get that coder's
        // color; subcodes inherit the parent's color (colorForNewCode),
        // which after a merge is the same coder color.
        match = {
          id: uid('code'),
          name: sc.name,
          color: targetParentId === null
            ? coderColor(sourceCoderName)
            : colorForNewCode(target.codes, targetParentId, target.codes.length),
          parentId: targetParentId,
          summary: sc.summary,
          definition: sc.definition,
          createdAt: Date.now()
        };
        target.codes.push(match);
        summary.codesAdded++;
      }
      codeIdMap.set(sc.id, match.id);
      mergeLevel(sc.id, match.id);
    }
  }
  mergeLevel(null, null);

  const coder = source.coderName || undefined;

  // Image sources: reuse an existing image with the same data (base64 bytes
  // are the identity), else add it. Region coordinates are normalized 0–1, so
  // they survive the remap to a different image id unchanged.
  const imageIdMap = new Map<string, string>();
  for (const img of source.images || []) {
    const existing = (target.images || []).find(t => img.pdfPage
      ? t.pdfPage?.docId === docIdMap.get(img.pdfPage.docId) && t.pdfPage?.page === img.pdfPage.page && t.pdfPage?.originalHash === img.pdfPage.originalHash
      : t.dataUrl === img.dataUrl);
    if (existing) {
      if (!existing.pdfPage && img.pdfPage && docIdMap.has(img.pdfPage.docId)) existing.pdfPage = { ...img.pdfPage, docId: docIdMap.get(img.pdfPage.docId)! };
      imageIdMap.set(img.id, existing.id);
      summary.imagesMerged++;
      continue;
    }
    const newId = uid('img');
    imageIdMap.set(img.id, newId);
    const mapped: ImageSource = {
      ...img,
      id: newId,
      ...(img.pdfPage ? { pdfPage: { ...img.pdfPage, docId: docIdMap.get(img.pdfPage.docId) || img.pdfPage.docId } } : {}),
      folderId: img.folderId ? folderIdMap.get(img.folderId) || null : null
    };
    if (!target.images) target.images = [];
    target.images.push(mapped);
    summary.imagesAdded++;
  }

  for (const seg of source.codedSegments) {
    const coder = seg.coder || source.coderName || undefined;
    const docId = docIdMap.get(seg.docId);
    const codeId = codeIdMap.get(seg.codeId);
    if (!docId || !codeId) continue;

    // Dedupe on (doc, code, span, coder) — only matters when docId points
    // at a reused document (a brand-new document can't already contain
    // these ids), but harmless to apply uniformly. This is what makes
    // re-running Merge on the same file safe rather than doubling everything.
    const alreadyPresent = target.codedSegments.some(
      s => s.docId === docId && s.codeId === codeId && s.start === seg.start && s.end === seg.end && s.coder === coder
    );
    if (alreadyPresent) continue;

    const mapped: CodedSegment = {
      id: uid('seg'),
      docId,
      codeId,
      start: seg.start,
      end: seg.end,
      text: seg.text,
      createdAt: seg.createdAt || Date.now(),
      source: seg.source || 'manual',
      ...(coder ? { coder } : {}),
      ...(seg.note ? { note: seg.note } : {}),
      ...(seg.starred ? { starred: true } : {})
    };
    target.codedSegments.push(mapped);
    summary.segmentsAdded++;
  }

  // Image coded regions — deduped on (image, code, geometry, coder).
  if (source.codedRegions && source.codedRegions.length > 0) {
    if (!target.codedRegions) target.codedRegions = [];
    for (const r of source.codedRegions) {
      const coder = r.coder || source.coderName || undefined;
      const imageId = imageIdMap.get(r.imageId);
      const codeId = codeIdMap.get(r.codeId);
      if (!imageId || !codeId) continue;
      // Dedupe on the SAME key the segment loop uses: the merge is attributed to
      // the source project's coder name, so compare against that — comparing
      // against the region's own (usually absent) stamp would never match and
      // would duplicate every region on each re-merge.
      const alreadyPresent = target.codedRegions.some(t =>
        t.imageId === imageId && t.codeId === codeId && t.x === r.x && t.y === r.y &&
        t.width === r.width && t.height === r.height && t.coder === coder
      );
      if (alreadyPresent) continue;
      const mapped: CodedRegion = {
        ...r,
        id: uid('region'),
        imageId,
        codeId,
        createdAt: r.createdAt || Date.now(),
        ...(coder ? { coder } : {}),
        ...(r.note ? { note: r.note } : {}),
        ...(r.starred ? { starred: true } : {})
      };
      target.codedRegions.push(mapped);
      summary.regionsAdded++;
    }
  }

  // Framework-matrix cells (case × theme summaries) — deduped on doc::code.
  if (source.frameworkCells && source.frameworkCells.length > 0) {
    if (!target.frameworkCells) target.frameworkCells = [];
    for (const cell of source.frameworkCells) {
      const docId = docIdMap.get(cell.docId);
      const codeId = codeIdMap.get(cell.codeId);
      if (!docId || !codeId) continue;
      const key = `${docId}::${codeId}`;
      const existing = target.frameworkCells.find(c => `${c.docId}::${c.codeId}` === key);
      if (existing) {
        // Keep both texts rather than overwrite: two coders may have written
        // different summaries for the same case/theme pair.
        if (cell.text && cell.text.trim() && !existing.text.includes(cell.text)) {
          existing.text = existing.text.trim()
            ? `${existing.text.trim()}\n\n${cell.text.trim()}`
            : cell.text.trim();
          existing.updatedAt = Date.now();
        }
        continue;
      }
      const mapped: FrameworkCell = { ...cell, id: uid('fw'), docId, codeId, updatedAt: Date.now() };
      target.frameworkCells.push(mapped);
      summary.frameworkCellsAdded++;
    }
  }

  // Relationship notes on code pairs. Keys are canonicalized to the
  // lexicographically smaller id first (the same invariant the rest of the
  // app uses), so A×B and B×A resolve to one note.
  if (source.relationNotes && source.relationNotes.length > 0) {
    if (!target.relationNotes) target.relationNotes = [];
    const noteKey = (a: string, b: string) => (a < b ? `${a}::${b}` : `${b}::${a}`);
    for (const n of source.relationNotes) {
      const a = codeIdMap.get(n.codeAId);
      const b = codeIdMap.get(n.codeBId);
      if (!a || !b) continue;
      const text = (n.note || '').trim();
      if (!text) continue;
      const key = noteKey(a, b);
      const existing = target.relationNotes.find(t => noteKey(t.codeAId, t.codeBId) === key);
      if (existing) {
        if (!existing.note.includes(text)) {
          existing.note = existing.note.trim() ? `${existing.note.trim()}\n\n${text}` : text;
          existing.updatedAt = Date.now();
        }
        continue;
      }
      const mapped: CodeRelationNote = {
        id: uid('rel'),
        codeAId: a < b ? a : b,
        codeBId: a < b ? b : a,
        note: text,
        updatedAt: Date.now()
      };
      target.relationNotes.push(mapped);
      summary.relationNotesAdded++;
    }
  }

  // Manually styled / custom Code Map edges — deduped on the unordered pair
  // plus kind, so a re-merge does not stack duplicate overrides.
  if (source.mapEdgeStyles && source.mapEdgeStyles.length > 0) {
    if (!target.mapEdgeStyles) target.mapEdgeStyles = [];
    for (const s of source.mapEdgeStyles) {
      const from = codeIdMap.get(s.fromCodeId);
      const to = codeIdMap.get(s.toCodeId);
      if (!from || !to) continue;
      const existing = target.mapEdgeStyles.find(t =>
        t.kind === s.kind &&
        ((t.fromCodeId === from && t.toCodeId === to) || (t.fromCodeId === to && t.toCodeId === from))
      );
      if (existing) continue;
      const mapped: MapEdgeStyle = { ...s, id: uid('edge'), fromCodeId: from, toCodeId: to };
      target.mapEdgeStyles.push(mapped);
      summary.edgeStylesAdded++;
    }
  }

  mergeResearch(target,source,docIdMap,codeIdMap,imageIdMap);
  return summary;
}
