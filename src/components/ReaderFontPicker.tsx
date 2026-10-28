import React, { useEffect, useMemo, useRef, useState } from 'react';

const KEY = 'eqc-preferred-reader-fonts';
const MAX_SAVED = 12;

// Fallback list used only when the browser cannot enumerate installed fonts
// (older runtime, or the Local Font Access permission is refused).
const standard: Array<[string, string]> = [
  ['Segoe UI', 'Segoe UI, Arial, sans-serif'],
  ['Cambria', "Cambria, Georgia, 'Times New Roman', serif"],
  ['Caladea', "'Caladea', Cambria, Georgia, serif"],
  ['Georgia', 'Georgia, serif'],
  ['Times New Roman', "'Times New Roman', serif"],
  ['Arial', 'Arial, sans-serif'],
  ['Verdana', 'Verdana, sans-serif'],
  ['Calibri', 'Calibri, sans-serif'],
  ['Courier New', "'Courier New', monospace"],
  ['Kalpurush', "'Kalpurush', 'SolaimanLipi', 'Nirmala UI', 'Segoe UI', sans-serif"],
  ['SolaimanLipi', "'SolaimanLipi', 'Kalpurush', 'Nirmala UI', 'Segoe UI', sans-serif"],
  ['Siyam Rupali', "'Siyam Rupali', 'Kalpurush', 'SolaimanLipi', 'Nirmala UI', sans-serif"],
  ['Nikosh', "'Nikosh', 'Kalpurush', 'SolaimanLipi', 'Nirmala UI', sans-serif"],
];

/** CSS font stack for one installed family name. */
export const fontStack = (name: string) => `"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}", sans-serif`;

