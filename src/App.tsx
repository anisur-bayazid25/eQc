import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  Project, ProjectSummary, Folder, SourceDoc, Code, CodedSegment, FrameworkCell, CodeRelationNote,
  ID, uid, newProject, colorForNewCode, childCodes, descendantCodeIds,
  CodedRegion, UNATTRIBUTED_CODER,
  MapEdgeStyle, MapAnnotation, ImageSource
} from './domain';
import CodeTree from './components/CodeTree';
import CodeSearch from './components/CodeSearch';
import DocTree, { SortKey } from './components/DocTree';
import DocEditor from './components/DocEditor';
import { getSelectionOffsets, SelectionOffsets } from './lib/textOffsets';
import { relocateSegmentsAfterEdit } from './lib/relocateSegments';
import { importCsvDataset } from './lib/csvImport';
import { importQdpx } from './lib/qdpxImport';
import { buildQdpxExport, buildQdpxCodebookExport } from './lib/qdpxExport';
import { importDocxComments } from './lib/docxCommentImport';
import { mergeProjectInto } from './lib/merge';
import { codingFrequency, codeDocumentMatrix, codeCooccurrenceMatrix } from './lib/analysis';
import { buildReportHtml, ReportExtras } from './lib/report';
import { AUTO_CODE_LANGUAGES, CaptureBoundary, AutoCodeMatchMode, runAutoCode } from './lib/autoCode';
import { extractBengaliTextFromPDF } from './lib/pdfExtractor';
import { buildScopedExport, buildCodebookOutline, ExportScope, SCOPE_LABELS } from './lib/exportBuilders';
import pkg from '../package.json';
import ImageEditor from './components/ImageEditor';
import { cropRegionToPng, renderCodedImagePng } from './lib/imageCrop';
import CodeMap from './components/CodeMap';
import DocumentPortrait from './components/DocumentPortrait';
import LanModal from './components/LanModal';
import type { LanHostInfo, LanSessionState, LanSyncProgress, LanRemoteProject, LanRole, LanCoder } from './global';

