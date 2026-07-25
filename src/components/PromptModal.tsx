import React, { useCallback, useEffect, useRef, useState } from 'react';

interface PromptState {
  title: string;
  defaultValue: string;
  confirmLabel: string;
  resolve: (value: string | null) => void;
}

export interface TextPrompt {
  prompt: (title: string, defaultValue?: string, confirmLabel?: string) => Promise<string | null>;
  modal: React.ReactNode;
}

// Electron does not implement window.prompt() (it throws "prompt() is and
// will not be supported" by design). This hook provides a drop-in async
// replacement backed by a real modal component instead.
export function useTextPrompt(): TextPrompt {
  const [state, setState] = useState<PromptState | null>(null);

  const prompt = useCallback(
    (title: string, defaultValue = '', confirmLabel = 'OK'): Promise<string | null> => {
      return new Promise(resolve => {
        setState({ title, defaultValue, confirmLabel, resolve });
      });
    },
    []
  );

  const close = (value: string | null) => {
    setState(current => {
      if (current) current.resolve(value);
      return null;
    });
  };

  const modal = state ? (
    <PromptModalView
      title={state.title}
      defaultValue={state.defaultValue}
      confirmLabel={state.confirmLabel}
      onSubmit={close}
      onCancel={() => close(null)}
    />
  ) : null;

  return { prompt, modal };
}

function PromptModalView({
  title,
  defaultValue,
  confirmLabel,
  onSubmit,
  onCancel
}: {
  title: string;
  defaultValue: string;
  confirmLabel: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal-box" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <input
          ref={inputRef}
          className="modal-input"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && value.trim()) onSubmit(value.trim());
            if (e.key === 'Escape') onCancel();
          }}
        />
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary-btn" disabled={!value.trim()} onClick={() => onSubmit(value.trim())}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
