import { Project, Code, ID, CodedRegion, codeAncestorPath, childCodes, UNATTRIBUTED_CODER } from '../domain';
import { sourceLineRange } from './sourceLines';
import { excerptResearch, linkedMemos } from './researchDetails';

export type ExportScope = 'codesOnly' | 'codesExcerpts' | 'codesExcerptsSummaries';

export const SCOPE_LABELS: Record<ExportScope, string> = {
  codesOnly: 'Codes only (codebook)',
  codesExcerpts: 'Codes + excerpts',
  codesExcerptsSummaries: 'Codes + excerpts + summaries'
};

function csvEscape(v: string | undefined): string {
  const s = v ?? '';
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function rowsToCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\r\n');
}

// Breaks a code's hierarchy into up to 3 columns (Parent / Child 1 / Child 2)
// — deliberately matching the same header names your CSV importer already
// recognizes, so codesExcerpts/Summaries exports can be re-imported
// into another project via "Import Dataset (CSV)" if you ever want to.
function codeLevelColumns(codes: Code[], code: Code): [string, string, string] {
  const path = [...codeAncestorPath(codes, code), code.name];
  return [
    path[0] || '',
    path[1] || '',
    path.length > 3 ? path.slice(2).join(' > ') : (path[2] || '')
  ];
}

// Same 3-column shape for coding definitions: each level's own definition.
// Resolved by walking the real parentId chain upward from the code (root-first)
// rather than re-matching the path by name — two sibling codes may share a
// name, and name matching would then pick the wrong one. The `seen` guard
// stops a corrupted cyclic parentId from spinning forever.
// Depth limit: only 3 columns exist, so for paths deeper than 3 levels the
// deepest code's definition lands in the "Child 2" slot and intermediate
// levels' definitions are not carried (the same 3-level ceiling the name
// columns have always had).
function codeLevelDefinitions(codes: Code[], code: Code): [string, string, string] {
  const chain: Code[] = [];
  const seen = new Set<string>();
  let cur: Code | undefined = code;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    const parentId: ID | null = cur.parentId;
    cur = parentId ? codes.find(c => c.id === parentId) : undefined;
  }
  return [
    chain[0]?.definition || '',
    chain[1]?.definition || '',
    chain.length > 3
      ? chain[chain.length - 1]?.definition || ''
      : (chain[2]?.definition || '')
  ];
}

export interface ScopedExport {
  headers: string[];
  rows: string[][];
  csv: string;
  imageRows?: Array<{ row: number; column: number; region: CodedRegion }>;
}

export function buildScopedExport(project: Project, scope: ExportScope, selectedIds?: ReadonlySet<ID>): ScopedExport {
  const docsById = new Map(project.docs.map(d => [d.id, d]));
  const imagesById = new Map((project.images || []).map(d => [d.id, d]));
  const codes = project.codes.filter(c => !selectedIds || selectedIds.has(c.id));
  const includeSummary = scope === 'codesExcerptsSummaries';
  const researchColumns=!!(project.cases?.length||project.groups?.length||project.annotations?.length||project.memos?.length);
  if (scope === 'codesOnly') {
    const headers = ['Document', 'Parent Node', 'Child Node 1', 'Child Node 2', 'Definition of Parent', 'Definition of Child 1', 'Definition of Child 2', 'Code Summary'];
    const rows = codes.map(c => {
      const names = new Set([
        ...project.codedSegments.filter(s => s.codeId === c.id).map(s => docsById.get(s.docId)?.name || 'Unknown source'),
        ...(project.codedRegions || []).filter(r => r.codeId === c.id).map(r => imagesById.get(r.imageId)?.name || 'Unknown source')
      ]);
      return [[...names].join('; '), ...codeLevelColumns(project.codes, c), ...codeLevelDefinitions(project.codes, c), c.summary || ''];
    });
    return { headers, rows, csv: rowsToCsv(headers, rows) };
  }
  const headers = ['Document', 'Parent Node', 'Child Node 1', 'Child Node 2', 'Quote', 'Coder', 'Excerpt Memo', 'Source Lines',
    ...(includeSummary ? ['Code Summary', 'Code Definition'] : []),...(researchColumns?['Cases','Case Attributes','Source Groups','Code Groups',...(includeSummary?['Related Notes','Source Memo']:[])]:[])];
  const rows: string[][] = [];
  const imageRows: NonNullable<ScopedExport['imageRows']> = [];
  for (const code of codes) {
    const makeRow = (name: string, quote: string, coder: string, note: string, lines = '', id='',sourceId='',segment?:Project['codedSegments'][number]) => {
      const research=excerptResearch(project,id,sourceId,segment);
      rows.push([name, ...codeLevelColumns(project.codes, code), quote, coder, note, lines,
        ...(includeSummary ? [[code.summary,linkedMemos(project,'codeIds',code.id)].filter(Boolean).join('\n\n'), code.definition || ''] : []),...(researchColumns?[research.cases,research.attributes,research.sourceGroups,(project.groups||[]).filter(g=>g.kind==='codes'&&g.memberIds.includes(code.id)).map(g=>g.name).join('; '),...(includeSummary?[research.notes,[docsById.get(sourceId)?.notes||imagesById.get(sourceId)?.notes,linkedMemos(project,'docIds',sourceId)].filter(Boolean).join('\n\n')]:[])]:[])]);
    };
    const segments = project.codedSegments.filter(s => s.codeId === code.id);
    const regions = (project.codedRegions || []).filter(r => r.codeId === code.id);
    for (const seg of segments) {
      const doc = docsById.get(seg.docId);
      makeRow(doc?.name || 'Unknown source', seg.text, seg.coder || UNATTRIBUTED_CODER, seg.note || '', doc ? sourceLineRange(doc.content, seg.start, seg.end) : '',seg.id,seg.docId,seg);
    }
    for (const r of regions) {
      imageRows.push({ row: rows.length, column: 4, region: r });
      makeRow(imagesById.get(r.imageId)?.name || 'Unknown source',
        `[Image region: x=${r.x}, y=${r.y}, width=${r.width}, height=${r.height}]`, r.coder || UNATTRIBUTED_CODER, r.note || '','',r.id,r.imageId);
    }
    // Uncoded codes still carry their definitions and memos in the export.
    if (!segments.length && !regions.length) makeRow('', '', '', '');
  }
  return { headers, rows, imageRows, csv: rowsToCsv(headers, rows) };
}

// Legacy outline helper retained for callers needing an indented code tree.
// Codebook DOCX uses the source-aware narrative builder in codeReport.ts.
// Carries both the summary/memo and the coding definition, so a codebook
// exported to Word is self-contained.
export function buildCodebookOutline(project: Project): { depth: number; name: string; summary?: string; definition?: string }[] {
  const out: { depth: number; name: string; summary?: string; definition?: string }[] = [];
  function walk(parentId: string | null, depth: number) {
    for (const c of childCodes(project.codes, parentId)) {
      out.push({
        depth,
        name: c.name,
        summary: c.summary || undefined,
        definition: c.definition || undefined
      });
      walk(c.id, depth + 1);
    }
  }
  walk(null, 0);
  return out;
}
