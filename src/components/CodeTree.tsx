import React, { useState } from 'react';
import { Code, childCodes, ID } from '../domain';

interface Props {
  codes: Code[];
  selectedCodeId: ID | null;
  onSelectCode: (code: Code) => void;
  onAddSubcode: (parentId: ID) => void;
  onDeleteCode?: (code: Code) => void;
  applyHint?: boolean; 
  onMoveCode?: (codeId: ID, targetParentId: ID | null) => void;
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
  onMoveCode
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
}) {
  const [expanded, setExpanded] = useState(true);
  const children = childCodes(codes, code.id);
  const [hover, setHover] = useState(false);

  const eligibleParents = codes.filter(c => c.id !== code.id);

  return (
    <div>
      <div
        className={`code-row ${selectedCodeId === code.id ? 'selected' : ''} ${applyHint ? 'apply-hint' : ''}`}
        style={{ 
          paddingLeft: depth * 16 + 6,
          display: 'flex',          // Enables flex layout
          alignItems: 'center',     // Vertically aligns items
          width: '100%',            // Full container width
          gap: '6px'               // Consistent spacing between items
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => onSelectCode(code)}
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
                  width: '28px',         // Strictly locks width to icon size
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
                <option value="" disabled>↱</option>
                <option value="root" style={{ background: '#ffffff', color: '#000000' }}>
                  [Root Level]
                </option>
                {eligibleParents.map(p => (
                  <option key={p.id} value={p.id} style={{ background: '#ffffff', color: '#000000' }}>
                    ↳ {p.name}
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
  onMoveCode 
}: Props) {
  const roots = childCodes(codes, null);
  
  if (roots.length === 0) {
    return <div className="empty-hint">No codes yet. Use “+ Root Code” to start your codebook.</div>;
  }
  
  return (
    <div className="code-tree">
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
        />
      ))}
    </div>
  );
}