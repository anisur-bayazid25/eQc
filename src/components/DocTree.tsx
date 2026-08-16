import React, { useState } from 'react';
import { Folder, SourceDoc, ImageSource, ID } from '../domain';
import type { LanCoder } from '../global';

export type SortKey = 'name' | 'date' | 'size' | 'coded';

interface Props {
  folders: Folder[];
  docs: SourceDoc[];
  images?: ImageSource[];
  selectedDocId: ID | null;
  selectedImageId?: ID | null;
  sortBy: SortKey;
  codedCount: (docId: ID) => number;
  codedRegionCount: (imageId: ID) => number;
  onSelectDoc: (doc: SourceDoc) => void;
  onSelectImage?: (image: ImageSource) => void;
  onAddRootFolder: () => void;
  onAddSubfolder: (parentId: ID) => void;
  onAddDoc: (folderId: ID | null) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onRenameDoc: (doc: SourceDoc) => void;
  onDeleteDoc: (doc: SourceDoc) => void;
  onRenameImage: (image: ImageSource) => void;
  onDeleteImage: (id: ID) => void;
  onMoveDoc: (docId: ID, targetFolderId: ID | null) => void;
  onMoveImage: (imageId: ID, targetFolderId: ID | null) => void;
  onDropFiles: (files: FileList, folderId: ID | null) => void;
  // Live LAN presence: coders whose activeDocId matches a row get a colored
  // dot; the viewer's own name is excluded so the dots always mean "other
  // people are looking at this".
  lanCoders?: LanCoder[];
  lanMyName?: string;
}

function sortDocs(docs: SourceDoc[], sortBy: SortKey, codedCount: (id: ID) => number): SourceDoc[] {
  const copy = [...docs];
  switch (sortBy) {
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'date':
      return copy.sort((a, b) => b.addedAt - a.addedAt);
    case 'size':
      return copy.sort((a, b) => b.sizeBytes - a.sizeBytes);
    case 'coded':
      return copy.sort((a, b) => codedCount(b.id) - codedCount(a.id));
  }
}

// One stable dot color per coder name, cycled deterministically so the
// same person is always the same color in every session.
const PRESENCE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];

function presenceColor(coderName: string): string {
  let h = 0;
  for (let i = 0; i < coderName.length; i++) h = (h * 31 + coderName.charCodeAt(i)) >>> 0;
  return PRESENCE_COLORS[h % PRESENCE_COLORS.length];
}

// Which other coders are currently viewing this document/image.
function viewersFor(list: LanCoder[] | undefined, itemId: string | null, selfName: string | undefined): string[] {
  if (!list || !itemId) return [];
  return list
    .filter(c => c.activeDocId === itemId && c.coderName !== selfName)
    .map(c => c.coderName);
}

function PresenceDots({ itemId, list, selfName }: { itemId: string; list?: LanCoder[]; selfName?: string }) {
  const viewers = viewersFor(list, itemId, selfName);
  if (viewers.length === 0) return null;
  return (
    <span className="presence-dots" title={`Viewing: ${viewers.join(', ')}`}>
      {viewers.map(n => (
        <i key={n} className="presence-dot" style={{ background: presenceColor(n) }} />
      ))}
    </span>
  );
}

