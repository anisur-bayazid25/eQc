import React, { useEffect, useState } from 'react';

export default function ReaderFontSize({ value, onChange }: {
  value: number;
  onChange: (size: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const parsed = Number(draft);
    const next = draft.trim() && Number.isFinite(parsed)
      ? Math.max(8, Math.min(48, Math.round(parsed)))
      : value;
    setDraft(String(next));
    onChange(next);
  };
  const step = (amount: number) => {
    const next = Math.max(8, Math.min(48, value + amount));
    setDraft(String(next));
    onChange(next);
  };

  return <div className="reader-font-size">
    <button className="icon-btn" title="Decrease font size" onClick={() => step(-1)}>A−</button>
    <label>
      <input
        aria-label="Reading font size"
        title="Font size in pixels (8–48)"
        type="number" min={8} max={48} step={1}
        value={draft}
        onChange={event => {
          setDraft(event.target.value);
          const size = Number(event.target.value);
          if (event.target.value && Number.isInteger(size) && size >= 8 && size <= 48) onChange(size);
        }}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') setDraft(String(value));
        }}
      />
      <span>px</span>
    </label>
    <button className="icon-btn" title="Increase font size" onClick={() => step(1)}>A+</button>
  </div>;
}
