// Core data model for eQc project.
// The whole project is persisted as one JSON document per row in SQLite
// (table `projects`), matching the "single JSON blob, replace on save"
// approach already used by the desktop app's migration path.

export type ID = string;

export interface Folder {
  id: ID;
  name: string;
  parentId: ID | null;
}

export interface SourceDoc {
  id: ID;
  folderId: ID | null;
  name: string;
  content: string;      // plain text content used for coding/search
  addedAt: number;
  sizeBytes: number;
  notes?: string;        // source-level memo (e.g. from REFI-QDA import)
}

export interface Code {
  id: ID;
  name: string;
  color: string;
  parentId: ID | null;
  summary: string;       // memo / definition text
}

export interface CodedSegment {
  id: ID;
  docId: ID;
  codeId: ID;
  start: number;         // character offset in doc.content
  end: number;
  text: string;
  createdAt: number;
  source: 'manual' | 'csv-import' | 'auto-code' | 'qdpx-import'| 'docx-comment-import';
  note?: string;          // segment-level memo (e.g. from REFI-QDA import)
  starred?: boolean;      // marked as a "key quote" for manuscript writing
}

export interface CodeRelationNote {
  id: ID;
  codeAId: ID;
  codeBId: ID;   // canonical: always the lexicographically smaller id first, so A×B and B×A share one note
  note: string;
  updatedAt: number;
}

export interface FrameworkCell {
  id: ID;
  docId: ID;
  codeId: ID;
  text: string;
  updatedAt: number;
}

export interface Project {
  id: ID;
  name: string;
  createdAt: number;
  folders: Folder[];
  docs: SourceDoc[];
  codes: Code[];
  codedSegments: CodedSegment[];
  frameworkCells?: FrameworkCell[];   // case × theme summary matrix (framework analysis)
  relationNotes?: CodeRelationNote[]; // analytic memos on code-pair relationships (co-occurrence)
}

export interface ProjectSummary {
  id: ID;
  name: string;
  createdAt: number;
}

export function uid(prefix = 'id'): ID {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function newProject(name: string): Project {
  return {
    id: uid('proj'),
    name,
    createdAt: Date.now(),
    folders: [],
    docs: [],
    codes: [],
    codedSegments: [],
    frameworkCells: [],
    relationNotes: []
  };
}

export const CODE_COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80',
  '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa',
  '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6'
];

export function randomColor(seedIndex: number): string {
  return CODE_COLORS[seedIndex % CODE_COLORS.length];
}

// Returns all descendant code ids (including the code itself)
export function descendantCodeIds(codes: Code[], rootId: ID): Set<ID> {
  const result = new Set<ID>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of codes) {
      if (c.parentId && result.has(c.parentId) && !result.has(c.id)) {
        result.add(c.id);
        added = true;
      }
    }
  }
  return result;
}

export function childCodes(codes: Code[], parentId: ID | null): Code[] {
  return codes.filter(c => c.parentId === parentId);
}

// Names of every ancestor of `code`, root-first, not including `code` itself.
// Used to show a breadcrumb (e.g. "Infrastructure › Drainage") in search results.
export function codeAncestorPath(codes: Code[], code: Code): string[] {
  const path: string[] = [];
  let current = code;
  const byId = new Map(codes.map(c => [c.id, c]));
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    path.unshift(parent.name);
    current = parent;
  }
  return path;
}
