import React from 'react';

export default function TaskTabs({ label, active, options, onChange }: {
  label: string;
  active: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
}) {
  return <div className="task-tabs" role="tablist" aria-label={label}>
    {options.map((option, index) => <button key={option.id} id={`task-tab-${option.id}`} role="tab"
      aria-selected={active === option.id} aria-controls={`task-panel-${option.id}`}
      tabIndex={active === option.id ? 0 : -1} className={active === option.id ? 'active' : ''}
      onClick={() => onChange(option.id)} onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % options.length
          : event.key === 'ArrowLeft' ? (index + options.length - 1) % options.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        onChange(options[next].id);
        const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        tabs?.[next].focus();
      }}>{option.label}</button>)}
  </div>;
}
