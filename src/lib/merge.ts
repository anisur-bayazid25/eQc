import { Project, Folder, SourceDoc, Code, CodedSegment, uid, colorForNewCode, CODE_COLORS } from '../domain';

export interface MergeSummary {
  foldersAdded: number;
  docsAdded: number;
  docsMerged: number;   // matched an existing same-name, byte-identical document instead of duplicating it
  codesAdded: number;
  codesReused: number;
  segmentsAdded: number;
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
// - Every merged-in segment is tagged with source.coderName (if set), and
//   any of target's own pre-existing segments that don't yet have a coder
//   tag are backfilled with target.coderName — so after a merge, every
//   segment has attribution, not just the newly-arrived ones.
export function mergeProjectInto(target: Project, source: Project): MergeSummary {
  const summary: MergeSummary = { foldersAdded: 0, docsAdded: 0, docsMerged: 0, codesAdded: 0, codesReused: 0, segmentsAdded: 0 };

  if (target.coderName) {
    for (const s of target.codedSegments) {
      if (!s.coder) s.coder = target.coderName;
    }
  }

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
      sizeBytes: d.sizeBytes || d.content.length
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
  for (const seg of source.codedSegments) {
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
      ...(coder ? { coder } : {})
    };
    target.codedSegments.push(mapped);
    summary.segmentsAdded++;
  }

  return summary;
}