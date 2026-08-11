import React, { useState } from 'react';
import { Folder, SourceDoc, ImageSource, ID } from '../domain';

export type SortKey = 'name' | 'date' | 'size' | 'coded';

interface Props {
  folders: Folder[];
  docs: SourceDoc[];
  images?: ImageSource[];
  selectedDocId: ID | null;
  selectedImageId?: ID | null;
  sortBy: SortKey;
  codedCount: (docId: ID) => number;
  onSelectDoc: (doc: SourceDoc) => void;
  onSelectImage?: (image: ImageSource) => void;
  onAddRootFolder: () => void;
  onAddSubfolder: (parentId: ID) => void;
  onAddDoc: (folderId: ID | null) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onRenameDoc: (doc: SourceDoc) => void;
  onDeleteDoc: (doc: SourceDoc) => void;
  onDeleteImage: (id: ID) => void;
  onMoveDoc: (docId: ID, targetFolderId: ID | null) => void;
  onDropFiles: (files: FileList, folderId: ID | null) => void;
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

          // 2. Otherwise, handle the internal document move like normal
          const docId = e.dataTransfer.getData('text/plain');
          if (docId) props.onMoveDoc(docId, folder.id);
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

  return (
    <div
      className={`doc-row ${isSelected ? 'selected' : ''}`}
      style={{ paddingLeft: depth * 14 + 4, cursor: 'pointer' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => props.onSelectImage && props.onSelectImage(image)}
    >
      <span className="tree-arrow spacer" />
      <span className="doc-icon">🖼️</span>
      <span className="doc-name">{image.name}</span>
      {hover && (
        <span className="row-actions">
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
        const docId = e.dataTransfer.getData('text/plain');
        // Dropping into the main tree area moves it to the root (null)
        if (docId) props.onMoveDoc(docId, null);
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