function IsolatedPromptModal({ isOpen, message, buttonText, onResolve }: any) {
  const [val, setVal] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Auto-focus and clear text when opened
  React.useEffect(() => {
    if (isOpen) {
      setVal('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Dark background overlay */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => onResolve(null)} />
      
      {/* Modal Box */}
      <div className="modal" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999, backgroundColor: '#ffffff', color: '#0f172a', padding: '24px', borderRadius: '8px', minWidth: '300px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <h3 style={{ marginTop: 0 }}>{message}</h3>
        <input 
          ref={inputRef}
          type="text" 
          value={val} 
          onChange={e => setVal(e.target.value)} 
          onKeyDown={e => {
            if (e.key === 'Enter') onResolve(val);
            if (e.key === 'Escape') onResolve(null);
          }}
          style={{ width: '100%', padding: '8px', marginBottom: '16px', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={() => onResolve(null)}>Cancel</button>
          <button onClick={() => onResolve(val)} className="primary-btn">{buttonText || 'Create'}</button>
        </div>
      </div>
    </>
  );
}

// Local-state input that commits to the parent only on blur/Enter and after a
// trailing pause, so typing in the codebook name/summary fields no longer
// triggers a full app persist+re-render on every keystroke.
function DebouncedCodeText({ value, onCommit, multiline }: { value: string; onCommit: (val: string) => void; multiline?: boolean }) {
  const [val, setVal] = React.useState(value);

  React.useEffect(() => {
    setVal(value);
  }, [value]);

  React.useEffect(() => {
    const t = setTimeout(() => {
      if (val !== value) onCommit(val);
    }, 500);
    return () => clearTimeout(t);
  }, [val, value, onCommit]);

  const commit = () => {
    if (val !== value) onCommit(val);
  };

  const el = multiline
    ? 'textarea'
    : 'input';

  const commonProps: any = {
    value: val,
    onChange: (e: any) => setVal(e.target.value),
    onBlur: commit,
    onKeyDown: (e: any) => {
      if (e.key === 'Enter' && !multiline) commit();
    },
    style: multiline
      ? { width: '100%', padding: '6px', minHeight: '80px', boxSizing: 'border-box', fontSize: '12px', resize: 'vertical' }
      : { width: '100%', padding: '6px', fontSize: '12px', boxSizing: 'border-box' },
  };

  return React.createElement(el, commonProps);
}

type Tab = 'workspace' | 'codebook' | 'codemap' | 'autocode' | 'analysis' | 'about';

// Coder filter predicate shared by the Workspace and Codebook lists. A
// segment matches when it is explicitly stamped with the chosen coder, or —
// when the "Unattributed" group is chosen — when it has no stamp at all.
// Untagged items therefore show up under BOTH "Everyone" and "Unattributed",
// never under a named coder, exactly matching what the UI displays.
function matchesCoder(coder: string | undefined, filter: string): boolean {
  return filter === 'all' || coder === filter || (filter === UNATTRIBUTED_CODER && !coder);
}

function describeLanDiff(prev: Project, next: Project): string {
  const parts: string[] = [];
  const delSeg = next.codedSegments.length - prev.codedSegments.length;
  if (delSeg) parts.push(`${delSeg > 0 ? '+' : ''}${delSeg} coded passage(s)`);
  const delCodes = next.codes.length - prev.codes.length;
  if (delCodes) parts.push(`${delCodes > 0 ? '+' : ''}${delCodes} code(s)`);
  const delDocs = next.docs.length - prev.docs.length;
  if (delDocs) parts.push(`${delDocs > 0 ? '+' : ''}${delDocs} document(s)`);
  const delImgs = (next.images?.length || 0) - (prev.images?.length || 0);
  if (delImgs) parts.push(`${delImgs > 0 ? '+' : ''}${delImgs} image(s)`);
  const delRegs = (next.codedRegions?.length || 0) - (prev.codedRegions?.length || 0);
  if (delRegs) parts.push(`${delRegs > 0 ? '+' : ''}${delRegs} image region(s)`);
  return parts.length > 0 ? parts.join(', ') : 'updated the project';
}

function flattenCodes(codes: Code[]): Array<{ code: Code; depth: number }> {
  const out: Array<{ code: Code; depth: number }> = [];
  function walk(parentId: ID | null, depth: number) {
    for (const c of childCodes(codes, parentId)) {
      out.push({ code: c, depth });
      walk(c.id, depth + 1);
    }
  }
  walk(null, 0);
  return out;
}

type FreqSortKey =
  | 'countDesc' | 'countAsc'
  | 'nameAsc' | 'nameDesc'
  | 'groupedNameAsc' | 'groupedNameDesc'
  | 'groupedCountDesc' | 'groupedCountAsc';

function sortFrequencyTree(
  project: Project,
  sortKey: FreqSortKey
): Array<{ code: Code; depth: number; ownCount: number; rolledUpCount: number; hasChildren: boolean }> {
  const ownCountByCode = new Map<ID, number>();
  for (const seg of project.codedSegments) {
    ownCountByCode.set(seg.codeId, (ownCountByCode.get(seg.codeId) || 0) + 1);
  }
  const rolledUp = (codeId: ID) => {
    let total = 0;
    descendantCodeIds(project.codes, codeId).forEach(id => { total += ownCountByCode.get(id) || 0; });
    return total;
  };
  const toRow = (code: Code, depth: number) => ({
    code,
    depth,
    ownCount: ownCountByCode.get(code.id) || 0,
    rolledUpCount: rolledUp(code.id),
    hasChildren: childCodes(project.codes, code.id).length > 0
  });

  // "Flat" sorts ignore hierarchy entirely — every code, one level, ranked
  // purely by the chosen criterion. Good for "what's my single most-coded
  // category regardless of where it sits in the tree".
  if (!sortKey.startsWith('grouped')) {
    const rows = project.codes.map(c => toRow(c, 0));
    switch (sortKey) {
      case 'countDesc': return rows.sort((a, b) => b.rolledUpCount - a.rolledUpCount);
      case 'countAsc': return rows.sort((a, b) => a.rolledUpCount - b.rolledUpCount);
      case 'nameAsc': return rows.sort((a, b) => a.code.name.localeCompare(b.code.name));
      case 'nameDesc': return rows.sort((a, b) => b.code.name.localeCompare(a.code.name));
      default: return rows;
    }
  }

  // "Grouped" sorts keep the parent/child nesting, but order siblings
  // within each level by the chosen criterion.
  const rows: Array<{ code: Code; depth: number; ownCount: number; rolledUpCount: number; hasChildren: boolean }> = [];
  function orderSiblings(codes: Code[]): Code[] {
    const copy = [...codes];
    switch (sortKey) {
      case 'groupedNameAsc': return copy.sort((a, b) => a.name.localeCompare(b.name));
      case 'groupedNameDesc': return copy.sort((a, b) => b.name.localeCompare(a.name));
      case 'groupedCountDesc': return copy.sort((a, b) => rolledUp(b.id) - rolledUp(a.id));
      case 'groupedCountAsc': return copy.sort((a, b) => rolledUp(a.id) - rolledUp(b.id));
      default: return copy;
    }
  }
  function walk(parentId: ID | null, depth: number) {
    for (const code of orderSiblings(childCodes(project.codes, parentId))) {
      rows.push(toRow(code, depth));
      walk(code.id, depth + 1);
    }
  }
  walk(null, 0);
  return rows;
}

function findCooccurringExcerpts(project: Project, codeAId: ID, codeBId: ID): Array<{ docName: string; text: string }> {
  const segsA = project.codedSegments.filter(s => s.codeId === codeAId);
  const segsB = project.codedSegments.filter(s => s.codeId === codeBId);
  const results: Array<{ docName: string; text: string }> = [];
  const seen = new Set<string>(); // avoids duplicate entries when several A/B pairs overlap the same stretch

  for (const a of segsA) {
    for (const b of segsB) {
      if (a.docId !== b.docId) continue;
      const overlaps = a.start < b.end && b.start < a.end; // standard interval-overlap test
      if (!overlaps) continue;

      // Show the union of both ranges, so the reader sees the full
      // overlapping context rather than just whichever code's span happens
      // to be narrower.
      const unionStart = Math.min(a.start, b.start);
      const unionEnd = Math.max(a.end, b.end);
      const key = `${a.docId}:${unionStart}:${unionEnd}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const doc = project.docs.find(d => d.id === a.docId);
      results.push({ docName: doc?.name || 'Unknown source', text: doc?.content.slice(unionStart, unionEnd) || '' });
    }
  }
  return results;
}

type NameCountSort = 'nameAsc' | 'nameDesc' | 'countDesc' | 'countAsc';

function sortByNameOrCount<T>(items: T[], getName: (t: T) => string, getCount: (t: T) => number, sortKey: NameCountSort): T[] {
  const copy = [...items];
  switch (sortKey) {
    case 'nameAsc': return copy.sort((a, b) => getName(a).localeCompare(getName(b)));
    case 'nameDesc': return copy.sort((a, b) => getName(b).localeCompare(getName(a)));
    case 'countDesc': return copy.sort((a, b) => getCount(b) - getCount(a));
    case 'countAsc': return copy.sort((a, b) => getCount(a) - getCount(b));
  }
}

// Small CSV helper reused by every per-view analysis export below.
function toCsv(headers: string[], rows: string[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
}

export type ReaderTheme = 'paperwhite' | 'white' | 'dark';

// Extended preset palette for the "More colors" picker (plain hex buttons —
// no canvas, no image resources, negligible cost to render).
const MORE_COLORS = [
  '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#f87171', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239',
  '#f97316', '#ea580c', '#c2410c', '#fb923c', '#fdba74', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f',
  '#facc15', '#eab308', '#ca8a04', '#fde047', '#fef08a', '#fef9c3', '#a16207', '#854d0e', '#713f12', '#7c2d12',
  '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#4ade80', '#86efac', '#bbf7d0', '#a3e635', '#84cc16',
  '#65a30d', '#4d7c0f', '#3f6212', '#365314', '#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#0f766e',
  '#115e59', '#134e4a', '#2dd4bf', '#14b8a6', '#0d9488', '#5eead4', '#99f6e4', '#06b6d4', '#0891b2', '#0e7490',
  '#22d3ee', '#67e8f9', '#a5f3fc', '#155e75', '#164e63', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#60a5fa',
  '#93c5fd', '#bfdbfe', '#0ea5e9', '#0284c7', '#0369a1', '#38bdf8', '#7dd3fc', '#bae6fd', '#075985', '#0c4a6e',
  '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81', '#818cf8', '#a5b4fc', '#c7d2fe', '#8b5cf6', '#7c3aed',
  '#6d28d9', '#5b21b6', '#4c1d95', '#a78bfa', '#c4b5fd', '#ddd6fe', '#9333ea', '#7e22ce', '#6b21a8', '#581c87',
  '#c026d3', '#a21caf', '#86198f', '#701a75', '#d946ef', '#e879f9', '#f0abfc', '#f5d0fe', '#ec4899', '#db2777',
  '#be185d', '#9d174d', '#831843', '#f472b6', '#f9a8d4', '#fbcfe8', '#8b5e3c', '#a0522d', '#6f4e37', '#c19a6b',
  '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#0f172a'
];

const THEME_STYLES: Record<ReaderTheme, React.CSSProperties> = {
  paperwhite: {
      backgroundColor: '#f8f1e3', // Paperwhite/Warm e-reader tan
    color: '#3c3226',           // Deep warm brown text  

  },
  white: {
    backgroundColor: '#ffffff', // Clean crisp white
    color: '#0f172a',           // Dark charcoal text
  },
  dark: {
    backgroundColor: '#0f172a', // Current dark background
    color: '#f8fafc',           // High-contrast white text
  },
};

export default function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<Tab>('workspace');
  const [toast, setToast] = useState<string | null>(null);
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>(() => {
    return (localStorage.getItem('qda-reader-theme') as ReaderTheme) || 'paperwhite';
  });
  const [readerFontSize, setReaderFontSize] = useState<number>(() => {
    const v = parseInt(localStorage.getItem('qda-reader-font-size') || '', 10);
    return Number.isNaN(v) ? 14 : Math.max(8, Math.min(48, v));
  });
  const [readerFontFamily, setReaderFontFamily] = useState<string>(() => {
    return localStorage.getItem('qda-reader-font-family') || '';
  });
  const [theme, setTheme] = useState<'dark' | 'light'>(
  () => (localStorage.getItem('qv-theme') as 'dark' | 'light') || 'dark'
);
  const [showDocNotes, setShowDocNotes] = useState(false);
  const [showDocPortrait, setShowDocPortrait] = useState(false);
  const [docNotesDraft, setDocNotesDraft] = useState('');
  const [editingNoteFor, setEditingNoteFor] = useState<ID | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [projectCoderDraft, setProjectCoderDraft] = useState('');
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0); // 0 = rename view, 1 = first confirm, 2 = final confirm

useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('qv-theme', theme);
}, [theme]);

  React.useEffect(() => {
    localStorage.setItem('qda-reader-theme', readerTheme);
  }, [readerTheme]);

  React.useEffect(() => {
    localStorage.setItem('qda-reader-font-size', String(readerFontSize));
  }, [readerFontSize]);

  React.useEffect(() => {
    localStorage.setItem('qda-reader-font-family', readerFontFamily);
  }, [readerFontFamily]);

  // Auto-update
  const [updateInfo, setUpdateInfo] = useState<{ version: string; url?: string; platform: string } | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  const [updateProgress, setUpdateProgress] = useState<number | null>(null);

  useEffect(() => {
    window.qv.onUpdateAvailable(info => setUpdateInfo(info));
    window.qv.onUpdateProgress(pct => setUpdateProgress(pct));
    window.qv.onUpdateReady(() => { setUpdateReady(true); setUpdateProgress(null); });
    window.qv.onUpdateNone(() => showToast('You are running the latest version.'));
    window.qv.onUpdateError(msg => showToast(`Update check failed: ${msg}`));
  }, []);

  // Workspace state
  const [selectedDocId, setSelectedDocId] = useState<ID | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [pendingSelection, setPendingSelection] = useState<SelectionOffsets | null>(null);
  const [segmentPopup, setSegmentPopup] = useState<{ segments: CodedSegment[]; x: number; y: number } | null>(null);
  const [editingDocId, setEditingDocId] = useState<ID | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [gotoTarget, setGotoTarget] = useState<{ segId: ID; nonce: number } | null>(null);
  const [docNameQuery, setDocNameQuery] = useState('');
  const [contentSearchOpen, setContentSearchOpen] = useState(false);
  const [contentSearchQuery, setContentSearchQuery] = useState('');
  const [highlightTarget, setHighlightTarget] = useState<{ docId: ID; start: number; end: number; nonce: number } | null>(null);
  const [showImageNotes, setShowImageNotes] = useState(false);
  const [imageNotesDraft, setImageNotesDraft] = useState('');
  const [editingRegionNoteFor, setEditingRegionNoteFor] = useState<ID | null>(null);
  const [regionNoteDraft, setRegionNoteDraft] = useState('');
  const [pendingDeleteImageId, setPendingDeleteImageId] = useState<ID | null>(null);
  

  // Undo / redo history (per project, in-memory only)
  const [past, setPast] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const HISTORY_LIMIT = 50;

  // Codebook state
  const [codebookSelectedCodeId, setCodebookSelectedCodeId] = useState<ID | null>(null);
  const [workspaceCodeSearch, setWorkspaceCodeSearch] = useState('');
  const [codebookCodeSearch, setCodebookCodeSearch] = useState('');
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>('codesExcerptsSummaries');
  const [docxCommentModalOpen, setDocxCommentModalOpen] = useState(false);
  const [docxSeparatorChoice, setDocxSeparatorChoice] = useState<',' | ';' | '|' | 'custom'>(',');
  const [docxCustomSeparator, setDocxCustomSeparator] = useState('');
  const [docxFirstIsSpeaker, setDocxFirstIsSpeaker] = useState(false);
  const [docxLastIsExcerpt, setDocxLastIsExcerpt] = useState(true);
  const [sortOrder, setSortOrder] = useState<string>('name');
  const [excerptSort, setExcerptSort] = useState('notes_first');
  // Coder attribution filter (Workspace & Codebook). 'all' = show everyone's
  // work; a specific name shows only that coder's segments/regions/excerpts.
  const [selectedCoderFilter, setSelectedCoderFilter] = useState<string>('all');

  useEffect(() => {
    setSelectedCoderFilter('all'); // switching projects must not keep a stale coder
  }, [project?.id]);

  // Auto-code state
  const [autoCodeQuery, setAutoCodeQuery] = useState('');
  const [autoCodeBoundary, setAutoCodeBoundary] = useState<CaptureBoundary>('exact');
  const [autoCodeLanguage, setAutoCodeLanguage] = useState(AUTO_CODE_LANGUAGES[0].code);
  const [autoCodeTargetCodeId, setAutoCodeTargetCodeId] = useState<ID | ''>('');
  const [autoCodeResultText, setAutoCodeResultText] = useState<string | null>(null);
  const [autoCodeMatchMode, setAutoCodeMatchMode] = useState<AutoCodeMatchMode>('root');
  const [autoCodePreview, setAutoCodePreview] = useState<{ count: number; docs: number } | null>(null);

  const [promptConfig, setPromptConfig] = React.useState<{
    isOpen: boolean;
    message: string;
    buttonText: string;
    resolve: ((value: string | null) => void) | null;
  }>({ isOpen: false, message: '', buttonText: '', resolve: null });

  // In-app confirm dialog. Native window.confirm() stalls renderer keyboard
  // focus in Electron (after it closes, no input accepts keystrokes until the
  // window loses and regains focus), so delete confirmations use this instead.
  const [confirmDialog, setConfirmDialog] = React.useState<{
    message: string;
    confirmText: string;
    onConfirm: () => void;
  } | null>(null);

  const customPrompt = (message: string, defaultValue: string = '', buttonText: string = 'Create'): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptConfig({ isOpen: true, message, buttonText, resolve });
    });
  };

  const handlePromptResolve = (value: string | null) => {
    if (promptConfig.resolve) promptConfig.resolve(value);
    setPromptConfig({ isOpen: false, message: '', buttonText: '', resolve: null });
  };

  const showToast = useCallback((msg: string, durationMs?: number) => {
    setToast(msg);
    setTimeout(() => setToast(t => (t === msg ? null : t)), durationMs ?? 3500);
  }, []);

  // ---------------------------------------------------------------
  // LAN collaboration state
  // ---------------------------------------------------------------
  const [lanModalOpen, setLanModalOpen] = useState(false);
  const [lanSession, setLanSession] = useState<LanSessionState | null>(null);
  // Latest lanSession readable from stable callbacks/effects without
  // re-subscribing (onRemoteProject and the broadcast effect need the
  // session's locked project id synchronously).
  const lanSessionRef = useRef<LanSessionState | null>(null);
  const [lanHosts, setLanHosts] = useState<LanHostInfo[]>([]);
  const [lanSync, setLanSync] = useState<LanSyncProgress | null>(null);
  const [lanJoining, setLanJoining] = useState(false);
  const [lanMyName, setLanMyName] = useState(() => localStorage.getItem('qda-lan-name') || 'Coder');
  // The LAN identity defaults to this project's Coder Name (set in Project
  // Settings) the moment a project loads, so hosted/joined sessions display
  // it by default. It stays editable from the LAN dialog for that session.
  useEffect(() => {
    if (project?.id) setLanMyName(project.coderName || 'Coder');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);
  // Offline-edit conflict waiting on a user decision after joining a host that
  // serves the same project we edited while disconnected. The host snapshot is
  // NOT applied until one of the three resolutions runs.
  const [lanConflict, setLanConflict] = useState<{
    hostProject: Project;
    hostName: string;
    seq: number;
  } | null>(null);
  const lanConflictRef = useRef<typeof lanConflict>(null);
  useEffect(() => {
    lanConflictRef.current = lanConflict;
  }, [lanConflict]);

  const projectRef = useRef<Project | null>(null);
  useEffect(() => { projectRef.current = project; }, [project]);

  const lastLanSeqRef = useRef(0);
  const lanApplyRemoteRef = useRef(false);
  const lanJoinedRef = useRef(false);
  const lanRoleRef = useRef<LanRole | null>(null);
  useEffect(() => {
    lanRoleRef.current = lanSession?.role ?? null;
    if (lanSession) localStorage.setItem('qda-lan-name', lanMyName);
  }, [lanSession, lanMyName]);

  // Current LAN session facts, derived per render (ref stays in sync with the
  // state via the onSessionState handler, so both agree).
  const isLanActive = !!lanSessionRef.current;
  const sessionProjectId = isLanActive ? lanSessionRef.current?.projectId : null;
  // True only while the OPEN project is exactly the session's locked project.
  const isLanSyncedView = isLanActive && !!project && project.id === sessionProjectId;
  // LAN clients may freely manage their OTHER local projects, but the
  // session's shared project stays locked (no rename/delete, it belongs to
  // the host's live state).
  const isLanSharedProjectLocked = isLanActive && lanSessionRef.current?.role === 'client' && isLanSyncedView;

  const applyLanRemote = useCallback((r: LanRemoteProject) => {
    // While an offline-conflict decision is pending we must NOT overwrite the
    // local (offline-edited) project with live host snapshots — the user still
    // has to pick merge/backup/discard. Reconnect flows re-sync right after.
    if (lanConflictRef.current && lanConflictRef.current.hostProject.id === r.project.id) return;
    // Security: the session is locked to ONE project id. A snapshot about any
    // other project is never applied (defense-in-depth behind the same check
    // in lan.cjs) — logged, not shovelled to disk.
    const sessionId = lanSessionRef.current?.projectId;
    if (sessionId && r.project.id !== sessionId) {
      console.warn('[LAN] Ignored remote snapshot outside the session lock', r.project.id);
      return;
    }
    const prev = projectRef.current;
    const seqKey = `qda-lan-seq-${r.project.id}`;
    // Every remote apply that we accept IS a sync point: afterwards our local
    // copy equals the session state, so only edits made after this moment can
    // count as "offline edits" on a later join.
    localStorage.setItem(`qda-lan-synced-at-${r.project.id}`, String(r.project.updatedAt ?? Date.now()));
    if (prev && prev.id === r.project.id) {
      // Viewing the shared project: update the screen and persist as normal.
      lanApplyRemoteRef.current = true;
      setProject(r.project);
      window.qv.saveProject(r.project).catch(() => {});
      localStorage.setItem(seqKey, String(r.seq));
      lastLanSeqRef.current = Math.max(lastLanSeqRef.current, r.seq);
      if (!r.quiet) showToast(`[${r.coderName}] ${describeLanDiff(prev, r.project)}`);
    } else {
      // Multitasking on a DIFFERENT local project: never yank the user's
      // screen away. The LAN updates for the shared project are written
      // silently to disk in the background, and the delta-tracking seq is
      // advanced so nothing is mistaken for an "offline edit" later.
      window.qv.saveProject(r.project).catch(() => {});
      localStorage.setItem(seqKey, String(r.seq));
      lastLanSeqRef.current = Math.max(lastLanSeqRef.current, r.seq);
    }
  }, [showToast]);

  useEffect(() => {
    window.qv.lan.onHostsUpdated(h => setLanHosts(h));
    // Track the previous coder roster to notify the HOST when someone new
    // joins. 'client' role users don't get these: only the host receives
    // join announcements (the joining side already confirmed its own name).
    const prevCoders = new Map<string | null, LanCoder[]>([[null, []]]);
    window.qv.lan.onSessionState(s => {
      // Defensive: a client always sees its own role as 'client', even if
      // the host is still running an older build that reports 'host'.
      const next = s && lanJoinedRef.current ? { ...s, role: 'client' as const } : s;
      lanSessionRef.current = next;
      setLanSession(next);
      if (next && next.role === 'host' && s) {
        const prior = prevCoders.get(s.projectId) ?? [];
        const added = s.coders.filter(c => !prior.some(p => p.coderName === c.coderName));
        if (prior.length > 0 && added.length > 0) {
          showToast(`${added.map(c => c.coderName).join(', ')} joined your session`);
        }
        prevCoders.set(s.projectId, s.coders);
      } else {
        // Session ended (or this build reports a role we don't toast for):
        // forget the previous roster so a brand-new host session doesn't
        // mistake itself for a "joiner".
        prevCoders.clear();
      }
    });
    window.qv.lan.onSyncProgress(p => {
      setLanSync(p.phase === 'done' || p.phase === 'error' ? null : p);
      if (p.phase === 'error' && p.message) showToast(`LAN: ${p.message}`);
    });
    window.qv.lan.onRemoteProject(r => applyLanRemote(r));
    window.qv.lan.onRejected(r => {
      // Defensive fallback only: the broadcast guard + the session lock should
      // already prevent these; a mismatch here signals an old host or a bug,
      // so it is logged instead of alarming the user.
      if (r.reason === 'project-mismatch') {
        console.warn('[LAN] Host refused a dispatch (project-mismatch)');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Broadcast every local project change while in a LAN session (200ms
  // debounce, latest wins). The suppression flag is consumed here so a
  // remote apply never echoes back (the first effect run after an apply
  // skips, subsequent local edits broadcast normally).
  useEffect(() => {
    if (!project) return;
    // Consume the suppression flag first — it marks "this change came from a
    // remote apply", regardless of which project is open.
    const suppressed = lanApplyRemoteRef.current;
    lanApplyRemoteRef.current = false;
    // Only the project that was shared when this session started may ever be
    // broadcast into the session. Editing a different local project is fully
    // allowed — it just stays local (silently, no popup).
    const sessionId = lanSessionRef.current?.projectId;
    if (sessionId && sessionId !== project.id) return;
    if (suppressed || !lanRoleRef.current) return;
    const t = setTimeout(() => {
      window.qv.lan.sendAction({ project, coderName: lanMyName }).then((res: { ok: boolean; error?: string }) => {
        // Our own edit reached the host → this moment is now a sync point.
        // Without this, reconnecting after having edited *while connected*
        // would wrongly trigger the offline-conflict prompt.
        if (res.ok) {
          const syncKey = `qda-lan-synced-at-${project.id}`;
          localStorage.setItem(syncKey, String(project.updatedAt ?? Date.now()));
          return;
        }
        if (res.error === 'project-mismatch') {
          console.warn('[LAN] Host refused a dispatch (project-mismatch)');
        }
      }).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [project, lanMyName, lanSession]);

  async function handleLanStartHost(hostName: string, password: string) {
    if (!project) return;
    lanJoinedRef.current = false;
    const res = await window.qv.lan.startHost({ hostName, password, project });
    if (res.ok) showToast(`Hosting "${project.name}" on port ${res.wsPort ?? 8080}`);
    else showToast(res.error || 'Failed to start hosting');
  }

  async function handleLanStopHost() {
    lanJoinedRef.current = false;
    await window.qv.lan.stopHost();
    showToast('LAN session stopped');
  }

  // Record that the given snapshot is the state we share with the session and
  // make it the active project. Shared by the plain join path and by every
  // offline-conflict resolution.
  function applyJoinedState(p: Project, seq: number) {
    lanJoinedRef.current = true;
    lanApplyRemoteRef.current = true;
    lastLanSeqRef.current = Math.max(lastLanSeqRef.current, seq);
    const seqKey = `qda-lan-seq-${p.id}`;
    localStorage.setItem(seqKey, String(seq));
    localStorage.setItem(`qda-lan-synced-at-${p.id}`, String(p.updatedAt ?? Date.now()));
    setProject(p);
    setProjects(list => [{ id: p.id, name: p.name, createdAt: p.createdAt }, ...list.filter(x => x.id !== p.id)]);
    setTab('workspace');
    setLanConflict(null);
  }

  async function handleLanJoin(host: LanHostInfo, password: string) {
    if (lanJoining) return;
    setLanJoining(true);
    setLanSync({ phase: 'connect', percent: 0, message: 'Starting…' });
    const res = await window.qv.lan.joinSession({
      hostIp: host.ip,
      wsPort: host.wsPort,
      password,
      coderName: lanMyName,
      projectId: host.projectId,
      lastSeq: null
    });
    setLanJoining(false);
    setLanSync(null);
    if (!res.ok) {
      window.qv.lan.startDiscovery().catch(() => {});
      showToast(res.error || 'Join failed');
      return;
    }
    if (!res.project) {
      showToast(`Connected to ${host.hostName}'s session`);
      return;
    }
    const hostProject = res.project;
    const seq = res.seq ?? 0;
    const localProj = projectRef.current;

    // Offline-edit detection: the same project id means we've synced with this
    // host before. If our local copy was edited after our last confirmed sync
    // point, applying the host snapshot blindly would throw that home work
    // away — so we pause and ask instead.
    if (localProj && localProj.id === hostProject.id) {
      const lastSyncAt = Number(localStorage.getItem(`qda-lan-synced-at-${hostProject.id}`) || '0');
      const localUpdatedAt = localProj.updatedAt ?? localProj.createdAt ?? 0;
      if (localUpdatedAt > lastSyncAt) {
        setLanConflict({ hostProject, hostName: host.hostName, seq });
        return; // host snapshot is NOT applied until the user resolves
      }
    }
    applyJoinedState(hostProject, seq);
    showToast(`Joined ${host.hostName}'s session — project synced`);
  }

  // Option 1 — merge offline work into the Host Session (default).
  // local project data is merged into a clone of the host snapshot, the merged
  // project is uploaded to the host (which fans it out to every client), and
  // the merged copy becomes the active project here.
  async function handleLanConflictMerge() {
    const conflict = lanConflictRef.current;
    const localProj = projectRef.current;
    if (!conflict || !localProj) return;
    // mergeProjectInto(target, source) mutates target — clone so we never
    // touch the JSON-parsed host snapshot in place.
    const merged = JSON.parse(JSON.stringify(conflict.hostProject)) as Project;
    const source = { ...localProj, coderName: lanMyName };
    const summary = mergeProjectInto(merged, source);
    const stamped = { ...merged, updatedAt: Date.now() } as Project;
    const res = await window.qv.lan.sendAction({ project: stamped, coderName: lanMyName });
    if (!res.ok) {
      showToast(res.error || 'Could not upload merged project — try again or pick another option');
      return; // keep the modal open
    }
    applyJoinedState(stamped, res.seq ?? conflict.seq);
    showToast(
      `Merged into ${conflict.hostName}'s session: +${summary.codesAdded} code(s), ` +
      `+${summary.segmentsAdded} passage(s), ${summary.docsMerged} doc(s) matched, +${summary.docsAdded} doc(s) added`
    );
  }

  // Option 2 — keep offline work as a separate local project, then adopt the
  // host snapshot untouched.
  async function handleLanConflictBackup() {
    const conflict = lanConflictRef.current;
    const localProj = projectRef.current;
    if (!conflict || !localProj) return;
    const backup = {
      ...localProj,
      id: crypto.randomUUID(),
      name: `${localProj.name} (Home Backup)`
    } as Project;
    await window.qv.saveProject(backup).catch(() => {});
    setProjects(list => [{ id: backup.id, name: backup.name, createdAt: backup.createdAt }, ...list]);
    applyJoinedState(conflict.hostProject, conflict.seq);
    showToast(`Saved "${backup.name}" locally — joined ${conflict.hostName}'s session`);
  }

  // Option 3 — discard offline edits and take the host snapshot as-is.
  function handleLanConflictDiscard() {
    const conflict = lanConflictRef.current;
    if (!conflict) return;
    applyJoinedState(conflict.hostProject, conflict.seq);
    showToast(`Joined ${conflict.hostName}'s session — offline edits discarded`);
  }

  async function handleLanDisconnect() {
    lanJoinedRef.current = false;
    setLanConflict(null);
    await window.qv.lan.disconnectSession();
    window.qv.lan.startDiscovery().catch(() => {});
    showToast('Disconnected from LAN session');
  }

  // Host-only: remove one specific client from this live session. The
  // main process tells the peer via KICKED and its UI shows why.
  async function handleLanKickClient(clientId: string) {
    const res = await window.qv.lan.kickClient(clientId);
    if (!res.ok) showToast(res.error || 'Could not disconnect that client');
  }

  
  // ---------------------------------------------------------------
  // Load project list on mount; open the most recent project, or
  // create a fresh one if this is the first launch.
  // ---------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const list = await window.qv.listProjects();
      setProjects(list);
      if (list.length > 0) {
        const p = await window.qv.loadProject(list[0].id);
        setProject(p);
      } else {
        const p = newProject('My Project');
        await window.qv.saveProject(p);
        setProjects([{ id: p.id, name: p.name, createdAt: p.createdAt }]);
        setProject(p);
      }
    })();
  }, []);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const saveToDisk = useCallback((p: Project) => {
    setSaveStatus('saving');
    return window.qv.saveProject(p).then(() => {
      setSaveStatus('saved');
      setProjects(prev => {
        const others = prev.filter(x => x.id !== p.id);
        return [{ id: p.id, name: p.name, createdAt: p.createdAt }, ...others];
      });
    }).catch(err => {
      setSaveStatus('error');
      showToast(`Save failed: ${err}`);
      throw err;
    });
  }, [showToast]);

  const persist = useCallback((next: Project) => {
    // Stamping `updatedAt` here (rather than at every call site) records the
    // moment of every local content edit in one place. LAN uses it to tell
    // "edits made while disconnected" apart from "already synced state".
    // Remote applications bypass persist (setProject + saveProject directly),
    // so they never advance the marker.
    const stamped: Project = { ...next, updatedAt: Date.now() };
    setProject(prevProj => {
      if (prevProj && prevProj.id === stamped.id) {
        setPast(p => {
          const updated = [...p, prevProj];
          return updated.length > HISTORY_LIMIT ? updated.slice(updated.length - HISTORY_LIMIT) : updated;
        });
        setFuture([]);
      }
      return stamped;
    });
    saveToDisk(stamped).catch(() => {});
  }, [saveToDisk]);

  function manualSave() {
    if (!project) return;
    saveToDisk(project).catch(() => {});
  }

  // Reset undo/redo history whenever the active project changes (undo/redo
  // themselves never change project.id, so this only fires on a genuine
  // switch/create/import — not as a side effect of undoing/redoing).
  useEffect(() => {
    setPast([]);
    setFuture([]);
  }, [project?.id]);

  function undo() {
    if (past.length === 0 || !project) return;
    const previous = past[past.length - 1];
    setPast(p => p.slice(0, -1));
    setFuture(f => [project, ...f].slice(0, HISTORY_LIMIT));
    const stamped = { ...previous, updatedAt: Date.now() };
    setProject(stamped);
    saveToDisk(stamped).catch(() => {});
  }

  function redo() {
    if (future.length === 0 || !project) return;
    const next = future[0];
    setFuture(f => f.slice(1));
    setPast(p => [...p, project].slice(-HISTORY_LIMIT));
    const stamped = { ...next, updatedAt: Date.now() };
    setProject(stamped);
    saveToDisk(stamped).catch(() => {});
  }

  function goToExcerpt(seg: CodedSegment) {
    setTab('workspace');
    setSelectedDocId(seg.docId);
    setPendingSelection(null);
    setGotoTarget({ segId: seg.id, nonce: Date.now() });
  }

  // Portrait strip click → scroll the document to the clicked passage.
  function handleJumpToSegment(segment: CodedSegment) {
    // Attempt 1: exact chunk lookup (DocEditor renders chunks with data-seg-ids)
    const chunk = document.querySelector(`[data-seg-ids~="${segment.id}"]`) as HTMLElement | null;
    if (chunk) {
      chunk.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // Attempt 2: fallback to proportional scroll
    const container = document.getElementById('doc-scroll-container');
    if (container && selectedDoc) {
      const scrollPercentage = segment.start / Math.max(selectedDoc.content.length, 1);
      container.scrollTo({ top: container.scrollHeight * scrollPercentage, behavior: 'smooth' });
    }
  }

  // Ctrl+Z to undo, Ctrl+Shift+Z or Ctrl+Y to redo (Cmd on macOS).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTextField = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;
      if (isTextField) return; // let the field handle its own native undo/redo
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [past, future, project]);

  const [selectedImageId, setSelectedImageId] = useState<ID | null>(null);
  const [pendingRegion, setPendingRegion] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [regionPopup, setRegionPopup] = useState<{ regions: CodedRegion[]; x: number; y: number } | null>(null);
  const [imageZoom, setImageZoom] = useState(1);

  const selectedImage = useMemo(
    () => (project && selectedImageId ? project.images?.find(i => i.id === selectedImageId) || null : null),
    [project?.images, selectedImageId]
  );
  const imageRegions = useMemo(
    () => (project && selectedImage ? (project.codedRegions || []).filter(r => r.imageId === selectedImage.id) : []),
    [project?.codedRegions, selectedImage]
  );

  async function addImages(folderId: ID | null) {
    if (!project) return;
    const picked = await window.qv.pickAndEncodeImages();
    if (!picked || picked.length === 0) return;
    const newImages: ImageSource[] = picked.map((p: any) => ({
      id: uid('img'),
      folderId,
      name: p.name,
      dataUrl: p.dataUrl,
      addedAt: Date.now(),
      sizeBytes: p.sizeBytes
    }));
    persist({ ...project, images: [...(project.images || []), ...newImages] });
    showToast(`Added ${newImages.length} image(s)`);
  }

async function handleExportStarredImages() {
    if (!project) return;
    const starredRegions = (project.codedRegions || []).filter(r => r.starred);
    if (starredRegions.length === 0) {
      showToast('No starred image regions yet.');
      return;
    }
    const items: Array<{ base64: string; width: number; height: number; caption: string }> = [];
    for (const r of starredRegions) {
      const image = (project.images || []).find(i => i.id === r.imageId);
      if (!image) continue;
      const cropped = await cropRegionToPng(image.dataUrl, r);
      const codeName = codesById.get(r.codeId)?.name || 'Unknown code';
      items.push({ ...cropped, caption: `${codeName} — ${image.name}${r.note ? ` — ${r.note}` : ''}` });
    }
    const path = await window.qv.exportDocxTable({
      kind: 'imageGallery',
      title: `${project.name} — Starred Image Regions`,
      items,
      filenameBase: `${project.name.replace(/[^\w\- ]/g, '_')}_starred_images`
    } as any);
    if (path) showToast(`Exported ${items.length} starred image(s) to ${path}`);
  }

async function handleExportCodedImage() {
    if (!selectedImage) return;
    const regions = imageRegions.map(r => ({
      x: r.x, y: r.y, width: r.width, height: r.height,
      color: codesById.get(r.codeId)?.color || '#facc15',
      label: codesById.get(r.codeId)?.name || 'Unknown'
    }));
    const dataUrl = await renderCodedImagePng(selectedImage.dataUrl, regions);
    const path = await window.qv.exportImage({
      title: 'Export Coded Image',
      defaultName: `${selectedImage.name.replace(/\.[^.]+$/, '')}_coded.png`,
      base64: dataUrl.split(',')[1]
    });
    if (path) showToast(`Coded image exported to ${path}`);
  }

  function applyCodeToRegion(code: Code) {
    if (!project || !selectedImage || !pendingRegion) return;
    const region: CodedRegion = {
      id: uid('region'),
      imageId: selectedImage.id,
      codeId: code.id,
      x: pendingRegion.x,
      y: pendingRegion.y,
      width: pendingRegion.width,
      height: pendingRegion.height,
      createdAt: Date.now(),
      ...(activeCoderName ? { coder: activeCoderName } : {})
    };
    persist({ ...project, codedRegions: [...(project.codedRegions || []), region] });
    setPendingRegion(null);
    showToast(`Applied "${code.name}" to region`);
  }

  function removeCodedRegion(regionId: ID) {
    if (!project) return;
    persist({ ...project, codedRegions: (project.codedRegions || []).filter(r => r.id !== regionId) });
    setRegionPopup(null);
  }

  function toggleStarRegion(regionId: ID) {
    if (!project) return;
    persist({
      ...project,
      codedRegions: (project.codedRegions || []).map(r => (r.id === regionId ? { ...r, starred: !r.starred } : r))
    });
  }

function updateImageNotes(imageId: ID, notes: string) {
    if (!project) return;
    persist({
      ...project,
      images: (project.images || []).map(i =>
        i.id === imageId ? { ...i, notes: notes.trim() ? notes.trim() : undefined } : i
      )
    });
  }

  const codesById = useMemo(() => {
    const m = new Map<string, Code>();
    project?.codes.forEach(c => m.set(c.id, c));
    return m;
  }, [project?.codes]);

  const selectedDoc = useMemo(
    () => project?.docs.find(d => d.id === selectedDocId) || null,
    [project?.docs, selectedDocId]
  );

const contentSearchResults = useMemo(() => {
    if (!project || !contentSearchQuery.trim()) return [];
    const q = contentSearchQuery.toLowerCase();
    const results: Array<{ docId: ID; docName: string; start: number; end: number; snippet: string }> = [];
    for (const doc of project.docs) {
      const lower = doc.content.toLowerCase();
      let idx = lower.indexOf(q);
      while (idx !== -1 && results.length < 200) {
        const start = idx;
        const end = idx + contentSearchQuery.length;
        const snippetStart = Math.max(0, start - 40);
        const snippetEnd = Math.min(doc.content.length, end + 40);
        const snippet =
          (snippetStart > 0 ? '…' : '') +
          doc.content.slice(snippetStart, snippetEnd).replace(/\s+/g, ' ') +
          (snippetEnd < doc.content.length ? '…' : '');
        results.push({ docId: doc.id, docName: doc.name, start, end, snippet });
        idx = lower.indexOf(q, idx + Math.max(1, contentSearchQuery.length));
      }
    }
    return results;
  }, [project?.docs, contentSearchQuery]);

  function goToTextMatch(result: { docId: ID; start: number; end: number }) {
    setSelectedDocId(result.docId);
    setPendingSelection(null);
    setEditingDocId(null);
    setHighlightTarget({ docId: result.docId, start: result.start, end: result.end, nonce: Date.now() });
  }

  // Precomputed counts so the doc tree's per-row badges are O(1) lookups
  // instead of a full scan of every segment/region for each row.
  const codedCountByDoc = useMemo(() => {
    const m = new Map<ID, number>();
    for (const s of project?.codedSegments ?? []) m.set(s.docId, (m.get(s.docId) || 0) + 1);
    return m;
  }, [project?.codedSegments]);

  const regionCountByImage = useMemo(() => {
    const m = new Map<ID, number>();
    for (const r of project?.codedRegions ?? []) m.set(r.imageId, (m.get(r.imageId) || 0) + 1);
    return m;
  }, [project?.codedRegions]);

  const codedCountForDoc = useCallback(
    (docId: ID) => codedCountByDoc.get(docId) || 0,
    [codedCountByDoc]
  );

  const codedRegionCount = useCallback(
    (imageId: ID) => regionCountByImage.get(imageId) || 0,
    [regionCountByImage]
  );

useEffect(() => {
    setDocNotesDraft(selectedDoc?.notes || '');
    setShowDocNotes(false);
    // Clear navigation targets when switching documents
    setHighlightTarget(null);
    setGotoTarget(null);
  }, [selectedDoc?.id]);

  useEffect(() => {
    setEditingNoteFor(null);
    setNoteDraft('');
  }, [segmentPopup]);

  // Clear navigation targets when switching tabs
  useEffect(() => {
    setHighlightTarget(null);
    setGotoTarget(null);
  }, [tab]);

useEffect(() => {
    setImageNotesDraft(selectedImage?.notes || '');
    setShowImageNotes(false);
    setImageZoom(1);
  }, [selectedImage?.id]);

  // =================================================================
  // Project management
  // =================================================================
  async function handleNewProject() {
    const name = await customPrompt('New project name', 'Untitled Project', 'Create');
    if (!name) return;
    const p = newProject(name);
    await saveToDisk(p).catch(() => {});
    setProject(p);
    setSelectedDocId(null);
  }

  async function handleSwitchProject(id: ID) {
    const p = await window.qv.loadProject(id);
    if (p) {
      setProject(p);
      setSelectedDocId(null);
      setCodebookSelectedCodeId(null);
    }
  }

  async function handleRenameProject() {
    if (!project) return;
    const name = await customPrompt('Rename project', project.name, 'Rename');
    if (!name) return;
    persist({ ...project, name });
  }

function openProjectSettings() {
    if (!project) return;
    // While joined to a LAN session the SHARED project is locked (the host is
    // the source of truth) — other local projects stay fully manageable.
    if (isLanSharedProjectLocked) { showToast('The session-shared project can’t be renamed — switch to a different project to manage it'); return; }
    setProjectNameDraft(project.name);
    setProjectCoderDraft(project.coderName || '');
    setDeleteStep(0);
    setProjectModalOpen(true);
  }

  function saveProjectName() {
    if (!project) return;
    const trimmed = projectNameDraft.trim();
    const coderTrimmed = projectCoderDraft.trim();
    if (trimmed) persist({ ...project, name: trimmed, coderName: coderTrimmed || undefined });
    setProjectModalOpen(false);
  }

  // Explicit, non-mutating migration for legacy/imported items that carry no
  // coder stamp: the user deliberately signs any Unattributed segments and
  // regions with the coder name currently entered in Project Settings. This
  // is the ONLY path that backfills attribution, so it can never silently
  // overwrite or relabel existing stamps when the active name later changes.
  function claimUnattributed() {
    if (!project) return;
    const name = projectCoderDraft.trim();
    if (!name) return;
    persist({
      ...project,
      codedSegments: project.codedSegments.map(s => (s.coder ? s : { ...s, coder: name })),
      codedRegions: (project.codedRegions || []).map(r => (r.coder ? r : { ...r, coder: name }))
    });
    showToast(`Assigned ${unattributedCount} Unattributed item(s) to ${name}`);
  }

  // Double-confirmation bulk cleanup: the user must retype the exact coder
  // name before every one of that coder's segments and regions is removed.
  // Guards against wiping data recorded under a typo-cloned name (e.g.
  // bayazid-dev vs bayazid_dev).
  async function handleDeleteCoderData(targetCoder: string) {
    if (!project) return;
    const input = await customPrompt(
      `Type the exact name "${targetCoder}" to permanently delete all their coded segments and regions.`,
      '',
      'Delete'
    );
    if (input == null) return; // cancelled
    if (input.trim() !== targetCoder) {
      showToast('Name did not match, cancelled');
      return;
    }
    const segCount = (project.codedSegments ?? []).filter(s => s.coder === targetCoder).length;
    const regCount = (project.codedRegions ?? []).filter(r => r.coder === targetCoder).length;
    if (segCount === 0 && regCount === 0) {
      showToast(`No items found for coder: ${targetCoder}`);
      return;
    }
    const next: Project = {
      ...project,
      codedSegments: (project.codedSegments ?? []).filter(s => s.coder !== targetCoder),
      codedRegions: (project.codedRegions ?? []).filter(r => r.coder !== targetCoder)
    };
    // persist stamps updatedAt: Date.now() (so LAN offline-edit tracking
    // recognizes this deletion as a real local change) and writes the
    // filtered state to disk.
    persist(next);
    showToast(`Removed ${segCount} segment(s) and ${regCount} region(s) for coder: ${targetCoder}`);
  }

  // Merges overlapping codings of the same code on the same document into
  // single segments (min start, max end, notes joined), so duplicate codings
  // never inflate counts. persist() stamps updatedAt for LAN offline-edit
  // tracking and writes the cleaned state to disk.
  function cleanRedundantCodings() {
    if (!project) return;
    const groups = new Map<string, CodedSegment[]>();
    for (const s of project.codedSegments) {
      const key = `${s.docId}::${s.codeId}`;
      const list = groups.get(key);
      if (list) list.push(s);
      else groups.set(key, [s]);
    }
    const cleaned: CodedSegment[] = [];
    let mergedCount = 0;
    for (const list of groups.values()) {
      if (list.length <= 1) {
        cleaned.push(...list);
        continue;
      }
      list.sort((a, b) => a.start - b.start || a.end - b.end);
      let cur = list[0];
      for (let i = 1; i < list.length; i++) {
        const nextSeg = list[i];
        if (nextSeg.start <= cur.end) {
          mergedCount++;
          const notes: string[] = [];
          if (cur.note) notes.push(cur.note);
          if (nextSeg.note) notes.push(nextSeg.note);
          cur = {
            ...cur,
            start: Math.min(cur.start, nextSeg.start),
            end: Math.max(cur.end, nextSeg.end),
            note: notes.length > 0 ? notes.join('\n') : cur.note
          };
        } else {
          cleaned.push(cur);
          cur = nextSeg;
        }
      }
      cleaned.push(cur);
    }
    persist({ ...project, codedSegments: cleaned });
    showToast(mergedCount > 0
      ? `Cleaned ${mergedCount} redundant coded passage(s).`
      : 'No redundant codings found — nothing to clean.');
  }

  async function confirmDeleteProject() {
    if (!project) return;
    if (isLanSharedProjectLocked) { showToast('The session-shared project can’t be deleted — switch to a different project to manage it'); setDeleteStep(0); setProjectModalOpen(false); return; }
    await window.qv.deleteProject(project.id);
    setProjectModalOpen(false);
    setDeleteStep(0);

    const list = await window.qv.listProjects();
    setProjects(list);
    if (list.length > 0) {
      const p = await window.qv.loadProject(list[0].id);
      if (p) {
        setProject(p);
        setSelectedDocId(null);
        setCodebookSelectedCodeId(null);
      }
    } else {
      const fresh = newProject('Untitled Project');
      await saveToDisk(fresh).catch(() => {});
      setProject(fresh);
    }
    showToast('Project deleted.');
  }

  async function handleExportBackup() {
    if (!project) return;
    const path = await window.qv.exportBackup(project);
    if (path) showToast(`Backup exported to ${path}`);
  }

  async function handleImportBackup() {
    const data = await window.qv.importBackup();
    if (!data) return;
    const imported: Project = { ...data, id: uid('proj'), name: `${data.name} (imported)` };
    await saveToDisk(imported).catch(() => {});
    setProject(imported);
    showToast('Project imported.');
  }

  async function handleMerge() {
    if (!project) return;
    const sources = await window.qv.pickMultipleForMerge();
    if (sources.length === 0) return;
    let next = { ...project, folders: [...project.folders], docs: [...project.docs], codes: [...project.codes], codedSegments: [...project.codedSegments] };
    let totalDocs = 0, totalMerged = 0, totalCodes = 0, totalSegs = 0;
    for (const src of sources) {
      const summary = mergeProjectInto(next, src);
      totalDocs += summary.docsAdded;
      totalMerged += summary.docsMerged;
      totalCodes += summary.codesAdded;
      totalSegs += summary.segmentsAdded;
    }
    persist(next);
    showToast(
      `Merged ${sources.length} file(s): +${totalDocs} new docs, ${totalMerged} matched onto existing docs, ` +
      `+${totalCodes} codes, +${totalSegs} coded passages.`
    );
  }

  // =================================================================
  // Folders / documents
  // =================================================================
  async function addRootFolder() {
    if (!project) return;
    const name = await customPrompt('New root folder', '', 'Create');
    if (!name) return;
    const folder: Folder = { id: uid('folder'), name, parentId: null };
    persist({ ...project, folders: [...project.folders, folder] });
  }

  async function addSubfolder(parentId: ID) {
    if (!project) return;
    const name = await customPrompt('New subfolder', '', 'Create');
    if (!name) return;
    const folder: Folder = { id: uid('folder'), name, parentId };
    persist({ ...project, folders: [...project.folders, folder] });
  }

  async function renameFolder(folder: Folder) {
    if (!project) return;
    const name = await customPrompt('Rename folder', folder.name, 'Rename');
    if (!name) return;
    persist({ ...project, folders: project.folders.map(f => (f.id === folder.id ? { ...f, name } : f)) });
  }

  function deleteFolder(folder: Folder) {
    if (!project) return;
    setConfirmDialog({
      message: `Delete folder "${folder.name}"? Documents inside will move to the root level.`,
      confirmText: 'Delete',
      onConfirm: () => {
        const folders = project.folders.filter(f => f.id !== folder.id);
        const docs = project.docs.map(d => (d.folderId === folder.id ? { ...d, folderId: null } : d));
        persist({ ...project, folders, docs });
      },
    });
  }

  async function addDocs(folderId: ID | null) {
    if (!project) return;
    const files = await window.qv.pickAndExtractDocs();
    if (files.length === 0) return;
    const newDocs: SourceDoc[] = [];
    const failures: string[] = [];
    for (const f of files) {
      if (!f.ok) {
        failures.push(`${f.name}: ${f.error}`);
        continue;
      }
      newDocs.push({
        id: uid('doc'),
        folderId,
        name: f.name,
        content: f.content,
        addedAt: Date.now(),
        sizeBytes: f.sizeBytes
      });
    }
    if (newDocs.length > 0) {
      persist({ ...project, docs: [...project.docs, ...newDocs] });
      setSelectedDocId(newDocs[0].id);
    }
    if (failures.length > 0) showToast(`Some files could not be imported: ${failures.join('; ')}`);
  }

async function importDroppedFiles(paths: string[], folderId: ID | null) {
  if (!project || paths.length === 0) return;
  
  // Notice we call a hypothetical 'extractDroppedDocs' instead of 'pickAndExtractDocs'
  const files = await window.qv.extractDroppedDocs(paths); 
  
  if (files.length === 0) return;
  
  const newDocs: SourceDoc[] = [];
  const failures: string[] = [];
  
  for (const f of files) {
    if (!f.ok) {
      failures.push(`${f.name}: ${f.error}`);
      continue;
    }
    newDocs.push({
      id: uid('doc'),
      folderId,
      name: f.name,
      content: f.content,
      addedAt: Date.now(),
      sizeBytes: f.sizeBytes
    });
  }
  
  if (newDocs.length > 0) {
    persist({ ...project, docs: [...project.docs, ...newDocs] });
    setSelectedDocId(newDocs[0].id);
  }
  if (failures.length > 0) showToast(`Some files could not be imported: ${failures.join('; ')}`);
}

async function importDroppedImages(paths: string[], folderId: ID | null) {
  if (!project || paths.length === 0) return;
  
  const images = await window.qv.extractDroppedImages(paths); 
  if (images.length === 0) return;
  
  // Create the image objects exactly like you do in your normal 'addImages' function
  const newImages = images.map(img => ({
    id: uid('img'), // Assuming you use uid() for IDs like in documents
    folderId,
    name: img.name,
    dataUrl: img.dataUrl,
    addedAt: Date.now(),
    sizeBytes: img.sizeBytes
  }));
  
  if (newImages.length > 0) {
    persist({ ...project, images: [...(project.images || []), ...newImages] });
    // setSelectedImageId(newImages[0].id); // Optional
  }
}

async function addScannedPdf(folderId: ID | null) {
    if (!project) return;
    
    // Create an invisible file input to grab the raw File object in the browser
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.multiple = true;
    
    input.onchange = async (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      const newDocs: SourceDoc[] = [];
      const failures: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        
        try {
          // Send progress messages directly to your UI's showToast banner
          const content = await extractBengaliTextFromPDF(f, (message) => {
            // Converts "Reading page 1 of 11..." to "Scanning page 1 of 11..."
            const statusMsg = message.replace(/^Reading/i, 'Scanning');
            showToast(`[${f.name}] ${statusMsg}`);
          });
          
          newDocs.push({
            id: uid('doc'),
            folderId,
            name: f.name,
            content: content,
            addedAt: Date.now(),
            sizeBytes: f.size
          });
        } catch (error: any) {
          failures.push(`${f.name}: ${error.message || 'OCR failed'}`);
        }
      }

      if (newDocs.length > 0) {
        persist({ ...project, docs: [...project.docs, ...newDocs] });
        setSelectedDocId(newDocs[0].id);
        // Final completion message shown on screen
        showToast('PDF scan complete!');
      }
      if (failures.length > 0) showToast(`Some files failed: ${failures.join('; ')}`);
    };

    input.click(); // Trigger the file picker
  }


  async function renameDoc(doc: SourceDoc) {
    if (!project) return;
    const name = await customPrompt('Rename document', doc.name, 'Rename');
    if (!name) return;
    persist({ ...project, docs: project.docs.map(d => (d.id === doc.id ? { ...d, name } : d)) });
  }

  function deleteDoc(doc: SourceDoc) {
    if (!project) return;
    setConfirmDialog({
      message: `Delete document "${doc.name}"? Its coded passages will also be removed.`,
      confirmText: 'Delete',
      onConfirm: () => {
        const docs = project.docs.filter(d => d.id !== doc.id);
        const codedSegments = project.codedSegments.filter(s => s.docId !== doc.id);
        persist({ ...project, docs, codedSegments });
        if (selectedDocId === doc.id) setSelectedDocId(null);
      },
    });
  }

// 1. This just opens the modal
function requestDeleteImage(id: ID) {
  setPendingDeleteImageId(id);
}

// 2. This runs when they click "Yes, Delete" inside the modal
function executeDeleteImage() {
  if (!project || !pendingDeleteImageId) return;
  
  const id = pendingDeleteImageId;
  const newImages = project.images?.filter(img => img.id !== id) ?? [];
  const newRegions = project.codedRegions?.filter(r => r.imageId !== id) ?? [];
  
  persist({ 
    ...project, 
    images: newImages, 
    codedRegions: newRegions 
  });

  if (selectedImageId === id) {
    setSelectedImageId(null);
  }
  
  // Close the modal
  setPendingDeleteImageId(null);
}

function renameImage(id: ID, newName: string) {
  if (!project) return;
  
  const updatedImages = project.images?.map(img => 
    img.id === id ? { ...img, name: newName } : img
  ) ?? [];

  persist({ ...project, images: updatedImages });
}

async function renameImageWithPrompt(img: ImageSource) {
  const name = await customPrompt('Rename image', img.name, 'Rename');
  if (!name) return;
  renameImage(img.id, name);
  showToast(`Image renamed to "${name}"`);
}

  function startEditDoc(doc: SourceDoc) {
    setPendingSelection(null);
    setSegmentPopup(null);
    setDraftContent(doc.content);
    setEditingDocId(doc.id);
  }

  function cancelEditDoc() {
    setEditingDocId(null);
    setDraftContent('');
  }

  function saveEditDoc() {
    if (!project || !editingDocId) return;
    const doc = project.docs.find(d => d.id === editingDocId);
    if (!doc) return;

    const docSegs = project.codedSegments.filter(s => s.docId === editingDocId);
    const { segments: relocated, keptCount, droppedCount } = relocateSegmentsAfterEdit(doc.content, draftContent, docSegs);

    const docs = project.docs.map(d =>
      d.id === editingDocId ? { ...d, content: draftContent, sizeBytes: draftContent.length } : d
    );
    const codedSegments = [
      ...project.codedSegments.filter(s => s.docId !== editingDocId),
      ...relocated
    ];
    persist({ ...project, docs, codedSegments });
    setEditingDocId(null);
    setDraftContent('');

    if (docSegs.length > 0) {
      showToast(
        droppedCount > 0
          ? `Saved. ${keptCount} coded passage(s) re-matched; ${droppedCount} could not be found in the edited text and were removed.`
          : `Saved. All ${keptCount} coded passage(s) re-matched successfully.`
      );
    } else {
      showToast('Document saved.');
    }
  }

async function handleExportDocDocx(doc: SourceDoc) {
  const path = await window.qv.exportDocAsDocx({ name: doc.name, content: doc.content });
  if (path) showToast(`Exported to ${path}`);
}

  // =================================================================
  // Codes
  // =================================================================
  async function addRootCode() {
    if (!project) return;
    const name = await customPrompt('New root code', '', 'Create');
    if (!name) return;
    const code: Code = { 
      id: uid('code'), 
      name, 
      color: colorForNewCode(project.codes, null, project.codes.length), 
      parentId: null, 
      summary: '',
      createdAt: Date.now()
    };
    persist({ ...project, codes: [...project.codes, code] });
  }

  async function addSubcode(parentId: ID) {
    if (!project) return;
    const name = await customPrompt('New subcode', '', 'Create');
    if (!name) return;
    const code: Code = { 
      id: uid('code'), 
      name, 
      color: colorForNewCode(project.codes, parentId, project.codes.length), 
      parentId, 
      summary: '',
      createdAt: Date.now()
    };
    persist({ ...project, codes: [...project.codes, code] });
  }

async function handleExportCsv() {
  if (!project) return;
  const { csv } = buildScopedExport(project, exportScope);
  const path = await window.qv.exportText({
    title: 'Export CSV',
    defaultName: `${project.name.replace(/[^\w\- ]/g, '_')}_${exportScope}.csv`,
    content: csv,
    extension: 'csv',
    filterName: 'CSV file'
  });
  if (path) showToast(`Exported to ${path}`);
}

async function handleExportDocx() {
  if (!project) return;
  if (exportScope === 'codesOnly') {
    const outline = buildCodebookOutline(project);
    const path = await window.qv.exportDocxTable({
      kind: 'outline',
      title: `${project.name} — Codebook`,
      outline,
      filenameBase: `${project.name}_codebook`
    });
    if (path) showToast(`Exported to ${path}`);
    return;
  }
  const { headers, rows } = buildScopedExport(project, exportScope);
  const path = await window.qv.exportDocxTable({
    kind: 'table',
    title: `${project.name} — ${SCOPE_LABELS[exportScope]}`,
    headers,
    rows,
    filenameBase: `${project.name}_${exportScope}`
  });
  if (path) showToast(`Exported to ${path}`);
}

  function updateCode(codeId: ID, patch: Partial<Code>) {
    if (!project) return;
    persist({ ...project, codes: project.codes.map(c => (c.id === codeId ? { ...c, ...patch } : c)) });
  }

  function updateCodesBatch(updates: Array<{ id: ID; patch: Partial<Code> }>) {
    if (!project) return;
    const byId = new Map(updates.map(u => [u.id, u.patch]));
    persist({
      ...project,
      codes: project.codes.map(c => (byId.has(c.id) ? { ...c, ...byId.get(c.id)! } : c))
    });
  }

  function updateMapEdgeStyle(edgeId: ID, patch: Partial<MapEdgeStyle>) {
    if (!project) return;
    persist({
      ...project,
      mapEdgeStyles: (project.mapEdgeStyles || []).map(e => (e.id === edgeId ? { ...e, ...patch } : e))
    });
  }

  function addMapEdgeStyle(style: MapEdgeStyle) {
    if (!project) return;
    persist({ ...project, mapEdgeStyles: [...(project.mapEdgeStyles || []), style] });
  }

  function deleteMapEdgeStyle(edgeId: ID) {
    if (!project) return;
    persist({ ...project, mapEdgeStyles: (project.mapEdgeStyles || []).filter(e => e.id !== edgeId) });
  }

  // Free-standing map annotations: one batched persist per user action
  // (draw, style change, delete) — never a per-shape loop.
  function updateMapAnnotations(next: MapAnnotation[]) {
    if (!project) return;
    persist({ ...project, mapAnnotations: next });
  }

  // Codes hidden from / re-added to the Code Map canvas: one batched persist
  // per action (a single add or remove click).
  function updateHiddenMapCodes(next: ID[]) {
    if (!project) return;
    persist({ ...project, hiddenMapCodeIds: next });
  }

  function deleteCode(code: Code) {
    if (!project) return;
    const idsToRemove = descendantCodeIds(project.codes, code.id);
    const label = idsToRemove.size > 1 ? `"${code.name}" and its ${idsToRemove.size - 1} subcode(s)` : `"${code.name}"`;
    setConfirmDialog({
      message: `Delete code ${label}? All coded passages using it will also be removed.`,
      confirmText: 'Delete',
      onConfirm: () => {
        const ids = descendantCodeIds(project.codes, code.id);
        const codes = project.codes.filter(c => !ids.has(c.id));
        const codedSegments = project.codedSegments.filter(s => !ids.has(s.codeId));
        const codedRegions = (project.codedRegions || []).filter(r => !ids.has(r.codeId));
        const mapEdgeStyles = (project.mapEdgeStyles || []).filter(e => !ids.has(e.fromCodeId) && !ids.has(e.toCodeId));
        persist({ ...project, codes, codedSegments, codedRegions, mapEdgeStyles });
        if (codebookSelectedCodeId && ids.has(codebookSelectedCodeId)) setCodebookSelectedCodeId(null);
      },
    });
  }

function moveDoc(docId: ID, targetFolderId: ID | null) {
    if (!project) return;
    const docs = project.docs.map(d =>
      d.id === docId ? { ...d, folderId: targetFolderId } : d
    );
    persist({ ...project, docs });
  }

  function moveImage(imageId: ID, targetFolderId: ID | null) {
    if (!project) return;
    const images = (project.images || []).map(img =>
      img.id === imageId ? { ...img, folderId: targetFolderId } : img
    );
    persist({ ...project, images });
  }

  function moveCode(codeId: ID, targetParentId: ID | null) {
    if (!project) return;
    
    // Prevent dropping on itself
    if (codeId === targetParentId) return; 
    
    // Prevent cyclical dependencies (dropping a code into its own subcode)
    if (targetParentId !== null) {
      const descendants = descendantCodeIds(project.codes, codeId);
      if (descendants.has(targetParentId)) {
        showToast("Cannot move a code into its own subcode.");
        return;
      }
    }

    const codes = project.codes.map(c =>
      c.id === codeId ? { ...c, parentId: targetParentId } : c
    );
    persist({ ...project, codes });
  }

  // Drag-reorder from the code tree: applies a new sibling order (sortIndex
  // renumbering) and/or a reparent in one atomic persist. Mirrors moveCode's
  // cycle guard: a code can never be dropped inside its own subtree.
  function reorderCode(codeId: ID, newParentId: ID | null, newSortIndex: number, siblingUpdates: Array<{ id: ID; sortIndex: number }>) {
    if (!project) return;
    if (newParentId !== null) {
      const descendants = descendantCodeIds(project.codes, codeId);
      if (descendants.has(newParentId)) {
        showToast('Cannot move a code into its own subcode.');
        return;
      }
    }
    const sortByCode = new Map(siblingUpdates.map(u => [u.id, u.sortIndex]));
    const codes = project.codes.map(c => {
      if (c.id === codeId) return { ...c, parentId: newParentId, sortIndex: newSortIndex };
      const idx = sortByCode.get(c.id);
      if (typeof idx === 'number' && idx !== c.sortIndex) return { ...c, sortIndex: idx };
      return c;
    });
    persist({ ...project, codes });
  }

  function pullChildSummaries(codeId: ID) {
    if (!project) return;
    const children = childCodes(project.codes, codeId);
    if (children.length === 0) {
      showToast('This code has no subcodes.');
      return;
    }
    const parent = project.codes.find(c => c.id === codeId);
    if (!parent) return;
    const additions = children
      .filter(c => c.summary.trim())
      .map(c => `— ${c.name} —\n${c.summary}`)
      .join('\n\n');
    if (!additions) {
      showToast('Subcodes have no summaries to pull yet.');
      return;
    }
    const merged = parent.summary ? `${parent.summary}\n\n${additions}` : additions;
    updateCode(codeId, { summary: merged });
  }

  // COPY (never move) coded segments and regions from every descendant code
  // into this code (NVivo-style aggregation, non-destructive): the originals
  // stay put under their own codes, duplicates are created stamped with this
  // code's id. The lightning icon in the tree. One persist() per action.
  function copyChildCodings(codeId: ID) {
    if (!project) return;
    const descendants = descendantCodeIds(project.codes, codeId);
    descendants.delete(codeId);
    if (descendants.size === 0) {
      showToast('This code has no subcodes to copy from.');
      return;
    }
    const parent = project.codes.find(c => c.id === codeId);
    if (!parent) return;
    const sourceSegs = project.codedSegments.filter(s => descendants.has(s.codeId));
    const sourceRegs = (project.codedRegions || []).filter(r => descendants.has(r.codeId));
    if (sourceSegs.length + sourceRegs.length === 0) {
      showToast(`No coded segments or regions found in subcodes of "${parent.name}".`);
      return;
    }
    const copiedSegs = sourceSegs.map(s => ({ ...s, id: uid('seg'), codeId }));
    const copiedRegs = sourceRegs.map(r => ({ ...r, id: uid('reg'), codeId }));
    persist({
      ...project,
      codedSegments: [...project.codedSegments, ...copiedSegs],
      codedRegions: project.codedRegions
        ? [...project.codedRegions, ...copiedRegs]
        : copiedRegs.length > 0 ? copiedRegs : undefined
    });
    showToast(`Copied ${copiedSegs.length} segment(s) and ${copiedRegs.length} region(s) into "${parent.name}".`);
  }

  // =================================================================
  // Manual coding (Workspace tab)
  // =================================================================
  function applyCodeToSelection(code: Code) {
    if (!project || !selectedDoc || !pendingSelection) return;
    const segment: CodedSegment = {
      id: uid('seg'),
      docId: selectedDoc.id,
      codeId: code.id,
      start: pendingSelection.start,
      end: pendingSelection.end,
      text: pendingSelection.text,
      createdAt: Date.now(),
      source: 'manual',
      ...(activeCoderName ? { coder: activeCoderName } : {})
    };
    persist({ ...project, codedSegments: [...project.codedSegments, segment] });
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
    showToast(`Applied "${code.name}"`);
  }

  // Shared by the Code Legend tree and the code search box: apply to the
  // pending text selection if there is one, otherwise jump to that code's
  // detail view in the Codebook tab.
  function handleWorkspaceCodeClick(code: Code) {
    if (pendingSelection) {
      applyCodeToSelection(code);
    } else if (pendingRegion) {
      applyCodeToRegion(code);
    } else {
      setCodebookSelectedCodeId(code.id);
      setTab('codebook');
    }
  }

  function removeCodedSegment(segId: ID) {
    if (!project) return;
    persist({ ...project, codedSegments: project.codedSegments.filter(s => s.id !== segId) });
    setSegmentPopup(null);
  }

function updateSegmentNote(segId: ID, note: string) {
    if (!project) return;
    persist({
      ...project,
      codedSegments: project.codedSegments.map(s =>
        s.id === segId ? { ...s, note: note.trim() ? note.trim() : undefined } : s
      )
    });
  }

function updateRegionNote(regionId: ID, note: string) {
  if (!project) return;
  persist({
    ...project,
    codedRegions: (project.codedRegions || []).map(r =>
      r.id === regionId ? { ...r, note: note.trim() ? note.trim() : undefined } : r
    )
  });
}

function toggleStarSegment(segId: ID) {
    if (!project) return;
    persist({
      ...project,
      codedSegments: project.codedSegments.map(s =>
        s.id === segId ? { ...s, starred: !s.starred } : s
      )
    });
  }

  async function handleExportStarredQuotes(kind: 'csv' | 'docx') {
    if (!project) return;
    const starred = project.codedSegments.filter(s => s.starred);
    if (starred.length === 0) {
      showToast('No starred quotes yet — star an excerpt first.');
      return;
    }
    const headers = ['Quote', 'Code', 'Document', 'Coder', 'Note'];
    const rows = starred.map(s => [
      s.text,
      codesById.get(s.codeId)?.name || 'Unknown code',
      project.docs.find(d => d.id === s.docId)?.name || 'Unknown source',
      s.coder || UNATTRIBUTED_CODER,
      s.note || ''
    ]);
    const filenameBase = `${project.name.replace(/[^\w\- ]/g, '_')}_starred_quotes`;

    const path = kind === 'csv'
      ? await window.qv.exportText({
          title: 'Export Starred Quotes (CSV)',
          defaultName: `${filenameBase}.csv`,
          content: toCsv(headers, rows.map(r => r.map(String))),
          extension: 'csv',
          filterName: 'CSV file'
        })
      : await window.qv.exportDocxTable({
          kind: 'table',
          title: `${project.name} — Starred Quotes`,
          headers,
          rows,
          filenameBase
        });
    if (path) showToast(`Exported ${starred.length} starred quotes to ${path}`);
  }

async function handleExportManuscriptSkeleton() {
    if (!project) return;

    const outline: Array<{ name: string; depth: number; summary?: string; quotes?: string[]; imageQuotes?: Array<{ base64: string; width: number; height: number; caption: string }> }> = [];
    const totalStarred = project!.codedSegments.filter(s => s.starred).length;
    let codesWithSummary = 0;
    let quotesMatched = 0;

    async function walk(parentId: ID | null, depth: number) {
      for (const code of childCodes(project!.codes, parentId)) {
        const summary = code.summary?.trim();
        if (summary) {
          const starredQuotes = project!.codedSegments
            .filter(s => s.codeId === code.id && s.starred)
            .map(s => {
              const doc = project!.docs.find(d => d.id === s.docId);
              const attribution = s.coder ? ` [Coded by: ${s.coder}]` : '';
              return `"${s.text}" (${doc?.name || 'Unknown source'})${attribution}`;
            });

          const starredRegions = (project!.codedRegions || []).filter(r => r.codeId === code.id && r.starred);
          const imageQuotes: Array<{ base64: string; width: number; height: number; caption: string }> = [];
          for (const r of starredRegions) {
            const image = (project!.images || []).find(i => i.id === r.imageId);
            if (!image) continue;
            const cropped = await cropRegionToPng(image.dataUrl, r);
            imageQuotes.push({ ...cropped, caption: image.name + (r.note ? ` — ${r.note}` : '') });
          }

          outline.push({
            name: code.name,
            depth,
            summary,
            quotes: starredQuotes.length > 0 ? starredQuotes : undefined,
            imageQuotes: imageQuotes.length > 0 ? imageQuotes : undefined
          });
        }
        await walk(code.id, depth + 1);
      }
    }
    await walk(null, 0);

    if (outline.length === 0) {
      showToast('No codes with a summary/memo yet — write at least one code memo first.');
      return;
    }

    const path = await window.qv.exportDocxTable({
      kind: 'outline',
      title: `${project!.name} — Results Skeleton`,
      outline,
      filenameBase: `${project!.name.replace(/[^\w\- ]/g, '_')}_results_skeleton`
    } as any);
    if (path) showToast(`Manuscript skeleton exported to ${path}`);
  }

  function updateDocNotes(docId: ID, notes: string) {
    if (!project) return;
    persist({
      ...project,
      docs: project.docs.map(d =>
        d.id === docId ? { ...d, notes: notes.trim() ? notes.trim() : undefined } : d
      )
    });
  }

function updateFrameworkCell(docId: ID, codeId: ID, text: string) {
    if (!project) return;
    const cells = project.frameworkCells || [];
    const trimmed = text.trim();
    const existing = cells.find(c => c.docId === docId && c.codeId === codeId);

    let nextCells: FrameworkCell[];
    if (!trimmed) {
      nextCells = cells.filter(c => !(c.docId === docId && c.codeId === codeId));
    } else if (existing) {
      nextCells = cells.map(c =>
        c.docId === docId && c.codeId === codeId ? { ...c, text: trimmed, updatedAt: Date.now() } : c
      );
    } else {
      nextCells = [...cells, { id: uid('fw'), docId, codeId, text: trimmed, updatedAt: Date.now() }];
    }
    persist({ ...project, frameworkCells: nextCells });
  }

function updateRelationNote(codeAId: ID, codeBId: ID, note: string) {
    if (!project) return;
    const [a, b] = codeAId < codeBId ? [codeAId, codeBId] : [codeBId, codeAId];
    const notes = project.relationNotes || [];
    const trimmed = note.trim();
    const existing = notes.find(n => n.codeAId === a && n.codeBId === b);

    let next: CodeRelationNote[];
    if (!trimmed) {
      next = notes.filter(n => !(n.codeAId === a && n.codeBId === b));
    } else if (existing) {
      next = notes.map(n => (n.codeAId === a && n.codeBId === b) ? { ...n, note: trimmed, updatedAt: Date.now() } : n);
    } else {
      next = [...notes, { id: uid('rel'), codeAId: a, codeBId: b, note: trimmed, updatedAt: Date.now() }];
    }
    persist({ ...project, relationNotes: next });
  }

function handleRunAutoCode() {
    if (!project || !autoCodeTargetCodeId || !autoCodeQuery.trim()) return;

    const newSegments: CodedSegment[] = [];
    let docsMatched = 0;
    for (const doc of project.docs) {
      const matches = runAutoCode(doc.content, autoCodeQuery, autoCodeBoundary, autoCodeLanguage, autoCodeMatchMode);
      if (matches.length > 0) docsMatched++;
      for (const m of matches) {
        const exists = project.codedSegments.some(
          s => s.docId === doc.id && s.codeId === autoCodeTargetCodeId && s.start === m.start && s.end === m.end
        );
        if (!exists) {
          newSegments.push({
            id: uid('seg'),
            docId: doc.id,
            codeId: autoCodeTargetCodeId,
            start: m.start,
            end: m.end,
            text: m.text,
            createdAt: Date.now(),
            source: 'auto-code',
            ...(activeCoderName ? { coder: activeCoderName } : {})
          });
        }
      }
    }
    persist({ ...project, codedSegments: [...project.codedSegments, ...newSegments] });
    const msg = `Applied to ${newSegments.length} new segment(s) across ${docsMatched} document(s).`;
    setAutoCodeResultText(msg);
    showToast(msg);
  }

  // Live "how many will this hit?" preview, debounced so typing stays smooth.
  // Mirrors the dedupe logic in handleRunAutoCode so it only counts passages
  // that aren't already coded with the target code.
  useEffect(() => {
    if (!project || !autoCodeQuery.trim() || !autoCodeTargetCodeId) {
      setAutoCodePreview(null);
      return;
    }
    const t = setTimeout(() => {
      const existing = new Set(
        project.codedSegments
          .filter(s => s.codeId === autoCodeTargetCodeId)
          .map(s => `${s.docId}:${s.start}:${s.end}`)
      );
      let count = 0;
      let docs = 0;
      for (const doc of project.docs) {
        const matches = runAutoCode(doc.content, autoCodeQuery, autoCodeBoundary, autoCodeLanguage, autoCodeMatchMode).filter(
          m => !existing.has(`${doc.id}:${m.start}:${m.end}`)
        );
        if (matches.length > 0) docs++;
        count += matches.length;
      }
      setAutoCodePreview({ count, docs });
    }, 300);
    return () => clearTimeout(t);
  }, [project, autoCodeQuery, autoCodeBoundary, autoCodeLanguage, autoCodeMatchMode, autoCodeTargetCodeId]);

  const docSegments = useMemo(
    () => (selectedDoc
      ? (project?.codedSegments.filter(s => s.docId === selectedDoc.id && matchesCoder(s.coder, selectedCoderFilter)) || [])
      : []),
    [project?.codedSegments, selectedDoc, selectedCoderFilter]
  );

  // =================================================================
  // CSV dataset import (Codebook tab)
  // =================================================================
  async function handleCsvImport() {
    if (!project) return;
    const parsed = await window.qv.pickAndParseCsv();
    if (!parsed) return;
    try {
      const draft: Project = {
        ...project,
        folders: [...project.folders],
        docs: [...project.docs],
        codes: [...project.codes],
        codedSegments: [...project.codedSegments]
      };
      const summary = importCsvDataset(draft, parsed);
      persist(draft);
      showToast(
        `Imported ${parsed.fileName}: +${summary.docsCreated} docs, +${summary.codesCreated} codes, ` +
        `+${summary.segmentsCreated} coded passages` +
        (summary.segmentsNotFound ? ` (${summary.segmentsNotFound} quotes not matched in text)` : '')
      );
    } catch (e: any) {
      showToast(e.message || String(e));
    }
  }

// =================================================================
  // REFI-QDA (.qdpx) import (Codebook tab)
  // =================================================================
  async function handleQdpxImport() {
    if (!project) return;
    const payload = await window.qv.pickAndParseQdpx();
    if (!payload) return;
    try {
      const draft: Project = {
        ...project,
        folders: [...project.folders],
        docs: [...project.docs],
        codes: [...project.codes],
        codedSegments: [...project.codedSegments]
      };
      const summary = await importQdpx(draft, payload);
      persist(draft);
      if (summary.sourcesSkipped.length > 0) {
        console.log('qdpx import — skipped non-text sources:', summary.sourcesSkipped);
      }
      showToast(
        `Imported ${payload.fileName}: +${summary.codesCreated} codes, +${summary.docsCreated} docs, ` +
        `+${summary.imagesCreated} images, +${summary.segmentsCreated} coded passages, ${summary.memosImported} memos` +
        (summary.segmentsSkipped ? ` (${summary.segmentsSkipped} selections skipped)` : '') +
        (summary.sourcesSkipped.length ? ` — ${summary.sourcesSkipped.length} non-text source(s) skipped (see console)` : '')
      );
    } catch (e: any) {
      showToast(e.message || String(e));
    }
  }

  async function handleQdpxExport() {
    if (!project) return;
    try {
      const payload = await buildQdpxExport(project);
      const savedPath = await window.qv.exportQdpx(payload);
      if (savedPath) showToast(`Exported REFI-QDA project: ${savedPath}`);
    } catch (e: any) {
      showToast(e.message || String(e));
    }
  }

  // Codebook-only REFI-QDA export: valid QDPX with just the code tree.
  async function handleQdpxCodebookExport() {
    if (!project) return;
    try {
      const payload = buildQdpxCodebookExport(project);
      const savedPath = await window.qv.exportQdpx(payload);
      if (savedPath) showToast(`Exported codebook: ${savedPath}`);
    } catch (e: any) {
      showToast(e.message || String(e));
    }
  }

  // Global notes & memos: every non-empty doc memo, code summary, excerpt
  // note, and image-region note in one CSV.
  async function handleExportNotesCsv() {
    if (!project) return;
    const rows: Array<[string, string, string]> = [];
    for (const d of project.docs) {
      if (d.notes && d.notes.trim()) rows.push(['Doc Memo', d.name, d.notes.trim()]);
    }
    for (const c of project.codes) {
      if (c.summary && c.summary.trim()) rows.push(['Code Summary', c.name, c.summary.trim()]);
    }
    const codeName = (id: ID) => project.codes.find(c => c.id === id)?.name || 'Unknown code';
    for (const s of project.codedSegments) {
      if (s.note && s.note.trim()) {
        const docName = project.docs.find(d => d.id === s.docId)?.name || 'Unknown document';
        rows.push(['Segment Note', `${docName} — ${codeName(s.codeId)}`, s.note.trim()]);
      }
    }
    for (const r of project.codedRegions || []) {
      if (r.note && r.note.trim()) {
        const imgName = (project.images || []).find(img => img.id === r.imageId)?.name || 'Unknown image';
        rows.push(['Region Note', `${imgName} — ${codeName(r.codeId)}`, r.note.trim()]);
      }
    }
    if (rows.length === 0) {
      showToast('No notes or memos found — nothing to export.');
      return;
    }
    const csv = toCsv(['Type', 'Target Name', 'Note/Memo Text'], rows);
    const path = await window.qv.exportText({
      title: 'Export All Notes & Memos (CSV)',
      defaultName: `${project.name.replace(/[^\w\- ]/g, '_')}_notes_and_memos.csv`,
      content: csv,
      extension: 'csv',
      filterName: 'CSV file'
    });
    if (path) showToast(`Exported notes & memos to ${path}`);
  }

function openDocxCommentImport() {
    setDocxCommentModalOpen(true);
  }

  async function handleDocxCommentImport() {
    if (!project) return;
    const separator = docxSeparatorChoice === 'custom' ? docxCustomSeparator : docxSeparatorChoice;
    if (!separator) {
      showToast('Enter a custom separator first.');
      return;
    }
    setDocxCommentModalOpen(false);

    const payload = await window.qv.pickAndParseDocxComments();
    if (!payload) return;

    try {
      const draft: Project = {
        ...project,
        folders: [...project.folders],
        docs: [...project.docs],
        codes: [...project.codes],
        codedSegments: [...project.codedSegments]
      };
      const summary = importDocxComments(draft, payload, {
      separator,
      firstFieldIsSpeaker: docxFirstIsSpeaker,
      lastFieldIsExcerptEcho: docxLastIsExcerpt
    });
    persist(draft);
    showToast(
      `Imported ${payload.fileName}: +${summary.codesCreated} codes, +${summary.segmentsCreated} coded passages` +
      (summary.commentsSkipped ? `, ${summary.commentsSkipped} comments skipped` : '') +
      (summary.excerptMismatches ? `, ${summary.excerptMismatches} excerpt mismatches (worth a spot-check)` : '')
    );
    } catch (e: any) {
      showToast(e.message || String(e));
    }
  }

  // =================================================================
  // Analysis / report
  // =================================================================
  async function handleExportReport(extras?: ReportExtras) {
    if (!project) return;
    const html = buildReportHtml(project, extras);
    const path = await window.qv.exportReport(project, html);
    if (path) showToast(`Report exported to ${path}`);
  }

  // ------------------------------------------------------------------
  // Memoized derived data (declared before the early return so hook
  // order stays constant whether or not a project is loaded).
  // ------------------------------------------------------------------
  const flatCodes = useMemo(() => flattenCodes(project?.codes ?? []), [project?.codes]);

  // Lookup for the codebook excerpt cards (avoids O(excerpts × docs) per render)
  const docsById = useMemo(() => {
    const m = new Map<string, SourceDoc>();
    for (const d of project?.docs ?? []) m.set(d.id, d);
    return m;
  }, [project?.docs]);

  const codebookCode = codebookSelectedCodeId ? codesById.get(codebookSelectedCodeId) || null : null;

  // Unique coder names present in this project, for the filter dropdowns.
  // Attribution lives on CodedSegment.coder and CodedRegion.coder (set at
  // creation/merge). Also used to attribute new manual/auto segments.
  const coderOptions = useMemo(() => {
    const names = new Set<string>();
    let untagged = false;
    for (const s of project?.codedSegments ?? []) { if (s.coder) names.add(s.coder); else untagged = true; }
    for (const r of project?.codedRegions ?? []) { if (r.coder) names.add(r.coder); else untagged = true; }
    const out: string[] = ['all', ...Array.from(names).sort((a, b) => a.localeCompare(b))];
    if (untagged) out.push(UNATTRIBUTED_CODER);
    return out;
  }, [project?.codedSegments, project?.codedRegions]);

  // How many coded items have no coder stamp yet — powers the "Unattributed"
  // filter group and the one-click claim button in Project Settings.
  const unattributedCount = useMemo(
    () => (project?.codedSegments ?? []).filter(s => !s.coder).length + (project?.codedRegions ?? []).filter(r => !r.coder).length,
    [project?.codedSegments, project?.codedRegions]
  );

  // Unique coder names that currently have coded items in this project,
  // sorted alphabetically. UNATTRIBUTED_CODER is deliberately excluded:
  // untagged legacy data must never be bulk-deletable via a name match.
  const activeCoders = useMemo(() => {
    const names = new Set<string>();
    for (const s of project?.codedSegments ?? []) { if (s.coder && s.coder !== UNATTRIBUTED_CODER) names.add(s.coder); }
    for (const r of project?.codedRegions ?? []) { if (r.coder && r.coder !== UNATTRIBUTED_CODER) names.add(r.coder); }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [project?.codedSegments, project?.codedRegions]);

  // The name stamped onto newly created coded segments/regions: the LAN
  // session identity when collaborating live, otherwise the project's own
  // coder identity (if set). Unknown attribution stays unset.
  const activeCoderName = lanRoleRef.current ? lanMyName : (project?.coderName || undefined);

  const codebookExcerpts = useMemo(
    () => (codebookCode
      ? (project?.codedSegments ?? []).filter(s => s.codeId === codebookCode.id && matchesCoder(s.coder, selectedCoderFilter))
      : []),
    [codebookCode, project?.codedSegments, selectedCoderFilter]
  );
  const codebookRegions = useMemo(
    () => (codebookCode
      ? (project?.codedRegions ?? []).filter(r => r.codeId === codebookCode.id && matchesCoder(r.coder, selectedCoderFilter))
      : []),
    [codebookCode, project?.codedRegions, selectedCoderFilter]
  );

  // Segment-count per code, reused by the codebook tree sort. Built once per
  // change instead of re-filtering inside the sort comparator.
  const codeCodedCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of project?.codedSegments ?? []) m.set(s.codeId, (m.get(s.codeId) || 0) + 1);
    return m;
  }, [project?.codedSegments]);

  // Sorted code list used by the Codebook tab (driven by its own sortOrder
  // dropdown, independent of the workspace doc-tree sort). Memoized at
  // component scope so it isn't recomputed on every render of the tab.
  const sortedCodes = useMemo(() => {
    const copy = [...(project?.codes ?? [])];
    switch (sortOrder) {
      case 'createdAt':
        return copy.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      case 'most-coded':
        return copy.sort((a, b) => (codeCodedCounts.get(b.id) || 0) - (codeCodedCounts.get(a.id) || 0));
      case 'least-coded':
        return copy.sort((a, b) => (codeCodedCounts.get(a.id) || 0) - (codeCodedCounts.get(b.id) || 0));
      case 'name':
      default:
        return copy.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [project?.codes, sortOrder, codeCodedCounts]);

  if (!project) {
    return (
      <div className="loading-screen">
        <img src="./eqc-logo.png" alt="eQc" className="loading-logo" />
        <div className="loading-title">eQc — Easy Qual Coding</div>
        <div className="loading-spinner" />
        <div className="loading-subtitle">Loading your projects…</div>
      </div>
    );
  }
  return (
    <div className="app-shell">
      {/* --- RESTORED TOAST NOTIFICATION --- */}
{toast && (
  <div style={{ position: 'fixed', bottom: '24px', right: '24px', backgroundColor: '#334155', color: '#f8fafc', padding: '12px 24px', borderRadius: '6px', zIndex: 9999, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
    {toast}
  </div>
)}

{/* Single global prompt modal (all tabs) */}
<IsolatedPromptModal 
  isOpen={promptConfig.isOpen}
  message={promptConfig.message}
  buttonText={promptConfig.buttonText}
  onResolve={handlePromptResolve}
/>

{/* --- OFFLINE EDITS DETECTED (LAN join conflict) --- */}
{lanConflict && (
  <>
    <div style={{ position: 'fixed', inset: 0, zIndex: 11000, backgroundColor: 'rgba(15,23,42,0.7)' }} />
    <div className="modal" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 11001, width: 520, maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto', backgroundColor: '#ffffff', color: '#0f172a', padding: '24px', borderRadius: '10px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <h3 style={{ margin: 0, fontSize: 16 }}>Offline Edits Detected</h3>
      </div>
      <p style={{ fontSize: 13, margin: '0 0 8px', color: '#334155' }}>
        You edited <strong>“{project?.name}”</strong> locally since your last LAN sync with{' '}
        <strong>{lanConflict.hostName}</strong>'s session. Joining normally would overwrite those changes.
      </p>
      <p style={{ fontSize: 13, margin: '0 0 16px', color: '#334155' }}>
        What would you like to do?
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="primary-btn" style={{ textAlign: 'left', padding: '12px 14px', fontSize: 13 }} onClick={handleLanConflictMerge}>
          <span style={{ fontWeight: 'bold' }}>Merge my work into Host Session</span>
          <span style={{ display: 'block', fontSize: 12, opacity: 0.85, marginTop: 2 }}>
            Combine your offline codes &amp; passages with the host's project, then share the merged result with everyone. (Recommended)
          </span>
        </button>
        <button className="mini-btn" style={{ textAlign: 'left', padding: '12px 14px', fontSize: 13 }} onClick={handleLanConflictBackup}>
          <span style={{ fontWeight: 'bold' }}>Save offline work as a new project &amp; join host</span>
          <span style={{ display: 'block', fontSize: 12, opacity: 0.85, marginTop: 2 }}>
            Keep “{project?.name} (Home Backup)” on this PC and open the host session separately.
          </span>
        </button>
        <button className="mini-btn" style={{ textAlign: 'left', padding: '12px 14px', fontSize: 13 }} onClick={handleLanConflictDiscard}>
          <span style={{ fontWeight: 'bold' }}>Discard offline edits</span>
          <span style={{ display: 'block', fontSize: 12, opacity: 0.85, marginTop: 2 }}>
            Replace local work with the host's project as-is.
          </span>
        </button>
      </div>
    </div>
  </>
)}

{/* --- RESTORED PROJECT SETTINGS MODAL --- */}
{projectModalOpen && (
  <>
    <div style={{ position: 'fixed', inset: 0, zIndex: 99, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setProjectModalOpen(false)} />
    <div className="modal" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 100, backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', color: theme === 'dark' ? '#f8fafc' : '#0f172a', padding: '24px', borderRadius: '8px', minWidth: '320px', maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
      <h3 style={{ marginTop: 0 }}>Project Settings</h3>
      {deleteStep === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Rename Project</label>
            <input
                  className="modal-input"
                  value={projectNameDraft}
                  onChange={e => setProjectNameDraft(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveProjectName(); }}
                />
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', margin: '8px 0 4px' }}>
                  Coder name (used when this project is merged into another)
                </label>
                <input
                  className="modal-input"
                  placeholder="e.g. Anisur, RA-2"
                  value={projectCoderDraft}
                  onChange={e => setProjectCoderDraft(e.target.value)}
                />
                {unattributedCount > 0 && (
                  <button
                    onClick={claimUnattributed}
                    disabled={!projectCoderDraft.trim()}
                    title="Stamps every coded excerpt/region that has no coder yet with the name above. Already-attributed items are never changed."
                    style={{ marginTop: 8, fontSize: 11, padding: '4px 10px', borderRadius: 4, border: '1px solid #cbd5e1', background: 'rgba(59,130,246,0.1)', cursor: projectCoderDraft.trim() ? 'pointer' : 'not-allowed', color: 'var(--text)' }}
                  >
                    Assign {unattributedCount} Unattributed item(s) to this coder
                  </button>
                )}
                {activeCoders.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                      Manage Coders (Cleanup)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {activeCoders.map(c => {
                        const sCount = (project?.codedSegments ?? []).filter(s => s.coder === c).length;
                        const rCount = (project?.codedRegions ?? []).filter(r => r.coder === c).length;
                        return (
                          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ flex: 1, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{sCount} seg · {rCount} reg</span>
                            <button
                              onClick={() => handleDeleteCoderData(c)}
                              title={`Delete all of ${c}'s coded segments and regions (requires typing the exact name)`}
                              style={{ color: '#ef4444', border: '1px solid #fecaca', background: 'rgba(239,68,68,0.06)', cursor: 'pointer', padding: '1px 5px', fontSize: '11px', borderRadius: '4px', lineHeight: '1.4' }}
                            >
                              🗑️
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px' }}>
                      Deleting requires typing the exact coder name — safe against typos.
                    </div>
                    <div style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                      <button
                        onClick={cleanRedundantCodings}
                        title="Merges overlapping coded passages of the same code in the same document into single segments"
                        style={{ fontSize: '11px', padding: '4px 10px', borderRadius: 4, border: '1px solid #fde68a', background: 'rgba(245,158,11,0.08)', cursor: 'pointer', color: 'var(--text)' }}
                      >
                        🧹 Clean Redundant Codings
                      </button>
                    </div>
                  </div>
                )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={saveProjectName} className="primary-btn">Save</button>
            <button onClick={() => setDeleteStep(1)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}>Delete Project...</button>
          </div>
        </div>
      ) : deleteStep === 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0 }}>Are you sure you want to delete this project?</p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setDeleteStep(0)}>Cancel</button>
            <button onClick={() => setDeleteStep(2)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px' }}>Yes, proceed</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0 }}>
            <strong>This cannot be reverted.</strong> Project <em>{project ? `“${project.name}”` : ''}</em> and all of its documents, codes, memos, and analysis will be permanently deleted.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setDeleteStep(0)} style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px' }}>No / Keep</button>
            {isLanSharedProjectLocked
              ? <button disabled title="The session-shared project can't be deleted" style={{ backgroundColor: '#64748b', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'not-allowed' }}>Locked in LAN session</button>
              : <button onClick={confirmDeleteProject} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px' }}>Yes, delete forever</button>}
          </div>
        </div>
      )}
    </div>
  </>
)}

{/* --- RESTORED DOCX IMPORT MODAL --- */}
{docxCommentModalOpen && (
  <>
    <div style={{ position: 'fixed', inset: 0, zIndex: 99, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setDocxCommentModalOpen(false)} />
    <div className="modal" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 100, backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', color: theme === 'dark' ? '#f8fafc' : '#0f172a', padding: '24px', borderRadius: '8px', minWidth: '300px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
      <h3 style={{ marginTop: 0 }}>Import DOCX Comments</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Separator</label>
          <select value={docxSeparatorChoice} onChange={e => setDocxSeparatorChoice(e.target.value as any)} style={{ width: '100%', padding: '6px' }}>
            <option value=",">Comma (,)</option>
            <option value=";">Semicolon (;)</option>
            <option value="|">Pipe (|)</option>
            <option value="custom">Custom...</option>
          </select>
        </div>
        {docxSeparatorChoice === 'custom' && (
          <input type="text" value={docxCustomSeparator} onChange={e => setDocxCustomSeparator(e.target.value)} placeholder="Enter custom separator" style={{ padding: '6px' }} />
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
          <input type="checkbox" checked={docxFirstIsSpeaker} onChange={e => setDocxFirstIsSpeaker(e.target.checked)} />
          First field is speaker name
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
          <input type="checkbox" checked={docxLastIsExcerpt} onChange={e => setDocxLastIsExcerpt(e.target.checked)} />
          Last field is excerpt echo
        </label>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button onClick={() => setDocxCommentModalOpen(false)}>Cancel</button>
          <button onClick={handleDocxCommentImport} className="primary-btn">Import</button>
        </div>
      </div>
    </div>
  </>
)}
      <header className="app-header" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        width: '100%', 
        alignItems: 'stretch' /* Forces the rows to span the entire screen width */
      }}>
        
      {updateReady && (
        <div className="update-banner">
          <span>✅ Update downloaded — restart to install.</span>
          <button className="primary-btn" onClick={() => window.qv.quitAndInstallUpdate()}>Restart & Install</button>
        </div>
      )}
      {updateInfo && !updateReady && (
        <div className="update-banner">
          {updateInfo.platform === 'win32' ? (
            <span>
              🔄 Version {updateInfo.version} is available
              {updateProgress != null ? ` — downloading… ${updateProgress}%` : ' — starting download…'}
            </span>
          ) : (
            <>
              <span>🔄 Version {updateInfo.version} is available.</span>
              <a href={updateInfo.url} target="_blank" rel="noopener noreferrer">Download from GitHub</a>
            </>
          )}
          <button className="mini-btn" onClick={() => setUpdateInfo(null)}>Dismiss</button>
        </div>
      )}

        {/* FIRST LINE: Brand & Main Navigation Tabs */}
        <div className="header-top-row" style={{ 
          display: 'flex', 
          width: '100%',                /* Ensure row is full width */
          alignItems: 'center',       
          justifyContent: 'flex-start', /* Push contents to the left edge */
          gap: '24px', 
          padding: '8px 16px', 
          borderBottom: '1px solid #ddd',
          boxSizing: 'border-box'       /* Prevents padding from breaking 100% width */
        }}>
          
          {/* Brand Logo & Name */}
          <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img 
              src="./eqc-logo.png" 
              alt="EQC Logo" 
              style={{ width: '30px', height: '30px', objectFit: 'contain' }} 
            />
            <span style={{ fontWeight: 'bold' }}>eQc</span>
          </div>

          {/* Navigation Tabs */}
          <nav className="tabs" style={{ display: 'flex', gap: '5px' }}>
            {(['workspace', 'codebook', 'codemap', 'autocode', 'analysis', 'about'] as Tab[]).map(t => (
              <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'workspace' && 'Workspace'}
                {t === 'codebook' && 'Codebook'}
                {t === 'codemap' && 'Code Map'}
                {t === 'autocode' && 'Auto-Code'}
                {t === 'analysis' && 'Analysis'}
                {t === 'about' && 'About'}
              </button>
            ))}
          </nav>
        </div>

        {/* SECOND LINE: Project Controls & Action Buttons */}
        <div className="header-bottom-row" style={{ 
          display: 'flex', 
          width: '100%',                /* Ensure row is full width */
          alignItems: 'center',       
          justifyContent: 'flex-start', /* Push contents to the left edge */
          flexWrap: 'wrap',           
          padding: '8px 16px', 
          gap: '8px',
          boxSizing: 'border-box'       /* Prevents padding from breaking 100% width */
        }}>
          
          <select value={project.id} onChange={e => handleSwitchProject(e.target.value)}>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{lanSession && lanSession.projectId === p.id ? `🟢 ${p.name}` : p.name}</option>
            ))}
          </select>
          
          <button className="icon-btn" title="New project" onClick={handleNewProject}>➕</button>
          {isLanSharedProjectLocked
            ? <button className="icon-btn" title="The session-shared project can't be renamed" disabled>✏️</button>
            : <button className="icon-btn" title="Rename project" onClick={openProjectSettings}>✏️</button>}
          <button className="icon-btn" title="Export backup (.json)" onClick={handleExportBackup}>⬇️ Export</button>
          <button className="icon-btn" title="Import backup (.json)" onClick={handleImportBackup}>⬆️ Import</button>
          <button className="icon-btn" title="Merge project(s) into current" onClick={handleMerge}>🔀 Merge</button>
          <button
            className="icon-btn"
            title="LAN collaboration — host or join a live session on this network"
            onClick={() => setLanModalOpen(v => !v)}
            style={lanSession ? { color: '#16a34a', fontWeight: 'bold' } : undefined}
          >
            🌐 LAN{lanSession ? (lanSession.role === 'host' ? ' ·Hosting' : ' ·Joined') : ''}
          </button>
          {lanSession && (
            <span
              className="lan-status-chip"
              style={isLanSyncedView
                ? { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#86efac' }
                : { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }}
              title={isLanSyncedView
                ? 'This session shares the project you have open — edits sync live'
                : 'You are viewing an unshared project — its edits stay local and are not synced'}
            >
              {isLanSyncedView ? '🟢 Synced' : '⚪ Local only (not synced)'}
            </span>
          )}
          
          <span className="header-divider" style={{ margin: '0 8px', borderLeft: '1px solid #ccc', height: '20px' }} />
          
          <button className="icon-btn-sm" title="Undo (Ctrl+Z)" disabled={past.length === 0} onClick={undo}>↶</button>
          <button className="icon-btn-sm" title="Redo (Ctrl+Shift+Z)" disabled={future.length === 0} onClick={redo}>↷</button>
          <span className="header-divider" style={{ margin: '0 8px', borderLeft: '1px solid #ccc', height: '20px' }} />
          <select
            title="Reading font"
            value={readerFontFamily}
            onChange={e => setReaderFontFamily(e.target.value)}
            style={{ padding: '3px 4px', fontSize: '12px', maxWidth: '210px' }}
          >
            <option value="">Font (default)</option>
            <optgroup label="English">
              <option value="Cambria, Georgia, 'Times New Roman', serif">Cambria</option>
              <option value="'Caladea', Cambria, Georgia, serif">Caladea (open-source Cambria)</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="Verdana, sans-serif">Verdana</option>
              <option value="Calibri, sans-serif">Calibri</option>
              <option value="'Courier New', monospace">Courier New</option>
            </optgroup>
            <optgroup label="বাংলা (Bangla)">
              <option value="'Kalpurush', 'SolaimanLipi', 'Nirmala UI', 'Segoe UI', sans-serif">Kalpurush</option>
              <option value="'SolaimanLipi', 'Kalpurush', 'Nirmala UI', 'Segoe UI', sans-serif">SolaimanLipi</option>
              <option value="'Siyam Rupali', 'Kalpurush', 'SolaimanLipi', 'Nirmala UI', sans-serif">Siyam Rupali</option>
              <option value="'Nikosh', 'Kalpurush', 'SolaimanLipi', 'Nirmala UI', sans-serif">Nikosh</option>
            </optgroup>
          </select>
          <button className="icon-btn" title="Decrease font size" onClick={() => setReaderFontSize(s => Math.max(8, s - 1))}>A−</button>
          <span title="Font size (px)" style={{ fontSize: '12px', minWidth: '30px', textAlign: 'center' }}>{readerFontSize}px</span>
          <button className="icon-btn" title="Increase font size" onClick={() => setReaderFontSize(s => Math.min(48, s + 1))}>A+</button>
          <button className="icon-btn" title="Toggle light/dark theme" onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          
          <span className="header-divider" style={{ margin: '0 8px', borderLeft: '1px solid #ccc', height: '20px' }} />
          
          <button className="icon-btn-sm" title="Save now" onClick={manualSave}>💾</button>
          <span className={`save-status save-status-${saveStatus}`} style={{ marginLeft: '8px', fontSize: '0.9em', color: '#666' }}>
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'error' && '⚠ Save failed'}
            {saveStatus === 'idle' && ''}
          </span>
        </div>
        
      </header>

      {/* Remove the {tab === 'workspace' && ( wrapper and add inline style to workspace-grid */}
      <div 
        className="workspace-grid" 
        style={{ display: tab === 'workspace' ? undefined : 'none' }}
      >
        <aside className="panel left-panel">
            <div className="panel-toolbar">
              <button onClick={addRootFolder}>+ Add Root Folder</button>
              <button onClick={() => addDocs(null)}>+ Doc</button>
              <button onClick={() => addScannedPdf(null)}>+ Scanned PDF (OCR)</button>
              <button onClick={() => addImages(null)}>+ Add Image</button>
              <button onClick={() => setContentSearchOpen(v => !v)}>🔍 Search Text</button>
            </div>

            {contentSearchOpen && (
              <div className="code-search" style={{ marginBottom: 10 }}>
                <input
                  className="code-search-input"
                  type="text"
                  placeholder="Search inside all documents…"
                  value={contentSearchQuery}
                  onChange={e => setContentSearchQuery(e.target.value)}
                  autoFocus
                />
                {contentSearchQuery.trim() && (
                  <div className="code-search-results">
                    {contentSearchResults.map((r, i) => (
                      <div key={i} className="code-search-row" onClick={() => goToTextMatch(r)}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span className="code-search-path">{r.docName}</span>
                          <span className="code-search-name" style={{ whiteSpace: 'normal' }}>{r.snippet}</span>
                        </div>
                      </div>
                    ))}
                    {contentSearchResults.length === 0 && (
                      <div className="empty-hint" style={{ padding: 8 }}>No matches.</div>
                    )}
                    {contentSearchResults.length === 200 && (
                      <div className="section-hint" style={{ padding: 8 }}>Showing first 200 matches — refine your search for more.</div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="sort-row">
              <label>Sort by</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}>
                <option value="name">Name</option>
                <option value="date">Date added</option>
                <option value="size">Size</option>
                <option value="coded">Amount coded</option>
              </select>
            </div>
            {coderOptions.length > 1 && (
              <div className="sort-row">
                <label>Coder</label>
                <select value={selectedCoderFilter} onChange={e => setSelectedCoderFilter(e.target.value)}>
                  {coderOptions.map(name => (
                    <option key={name} value={name}>{name === 'all' ? 'Everyone' : name}</option>
                  ))}
                </select>
              </div>
            )}
             <div className="code-search">
              <input
                className="code-search-input"
                type="text"
                placeholder="Search document names…"
                value={docNameQuery}
                onChange={e => setDocNameQuery(e.target.value)}
              />
              {docNameQuery.trim() && (
                <div className="code-search-results">
                  {project.docs
                    .filter(d => d.name.toLowerCase().includes(docNameQuery.trim().toLowerCase()))
                    .map(d => (
                      <div
                        key={d.id}
                        className={`code-search-row ${selectedDocId === d.id ? 'selected' : ''}`}
                        onClick={() => { setSelectedDocId(d.id); setSelectedImageId(null); setPendingSelection(null); setEditingDocId(null); }}
                      >
                        <span className="code-search-name">{d.name}</span>
                      </div>
                    ))}
                  {project.docs.filter(d => d.name.toLowerCase().includes(docNameQuery.trim().toLowerCase())).length === 0 && (
                    <div className="empty-hint" style={{ padding: 8 }}>No matching documents.</div>
                  )}
                </div>
              )}
            </div>
            {!docNameQuery.trim() && (
              <DocTree
  folders={project.folders}
  docs={project.docs}
  images={project.images}
  selectedDocId={selectedDocId}
  selectedImageId={selectedImageId}
  sortBy={sortBy}
  codedCount={codedCountForDoc}
  codedRegionCount={codedRegionCount}
  onSelectDoc={d => { 
    setSelectedDocId(d.id); 
    setSelectedImageId(null); 
    setPendingSelection(null); 
    setEditingDocId(null); 
    window.qv.lan.setActiveDoc(d.id).catch(() => {}); // presence: "viewing this doc"
  }}
  onSelectImage={img => { 
    setSelectedImageId(img.id); 
    setSelectedDocId(null); 
    setPendingSelection(null); 
    setEditingDocId(null); 
    window.qv.lan.setActiveDoc(img.id).catch(() => {}); // presence: "viewing this image"
  }}
  onAddRootFolder={addRootFolder}
  onAddSubfolder={addSubfolder}
  onAddDoc={addDocs}
  onRenameFolder={renameFolder}
  onDeleteFolder={deleteFolder}
  onRenameDoc={renameDoc}
  onDeleteDoc={deleteDoc}
  onRenameImage={renameImageWithPrompt}
  onDeleteImage={requestDeleteImage}
  onMoveDoc={moveDoc}
  onMoveImage={moveImage}
  onDropFiles={(files, folderId) => {
    const fileArray = Array.from(files);
    
    // 1. Separate the images from the documents
    const docPaths = fileArray
      .map(f => (f as File & { path: string }).path)
      .filter(path => !path.match(/\.(png|jpe?g|gif|webp)$/i));
      
    const imagePaths = fileArray
      .map(f => (f as File & { path: string }).path)
      .filter(path => path.match(/\.(png|jpe?g|gif|webp)$/i));
      
    // 2. Send them to their respective functions!
    if (docPaths.length > 0) {
      importDroppedFiles(docPaths, folderId);
    }
    if (imagePaths.length > 0) {
      importDroppedImages(imagePaths, folderId);
    }
  }}
  lanCoders={lanSession?.coders ?? []}
  lanMyName={lanMyName}
/>
            )}
          </aside>

          <main className="panel center-panel" style={THEME_STYLES[readerTheme]}>
            {selectedDoc ? (
              <>
                {/* Reading Theme Switcher Buttons */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                  <span style={{ fontSize: '12px', opacity: 0.7 }}>Theme:</span>
                  <button
                    className="mini-btn"
                    onClick={() => setReaderTheme('paperwhite')}
                    style={{
                      fontWeight: readerTheme === 'paperwhite' ? 'bold' : 'normal',
                      border: readerTheme === 'paperwhite' ? '2px solid #3b82f6' : '1px solid #475569'
                    }}
                  >
                    📄 Paperwhite
                  </button>
                  <button
                    className="mini-btn"
                    onClick={() => setReaderTheme('white')}
                    style={{
                      fontWeight: readerTheme === 'white' ? 'bold' : 'normal',
                      border: readerTheme === 'white' ? '2px solid #3b82f6' : '1px solid #475569'
                    }}
                  >
                    ⚪ White
                  </button>
                  <button
                    className="mini-btn"
                    onClick={() => setReaderTheme('dark')}
                    style={{
                      fontWeight: readerTheme === 'dark' ? 'bold' : 'normal',
                      border: readerTheme === 'dark' ? '2px solid #3b82f6' : '1px solid #475569'
                    }}
                  >
                    🌙 Dark
                  </button>
                  <button
                    className="mini-btn"
                    onClick={() => setShowDocPortrait(v => !v)}
                    style={{
                      fontWeight: showDocPortrait ? 'bold' : 'normal',
                      border: showDocPortrait ? '2px solid #3b82f6' : '1px solid #475569'
                    }}
                  >
                    📊 Portrait
                  </button>
                </div>
                <div className="doc-title-row">
                  <h3>{selectedDoc.name}</h3>
                  {showDocNotes && (
                    <div className="doc-notes-panel">
                      <label>Document memo — whole-case notes, interpretation, context</label>
                      <textarea
                        value={docNotesDraft}
                        onChange={e => setDocNotesDraft(e.target.value)}
                        onBlur={() => updateDocNotes(selectedDoc.id, docNotesDraft)}
                        placeholder="e.g. this interview took place after the flood; participant was guarded until minute 20…"
                      />
                    </div>
                  )}
                </div>
                {!editingDocId && (
                  <div style={{ display: 'flex', flexDirection: 'row', height: '100%', minHeight: 0, alignItems: 'stretch' }}>
                    <div
                      id="doc-scroll-container"
                      style={{ flex: 1, overflowY: 'auto', padding: '16px', boxSizing: 'border-box', minWidth: 0 }}
                      onClick={() => { setHighlightTarget(null); setGotoTarget(null); }}
                    >
                      <DocEditor
                        doc={selectedDoc}
                        segments={docSegments}
                        codesById={codesById}
                        fontSize={readerFontSize}
                        fontFamily={readerFontFamily}
                        onSelectionChange={sel => {
                          setPendingSelection(sel);
                          // Clear navigation targets when user makes a new selection
                          if (sel) {
                            setHighlightTarget(null);
                            setGotoTarget(null);
                          }
                        }}
                        onClickSegment={(segments, x, y) => setSegmentPopup({ segments, x, y })}
                        onDropCode={codeId => {
                          const code = project.codes.find(c => c.id === codeId);
                          if (code) handleWorkspaceCodeClick(code);
                        }}
                        scrollToSegmentId={gotoTarget?.segId}
                        scrollNonce={gotoTarget?.nonce}
                        highlightRange={highlightTarget?.docId === selectedDoc.id ? { start: highlightTarget.start, end: highlightTarget.end } : null}
                        highlightNonce={highlightTarget?.nonce}
                      />
                    </div>
                    {showDocPortrait && (
                      <div style={{ width: '20px', flexShrink: 0, borderLeft: '1px solid #ccc', backgroundColor: '#f9f9f9' }}>
                        <DocumentPortrait
                          doc={selectedDoc}
                          segments={docSegments}
                          codesById={codesById}
                          onJumpToSegment={handleJumpToSegment}
                        />
                      </div>
                    )}
                  </div>
                )}
                {editingDocId === selectedDoc.id && (
  <div 
    style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '12px', 
      padding: '16px', 
      boxSizing: 'border-box', 
      width: '100%', 
      height: '100%', 
      minHeight: 0 // Prevents flex child overflow collapsing
    }}
  >
    <textarea
      value={draftContent}
      onChange={e => setDraftContent(e.target.value)}
      style={{ 
        flex: 1, 
        width: '100%', 
        height: '100%', 
        padding: '12px', 
        fontSize: '14px', 
        lineHeight: '1.5',
        fontFamily: 'monospace', 
        resize: 'none', 
        boxSizing: 'border-box',
        borderRadius: '6px',
        border: '1px solid var(--border-color, #ccc)'
      }}
      placeholder="Edit document text here…"
    />
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
      <button className="mini-btn" onClick={saveEditDoc}>Save</button>
      <button className="mini-btn" onClick={cancelEditDoc}>Cancel</button>
    </div>
  </div>
)}
                <div className="doc-title-actions">
                  {pendingSelection && (
                    <span className="selection-hint">
                      Selected {pendingSelection.text.length} chars — click or drag a code (legend or search box) to apply it
                    </span>
                  )}
                  <button onClick={() => startEditDoc(selectedDoc)}>✏️ Edit text</button>
                  <button onClick={() => setShowDocNotes(v => !v)}>
                    📝 Notes{selectedDoc.notes ? ' ●' : ''}
                  </button>
                  <button onClick={() => handleExportDocDocx(selectedDoc)}>📤 Export as Word (.docx)</button>
                </div>
              </>
            ) : selectedImage ? (
              <>
                <div className="doc-title-row">
                  <h3>{selectedImage.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button className="mini-btn" onClick={() => setShowImageNotes(v => !v)}>
                      📝 Notes{selectedImage.notes ? ' ●' : ''}
                    </button>
                    <button className="mini-btn" onClick={() => setImageZoom(z => Math.max(0.1, +(z - 0.1).toFixed(2)))}>−</button>
                    <input
                      type="range"
                      min={10}
                      max={400}
                      step={10}
                      value={Math.round(imageZoom * 100)}
                      onChange={e => setImageZoom(Number(e.target.value) / 100)}
                      style={{ width: '140px', verticalAlign: 'middle' }}
                    />
                    <span style={{ fontSize: 12, minWidth: 40, textAlign: 'center', display: 'inline-block' }}>{Math.round(imageZoom * 100)}%</span>
                    <button className="mini-btn" onClick={() => setImageZoom(z => Math.min(4, +(z + 0.1).toFixed(2)))}>+</button>
                    <button className="mini-btn" onClick={() => setImageZoom(1)}>Reset</button>
                  </div>
                </div>
                {showImageNotes && (
                  <div className="doc-notes-panel">
                    <label>Image memo — context, participant reflection, etc.</label>
                    <textarea
                      value={imageNotesDraft}
                      onChange={e => setImageNotesDraft(e.target.value)}
                      onBlur={() => updateImageNotes(selectedImage.id, imageNotesDraft)}
                      placeholder="e.g. taken by participant P4 during the July heatwave…"
                    />
                  </div>
                )}
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '16px', boxSizing: 'border-box' }}>
                  <ImageEditor
                    zoom={imageZoom}
                    image={selectedImage}
                    regions={imageRegions}
                    codesById={codesById}
                    pendingRegion={pendingRegion}
                    onPendingRegionChange={setPendingRegion}
                    onClickRegions={(regions, x, y) => setRegionPopup({ regions, x, y })} requestDeleteImage={requestDeleteImage}                  />
                  <button onClick={handleExportCodedImage}>📤 Export Coded Image</button>
                </div>
                <div className="doc-title-actions">
                  {pendingRegion && (
                    <span className="selection-hint">
                      Region drawn — click a code in the legend to apply it
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div>No document selected</div>
            )}
          </main>

          <aside className="panel right-panel">
            <div className="panel-toolbar">
              <button onClick={addRootCode}>+ Add Root Code</button>
            </div>
            <CodeSearch
              codes={project.codes}
              query={workspaceCodeSearch}
              onQueryChange={setWorkspaceCodeSearch}
              onSelectCode={handleWorkspaceCodeClick}
              applyHint={!!pendingSelection}
              placeholder={pendingSelection ? 'Search codes to apply…' : 'Search codes…'}
            />
            {!workspaceCodeSearch.trim() && (
              <CodeTree
                codes={project.codes}
                selectedCodeId={null}
                onSelectCode={handleWorkspaceCodeClick}
                onAddSubcode={addSubcode}
                onDeleteCode={deleteCode}
                onMoveCode={moveCode}
                onReorderCode={reorderCode}
                onCopyChildCodings={copyChildCodings}
              />
            )}
            </aside>

          {segmentPopup && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                onClick={() => setSegmentPopup(null)}
              />
              <div
                className="segment-popup"
                style={{ left: segmentPopup.x, top: segmentPopup.y, zIndex: 50 }}
                onClick={e => e.stopPropagation()}
              >
              <div className="segment-popup-title">Codes applied here</div>
              {segmentPopup.segments.map(snapshotSeg => {
                const s = project.codedSegments.find(cs => cs.id === snapshotSeg.id) || snapshotSeg;
                return (
                <div key={s.id} className="segment-popup-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="code-swatch" style={{ background: codesById.get(s.codeId)?.color }} />
                    <span style={{ flex: 1 }}>
                      {codesById.get(s.codeId)?.name || 'Unknown code'}
                      <span className="section-hint" style={{ marginLeft: 6, fontSize: 11 }}>Coded by: {s.coder || UNATTRIBUTED_CODER}</span>
                    </span>
                    <button className="mini-btn" onClick={() => toggleStarSegment(s.id)} title={s.starred ? 'Unstar' : 'Star as key quote'}>
                      {s.starred ? '⭐' : '☆'}
                    </button>
                    <button className="mini-btn" onClick={() => removeCodedSegment(s.id)}>Remove</button>
                  </div>

                  {editingNoteFor === s.id ? (
                    <>
                      <textarea
                        className="modal-input"
                        style={{ minHeight: 60, marginTop: 4 }}
                        value={noteDraft}
                        onChange={e => setNoteDraft(e.target.value)}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="mini-btn" onClick={() => { updateSegmentNote(s.id, noteDraft); setEditingNoteFor(null); }}>Save</button>
                        <button className="mini-btn" onClick={() => setEditingNoteFor(null)}>Cancel</button>
                      </div>
                    </>
                  ) : s.note ? (
                    <div style={{ fontSize: 12, fontStyle: 'italic', opacity: 0.85, marginBottom: 6, display: 'flex', justifyContent: 'space-between', gap: 6, backgroundColor: 'rgba(0,0,0,0.05)', padding: '6px', borderRadius: '4px' }}>
                      <span>📝 {s.note}</span>
                      <button className="mini-btn" onClick={() => { setEditingNoteFor(s.id); setNoteDraft(s.note || ''); }}>Edit</button>
                    </div>
                  ) : (
                    <button
                      className="mini-btn"
                      style={{ marginBottom: 6 }}
                      onClick={() => { setEditingNoteFor(s.id); setNoteDraft(''); }}
                    >
                      + Add note
                    </button>
                  )}
                </div>
                );
              })}
              <button className="close-popup" onClick={() => setSegmentPopup(null)}>Close</button>
              </div>
            </>
          )}

          {regionPopup && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                onClick={() => setRegionPopup(null)}
              />
              <div
                className="segment-popup"
                style={{ left: regionPopup.x, top: regionPopup.y, zIndex: 50 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="segment-popup-title">Codes applied to this region</div>
                {regionPopup.regions.map(snapshotRegion => {
                  const r = (project.codedRegions || []).find(cr => cr.id === snapshotRegion.id) || snapshotRegion;
                  return (
                    <div key={r.id} className="segment-popup-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="code-swatch" style={{ background: codesById.get(r.codeId)?.color }} />
                        <span style={{ flex: 1 }}>
                          {codesById.get(r.codeId)?.name || 'Unknown code'}
                        <span className="section-hint" style={{ marginLeft: 6, fontSize: 11 }}>Coded by: {r.coder || UNATTRIBUTED_CODER}</span>
                        </span>
                        <button className="mini-btn" onClick={() => toggleStarRegion(r.id)} title={r.starred ? 'Unstar' : 'Star as key region'}>
                          {r.starred ? '⭐' : '☆'}
                        </button>
                        <button className="mini-btn" onClick={() => removeCodedRegion(r.id)}>Remove</button>
                      </div>
                      {editingRegionNoteFor === r.id ? (
                        <>
                          <textarea
                            className="modal-input"
                            style={{ minHeight: 60, marginTop: 4 }}
                            value={regionNoteDraft}
                            onChange={e => setRegionNoteDraft(e.target.value)}
                            autoFocus
                          />
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: '4px' }}>
                            <button className="mini-btn" onClick={() => { updateRegionNote(r.id, regionNoteDraft); setEditingRegionNoteFor(null); }}>Save</button>
                            <button className="mini-btn" onClick={() => setEditingRegionNoteFor(null)}>Cancel</button>
                          </div>
                        </>
                      ) : r.note ? (
                        <div style={{ fontSize: 12, fontStyle: 'italic', opacity: 0.85, marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 6, backgroundColor: 'rgba(0,0,0,0.05)', padding: '6px', borderRadius: '4px' }}>
                          <span>📝 {r.note}</span>
                          <button className="mini-btn" onClick={() => { setEditingRegionNoteFor(r.id); setRegionNoteDraft(r.note || ''); }}>Edit</button>
                        </div>
                      ) : (
                        <button className="mini-btn" style={{ marginBottom: 8, fontSize: '10px', alignSelf: 'flex-start' }} onClick={() => { setEditingRegionNoteFor(r.id); setRegionNoteDraft(''); }}>
                          + Add note
                        </button>
                      )}
                    </div>
                  );
                })}
                <button className="close-popup" onClick={() => setRegionPopup(null)}>Close</button>
              </div>
            </>
          )}
        </div>
      

      {tab === 'codebook' && (() => {

  return (
    <div className="codebook-grid">
      
      {/* 1. LEFT PANEL: Import, Code Details, & Export Options */}
      <aside className="panel left-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        
        {/* IMPORT OPTIONS */}
        <div className="sidebar-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '4px' }}>
            Import Options
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="mini-btn" style={{ flex: 1, padding: '4px 2px', fontSize: '10px' }} onClick={handleCsvImport}>➕ CSV</button>
            <button className="mini-btn" style={{ flex: 1, padding: '4px 2px', fontSize: '10px' }} onClick={handleQdpxImport}>➕ REFI-QDA</button>
            <button className="mini-btn" style={{ flex: 1, padding: '4px 2px', fontSize: '10px' }} onClick={openDocxCommentImport}>➕ DOCX</button>
          </div>
        </div>

        {/* CODE DETAILS (Only visible when a code is selected) */}
        {codebookCode && (
          <div className="sidebar-group" style={{ borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
              Code Details
            </div>
            
            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Code Name</label>
              <DebouncedCodeText
                value={codebookCode.name}
                onCommit={val => updateCode(codebookCode.id, { name: val })}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Color</label>
              <div className="color-picker" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                {['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80', '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6'].map(c => (
                  <button
                    key={c}
                    className={`swatch-btn ${codebookCode.color === c ? 'active' : ''}`}
                    style={{ 
                      background: c, 
                      width: '16px', height: '16px', 
                      border: codebookCode.color === c ? '2px solid #000' : '1px solid transparent',
                      borderRadius: '3px', cursor: 'pointer', padding: 0
                    }}
                    onClick={() => updateCode(codebookCode.id, { color: c })}
                  />
                ))}
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <button
                    className={`mini-btn ${showColorPalette ? 'active' : ''}`}
                    title="More colors…"
                    style={{ padding: '1px 6px', fontSize: '12px' }}
                    onClick={() => setShowColorPalette(v => !v)}
                  >
                    🎨
                  </button>
                  {showColorPalette && (
                    <div style={{ position: 'absolute', top: '24px', left: '0', zIndex: 100, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', width: '255px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '3px' }}>
                        {MORE_COLORS.map(c => (
                          <button
                            key={c}
                            title={c}
                            style={{
                              width: '20px', height: '20px',
                              background: c,
                              border: codebookCode.color === c ? '2px solid #000' : '1px solid #e2e8f0',
                              borderRadius: '3px', cursor: 'pointer', padding: 0
                            }}
                            onClick={() => {
                              updateCode(codebookCode.id, { color: c });
                              setShowColorPalette(false);
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Custom:</span>
                        <input
                          type="color"
                          value={codebookCode.color}
                          onChange={e => updateCode(codebookCode.id, { color: e.target.value })}
                          style={{ width: '40px', height: '24px', padding: 0, border: '1px solid #cbd5e1', borderRadius: '3px', cursor: 'pointer', background: 'transparent' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Summary / memo</label>
                <button className="mini-btn" style={{ fontSize: '10px', padding: '2px 4px', color: '#eab308' }} onClick={() => pullChildSummaries(codebookCode.id)}>⚡ Pull Subcode Summaries</button>
              </div>
              <DebouncedCodeText
                value={codebookCode.summary}
                onCommit={val => updateCode(codebookCode.id, { summary: val })}
                multiline
              />
            </div>
          </div>
        )}

        {/* EXPORT OPTIONS */}
        <div className="sidebar-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
            Export Options
          </div>
          
          <button className="mini-btn" style={{ padding: '6px 8px', width: '100%' }} onClick={handleQdpxExport}>
            ⬇️ REFI-QDA
          </button>

          <button className="mini-btn" style={{ padding: '6px 8px', width: '100%' }} onClick={handleQdpxCodebookExport}>
            📚 Export Codebook (QDPX)
          </button>

          <button className="mini-btn" style={{ padding: '6px 8px', width: '100%' }} onClick={handleExportNotesCsv}>
            📝 Export All Notes &amp; Memos (CSV)
          </button>

          <button className="mini-btn" style={{ padding: '6px 8px', width: '100%' }} onClick={handleExportManuscriptSkeleton}>
            📄 Manuscript Skeleton
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
            <select 
              value={exportScope} 
              onChange={e => setExportScope(e.target.value as any)}
              style={{ width: '100%', padding: '6px', fontSize: '11px' }}
            >
              {Object.entries(SCOPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label as string}</option>
              ))}
              <option value="starred">Starred Excerpts</option>
            </select>
            
            <div style={{ display: 'flex', gap: '4px' }}>
              <button 
                className="mini-btn" 
                style={{ flex: 1, padding: '6px 4px' }} 
                onClick={() => (exportScope as ExportScope | 'starred') === 'starred' ? handleExportStarredQuotes('csv') : handleExportCsv()}
              >
                ⬇️ CSV
              </button>
              <button 
                className="mini-btn" 
                style={{ flex: 1, padding: '6px 4px' }} 
                onClick={() => (exportScope as ExportScope | 'starred') === 'starred' ? handleExportStarredQuotes('docx') : handleExportDocx()}
              >
                ⬇️ DOCX
              </button>
            </div>

            <button 
              className="mini-btn" 
              style={{ width: '100%', padding: '6px 4px', marginTop: '2px' }} 
              onClick={handleExportStarredImages}
            >
              ⭐ Starred Images (DOCX)
            </button>
          </div>
        </div>

        </aside>

      {/* 2. CENTER PANEL: Excerpts Only */}
      <main className="panel center-panel" style={THEME_STYLES[readerTheme]}>
        {codebookCode ? (
          <div style={{ padding: '16px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
            
            {/* Header with Sort Dropdown */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Excerpts</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {coderOptions.length > 1 && (
                  <select
                    value={selectedCoderFilter}
                    onChange={(e) => setSelectedCoderFilter(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: 'var(--bg-panel)' }}
                  >
                    {coderOptions.map(name => (
                      <option key={name} value={name}>{name === 'all' ? 'Everyone' : name}</option>
                    ))}
                  </select>
                )}
                <select 
                value={excerptSort} 
                onChange={(e) => setExcerptSort(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: 'var(--bg-panel)' }}
              >
                <option value="default">Default Order</option>
                <option value="notes_first">Notes First</option>
                <option value="starred_first">Starred First</option>
              </select>
              </div>
            </div>

            {codebookExcerpts.length > 0 ? (
              <div className="excerpt-list">
                {[...codebookExcerpts].sort((a, b) => {
                  // Sort Logic based on dropdown
                  if (excerptSort === 'notes_first') {
                    const aHasNote = a.note && a.note.trim().length > 0;
                    const bHasNote = b.note && b.note.trim().length > 0;
                    if (aHasNote && !bHasNote) return -1;
                    if (!aHasNote && bHasNote) return 1;
                  } else if (excerptSort === 'starred_first') {
                    if (a.starred && !b.starred) return -1;
                    if (!a.starred && b.starred) return 1;
                  }
                  return 0; // Default fallback
                }).map(seg => {
                  const doc = docsById.get(seg.docId);
                  return (
                    <div 
                      key={seg.id} 
                      className="excerpt-card"
                      style={{
                        backgroundColor: readerTheme === 'dark' ? '#1e293b' : (readerTheme === 'white' ? '#ffffff' : '#fef3c7'),
                        color: readerTheme === 'dark' ? '#f8fafc' : '#0f172a',
                        border: readerTheme === 'dark' ? '1px solid #334155' : (readerTheme === 'white' ? '1px solid #e2e8f0' : '1px solid #fde68a'),
                        padding: '12px',
                        marginBottom: '12px',
                        borderRadius: '6px'
                      }}
                    >
                      <div className="excerpt-doc" style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', fontWeight: 'bold' }}>
                        {doc?.name || 'Unknown source'}
                      </div>
                      <div className="excerpt-text" style={{ marginBottom: '8px', lineHeight: '1.5' }}>"{seg.text}"</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
                        Coded by: {seg.coder || UNATTRIBUTED_CODER}
                      </div>
                      {editingNoteFor === seg.id ? (
                        <div style={{ marginBottom: 6 }}>
                          <textarea
                            className="modal-input"
                            style={{ minHeight: 50, width: '100%', padding: '6px', boxSizing: 'border-box' }}
                            value={noteDraft}
                            onChange={e => setNoteDraft(e.target.value)}
                            autoFocus
                          />
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: '4px' }}>
                            <button className="mini-btn" onClick={() => { updateSegmentNote(seg.id, noteDraft); setEditingNoteFor(null); }}>Save</button>
                            <button className="mini-btn" onClick={() => setEditingNoteFor(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : seg.note ? (
                        <div style={{ fontSize: 12, fontStyle: 'italic', opacity: 0.85, marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 6, backgroundColor: 'rgba(0,0,0,0.05)', padding: '6px', borderRadius: '4px' }}>
                          <span>📝 {seg.note}</span>
                          <button className="mini-btn" onClick={() => { setEditingNoteFor(seg.id); setNoteDraft(seg.note || ''); }}>Edit</button>
                        </div>
                      ) : (
                        <button className="mini-btn" style={{ marginBottom: 8, fontSize: '10px' }} onClick={() => { setEditingNoteFor(seg.id); setNoteDraft(''); }}>
                          + Add note
                        </button>
                      )}
                      
                      <div style={{ display: 'flex', gap: 6 }}>
                          <button className="mini-btn" onClick={() => goToExcerpt(seg)}>📍 Go to Document</button>
                          <button className="mini-btn" onClick={() => toggleStarSegment(seg.id)}>
                            {seg.starred ? '⭐ Starred' : '☆ Star'}
                          </button>
                          <button className="mini-btn" onClick={() => removeCodedSegment(seg.id)}>Remove</button>
                        </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-hint">No excerpts coded to this code yet.</div>
            )}
            {codebookRegions.map(r => {
  const image = (project.images || []).find(i => i.id === r.imageId);
  if (!image) return null;
  return (
    <div 
      key={r.id} 
      className="excerpt-card" 
      style={{ 
        display: 'flex', gap: 10, alignItems: 'flex-start',
        backgroundColor: readerTheme === 'dark' ? '#1e293b' : (readerTheme === 'white' ? '#ffffff' : '#fef3c7'),
        color: readerTheme === 'dark' ? '#f8fafc' : '#0f172a',
        border: readerTheme === 'dark' ? '1px solid #334155' : (readerTheme === 'white' ? '1px solid #e2e8f0' : '1px solid #fde68a'),
        padding: '12px',
        marginBottom: '12px',
        borderRadius: '6px'
      }}
    >
      <div style={{ width: 100, height: 75, overflow: 'hidden', position: 'relative', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }}>
        <img
          src={image.dataUrl}
          style={{
            position: 'absolute',
            width: `${100 / r.width}%`,
            height: `${100 / r.height}%`,
            left: `${-r.x * (100 / r.width)}%`,
            top: `${-r.y * (100 / r.height)}%`,
            maxWidth: 'none'
          }}
          alt="Coded region"
        />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="excerpt-doc" style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', fontWeight: 'bold' }}>
          {image.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
          Coded by: {r.coder || UNATTRIBUTED_CODER}
        </div>
        
        {/* Editing Note UI for Images */}
        {editingNoteFor === r.id ? (
          <div style={{ marginBottom: 6 }}>
            <textarea
              className="modal-input"
              style={{ minHeight: 50, width: '100%', padding: '6px', boxSizing: 'border-box' }}
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: '4px' }}>
              <button className="mini-btn" onClick={() => { updateRegionNote(r.id, noteDraft); setEditingNoteFor(null); }}>Save</button>
              <button className="mini-btn" onClick={() => setEditingNoteFor(null)}>Cancel</button>
            </div>
          </div>
        ) : r.note ? (
          <div style={{ fontSize: 12, fontStyle: 'italic', opacity: 0.85, marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 6, backgroundColor: 'rgba(0,0,0,0.05)', padding: '6px', borderRadius: '4px' }}>
            <span>📝 {r.note}</span>
            <button className="mini-btn" onClick={() => { setEditingRegionNoteFor(r.id); setRegionNoteDraft(r.note || ''); }}>Edit</button>
          </div>
        ) : (
          <button className="mini-btn" style={{ marginBottom: 8, fontSize: '10px', alignSelf: 'flex-start' }} onClick={() => { setEditingRegionNoteFor(r.id); setRegionNoteDraft(''); }}>
            + Add note
          </button>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
          <button className="mini-btn" onClick={() => {
            setTab('workspace');
            setSelectedDocId(null); // Clear document selection
            setSelectedImageId(r.imageId); // Set image selection
            setPendingRegion(r); // Highlight this specific region in the workspace
          }}>📍 Go to Image</button>
          <button className="mini-btn" onClick={() => toggleStarRegion(r.id)}>{r.starred ? '⭐ Starred' : '☆ Star'}</button>
          <button className="mini-btn" onClick={() => removeCodedRegion(r.id)}>Remove</button>
        </div>
      </div>
    </div>
  );
})}
          </div>
        ) : (
          <div className="empty-hint center" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            Select a code on the right panel to review and edit.
          </div>
        )}
      </main>

      {/* 3. RIGHT PANEL: Code Toolbar, Search, & Sorted Tree */}
      <aside className="panel right-panel">
        
        <div style={{ 
  display: 'flex', 
  gap: '8px', 
  alignItems: 'center', 
  marginBottom: '10px',
  flexWrap: 'nowrap' // Forces them to stay on the same line
}}>
  <button 
    onClick={addRootCode} 
    className="btn-primary" 
    style={{ 
      flex: '1', // Takes up remaining space
      padding: '4px 8px', // Smaller padding
      fontSize: '13px', 
      whiteSpace: 'nowrap' 
    }}
  >
    + Add Root Code
  </button>
  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
    <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>↕</span>
    <select 
      value={sortOrder} 
      onChange={(e) => setSortOrder(e.target.value as any)}
      style={{ 
        padding: '2px 6px', 
        fontSize: '12px',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        backgroundColor: 'var(--bg-panel)'
      }}
    >
      <option value="name">Name</option>
      <option value="createdAt">Date Created</option>
      <option value="most-coded">Most Coded</option>
      <option value="least-coded">Least Coded</option>
    </select>
  </div>
</div>

        {/* Search & Code Tree */}
        <CodeSearch
          codes={sortedCodes}
          query={codebookCodeSearch}
          onQueryChange={setCodebookCodeSearch}
          onSelectCode={code => setCodebookSelectedCodeId(code.id)}
          placeholder="Search codes…"
        />
        {!codebookCodeSearch.trim() && (
          <CodeTree
            codes={sortedCodes}
            selectedCodeId={codebookSelectedCodeId}
            onSelectCode={code => setCodebookSelectedCodeId(code.id)}
            onAddSubcode={addSubcode}
            onDeleteCode={deleteCode}
            onMoveCode={moveCode}
            onReorderCode={reorderCode}
            onCopyChildCodings={copyChildCodings}
          />
        )}

      </aside>
    </div>
  );
})()}

{tab === 'autocode' && (
  <div className="panel autocode-panel">
    <h2>Auto-Coder</h2>
    <p className="section-hint">
      Scans every document in this project for a keyword or phrase and automatically applies a code to each match.
    </p>

    <div className="form-grid">
      <label>Search keyword / phrase</label>
      <input
        type="text"
        value={autoCodeQuery}
        onChange={e => setAutoCodeQuery(e.target.value)}
        placeholder='e.g. "climate change", "resilience"'
      />

      <label>Capture boundary</label>
      <div className="radio-row">
        <label>
          <input type="radio" checked={autoCodeBoundary === 'exact'} onChange={() => setAutoCodeBoundary('exact')} />
          Exact match only
        </label>
        <label>
          <input type="radio" checked={autoCodeBoundary === 'sentence'} onChange={() => setAutoCodeBoundary('sentence')} />
          Enclosing sentence
        </label>
      </div>

      {autoCodeBoundary === 'sentence' && (
        <>
          <label>Language</label>
          <select value={autoCodeLanguage} onChange={e => setAutoCodeLanguage(e.target.value)}>
            {AUTO_CODE_LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </>
      )}

      <label>Word matching</label>
      <div className="radio-row">
        <label>
          <input type="radio" checked={autoCodeMatchMode === 'literal'} onChange={() => setAutoCodeMatchMode('literal')} />
          Literal (exact substring, keeps e.g. "tree" inside "street" too)
        </label>
        <label>
          <input type="radio" checked={autoCodeMatchMode === 'root'} onChange={() => setAutoCodeMatchMode('root')} />
          Word roots &amp; variants ("green" → greens, greenery)
        </label>
      </div>

      <label>Target code</label>
      <select value={autoCodeTargetCodeId} onChange={e => setAutoCodeTargetCodeId(e.target.value)}>
        <option value="">Select a code…</option>
        {flatCodes.map(({ code, depth }) => (
          <option key={code.id} value={code.id}>
            {'—'.repeat(depth)} {code.name}
          </option>
        ))}
      </select>
    </div>

    <button
      className="primary-btn"
      style={{ marginTop: 16 }}
      disabled={!autoCodeQuery.trim() || !autoCodeTargetCodeId}
      onClick={handleRunAutoCode}
    >
      ⚡ Execute Auto-Code
    </button>

    {autoCodePreview && (
      <p className="section-hint" style={{ marginTop: 8 }}>
        Would apply to <strong>{autoCodePreview.count}</strong> new passage{autoCodePreview.count === 1 ? '' : 's'} across{' '}
        <strong>{autoCodePreview.docs}</strong> document{autoCodePreview.docs === 1 ? '' : 's'} (not yet applied).
      </p>
    )}

    {autoCodeResultText && <div className="autocode-result">{autoCodeResultText}</div>}
  </div>
)}

{tab === 'analysis' && (
  <AnalysisTab project={project} onExportReport={handleExportReport} onSaveCell={updateFrameworkCell} onSaveRelationNote={updateRelationNote} showToast={showToast} />
)}

<div
  className="panel codemap-panel"
  style={{
    display: tab === 'codemap' ? 'flex' : 'none',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0
  }}
>
    <h2>Code Map</h2>
    <CodeMap
      projectId={project.id}
      codes={project.codes}
      codedSegments={project.codedSegments}
      mapEdgeStyles={project.mapEdgeStyles || []}
      annotations={project.mapAnnotations || []}
      hiddenMapCodeIds={project.hiddenMapCodeIds || []}
      onUpdateCode={updateCode}
      onUpdateCodesBatch={updateCodesBatch}
      onUpdateEdgeStyle={updateMapEdgeStyle}
      onAddEdgeStyle={addMapEdgeStyle}
      onDeleteEdgeStyle={deleteMapEdgeStyle}
      onUpdateAnnotations={updateMapAnnotations}
      onUpdateHiddenMapCodes={updateHiddenMapCodes}
      onShowToast={showToast}
    />
</div>

{tab === 'about' && (
  <main 
    className="panel about-panel" 
    style={{ 
      padding: '40px', 
      maxWidth: '600px', 
      margin: '40px auto', 
      textAlign: 'center', 
      backgroundColor: 'var(--panel)', 
      color: 'var(--text)', 
      borderRadius: '8px', 
      border: '1px solid var(--border)',
      boxShadow: '0 4px 12px var(--shadow)',
      overflowX: 'hidden'
    }}
  >
    <img 
      src="./eqc-logo.png" 
      alt="EQC Logo" 
      style={{ width: '120px', height: '120px', marginBottom: '20px' }} 
    />
    <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', color: 'var(--text)' }}>EQC - Easy Qual Coding</h2>
    <p style={{ fontWeight: 'bold', color: '#fb923c', marginBottom: '20px' }}>Version {pkg.version}</p>
    <p>
      <a href="https://github.com/anisur-bayazid25/eQc" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
        github.com/anisur-bayazid25/eQc
      </a> — Visit for latest updates, releases, and source
      <button onClick={() => window.qv.checkForUpdates()}>🔄 Check for Updates</button>
    </p>
    
    <p style={{ lineHeight: '1.6', marginBottom: '30px', fontSize: '16px', color: 'var(--text)' }}>
      Designed to strip away the complexity of traditional QDA software. 
      EQC offers a lightweight, intuitive environment for researchers to seamlessly weave text into meaningful insights.
    </p>

    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', fontSize: '14px', lineHeight: '1.8', color: 'var(--text-dim)' }}>
      <p><strong style={{ color: 'var(--text)' }}>Made by:</strong> Anisur Rahman Bayazid <em>(with help from borrowed intellect)</em></p>
      <p><strong style={{ color: 'var(--text)' }}>Contact:</strong> <a href="mailto:anisur.rahman.bayazid@gmail.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>anisur.rahman.bayazid@gmail.com</a></p>
      <p><strong style={{ color: 'var(--text)' }}>License:</strong> MIT License - Open and free for commercial and non-commercial use.</p>
      <p><strong style={{ color: 'var(--text)' }}>Year:</strong> 2026</p>
    </div>
  </main>
)}
{pendingDeleteImageId && (
  <div className="modal-overlay">
    <div className="modal-content">
      <h3>Delete Image</h3>
      <p>Are you sure you want to delete this image? This action cannot be undone.</p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
        <button 
          className="primary-btn" 
          style={{ background: '#d9534f', color: 'white', border: 'none' }} 
          onClick={executeDeleteImage}
        >
          Yes, Delete
        </button>
        <button 
          className="secondary-btn" 
          onClick={() => setPendingDeleteImageId(null)}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
{confirmDialog && (
  <div className="modal-overlay">
    <div className="modal-content">
      <h3>Delete</h3>
      <p>{confirmDialog.message}</p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
        <button
          className="primary-btn"
          style={{ background: '#d9534f', color: 'white', border: 'none', padding: '8px 24px' }}
          onClick={() => {
            const fn = confirmDialog.onConfirm;
            setConfirmDialog(null);
            fn();
          }}
        >
          {confirmDialog.confirmText || 'Delete'}
        </button>
        <button
          className="secondary-btn"
          onClick={() => setConfirmDialog(null)}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
{lanModalOpen && (
  <LanModal
    session={lanSession}
    hosts={lanHosts}
    sync={lanSync}
    joining={lanJoining}
    myName={lanMyName}
    initialTab={lanSession ? (lanSession.role === 'host' ? 'host' : 'join') : 'host'}
    onMyNameChange={setLanMyName}
    onStartHost={handleLanStartHost}
    onStopHost={handleLanStopHost}
    onJoin={handleLanJoin}
    onDisconnect={handleLanDisconnect}
    onKickClient={handleLanKickClient}
    onClose={() => setLanModalOpen(false)}
  />
)}
</div>
  );
}
function FrameworkCellInput({ initialValue, onSave }: { initialValue: string; onSave: (text: string) => void }) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => setValue(initialValue), [initialValue]);
  return (
    <textarea
      className="framework-cell-input"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => { if (value !== initialValue) onSave(value); }}
      placeholder="—"
    />
  );
}

function AnalysisExportButtons({
  title, filenameBase, headers, rows, showToast
}: {
  title: string;
  filenameBase: string;
  headers: string[];
  rows: (string | number)[][];
  showToast: (msg: string) => void;
}) {
  async function doExport(kind: 'csv' | 'docx') {
    const path = kind === 'csv'
      ? await window.qv.exportText({
          title: `Export ${title} (CSV)`, 
          defaultName: `${filenameBase}.csv`, 
          content: toCsv(headers, rows.map(r => r.map(String))),
          extension: 'csv',
          filterName: 'CSV file'
        })
      : await window.qv.exportDocxTable({
          kind: 'table',
          title,
          headers,
          rows,
          filenameBase
        });
    if (path) showToast(`Exported ${title} to ${path}`);
  }
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button onClick={() => doExport('csv')}>⬇️ CSV</button>
      <button onClick={() => doExport('docx')}>⬇️ DOCX</button>
    </div>
  );
}

function AnalysisTab({ project, onExportReport, onSaveCell, onSaveRelationNote, showToast }: { project: Project; onExportReport: (extras?: ReportExtras) => void; onSaveCell: (docId: ID, codeId: ID, text: string) => void; onSaveRelationNote: (codeAId: ID, codeBId: ID, note: string) => void; showToast: (msg: string) => void }) {
  const [subTab, setSubTab] = useState<'frequency' | 'docMatrix' | 'coMatrix' | 'framework' | 'words' | 'kwic'>('frequency');
  const codesByIdLocal = useMemo(() => new Map(project.codes.map(c => [c.id, c])), [project.codes]);

  // The text the user is typing (`inputValue`, drives only the input field)
  // versus the keyword actually searched (`activeSearch`, set only by the
  // Search button or Enter key). Keeping them separate means typing in the
  // field never triggers a search.
  const [inputValue, setInputValue] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [kwicWindow, setKwicWindow] = useState(5);
  const [kwicResults, setKwicResults] = useState<Array<{ docName: string; before: string[]; keyword: string; after: string[] }>>([]);

  // The actual search logic runs ONLY when `activeSearch` changes — i.e. when
  // a search is explicitly executed — never while the user is still typing.
  useEffect(() => {
    if (!activeSearch) {
      setKwicResults([]);
      return;
    }
    const windowN = Math.max(1, Math.min(20, kwicWindow || 5));
    const results: Array<{ docName: string; before: string[]; keyword: string; after: string[] }> = [];
    for (const doc of project.docs) {
      const words = (doc.content || '').toLowerCase().split(/[\s\.,!\?:"';\(\)\[\]\{\}\-\–\—\‘\’\“\”\n\r\t]+/).filter(w => w.length > 0);
      for (let i = 0; i < words.length; i++) {
        if (words[i] !== activeSearch) continue;
        results.push({
          docName: doc.name,
          before: words.slice(Math.max(0, i - windowN), i),
          keyword: words[i],
          after: words.slice(i + 1, i + 1 + windowN)
        });
      }
    }
    setKwicResults(results);
  }, [activeSearch, kwicWindow, project]);

  function runKwicSearch() {
    setActiveSearch(inputValue.trim().toLowerCase());
  }

  const STOP_WORDS_DEFAULT = 'the, is, at, which, and, a, an, in, on, of, to, for, with, it, this, that, এবং, ও, আর, কি, যে, এই, সেই, হয়, না, থেকে, কে, করে, এর, তে';
  const [stopWordsText, setStopWordsText] = useState(STOP_WORDS_DEFAULT);
  const [wordFreqs, setWordFreqs] = useState<Array<{ word: string; count: number }> | null>(null);

  function generateWordFrequencies() {
    const stopSet = new Set(
      stopWordsText.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    );
    const allText = project.docs.map(d => d.content || '').join('\n');
    const rawWords = allText.toLowerCase().split(/[\s\.,!\?:"';\(\)\[\]\{\}\-\–\—\‘\’\“\”\n\r\t]+/);
    const tally = new Map<string, number>();
    for (const word of rawWords) {
      if (/\d/.test(word)) continue;
      if (word.length <= 1) continue;
      if (!word || stopSet.has(word)) continue;
      tally.set(word, (tally.get(word) || 0) + 1);
    }
    const rows = Array.from(tally.entries()).map(([word, count]) => ({ word, count }));
    rows.sort((a, b) => b.count - a.count);
    setWordFreqs(rows.slice(0, 100));
  }

  const [freqSort, setFreqSort] = useState<FreqSortKey>('groupedNameAsc');
  const freqTree = useMemo(() => sortFrequencyTree(project, freqSort), [project, freqSort]);

  const docMatrix = useMemo(() => codeDocumentMatrix(project), [project]);
  const [docMatrixCodeSort, setDocMatrixCodeSort] = useState<NameCountSort>('nameAsc');
  const [docMatrixDocSort, setDocMatrixDocSort] = useState<NameCountSort>('nameAsc');
  const docMatrixCodeTotal = (codeId: ID) => project.docs.reduce((sum, d) => sum + (docMatrix.get(codeId)?.get(d.id) || 0), 0);
  const docMatrixDocTotal = (docId: ID) => project.codes.reduce((sum, c) => sum + (docMatrix.get(c.id)?.get(docId) || 0), 0);
  const sortedDocMatrixCodes = useMemo(
    () => sortByNameOrCount(project.codes, c => c.name, c => docMatrixCodeTotal(c.id), docMatrixCodeSort),
    [project.codes, docMatrix, docMatrixCodeSort]
  );
  const sortedDocMatrixDocs = useMemo(
    () => sortByNameOrCount(project.docs, d => d.name, d => docMatrixDocTotal(d.id), docMatrixDocSort),
    [project.docs, docMatrix, docMatrixDocSort]
  );

  const coMatrix = useMemo(() => codeCooccurrenceMatrix(project), [project]);
  const activeCoocCodes = useMemo(
    () => project.codes.filter(code =>
      project.codes.some(other => other.id !== code.id && (coMatrix.get(code.id)?.get(other.id) || 0) > 0)
    ),
    [project.codes, coMatrix]
  );
  const [coocSort, setCoocSort] = useState<NameCountSort>('nameAsc');
  const coocTotal = (codeId: ID) => activeCoocCodes.reduce((sum, c) => sum + (c.id === codeId ? 0 : (coMatrix.get(codeId)?.get(c.id) || 0)), 0);
  const sortedCoocCodes = useMemo(
    () => sortByNameOrCount(activeCoocCodes, c => c.name, c => coocTotal(c.id), coocSort),
    [activeCoocCodes, coMatrix, coocSort]
  );
  const relationNotesMap = useMemo(() => {
    const m = new Map<string, string>();
    (project.relationNotes || []).forEach(n => m.set(`${n.codeAId}::${n.codeBId}`, n.note));
    return m;
  }, [project.relationNotes]);
  const [coocView, setCoocView] = useState<{ codeAId: ID; codeBId: ID; codeAName: string; codeBName: string; excerpts: Array<{ docName: string; text: string }> } | null>(null);

  const frameworkRows = useMemo(() => childCodes(project.codes, null), [project.codes]);
  const frameworkCellMap = useMemo(() => {
    const m = new Map<string, FrameworkCell>();
    (project.frameworkCells || []).forEach(c => m.set(`${c.docId}::${c.codeId}`, c));
    return m;
  }, [project.frameworkCells]);
  const [fwRowSort, setFwRowSort] = useState<NameCountSort>('nameAsc');
  const [fwColSort, setFwColSort] = useState<NameCountSort>('nameAsc');
  const fwRowFilled = (codeId: ID) => project.docs.filter(d => frameworkCellMap.get(`${d.id}::${codeId}`)?.text).length;
  const fwColFilled = (docId: ID) => frameworkRows.filter(c => frameworkCellMap.get(`${docId}::${c.id}`)?.text).length;
  const sortedFrameworkRows = useMemo(
    () => sortByNameOrCount(frameworkRows, c => c.name, c => fwRowFilled(c.id), fwRowSort),
    [frameworkRows, frameworkCellMap, fwRowSort]
  );
  const sortedFrameworkDocs = useMemo(
    () => sortByNameOrCount(project.docs, d => d.name, d => fwColFilled(d.id), fwColSort),
    [project.docs, frameworkCellMap, fwColSort]
  );

  const SORT_OPTIONS = (
    <>
      <option value="nameAsc">A → Z</option>
      <option value="nameDesc">Z → A</option>
      <option value="countDesc">Most coded → least</option>
      <option value="countAsc">Least coded → most</option>
    </>
  );

  return (
    <div className="analysis-panel panel">
      <div className="analysis-header">
        <h2>Analysis Dashboard</h2>
        <button onClick={() => onExportReport({
          wordFrequencies: wordFreqs,
          stopWordsText,
          kwicKeyword: activeSearch,
          kwicWindow,
          kwicResults
        })}>⬇️ HTML Report</button>
      </div>

      <nav className="subtabs">
        <button className={`subtab-btn ${subTab === 'frequency' ? 'active' : ''}`} onClick={() => setSubTab('frequency')}>
          Coding Frequency
        </button>
        <button className={`subtab-btn ${subTab === 'docMatrix' ? 'active' : ''}`} onClick={() => setSubTab('docMatrix')}>
          Code × Document Matrix
        </button>
        <button className={`subtab-btn ${subTab === 'coMatrix' ? 'active' : ''}`} onClick={() => setSubTab('coMatrix')}>
          Code Co-occurrence Matrix
        </button>
        <button className={`subtab-btn ${subTab === 'framework' ? 'active' : ''}`} onClick={() => setSubTab('framework')}>
          Framework Matrix
        </button>
        <button className={`subtab-btn ${subTab === 'words' ? 'active' : ''}`} onClick={() => setSubTab('words')}>
          Word Frequencies
        </button>
        <button className={`subtab-btn ${subTab === 'kwic' ? 'active' : ''}`} onClick={() => setSubTab('kwic')}>
          KWIC
        </button>
      </nav>

      {subTab === 'frequency' && (
        <section>
          <div className="sort-row">
            <label>Sort</label>
            <select value={freqSort} onChange={e => setFreqSort(e.target.value as FreqSortKey)}>
              <option value="groupedNameAsc">Grouped, A → Z</option>
              <option value="groupedNameDesc">Grouped, Z → A</option>
              <option value="groupedCountDesc">Grouped, highest → lowest</option>
              <option value="groupedCountAsc">Grouped, lowest → highest</option>
              <option value="countDesc">Highest → lowest</option>
              <option value="countAsc">Lowest → highest</option>
              <option value="nameAsc">A → Z</option>
              <option value="nameDesc">Z → A</option>
            </select>
            <AnalysisExportButtons
              title={`${project.name} — Coding Frequency`}
              filenameBase={`${project.name.replace(/[^\w\- ]/g, '_')}_coding_frequency`}
              headers={['Theme / Code', 'Depth', 'Direct Count', 'Total (incl. nested)']}
              rows={freqTree.map(f => [f.code.name, f.depth, f.ownCount, f.rolledUpCount])}
              showToast={showToast}
            />
          </div>
          <div className="freq-chart">
            {freqTree.map(f => (
              <div key={f.code.id} className="freq-row" style={{ paddingLeft: f.depth * 16 }}>
                <span className="freq-label" title={f.code.name}>
                  {f.code.name}
                  {f.hasChildren && (
                    <span className="section-hint" style={{ marginLeft: 6 }}>
                      ({f.ownCount} direct + {f.rolledUpCount - f.ownCount} nested)
                    </span>
                  )}
                </span>
                <div className="freq-bar-track">
                  <div className="freq-bar" style={{ width: `${(f.rolledUpCount / Math.max(1, ...freqTree.map(x => x.rolledUpCount))) * 100}%`, background: f.code.color }} />
                </div>
                <span className="freq-count">{f.rolledUpCount}</span>
              </div>
            ))}
            {freqTree.length === 0 && <div className="empty-hint">No codes yet.</div>}
          </div>
        </section>
      )}

      {subTab === 'docMatrix' && (
        <section>
          <div className="sort-row">
            <label>Sort codes</label>
            <select value={docMatrixCodeSort} onChange={e => setDocMatrixCodeSort(e.target.value as NameCountSort)}>
              {SORT_OPTIONS}
            </select>
            <label>Sort documents</label>
            <select value={docMatrixDocSort} onChange={e => setDocMatrixDocSort(e.target.value as NameCountSort)}>
              {SORT_OPTIONS}
            </select>
            <AnalysisExportButtons
              title={`${project.name} — Code × Document Matrix`}
              filenameBase={`${project.name.replace(/[^\w\- ]/g, '_')}_code_document_matrix`}
              headers={['Code', ...sortedDocMatrixDocs.map(d => d.name)]}
              rows={sortedDocMatrixCodes.map(code => [code.name, ...sortedDocMatrixDocs.map(d => docMatrix.get(code.id)?.get(d.id) || 0)])}
              showToast={showToast}
            />
          </div>
          <div className="matrix-wrap">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th />
                  {sortedDocMatrixDocs.map(d => <th key={d.id}>{d.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {sortedDocMatrixCodes.map(code => (
                  <tr key={code.id}>
                    <td className="matrix-code-cell"><span className="code-swatch" style={{ background: code.color }} />{code.name}</td>
                    {sortedDocMatrixDocs.map(d => (
                      <td key={d.id}>{docMatrix.get(code.id)?.get(d.id) || 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {project.codes.length === 0 && <div className="empty-hint">No codes yet.</div>}
          </div>
        </section>
      )}

      {subTab === 'coMatrix' && (
        <section>
          <div className="sort-row">
            <span className="section-hint">Click a cell to see the shared excerpts</span>
            <label>Sort</label>
            <select value={coocSort} onChange={e => setCoocSort(e.target.value as NameCountSort)}>
              {SORT_OPTIONS}
            </select>
            <AnalysisExportButtons
              title={`${project.name} — Code Co-occurrence Matrix`}
              filenameBase={`${project.name.replace(/[^\w\- ]/g, '_')}_code_cooccurrence_matrix`}
              headers={['', ...sortedCoocCodes.map(c => c.name)]}
              rows={sortedCoocCodes.map(rowCode => [
                rowCode.name,
                ...sortedCoocCodes.map(colCode => (rowCode.id === colCode.id ? '' : coMatrix.get(rowCode.id)?.get(colCode.id) || 0))
              ])}
              showToast={showToast}
            />
            <AnalysisExportButtons
              title={`${project.name} — Code Relationship Notes`}
              filenameBase={`${project.name.replace(/[^\w\- ]/g, '_')}_relationship_notes`}
              headers={['Code A', 'Code B', 'Co-occurrence Count', 'Relationship Memo']}
              rows={(project.relationNotes || []).map(n => {
                const a = codesByIdLocal.get(n.codeAId)?.name || 'Unknown';
                const b = codesByIdLocal.get(n.codeBId)?.name || 'Unknown';
                const count = coMatrix.get(n.codeAId)?.get(n.codeBId) || coMatrix.get(n.codeBId)?.get(n.codeAId) || 0;
                return [a, b, count, n.note];
              })}
              showToast={showToast}
            />
          </div>

          <div className="cooc-grid">
            <div className="cooc-matrix-panel" style={{ width: coocView ? '50%' : '100%' }}>
              {sortedCoocCodes.length === 0 ? (
                <div className="empty-hint">
                  No overlapping codes yet — co-occurrence appears once two different codes are applied to the exact same excerpt.
                </div>
              ) : (
                <div className="matrix-wrap">
                  <table className="matrix-table">
                    <thead>
                      <tr>
                        <th />
                        {sortedCoocCodes.map(c => <th key={c.id}>{c.name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCoocCodes.map(rowCode => (
                        <tr key={rowCode.id}>
                          <td className="matrix-code-cell"><span className="code-swatch" style={{ background: rowCode.color }} />{rowCode.name}</td>
                          {sortedCoocCodes.map(colCode => (
                            <td
                              key={colCode.id}
                              className={rowCode.id === colCode.id ? 'diag-cell' : 'matrix-cell-clickable'}
                              onClick={() => {
                                if (rowCode.id === colCode.id) return;
                                const [a, b] = rowCode.id < colCode.id ? [rowCode.id, colCode.id] : [colCode.id, rowCode.id];
                                setCoocView({
                                  codeAId: a,
                                  codeBId: b,
                                  codeAName: rowCode.name,
                                  codeBName: colCode.name,
                                  excerpts: findCooccurringExcerpts(project, rowCode.id, colCode.id)
                                });
                              }}
                            >
                              {rowCode.id === colCode.id ? '—' : coMatrix.get(rowCode.id)?.get(colCode.id) || 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {coocView && (
              <>
                <div className="cooc-excerpts-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <h3 style={{ margin: 0 }}>{coocView.codeAName} × {coocView.codeBName}</h3>
                    <button className="mini-btn" onClick={() => setCoocView(null)}>Close</button>
                  </div>
                  <div className="section-hint" style={{ margin: '4px 0 10px' }}>
                    {coocView.excerpts.length} shared excerpt{coocView.excerpts.length === 1 ? '' : 's'}
                  </div>
                  {coocView.excerpts.length === 0 ? (
                    <div className="empty-hint">No shared excerpts.</div>
                  ) : (
                    coocView.excerpts.map((e, i) => (
                      <div key={i} className="excerpt-card" style={{ marginBottom: 8 }}>
                        <div className="excerpt-doc">{e.docName}</div>
                        <div className="excerpt-text">"{e.text}"</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="cooc-memo-panel">
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>
                    Relationship memo
                  </label>
                  <FrameworkCellInput
                    initialValue={relationNotesMap.get(`${coocView.codeAId}::${coocView.codeBId}`) || ''}
                    onSave={text => onSaveRelationNote(coocView.codeAId, coocView.codeBId, text)}
                  />
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {subTab === 'framework' && (
        <section>
          <div className="sort-row">
            <span className="section-hint">One short summary per theme, per case. Click a cell to write or edit — saves when you click away.</span>
            <label>Sort themes</label>
            <select value={fwRowSort} onChange={e => setFwRowSort(e.target.value as NameCountSort)}>
              <option value="nameAsc">A → Z</option>
              <option value="nameDesc">Z → A</option>
              <option value="countDesc">Most filled → least</option>
              <option value="countAsc">Least filled → most</option>
            </select>
            <label>Sort documents</label>
            <select value={fwColSort} onChange={e => setFwColSort(e.target.value as NameCountSort)}>
              <option value="nameAsc">A → Z</option>
              <option value="nameDesc">Z → A</option>
              <option value="countDesc">Most filled → least</option>
              <option value="countAsc">Least filled → most</option>
            </select>
            <AnalysisExportButtons
              title={`${project.name} — Framework Matrix`}
              filenameBase={`${project.name.replace(/[^\w\- ]/g, '_')}_framework_matrix`}
              headers={['Theme', ...sortedFrameworkDocs.map(d => d.name)]}
              rows={sortedFrameworkRows.map(code => [
                code.name,
                ...sortedFrameworkDocs.map(d => frameworkCellMap.get(`${d.id}::${code.id}`)?.text || '')
              ])}
              showToast={showToast}
            />
          </div>
          <div className="matrix-wrap">
            <table className="matrix-table framework-matrix-table">
              <thead>
                <tr>
                  <th>Theme</th>
                  {sortedFrameworkDocs.map(d => <th key={d.id}>{d.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {sortedFrameworkRows.map(code => (
                  <tr key={code.id}>
                    <td className="matrix-code-cell"><span className="code-swatch" style={{ background: code.color }} />{code.name}</td>
                    {sortedFrameworkDocs.map(d => {
                      const existing = frameworkCellMap.get(`${d.id}::${code.id}`);
                      return (
                        <td key={d.id} className="framework-cell">
                          <FrameworkCellInput
                            initialValue={existing?.text || ''}
                            onSave={text => onSaveCell(d.id, code.id, text)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedFrameworkRows.length === 0 && <div className="empty-hint">No top-level (theme) codes yet — add a root code to use the framework matrix.</div>}
            {project.docs.length === 0 && <div className="empty-hint">No documents yet.</div>}
          </div>
        </section>
      )}

      {subTab === 'words' && (
        <section>
          <div className="sort-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
            <label style={{ marginBottom: 0 }}>Stop words (comma-separated) — edit freely, then click Generate List:</label>
            <textarea
              value={stopWordsText}
              onChange={e => setStopWordsText(e.target.value)}
              rows={4}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-panel)', color: 'var(--text)', resize: 'vertical' }}
            />
            <div>
              <button className="primary-btn" onClick={generateWordFrequencies}>Generate List</button>
            </div>
          </div>
          {wordFreqs && (
            <div className="matrix-wrap" style={{ marginTop: '12px' }}>
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Word</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {wordFreqs.map((row, i) => (
                    <tr key={row.word}>
                      <td style={{ color: 'var(--text-dim)' }}>{i + 1}</td>
                      <td>{row.word}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {wordFreqs.length === 0 && <div className="empty-hint">No words found (check that documents are loaded).</div>}
            </div>
          )}
        </section>
      )}

      {subTab === 'kwic' && (
        <section>
          <div className="sort-row" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ marginBottom: 0 }}>Keyword</label>
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="e.g. education"
                style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: 'var(--bg-panel)', color: 'var(--text)' }}
                onKeyDown={e => { if (e.key === 'Enter') runKwicSearch(); }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ marginBottom: 0 }}>Context window (words)</label>
              <input
                type="number"
                min={1}
                max={20}
                value={kwicWindow}
                onChange={e => setKwicWindow(parseInt(e.target.value || '5', 10))}
                style={{ width: '90px', padding: '4px 8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: 'var(--bg-panel)', color: 'var(--text)' }}
              />
            </div>
            <button className="primary-btn" onClick={runKwicSearch}>Search</button>
          </div>

          {kwicResults.length > 0 && (
            <>
              <div className="section-hint" style={{ marginTop: '12px' }}>
                <strong>Found {kwicResults.length} match(es) for "{activeSearch}"</strong>
              </div>
              <div className="matrix-wrap" style={{ marginTop: '8px' }}>
                <table className="matrix-table kwic-table">
                  <thead>
                    <tr>
                      <th style={{ width: '160px' }}>Document Name</th>
                      <th>Pre-Context</th>
                      <th style={{ width: '140px' }}>Keyword</th>
                      <th>Post-Context</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kwicResults.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-dim)', fontSize: '12px' }}>{r.docName}</td>
                        <td style={{ textAlign: 'right', fontStyle: 'italic', color: 'var(--text-dim)' }}>… {r.before.join(' ')}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--accent)' }}>{r.keyword}</td>
                        <td style={{ textAlign: 'left', fontStyle: 'italic', color: 'var(--text-dim)' }}>{r.after.join(' ')} …</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {kwicResults.length === 0 && activeSearch && (
            <div className="empty-hint" style={{ marginTop: '12px' }}>No matches found for "{activeSearch}".</div>
          )}
        </section>
      )}
    </div>
  );
}