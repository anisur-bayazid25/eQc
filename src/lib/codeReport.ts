import { Project, ID, CodedRegion, CodedSegment, codeAncestorPath, UNATTRIBUTED_CODER } from '../domain';
import { ExportScope } from './exportBuilders';
import { sourceLineRange } from './sourceLines';
import { excerptResearch, linkedMemos } from './researchDetails';

export interface ReportExcerpt {
  cases?: string;
  attributes?: string;
  location?: string;
  text?: string;
  coder: string;
  note?: string;
  starred?: boolean;
  region?: CodedRegion;
  image?: { base64: string; width: number; height: number };
}
export interface ReportCode {
  id: ID;
  path: string;
  definition?: string;
  summary?: string;
  frameworkMemo?: string;
  excerptCount: number;
  excerpts: ReportExcerpt[];
}
export interface CodeReport {
  kind: 'codeReport';
  title: string;
  projectName: string;
  description: string;
  filenameBase: string;
  sources: Array<{ name: string; type: 'Document' | 'Image'; memo?: string; codes: ReportCode[] }>;
  uncoded: ReportCode[];
}

/** Preserve Unicode names while respecting Windows filename restrictions. */
export function codeExportFilename(project: Project, ids?: ReadonlySet<ID>): string {
  const names = ids ? project.codes.filter(c => ids.has(c.id)).map(c => c.name) : ['All codes'];
  const clean = (s: string) => s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').trim();
  const projectPart = Array.from(clean(project.name) || 'Project').slice(0, 90).join('');
  const codePart = names.map(clean).filter(Boolean).join(' + ') || 'Selected codes';
  const base = `${projectPart}_${codePart}`;
  const safe = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(base) ? `_${base}` : base;
  return Array.from(safe).slice(0, 180).join('').replace(/[. ]+$/g, '');
}

/** Source → code → excerpt structure; CSV retains its separate tabular builder. */
export function buildCodeReport(project: Project, scope: ExportScope, ids?: ReadonlySet<ID>): CodeReport {
  const includeExcerpts = scope !== 'codesOnly';
  const includeMemos = scope !== 'codesExcerpts';
  const selected = project.codes.filter(c => !ids || ids.has(c.id));
  const selectedIds = new Set(selected.map(c => c.id));
  const report: CodeReport = {
    kind: 'codeReport', title: scope === 'codesOnly' ? 'Codebook' : 'Coded excerpts',
    projectName: project.name,
    description: scope === 'codesOnly' ? 'Code definitions and summaries grouped by their source documents and images.'
      : `Text and image excerpts grouped by source and code${includeMemos ? ', with definitions, summaries and memos' : ''}. Counts refer to coding entries; overlapping passages and separate coders are retained.`,
    filenameBase: codeExportFilename(project, ids), sources: [], uncoded: []
  };
  const makeCode = (code: typeof selected[number], docId?: ID): ReportCode => ({
    id: code.id, path: [...codeAncestorPath(project.codes, code), code.name].join(' > '),
    definition: includeMemos ? code.definition : undefined,
    summary: includeMemos ? [code.summary,linkedMemos(project,'codeIds',code.id)].filter(Boolean).join('\n\n') : undefined,
    frameworkMemo: includeMemos && docId ? (project.frameworkCells || []).filter(c => c.docId === docId && c.codeId === code.id).map(c => c.text).filter(Boolean).join('\n\n') : undefined,
    excerptCount: 0, excerpts: []
  });
  const used = new Set<ID>();
  const segmentsBySource = new Map<ID, Map<ID, CodedSegment[]>>();
  const regionsBySource = new Map<ID, Map<ID, CodedRegion[]>>();
  const group = <T extends { codeId: ID }>(map: Map<ID, Map<ID, T[]>>, sourceId: ID, item: T) => {
    if (!selectedIds.has(item.codeId)) return;
    if (!map.has(sourceId)) map.set(sourceId, new Map());
    const codes = map.get(sourceId)!;
    if (!codes.has(item.codeId)) codes.set(item.codeId, []);
    codes.get(item.codeId)!.push(item);
  };
  for (const segment of project.codedSegments) group(segmentsBySource, segment.docId, segment);
  for (const region of project.codedRegions || []) group(regionsBySource, region.imageId, region);
  const docsById = new Map(project.docs.map(d => [d.id, d]));
  const imagesById = new Map((project.images || []).map(i => [i.id, i]));
  // Include missing sources explicitly rather than silently dropping their coding.
  const docIds = new Set([...docsById.keys(), ...segmentsBySource.keys()]);
  const imageIds = new Set([...imagesById.keys(), ...regionsBySource.keys()]);
  for (const type of ['Document', 'Image'] as const) {
    for (const sourceId of type === 'Document' ? docIds : imageIds) {
      const source = type === 'Document' ? docsById.get(sourceId) : imagesById.get(sourceId);
      const codes: ReportCode[] = [];
      for (const code of selected) {
        const segments = type === 'Document' ? (segmentsBySource.get(sourceId)?.get(code.id) || []).sort((a, b) => a.start - b.start || a.createdAt - b.createdAt) : [];
        const regions = type === 'Image' ? (regionsBySource.get(sourceId)?.get(code.id) || []).sort((a, b) => a.y - b.y || a.x - b.x || a.createdAt - b.createdAt) : [];
        if (!segments.length && !regions.length) continue;
        used.add(code.id);
        const item = makeCode(code, type === 'Document' ? sourceId : undefined);
        item.excerptCount = segments.length + regions.length;
        if (includeExcerpts) item.excerpts = [
          ...segments.map(s => { const research=excerptResearch(project,s.id,s.docId,s);return { text: s.text, location: source ? sourceLineRange((source as typeof project.docs[number]).content, s.start, s.end) : undefined, coder: s.coder || UNATTRIBUTED_CODER, cases:research.cases,attributes:research.attributes,note:includeMemos?[s.note,research.notes].filter(Boolean).join('\n\n'):s.note, starred: s.starred }; }),
          ...regions.map(r => {const research=excerptResearch(project,r.id,r.imageId);return { region: r, coder: r.coder || UNATTRIBUTED_CODER,cases:research.cases,attributes:research.attributes,note:includeMemos?[r.note,research.notes].filter(Boolean).join('\n\n'):r.note, starred: r.starred };})
        ];
        codes.push(item);
      }
      if (codes.length) report.sources.push({ name: source?.name || `Missing source ${sourceId}`, type, memo: includeMemos ? [source?.notes,linkedMemos(project,'docIds',sourceId)].filter(Boolean).join('\n\n') : undefined, codes });
    }
  }
  report.uncoded = selected.filter(c => !used.has(c.id)).map(c => makeCode(c));
  return report;
}