function FolderNode(props: Props & { folder: Folder; depth: number }) {
  const { folder, depth } = props;
  const [expanded, setExpanded] = useState(true);
  const [hover, setHover] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const childFolders = props.folders.filter(f => f.parentId === folder.id);
  const childDocs = sortDocs(props.docs.filter(d => d.folderId === folder.id), props.sortBy, props.codedCount);
  const childImages = (props.images || []).filter(img => img.folderId === folder.id);

  return (
    <div>
      <div
        className="folder-row"
        style={{ 
          paddingLeft: depth * 14 + 4,
          backgroundColor: isDragOver ? "rgba(0, 120, 255, 0.2)" : undefined,
          border: isDragOver ? "1px dashed #0078ff" : "1px solid transparent"
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onDragOver={(e) => {
          e.preventDefault(); // Necessary to allow dropping
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation(); // Stop it from bubbling up to the root container
          setIsDragOver(false);
          
          // 1. Check if the user dropped external files from their OS
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            props.onDropFiles(e.dataTransfer.files, folder.id);
            return; // Exit early so we don't try to move an internal doc
          }

          // 2. Otherwise, handle the internal document/image move like normal
          const payload = e.dataTransfer.getData('text/plain');
          if (payload) {
            const imagePrefix = 'image:';
            if (payload.startsWith(imagePrefix)) {
              props.onMoveImage(payload.slice(imagePrefix.length), folder.id);
            } else if (payload) {
              props.onMoveDoc(payload, folder.id);
            }
          }
        }}
      >
        <span className="tree-arrow" onClick={() => setExpanded(v => !v)}>
          {expanded ? '▾' : '▸'}
        </span>
        <span className="folder-icon">📁</span>
        <span className="folder-name">{folder.name}</span>
        {hover && (
          <span className="row-actions">
            <button className="mini-btn" title="Add subfolder" onClick={() => props.onAddSubfolder(folder.id)}>
              +📁
            </button>
            <button className="mini-btn" title="Add document" onClick={() => props.onAddDoc(folder.id)}>
              +📄
            </button>
            <button className="mini-btn" title="Rename" onClick={() => props.onRenameFolder(folder)}>
              ✏️
            </button>
            <button className="mini-btn" title="Delete" onClick={() => props.onDeleteFolder(folder)}>
              🗑
            </button>
          </span>
        )}
      </div>
      {expanded && (
        <div>
          {childFolders.map(f => (
            <FolderNode key={f.id} {...props} folder={f} depth={depth + 1} />
          ))}
          {childDocs.map(doc => (
            <DocRow key={doc.id} {...props} doc={doc} depth={depth + 1} />
          ))}
          {childImages.map(img => (
            <ImageRow key={img.id} {...props} image={img} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocRow(props: Props & { doc: SourceDoc; depth: number }) {
  const { doc, depth } = props;
  const [hover, setHover] = useState(false);
  const coded = props.codedCount(doc.id);
  const viewers = viewersFor(props.lanCoders, doc.id, props.lanMyName);
  
  return (
    <div
      className={`doc-row ${props.selectedDocId === doc.id ? 'selected' : ''}`}
      style={{ paddingLeft: depth * 14 + 4, cursor: 'grab' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => props.onSelectDoc(doc)}
      draggable={true}
      onDragStart={(e) => {
        // Store the doc ID in the drag event so the drop target knows what is being moved
        e.dataTransfer.setData('text/plain', doc.id);
      }}
    >
      <span className="tree-arrow spacer" />
      <span className="doc-icon">📄</span>
      <span className="doc-name">{doc.name}</span>
      {coded > 0 && <span className="doc-coded-badge">{coded}</span>}
      {<PresenceDots itemId={doc.id} list={props.lanCoders} selfName={props.lanMyName} />}
      {hover && (
        <span className="row-actions">
          <button
            className="mini-btn"
            title="Rename"
            onClick={e => {
              e.stopPropagation();
              props.onRenameDoc(doc);
            }}
          >
            ✏️
          </button>
          <button
            className="mini-btn"
            title="Delete"
            onClick={e => {
              e.stopPropagation();
              props.onDeleteDoc(doc);
            }}
          >
            🗑
          </button>
        </span>
      )}
    </div>
  );
}

function ImageRow(props: Props & { image: ImageSource; depth: number }) {
  const { image, depth } = props;
  const [hover, setHover] = useState(false);
  const isSelected = props.selectedImageId === image.id;
  const codedRegions = props.codedRegionCount(image.id);

  return (
    <div
      className={`doc-row ${isSelected ? 'selected' : ''}`}
      style={{ paddingLeft: depth * 14 + 4, cursor: 'grab' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => props.onSelectImage && props.onSelectImage(image)}
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', `image:${image.id}`);
      }}
    >
      <span className="tree-arrow spacer" />
      <span className="doc-icon">🖼️</span>
      <span className="doc-name">{image.name}</span>
      {codedRegions > 0 && <span className="doc-coded-badge">{codedRegions}</span>}
      {<PresenceDots itemId={image.id} list={props.lanCoders} selfName={props.lanMyName} />}
      {hover && (
        <span className="row-actions">
          <button
            className="mini-btn"
            title="Rename Image"
            onClick={e => {
              e.stopPropagation();
              props.onRenameImage(image);
            }}
          >
            ✏️
          </button>
          <button
            className="mini-btn"
            title="Delete Image"
            onClick={e => {
              e.stopPropagation();
              props.onDeleteImage(image.id);
            }}
          >
            🗑
          </button>
        </span>
      )}
    </div>
  );
}

export default function DocTree(props: Props) {
  const rootFolders = props.folders.filter(f => f.parentId === null);
  const rootDocs = sortDocs(props.docs.filter(d => d.folderId === null), props.sortBy, props.codedCount);
  const rootImages = (props.images || []).filter(img => !img.folderId);

  return (
    <div 
      className="doc-tree"
      style={{ minHeight: '100px', paddingBottom: '40px' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          props.onDropFiles(e.dataTransfer.files, null);
          return;
        }
        const payload = e.dataTransfer.getData('text/plain');
        // Dropping into the main tree area moves it to the root (null)
        if (payload) {
          const imagePrefix = 'image:';
          if (payload.startsWith(imagePrefix)) {
            props.onMoveImage(payload.slice(imagePrefix.length), null);
          } else {
            props.onMoveDoc(payload, null);
          }
        }
      }}
    >
      {rootFolders.map(f => (
        <FolderNode key={f.id} {...props} folder={f} depth={0} />
      ))}
      {rootDocs.map(doc => (
        <DocRow key={doc.id} {...props} doc={doc} depth={0} />
      ))}
      {rootImages.map(img => (
        <ImageRow key={img.id} {...props} image={img} depth={0} />
      ))}
      {rootFolders.length === 0 && rootDocs.length === 0 && rootImages.length === 0 && (
        <div className="empty-hint">No documents yet. Use “+ Root Folder” or “+ Doc” to add sources.</div>
      )}
    </div>
  );
}