/** The family name stored inside a CSS stack, e.g. `"Bookman Old Style", sans-serif`. */
export function familyNameOf(value: string): string {
  const first = (value || '').split(',')[0].trim();
  return first.replace(/^["']|["']$/g, '').trim();
}

function readSaved(): string[] {
  try {
    const names = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string' && n.length > 0 && n.length <= 80).slice(0, 50) : [];
  } catch {
    return [];
  }
}

type FontWindow = Window & { queryLocalFonts?: () => Promise<Array<{ family: string; fullName?: string }>> };

// Only a successful list is cached: queryLocalFonts() rejects with "Page needs
// to be visible" while the window is hidden or occluded (for example during
// startup), and caching that failure previously left the list empty for the
// rest of the session.
let installedCache: string[] | null = null;

async function installedFamilies(): Promise<{ families: string[]; error: string }> {
  if (installedCache) return { families: installedCache, error: '' };
  const api = (window as FontWindow).queryLocalFonts;
  if (typeof api !== 'function') {
    return { families: [], error: 'This runtime cannot list installed fonts. Type a family name instead.' };
  }
  if (document.visibilityState !== 'visible') {
    return { families: [], error: 'The font list is read while the window is visible. Open this menu again after the window is showing.' };
  }
  try {
    const fonts = await api();
    installedCache = Array.from(new Set(fonts.map(font => font.family).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return { families: installedCache, error: '' };
  } catch (error) {
    const message = String((error as Error)?.message || error);
    return { families: [], error: `Installed fonts could not be listed (${message}). Type a family name instead.` };
  }
}

// Width probe: if naming this family does not change the measured text, the
// family is not installed and the browser is substituting a fallback. This is
// what keeps the "not installed" warning honest when the font list itself is
// unavailable.
export function fontAvailable(family: string): boolean {
  if (!family.trim()) return false;
  try {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return true;
    const sample = 'mmmmmmmmmmlli1WW@';
    const quoted = `"${family.replace(/"/g, '')}"`;
    return ['monospace', 'serif', 'sans-serif'].some(base => {
      context.font = `72px ${base}`;
      const fallbackWidth = context.measureText(sample).width;
      context.font = `72px ${quoted}, ${base}`;
      const namedWidth = context.measureText(sample).width;
      return Math.abs(namedWidth - fallbackWidth) > 0.5;
    });
  } catch {
    return true;
  }
}

const normalise = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Closest installed families for a name that is not installed. */
export function suggestFamilies(name: string, families: string[], limit = 3): string[] {
  const target = normalise(name);
  if (!target) return [];
  const tokens = target.split(' ').filter(Boolean);
  return families
    .map(family => {
      const candidate = normalise(family);
      let score = 0;
      if (candidate === target) score = 100;
      else if (candidate.startsWith(target) || target.startsWith(candidate)) score = 80;
      else if (candidate.includes(target) || target.includes(candidate)) score = 60;
      else score = tokens.reduce((sum, token) => sum + (candidate.includes(token) ? 15 : 0), 0);
      return { family, score };
    })
    .filter(entry => entry.score >= 30)
    .sort((a, b) => b.score - a.score || a.family.localeCompare(b.family))
    .slice(0, limit)
    .map(entry => entry.family);
}

export default function ReaderFontPicker({ value, onChange, context = 'coding text view', compact = false }: {
  value: string;
  onChange: (font: string) => void;
  context?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<string[]>(readSaved);
  const [installed, setInstalled] = useState<{ families: string[]; error: string } | null>(null);
  const [manual, setManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [error, setError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const current = familyNameOf(value);
  const isDefault = !value;
  const standardEntry = standard.find(([, stack]) => stack === value);

  // Load the installed list when the picker appears, and retry once the window
  // becomes visible: the browser refuses to enumerate fonts while it is hidden.
  useEffect(() => {
    if (installed && !installed.error) return;
    let cancelled = false;
    installedFamilies().then(result => { if (!cancelled) setInstalled(result); });
    return () => { cancelled = true; };
  }, [installed]);

  useEffect(() => {
    if (!installed?.error) return;
    const retry = () => {
      if (document.visibilityState !== 'visible') return;
      installedFamilies().then(result => { if (!result.error) setInstalled(result); });
    };
    // Retry as soon as the user opens the list, when the window is shown again,
    // and once shortly after a startup failure.
    if (open) retry();
    document.addEventListener('visibilitychange', retry);
    const timer = window.setTimeout(retry, 4000);
    return () => { document.removeEventListener('visibilitychange', retry); window.clearTimeout(timer); };
  }, [installed, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const families = installed?.families || [];
  const lookup = useMemo(() => new Map(families.map(family => [family.toLowerCase(), family])), [families]);
  const listUnavailable = !!installed?.error;

  // A saved name that is not installed renders as an unpredictable fallback,
  // which looks like the font "did not change". Only claim that when it can be
  // checked: either the family is absent from a loaded list, or naming it in
  // CSS does not change the measured text.
  const resolved = useMemo(() => {
    if (!value) return { state: 'default' as const, name: '' };
    if (standardEntry) return { state: 'standard' as const, name: standardEntry[0] };
    const exact = lookup.get(current.toLowerCase());
    if (exact) return { state: 'installed' as const, name: exact };
    if (!installed) return { state: 'unknown' as const, name: current };
    if (listUnavailable) return fontAvailable(current)
      ? { state: 'installed' as const, name: current }
      : { state: 'missing' as const, name: current };
    return { state: 'missing' as const, name: current };
  }, [value, standardEntry, lookup, current, installed, listUnavailable]);

  const suggestionPool = families.length ? families : standard.map(([name]) => name);
  const suggestions = useMemo(
    () => (resolved.state === 'missing' ? suggestFamilies(current, suggestionPool) : []),
    [resolved.state, current, suggestionPool]
  );

  function persist(next: string[]) {
    try {
      localStorage.setItem(KEY, JSON.stringify(next.slice(0, 50)));
      setSaved(next);
      return true;
    } catch {
      setError('Your font preference could not be saved.');
      return false;
    }
  }

  function apply(name: string) {
    const next = name.trim();
    if (!next) {
      onChange('');
    } else {
      onChange(fontStack(next));
      // Keep used fonts in "My fonts", newest first, without duplicates.
      persist([next, ...saved.filter(savedName => savedName.toLowerCase() !== next.toLowerCase())].slice(0, MAX_SAVED));
    }
    setError('');
    setOpen(false);
    setQuery('');
    // Close the enclosing Reading menu so the text underneath is immediately
    // readable and selectable for coding.
    rootRef.current?.closest('details')?.removeAttribute('open');
  }

  function addManual() {
    const name = manualName.trim();
    if (!name) return;
    const exact = lookup.get(name.toLowerCase());
    // Reject a name that no family answers to, instead of storing it and
    // letting the browser substitute something else silently.
    if (!exact && !fontAvailable(name)) {
      setError(`“${name}” is not installed on this computer. Check the spelling — for example “Bookman Old Style”, not “Bookman Old”.`);
      return;
    }
    apply(exact || name);
    setManualName('');
    setManual(false);
  }

  const list = useMemo(() => {
    const needle = normalise(query);
    const base = needle
      ? families.filter(family => normalise(family).includes(needle))
      : saved.length
        ? [...saved.filter(name => lookup.has(name.toLowerCase())), ...families.filter(family => !saved.some(name => name.toLowerCase() === family.toLowerCase()))]
        : families;
    const seen = new Set<string>();
    return base.filter(family => { const key = family.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 80);
  }, [families, saved, query, lookup]);

  const currentLabel = isDefault ? 'Default font' : resolved.state === 'standard' ? standardEntry![0] : current;
  const sampleStyle = { fontFamily: isDefault ? undefined : value };

  return (
    <div className={`reader-font-picker${compact ? ' compact-font-picker' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="reader-font-current"
        aria-expanded={open}
        aria-label={`Reading font: ${currentLabel}. Choose a font`}
        title={isDefault ? 'Choose a reading font' : `${currentLabel} — choose a different font`}
        onClick={() => { setOpen(v => !v); setError(''); }}
      >
        <span className="reader-font-current-label">{currentLabel}</span>
        <span className="reader-font-current-sample" style={sampleStyle} aria-hidden="true">Aa</span>
      </button>

      {!compact && resolved.state === 'missing' && !open && (
        <p className="reader-font-warning" role="status">
          “{current}” is not installed, so the reader is showing a substitute.
          {suggestions[0]
            ? <> Use <button type="button" className="reader-font-fix" onClick={() => apply(suggestions[0])}>{suggestions[0]}</button> instead?</>
            : <> Open the font list to choose an installed family.</>}
        </p>
      )}

      {open && (
        <div className={`reader-font-panel${compact ? ' compact' : ''}`}>
          <input
            className="reader-font-search"
            autoFocus
            type="search"
            value={query}
            placeholder="Search installed fonts…"
            aria-label="Search installed fonts"
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && list[0]) { event.preventDefault(); apply(list[0]); }
            }}
          />

          {resolved.state === 'missing' && (
            <div className="reader-font-hint" role="alert">
              “{current}” is not installed. Pick a real family below
              {suggestions.length ? <> — closest: {suggestions.map(name => (
                <button type="button" key={name} className="reader-font-fix" onClick={() => apply(name)}>{name}</button>
              ))}</> : ''}.
            </div>
          )}

          <div className="reader-font-list" role="listbox" aria-label="Installed fonts">
            <button type="button" role="option" aria-selected={isDefault} className={isDefault ? 'selected' : ''} onClick={() => apply('')}>
              <span className="reader-font-row-name">Default font</span>
              <span className="reader-font-row-note">use the app font</span>
            </button>

            {!installed && <p className="reader-font-row-note" role="status">Reading installed fonts…</p>}
            {installed?.error && (
              <div className="reader-font-unavailable">
                <p className="reader-font-row-note">{installed.error}</p>
                <button type="button" className="reader-font-fix" onClick={() => setInstalled(null)}>Try again</button>
              </div>
            )}

            {list.map(family => (
              <button
                type="button"
                role="option"
                key={family}
                aria-selected={current.toLowerCase() === family.toLowerCase()}
                className={current.toLowerCase() === family.toLowerCase() ? 'selected' : ''}
                onClick={() => apply(family)}
                title={`Use ${family}`}
              >
                <span className="reader-font-row-name">{family}</span>
                <span className="reader-font-row-sample" style={{ fontFamily: fontStack(family) }} aria-hidden="true">Aa Bb 123</span>
              </button>
            ))}
            {installed && !installed.error && list.length === 0 && (
              <p className="reader-font-row-note">No installed font matches “{query}”.</p>
            )}
          </div>

          <div className="reader-font-foot">
            {manual ? (
              <>
                <label className="reader-font-manual">
                  Font family name
                  <input
                    autoFocus
                    maxLength={80}
                    value={manualName}
                    placeholder="e.g. Bookman Old Style"
                    onChange={event => setManualName(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addManual(); } }}
                  />
                </label>
                <div className="reader-font-actions">
                  <button type="button" onClick={addManual} disabled={!manualName.trim()}>Use font</button>
                  <button type="button" onClick={() => { setManual(false); setManualName(''); }}>Cancel</button>
                </div>
              </>
            ) : (
              <div className="reader-font-actions">
                {current && !isDefault && (
                  <button type="button" onClick={() => apply('')}>Clear font</button>
                )}
                <button type="button" onClick={() => { setManual(true); setManualName(current); }}>Type a name…</button>
              </div>
            )}
            <p className="reader-font-row-note">Fonts come from your operating system; install new ones there first. This changes the {context}.</p>
            {error && <p role="alert">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
