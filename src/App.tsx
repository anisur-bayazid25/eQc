import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Project, ProjectSummary, Folder, SourceDoc, Code, CodedSegment, FrameworkCell, CodeRelationNote,
  ID, uid, newProject, randomColor, childCodes, descendantCodeIds
} from './domain';
import CodeTree from './components/CodeTree';
import CodeSearch from './components/CodeSearch';
import DocTree, { SortKey } from './components/DocTree';
import DocEditor from './components/DocEditor';
import { getSelectionOffsets, SelectionOffsets } from './lib/textOffsets';
import { relocateSegmentsAfterEdit } from './lib/relocateSegments';
import { importCsvDataset } from './lib/csvImport';
import { importQdpx } from './lib/qdpxImport';
import { importDocxComments } from './lib/docxCommentImport';
import { mergeProjectInto } from './lib/merge';
import { codingFrequency, codeDocumentMatrix, codeCooccurrenceMatrix } from './lib/analysis';
import { buildReportHtml } from './lib/report';
import { AUTO_CODE_LANGUAGES, CaptureBoundary, runAutoCode } from './lib/autoCode';
import { useTextPrompt } from './components/PromptModal';
import { extractBengaliTextFromPDF } from './lib/pdfExtractor';
import { buildScopedExport, buildCodebookOutline, ExportScope, SCOPE_LABELS } from './lib/exportBuilders';
import pkg from '../package.json';

type Tab = 'workspace' | 'codebook' | 'autocode' | 'analysis' | 'about';

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
  const [theme, setTheme] = useState<'dark' | 'light'>(
  () => (localStorage.getItem('qv-theme') as 'dark' | 'light') || 'dark'
);
  const [showDocNotes, setShowDocNotes] = useState(false);
  const [docNotesDraft, setDocNotesDraft] = useState('');
  const [editingNoteFor, setEditingNoteFor] = useState<ID | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0); // 0 = rename view, 1 = first confirm, 2 = final confirm

useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('qv-theme', theme);
}, [theme]);

  React.useEffect(() => {
    localStorage.setItem('qda-reader-theme', readerTheme);
  }, [readerTheme]);

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

  // Undo / redo history (per project, in-memory only)
  const [past, setPast] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const HISTORY_LIMIT = 50;

  // Codebook state
  const [codebookSelectedCodeId, setCodebookSelectedCodeId] = useState<ID | null>(null);
  const [workspaceCodeSearch, setWorkspaceCodeSearch] = useState('');
  const [codebookCodeSearch, setCodebookCodeSearch] = useState('');
  const [exportScope, setExportScope] = useState<ExportScope>('codesExcerptsSummaries');
  const [docxCommentModalOpen, setDocxCommentModalOpen] = useState(false);
  const [docxSeparatorChoice, setDocxSeparatorChoice] = useState<',' | ';' | '|' | 'custom'>(',');
  const [docxCustomSeparator, setDocxCustomSeparator] = useState('');
  const [docxFirstIsSpeaker, setDocxFirstIsSpeaker] = useState(false);
  const [docxLastIsExcerpt, setDocxLastIsExcerpt] = useState(true);
  const [sortOrder, setSortOrder] = useState<string>('name');
  const [excerptSort, setExcerptSort] = useState('notes_first');

  // Auto-code state
  const [acKeyword, setAcKeyword] = useState('');
  const [acBoundary, setAcBoundary] = useState<CaptureBoundary>('exact');
  const [acLanguage, setAcLanguage] = useState('en');
  const [acTargetCodeId, setAcTargetCodeId] = useState<ID | ''>('');
  const [acResult, setAcResult] = useState<string | null>(null);

  const [autoCodeQuery, setAutoCodeQuery] = useState('');
  const [autoCodeBoundary, setAutoCodeBoundary] = useState<CaptureBoundary>('exact');
  const [autoCodeLanguage, setAutoCodeLanguage] = useState(AUTO_CODE_LANGUAGES[0].code);
  const [autoCodeTargetCodeId, setAutoCodeTargetCodeId] = useState<ID | ''>('');
  const [autoCodeResultText, setAutoCodeResultText] = useState<string | null>(null);

  const { prompt, modal: promptModal } = useTextPrompt();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(t => (t === msg ? null : t)), 3500);
  }, []);

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
    setProject(prevProj => {
      if (prevProj && prevProj.id === next.id) {
        setPast(p => {
          const updated = [...p, prevProj];
          return updated.length > HISTORY_LIMIT ? updated.slice(updated.length - HISTORY_LIMIT) : updated;
        });
        setFuture([]);
      }
      return next;
    });
    saveToDisk(next).catch(() => {});
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
    setProject(previous);
    saveToDisk(previous).catch(() => {});
  }

  function redo() {
    if (future.length === 0 || !project) return;
    const next = future[0];
    setFuture(f => f.slice(1));
    setPast(p => [...p, project].slice(-HISTORY_LIMIT));
    setProject(next);
    saveToDisk(next).catch(() => {});
  }

  function goToExcerpt(seg: CodedSegment) {
    setTab('workspace');
    setSelectedDocId(seg.docId);
    setPendingSelection(null);
    setGotoTarget({ segId: seg.id, nonce: Date.now() });
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

  const codedCountForDoc = useCallback(
    (docId: ID) => project?.codedSegments.filter(s => s.docId === docId).length || 0,
    [project?.codedSegments]
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

  // =================================================================
  // Project management
  // =================================================================
  async function handleNewProject() {
    const name = await prompt('New project name', 'Untitled Project', 'Create');
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
    const name = await prompt('Rename project', project.name, 'Rename');
    if (!name) return;
    persist({ ...project, name });
  }

function openProjectSettings() {
    if (!project) return;
    setProjectNameDraft(project.name);
    setDeleteStep(0);
    setProjectModalOpen(true);
  }

  function saveProjectName() {
    if (!project) return;
    const trimmed = projectNameDraft.trim();
    if (trimmed) persist({ ...project, name: trimmed });
    setProjectModalOpen(false);
  }

  async function confirmDeleteProject() {
    if (!project) return;
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
    let totalDocs = 0, totalCodes = 0, totalSegs = 0;
    for (const src of sources) {
      const summary = mergeProjectInto(next, src);
      totalDocs += summary.docsAdded;
      totalCodes += summary.codesAdded;
      totalSegs += summary.segmentsAdded;
    }
    persist(next);
    showToast(`Merged ${sources.length} file(s): +${totalDocs} docs, +${totalCodes} codes, +${totalSegs} coded passages.`);
  }

  // =================================================================
  // Folders / documents
  // =================================================================
  async function addRootFolder() {
    if (!project) return;
    const name = await prompt('New root folder', '', 'Create');
    if (!name) return;
    const folder: Folder = { id: uid('folder'), name, parentId: null };
    persist({ ...project, folders: [...project.folders, folder] });
  }

  async function addSubfolder(parentId: ID) {
    if (!project) return;
    const name = await prompt('New subfolder', '', 'Create');
    if (!name) return;
    const folder: Folder = { id: uid('folder'), name, parentId };
    persist({ ...project, folders: [...project.folders, folder] });
  }

  async function renameFolder(folder: Folder) {
    if (!project) return;
    const name = await prompt('Rename folder', folder.name, 'Rename');
    if (!name) return;
    persist({ ...project, folders: project.folders.map(f => (f.id === folder.id ? { ...f, name } : f)) });
  }

  function deleteFolder(folder: Folder) {
    if (!project) return;
    if (!window.confirm(`Delete folder "${folder.name}"? Documents inside will move to the root level.`)) return;
    const folders = project.folders.filter(f => f.id !== folder.id);
    const docs = project.docs.map(d => (d.folderId === folder.id ? { ...d, folderId: null } : d));
    persist({ ...project, folders, docs });
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
    const name = await prompt('Rename document', doc.name, 'Rename');
    if (!name) return;
    persist({ ...project, docs: project.docs.map(d => (d.id === doc.id ? { ...d, name } : d)) });
  }

  function deleteDoc(doc: SourceDoc) {
    if (!project) return;
    if (!window.confirm(`Delete document "${doc.name}"? Its coded passages will also be removed.`)) return;
    const docs = project.docs.filter(d => d.id !== doc.id);
    const codedSegments = project.codedSegments.filter(s => s.docId !== doc.id);
    persist({ ...project, docs, codedSegments });
    if (selectedDocId === doc.id) setSelectedDocId(null);
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
    const name = await prompt('New root code', '', 'Create');
    if (!name) return;
    const code: Code = { 
      id: uid('code'), 
      name, 
      color: randomColor(project.codes.length), 
      parentId: null, 
      summary: '',
      createdAt: Date.now()
    };
    persist({ ...project, codes: [...project.codes, code] });
  }

  async function addSubcode(parentId: ID) {
    if (!project) return;
    const name = await prompt('New subcode', '', 'Create');
    if (!name) return;
    const code: Code = { 
      id: uid('code'), 
      name, 
      color: randomColor(project.codes.length), 
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

  function deleteCode(code: Code) {
    if (!project) return;
    const idsToRemove = descendantCodeIds(project.codes, code.id);
    const label = idsToRemove.size > 1 ? `"${code.name}" and its ${idsToRemove.size - 1} subcode(s)` : `"${code.name}"`;
    if (!window.confirm(`Delete code ${label}? All coded passages using it will also be removed.`)) return;
    const codes = project.codes.filter(c => !idsToRemove.has(c.id));
    const codedSegments = project.codedSegments.filter(s => !idsToRemove.has(s.codeId));
    persist({ ...project, codes, codedSegments });
    if (codebookSelectedCodeId && idsToRemove.has(codebookSelectedCodeId)) setCodebookSelectedCodeId(null);
  }

function moveDoc(docId: ID, targetFolderId: ID | null) {
    if (!project) return;
    const docs = project.docs.map(d =>
      d.id === docId ? { ...d, folderId: targetFolderId } : d
    );
    persist({ ...project, docs });
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
      source: 'manual'
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
    const headers = ['Quote', 'Code', 'Document', 'Note'];
    const rows = starred.map(s => [
      s.text,
      codesById.get(s.codeId)?.name || 'Unknown code',
      project.docs.find(d => d.id === s.docId)?.name || 'Unknown source',
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

    const outline: Array<{ name: string; depth: number; summary?: string; quotes?: string[] }> = [];
    const totalStarred = project!.codedSegments.filter(s => s.starred).length;
    let codesWithSummary = 0;
    let quotesMatched = 0;

    function walk(parentId: ID | null, depth: number) {
      for (const code of childCodes(project!.codes, parentId)) {
        const summary = code.summary?.trim();
        if (summary) {
          codesWithSummary++;
          const starredQuotes = project!.codedSegments
            .filter(s => s.codeId === code.id && s.starred)
            .map(s => {
              const doc = project!.docs.find(d => d.id === s.docId);
              const attribution = [doc?.name || 'Unknown source', s.note].filter(Boolean).join(' — ');
              return `"${s.text}" (${attribution})`;
            });
          quotesMatched += starredQuotes.length;

          outline.push({
            name: code.name,
            depth,
            summary,
            quotes: starredQuotes.length > 0 ? starredQuotes : undefined
          });
        }
        walk(code.id, depth + 1);
      }
    }
    walk(null, 0);

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
    for (const doc of project.docs) {
      const matches = runAutoCode(doc.content, autoCodeQuery, autoCodeBoundary, autoCodeLanguage);
      for (const m of matches) {
        const dup =
          project.codedSegments.some(s => s.docId === doc.id && s.codeId === autoCodeTargetCodeId && s.start === m.start && s.end === m.end) ||
          newSegments.some(s => s.docId === doc.id && s.codeId === autoCodeTargetCodeId && s.start === m.start && s.end === m.end);
        if (dup) continue;

        newSegments.push({
          id: uid('seg'),
          docId: doc.id,
          codeId: autoCodeTargetCodeId,
          start: m.start,
          end: m.end,
          text: m.text,
          createdAt: Date.now(),
          source: 'auto-code'
        });
      }
    }

    if (newSegments.length === 0) {
      setAutoCodeResultText('No new matches found (or every match was already coded).');
      return;
    }

    persist({ ...project, codedSegments: [...project.codedSegments, ...newSegments] });
    setAutoCodeResultText(
      `Applied "${codesById.get(autoCodeTargetCodeId)?.name}" to ${newSegments.length} new passage(s) across ${project.docs.length} document(s).`
    );
  }

  const docSegments = useMemo(
    () => (selectedDoc ? project?.codedSegments.filter(s => s.docId === selectedDoc.id) || [] : []),
    [project?.codedSegments, selectedDoc]
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
      const summary = importQdpx(draft, payload);
      persist(draft);
      if (summary.sourcesSkipped.length > 0) {
        console.log('qdpx import — skipped non-text sources:', summary.sourcesSkipped);
      }
      showToast(
        `Imported ${payload.fileName}: +${summary.codesCreated} codes, +${summary.docsCreated} docs, ` +
        `+${summary.segmentsCreated} coded passages, ${summary.memosImported} memos` +
        (summary.segmentsSkipped ? ` (${summary.segmentsSkipped} selections skipped)` : '') +
        (summary.sourcesSkipped.length ? ` — ${summary.sourcesSkipped.length} non-text source(s) skipped (see console)` : '')
      );
    } catch (e: any) {
      showToast(e.message || String(e));
    }
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
  // Auto-coder
  // =================================================================
  function runAutoCodeJob() {
    if (!project || !acTargetCodeId || !acKeyword.trim()) {
      showToast('Enter a keyword and choose a target code first.');
      return;
    }
    const newSegments: CodedSegment[] = [];
    let docsMatched = 0;
    for (const doc of project.docs) {
      const matches = runAutoCode(doc.content, acKeyword, acBoundary, acLanguage);
      if (matches.length > 0) docsMatched++;
      for (const m of matches) {
        const exists = project.codedSegments.some(
          s => s.docId === doc.id && s.codeId === acTargetCodeId && s.start === m.start && s.end === m.end
        );
        if (!exists) {
          newSegments.push({
            id: uid('seg'),
            docId: doc.id,
            codeId: acTargetCodeId,
            start: m.start,
            end: m.end,
            text: m.text,
            createdAt: Date.now(),
            source: 'auto-code'
          });
        }
      }
    }
    persist({ ...project, codedSegments: [...project.codedSegments, ...newSegments] });
    const msg = `Applied to ${newSegments.length} new segment(s) across ${docsMatched} document(s).`;
    setAcResult(msg);
    showToast(msg);
  }

  // =================================================================
  // Analysis / report
  // =================================================================
  async function handleExportReport() {
    if (!project) return;
    const html = buildReportHtml(project);
    const path = await window.qv.exportReport(project, html);
    if (path) showToast(`Report exported to ${path}`);
  }

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
  const flatCodes = flattenCodes(project.codes);
  const codebookCode = codebookSelectedCodeId ? codesById.get(codebookSelectedCodeId) || null : null;
  const codebookExcerpts = codebookCode
    ? project.codedSegments.filter(s => s.codeId === codebookCode.id)
    : [];

  return (
    <div className="app-shell">
      <header className="app-header" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        width: '100%', 
        alignItems: 'stretch' /* Forces the rows to span the entire screen width */
      }}>
        
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
            {(['workspace', 'codebook', 'autocode', 'analysis', 'about'] as Tab[]).map(t => (
              <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'workspace' && 'Workspace'}
                {t === 'codebook' && 'Codebook'}
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
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          
          <button className="icon-btn" title="New project" onClick={handleNewProject}>➕</button>
          <button className="icon-btn" title="Rename project" onClick={openProjectSettings}>✏️</button>
          <button className="icon-btn" title="Export backup (.json)" onClick={handleExportBackup}>⬇️ Export</button>
          <button className="icon-btn" title="Import backup (.json)" onClick={handleImportBackup}>⬆️ Import</button>
          <button className="icon-btn" title="Merge project(s) into current" onClick={handleMerge}>🔀 Merge</button>
          
          <span className="header-divider" style={{ margin: '0 8px', borderLeft: '1px solid #ccc', height: '20px' }} />
          
          <button className="icon-btn" title="Undo (Ctrl+Z)" disabled={past.length === 0} onClick={undo}>↶ Undo</button>
          <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" disabled={future.length === 0} onClick={redo}>↷ Redo</button>
          <button className="icon-btn" title="Toggle light/dark theme" onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          
          <span className="header-divider" style={{ margin: '0 8px', borderLeft: '1px solid #ccc', height: '20px' }} />
          
          <button className="icon-btn" title="Save now" onClick={manualSave}>💾 Save</button>
          <span className={`save-status save-status-${saveStatus}`} style={{ marginLeft: '8px', fontSize: '0.9em', color: '#666' }}>
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'error' && '⚠ Save failed'}
            {saveStatus === 'idle' && ''}
          </span>
        </div>
        
      </header>

      {tab === 'workspace' && (
        <div className="workspace-grid">
          <aside className="panel left-panel">
            <div className="panel-toolbar">
              <button onClick={addRootFolder}>+ Add Root Folder</button>
              <button onClick={() => addDocs(null)}>+ Doc</button>
              <button onClick={() => addScannedPdf(null)}>+ Scanned PDF (OCR)</button>
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
                        onClick={() => { setSelectedDocId(d.id); setPendingSelection(null); setEditingDocId(null); }}
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
              selectedDocId={selectedDocId}
              sortBy={sortBy}
              codedCount={codedCountForDoc}
              onSelectDoc={d => { setSelectedDocId(d.id); setPendingSelection(null); setEditingDocId(null); }}
              onAddRootFolder={addRootFolder}
              onAddSubfolder={addSubfolder}
              onAddDoc={addDocs}
              onRenameFolder={renameFolder}
              onDeleteFolder={deleteFolder}
              onRenameDoc={renameDoc}
              onDeleteDoc={deleteDoc}
              onMoveDoc={moveDoc}
            />
            )}</aside>

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
                  <div 
                    style={{ flex: 1, overflowY: 'auto', padding: '16px', boxSizing: 'border-box' }}
                    onClick={() => { setHighlightTarget(null); setGotoTarget(null); }}
                  >
                    <DocEditor
                      doc={selectedDoc}
                      segments={project.codedSegments.filter(s => s.docId === selectedDoc.id)}
                      codesById={codesById}
                      onSelectionChange={sel => {
                        setPendingSelection(sel);
                        // Clear navigation targets when user makes a new selection
                        if (sel) {
                          setHighlightTarget(null);
                          setGotoTarget(null);
                        }
                      }}
                      onClickSegment={(segments, x, y) => setSegmentPopup({ segments, x, y })}
                      scrollToSegmentId={gotoTarget?.segId}
                      scrollNonce={gotoTarget?.nonce}
                      highlightRange={highlightTarget?.docId === selectedDoc.id ? { start: highlightTarget.start, end: highlightTarget.end } : null}
                      highlightNonce={highlightTarget?.nonce}
                    />
                  </div>
                )}
                {editingDocId === selectedDoc.id && (
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      value={draftContent}
                      onChange={e => setDraftContent(e.target.value)}
                      style={{ flex: 1, padding: '8px', fontSize: '14px', fontFamily: 'monospace', resize: 'none', boxSizing: 'border-box' }}
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
                      Selected {pendingSelection.text.length} chars — click a code in the legend to apply it
                    </span>
                  )}
                  <button onClick={() => startEditDoc(selectedDoc)}>✏️ Edit text</button>
                  <button onClick={() => setShowDocNotes(v => !v)}>
                    📝 Notes{selectedDoc.notes ? ' ●' : ''}
                  </button>
                  <button onClick={() => handleExportDocDocx(selectedDoc)}>📤 Export as Word (.docx)</button>
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
                    <span style={{ flex: 1 }}>{codesById.get(s.codeId)?.name || 'Unknown code'}</span>
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
        </div>
      )}

      {tab === 'codebook' && (() => {
  // Compute sorted codes based on active sort criterion
  const sortedCodes = [...project.codes].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'coded') {
      const counts: Record<string, number> = {};
      (project.codedSegments || []).forEach(s => {
        counts[s.codeId] = (counts[s.codeId] || 0) + 1;
      });
      return (counts[b.id] || 0) - (counts[a.id] || 0);
    }
    if (sortBy === 'date') {
      return (b.createdAt || 0) - (a.createdAt || 0);
    }
    return 0;
  });

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

        {/* MOVED CODE DETAILS (Only visible when a code is selected) */}
        {codebookCode && (
          <div className="sidebar-group" style={{ borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
              Code Details
            </div>
            
            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Code Name</label>
              <input
                style={{ width: '100%', padding: '6px', fontSize: '12px', boxSizing: 'border-box' }}
                value={codebookCode.name}
                onChange={e => updateCode(codebookCode.id, { name: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Color</label>
              <div className="color-picker" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
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
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Summary / memo</label>
                <button className="mini-btn" style={{ fontSize: '10px', padding: '2px 4px', color: '#eab308' }} onClick={() => pullChildSummaries(codebookCode.id)}>⚡ Pull Child Summaries</button>
              </div>
              <textarea
                style={{ width: '100%', padding: '6px', minHeight: '80px', boxSizing: 'border-box', fontSize: '12px', resize: 'vertical' }}
                value={codebookCode.summary}
                onChange={e => updateCode(codebookCode.id, { summary: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* EXPORT OPTIONS */}
        <div className="sidebar-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
            Export Options
          </div>
          
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
              {/* Force Starred Excerpts into the dropdown toggle */}
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
                  const doc = project.docs.find(d => d.id === seg.docId);
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

    {autoCodeResultText && <div className="autocode-result">{autoCodeResultText}</div>}
  </div>
)}

{tab === 'analysis' && (
  <AnalysisTab project={project} onExportReport={handleExportReport} onSaveCell={updateFrameworkCell} onSaveRelationNote={updateRelationNote} showToast={showToast} />
)}

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

function AnalysisTab({ project, onExportReport, onSaveCell, onSaveRelationNote, showToast }: { project: Project; onExportReport: () => void; onSaveCell: (docId: ID, codeId: ID, text: string) => void; onSaveRelationNote: (codeAId: ID, codeBId: ID, note: string) => void; showToast: (msg: string) => void }) {
  const [subTab, setSubTab] = useState<'frequency' | 'docMatrix' | 'coMatrix' | 'framework'>('frequency');
  const codesByIdLocal = useMemo(() => new Map(project.codes.map(c => [c.id, c])), [project.codes]);

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
        <button onClick={onExportReport}>⬇️ HTML Report</button>
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
    </div>
  );
}