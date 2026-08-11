import { Project, Folder, SourceDoc, Code, CodedSegment, uid, randomColor } from '../domain';

export interface MergeSummary {
  foldersAdded: number;
  docsAdded: number;
  codesAdded: number;
  codesReused: number;
  segmentsAdded: number;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

// Merges `source` project data into `target` (mutated in place).
// - Folders/docs are always added as new (kept distinct per source file,
//   as intended for "different researchers coding different documents").
// - Codes are unified by matching name + position in the hierarchy, so
//   the same theme coded independently in two files collapses into one
//   code with combined excerpts.
export function mergeProjectInto(target: Project, source: Project): MergeSummary {
  const summary: MergeSummary = { foldersAdded: 0, docsAdded: 0, codesAdded: 0, codesReused: 0, segmentsAdded: 0 };

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
        match = {
          id: uid('code'),
          name: sc.name,
          color: randomColor(target.codes.length),
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

  for (const seg of source.codedSegments) {
    const docId = docIdMap.get(seg.docId);
    const codeId = codeIdMap.get(seg.codeId);
    if (!docId || !codeId) continue;
    const mapped: CodedSegment = {
      id: uid('seg'),
      docId,
      codeId,
      start: seg.start,
      end: seg.end,
      text: seg.text,
      createdAt: seg.createdAt || Date.now(),
      source: seg.source || 'manual'
    };
    target.codedSegments.push(mapped);
    summary.segmentsAdded++;
  }

  return summary;
}
