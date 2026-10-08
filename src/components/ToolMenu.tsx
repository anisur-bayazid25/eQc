import React, { useEffect, useRef } from 'react';

/** Native disclosure with an anchored, keyboard-accessible tool panel. */
export default function ToolMenu({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  function positionMenu() {
    const details = ref.current;
    const content = contentRef.current;
    if (!details?.open || !content) return;
    const anchor = details.querySelector('summary')!.getBoundingClientRect();
    const margin = 8;
    const below = window.innerHeight - anchor.bottom - margin - 6;
    const above = anchor.top - margin - 6;
    const useAbove = below < 180 && above > below;
    // Constrain to the viewport, not the previously constrained scrollHeight.
    // Flex layout and borders can otherwise feed a clipped height into the next opening.
    const availableHeight = Math.min(520, Math.max(0, useAbove ? above : below));
    content.style.maxHeight = `${availableHeight}px`;
    const height = content.getBoundingClientRect().height;
    content.style.left = `${Math.max(margin, Math.min(anchor.left, window.innerWidth - content.offsetWidth - margin))}px`;
    content.style.top = `${useAbove ? Math.max(margin, anchor.top - height - 6) : anchor.bottom + 6}px`;
  }
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    const reposition = (event: Event) => {
      if (event.target instanceof Node && contentRef.current?.contains(event.target)) return;
      positionMenu();
    };
    document.addEventListener('pointerdown', closeOutside);
    window.addEventListener('resize', reposition);
    document.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('scroll', reposition, true);
    };
  }, []);
  return <details ref={ref} className="tool-menu" onToggle={positionMenu} onBlur={event => {
    if (ref.current?.open && event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) ref.current.open = false;
  }} onKeyDown={event => {
    if (event.key === 'Escape' && ref.current?.open) {
      event.stopPropagation();
      ref.current.open = false;
      ref.current.querySelector('summary')?.focus();
    }
  }}>
    <summary>{label}</summary>
    <div ref={contentRef} className="tool-menu-content">{children}</div>
  </details>;
}
