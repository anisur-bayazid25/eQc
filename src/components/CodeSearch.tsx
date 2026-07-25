import React, { useMemo, useRef } from 'react';
import { Code, codeAncestorPath, ID } from '../domain';

interface Props {
  codes: Code[];
  query: string;
  onQueryChange: (q: string) => void;
  onSelectCode: (code: Code) => void;
  placeholder?: string;
  applyHint?: boolean; // shown when a text selection is pending, to hint "press Enter / click to apply"
}

export default function CodeSearch({ codes, query, onQueryChange, onSelectCode, placeholder, applyHint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return codes
      .filter(c => c.name.toLowerCase().includes(q))
      .map(c => ({ code: c, path: codeAncestorPath(codes, c) }))
      .sort((a, b) => a.code.name.localeCompare(b.code.name));
  }, [codes, query]);

  const handleSelect = (code: Code) => {
    onSelectCode(code);
    // Keep focus in the box so the person can immediately search/apply the
    // next code without reaching for the mouse.
    inputRef.current?.focus();
  };

  return (
    <div className="code-search">
      <input
        ref={inputRef}
        type="text"
        className="code-search-input"
        placeholder={placeholder || 'Search codes…'}
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && results.length > 0) {
            handleSelect(results[0].code);
          } else if (e.key === 'Escape') {
            onQueryChange('');
          }
        }}
      />
      {query.trim() && (
        <div className="code-search-results">
          {results.length > 0 ? (
            results.map(r => (
              <div
                key={r.code.id}
                className={`code-search-row ${applyHint ? 'apply-hint' : ''}`}
                onClick={() => handleSelect(r.code)}
                title={applyHint ? 'Click to apply this code to the current selection' : r.code.name}
              >
                <span className="code-swatch" style={{ background: r.code.color }} />
                {r.path.length > 0 && <span className="code-search-path">{r.path.join(' › ')} ›</span>}
                <span className="code-search-name">{r.code.name}</span>
              </div>
            ))
          ) : (
            <div className="empty-hint">No codes match “{query}”</div>
          )}
        </div>
      )}
    </div>
  );
}
