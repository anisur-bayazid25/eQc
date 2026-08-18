import React, { useState } from 'react';
import { Code, childCodes, descendantCodeIds, ID } from '../domain';

interface Props {
  codes: Code[];
  selectedCodeId: ID | null;
  onSelectCode: (code: Code) => void;
  onAddSubcode: (parentId: ID) => void;
  onDeleteCode?: (code: Code) => void;
  applyHint?: boolean;
  onMoveCode?: (codeId: ID, targetParentId: ID | null) => void;
  onReorderCode?: (
    codeId: ID,
    newParentId: ID | null,
    newSortIndex: number,
    siblingUpdates: Array<{ id: ID; sortIndex: number }>
  ) => void;
  onCopyChildCodings?: (codeId: ID) => void;
}

function CodeNode({
  code,
  codes,
  depth,
  selectedCodeId,
  onSelectCode,
  onAddSubcode,
  onDeleteCode,
  applyHint,
  onMoveCode,
  onReorderCode,
  onCopyChildCodings
}: {
  code: Code;
  codes: Code[];
  depth: number;
  selectedCodeId: ID | null;
  onSelectCode: (code: Code) => void;
  onAddSubcode: (parentId: ID) => void;
  onDeleteCode?: (code: Code) => void;
  applyHint?: boolean;
  onMoveCode?: (codeId: ID, targetParentId: ID | null) => void;
  onReorderCode?: (
    codeId: ID,
    newParentId: ID | null,
    newSortIndex: number,
    siblingUpdates: Array<{ id: ID; sortIndex: number }>
  ) => void;
  onCopyChildCodings?: (codeId: ID) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = childCodes(codes, code.id);
  const [hover, setHover] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const eligibleParents = codes.filter(c => c.id !== code.id);

  // Dragging `draggedId` onto this row: if both share the same parent,
  // reorder so the dragged code lands immediately before this row; otherwise
  // reparent it, appended at the end of this row's sibling list.
  function handleDrop(e: React.DragEvent, target: Code) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!onReorderCode) return;
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === target.id) return;
    const dragged = codes.find(c => c.id === draggedId);
    if (!dragged) return;
    if (descendantCodeIds(codes, draggedId).has(target.id)) return; // cannot drop into its own subtree

    const siblings = childCodes(codes, target.parentId).filter(s => s.id !== draggedId);
    const newOrder = siblings.flatMap(s => (s.id === target.id ? [draggedId, s.id] : [s.id]));
    const siblingUpdates = newOrder.map((id, i) => ({ id, sortIndex: i }));
    onReorderCode(draggedId, target.parentId, newOrder.indexOf(draggedId), siblingUpdates);
  }

  return (
    <div>
      <div
        className={`code-row ${selectedCodeId === code.id ? 'selected' : ''} ${applyHint ? 'apply-hint' : ''}`}
        style={{
          paddingLeft: depth * 16 + 6,
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          gap: '6px',
          cursor: 'grab',
          backgroundColor: isDragOver ? 'rgba(0, 120, 255, 0.2)' : undefined,
          border: isDragOver ? '1px dashed #0078ff' : '1px solid transparent'
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => onSelectCode(code)}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', code.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => handleDrop(e, code)}
        title={applyHint ? 'Click to apply this code to the current selection' : code.name}
      >
        {children.length > 0 ? (
          <span
            className="tree-arrow"
            style={{ flexShrink: 0 }}
            onClick={e => {
              e.stopPropagation();
              setExpanded(v => !v);
            }}
          >
            {expanded ? '\u25be' : '\u25b8'}
          </span>
        ) : (
          <span className="tree-arrow spacer" style={{ flexShrink: 0 }} />
        )}

        <span className="code-swatch" style={{ background: code.color, flexShrink: 0 }} />

        {/* Code Name fills all remaining space in the middle */}
        <span
          className="code-name"
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {code.name}
        </span>

        {hover && (
          /* Actions wrapper pinned tightly to the right edge */
          <span className="row-actions" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: 'auto', flexShrink: 0 }}>
            <button
              className="mini-btn"
              title="Add subcode"
              onClick={e => {
                e.stopPropagation();
                onAddSubcode(code.id);
              }}
            >
              +
            </button>
            {onCopyChildCodings && children.length > 0 && (
              <button
                className="mini-btn"
                title="Copy subcodes' coded segments and regions into this code"
                onClick={e => { e.stopPropagation(); onCopyChildCodings(code.id); }}
              >
                ⚡
              </button>
            )}
            {onDeleteCode && (
              <button
                className="mini-btn"
                title="Delete code"
                onClick={e => {
                  e.stopPropagation();
                  onDeleteCode(code);
                }}
              >
                Del
              </button>
            )}

            {onMoveCode && (
              <select
                className="mini-btn"
                style={{
                  cursor: 'pointer',
                  backgroundColor: '#f1f5f9',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '0',
                  width: '28px',
                  height: '22px',
                  textAlign: 'center',
                  outline: 'none',
                  flexShrink: 0
                }}
                title="Move code"
                value=""
                onClick={e => e.stopPropagation()}
                onChange={e => {
                  const val = e.target.value;
                  if (val) {
                    onMoveCode(code.id, val === 'root' ? null : val);
                  }
                }}
              >
                <option value="" disabled>{'\u21B3 '}</option>
                <option value="root" style={{ background: '#ffffff', color: '#000000' }}>
                  [Root Level]
                </option>
                {eligibleParents.map(p => (
                  <option key={p.id} value={p.id} style={{ background: '#ffffff', color: '#000000' }}>
                    {'\u21B3 '}{p.name}
                  </option>
                ))}
              </select>
            )}
          </span>
        )}
      </div>

      {expanded &&
        children.map(child => (
          <CodeNode
            key={child.id}
            code={child}
            codes={codes}
            depth={depth + 1}
            selectedCodeId={selectedCodeId}
            onSelectCode={onSelectCode}
            onAddSubcode={onAddSubcode}
            onDeleteCode={onDeleteCode}
            applyHint={applyHint}
            onMoveCode={onMoveCode}
            onReorderCode={onReorderCode}
            onCopyChildCodings={onCopyChildCodings}
          />
        ))}
    </div>
  );
}

export default function CodeTree({
  codes,
  selectedCodeId,
  onSelectCode,
  onAddSubcode,
  onDeleteCode,
  applyHint,
  onMoveCode,
  onReorderCode,
  onCopyChildCodings
}: Props) {
  const roots = childCodes(codes, null);

  // Dropping into the empty area below/beside the tree moves the code to the
  // root level, appended at the end.
  function handleContainerDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!onReorderCode) return;
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId) return;
    const rootIds = roots.filter(r => r.id !== draggedId).map(r => r.id);
    const siblingUpdates = rootIds.map((id, i) => ({ id, sortIndex: i }));
    onReorderCode(draggedId, null, rootIds.length, siblingUpdates);
  }

  if (roots.length === 0) {
    return <div className="empty-hint">No codes yet. Use "+ Root Code" to start your codebook.</div>;
  }

  return (
    <div
      className="code-tree"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleContainerDrop}
    >
      {roots.map(code => (
        <CodeNode
          key={code.id}
          code={code}
          codes={codes}
          depth={0}
          selectedCodeId={selectedCodeId}
          onSelectCode={onSelectCode}
          onAddSubcode={onAddSubcode}
          onDeleteCode={onDeleteCode}
          applyHint={applyHint}
          onMoveCode={onMoveCode}
          onReorderCode={onReorderCode}
          onCopyChildCodings={onCopyChildCodings}
        />
      ))}
    </div>
  );
}

