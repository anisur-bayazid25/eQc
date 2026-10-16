import { RefObject, useEffect } from 'react';

// Chromium's selection navigation also works in read-only text. Keep the
// source immutable and let the browser handle wrapping and Unicode boundaries.
export function useReaderKeyboardSelection(ref: RefObject<HTMLElement>, ready = 0) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.tabIndex = 0;
    const focus = (event: MouseEvent) => {
      if ((event.target as Element).closest('a,button,input,textarea,select,[contenteditable="true"]')) return;
      root.focus({ preventScroll: true });
    };
    const navigate = (event: KeyboardEvent) => {
      if (event.altKey || event.isComposing || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      if (event.target !== root) return;
      const selection = window.getSelection() as (Selection & { modify?: (action: string, direction: string, granularity: string) => void }) | null;
      if (!selection?.modify || !selection.focusNode || !root.contains(selection.focusNode)) return;
      const forward = ['ArrowRight', 'ArrowDown', 'End'].includes(event.key);
      const modifier = event.ctrlKey || event.metaKey;
      const granularity = event.key === 'Home' || event.key === 'End'
        ? (modifier ? 'documentboundary' : 'lineboundary')
        : event.key === 'ArrowUp' || event.key === 'ArrowDown'
          ? (modifier ? 'paragraphboundary' : 'line') : (modifier ? 'word' : 'character');
      const anchor = selection.anchorNode, anchorOffset = selection.anchorOffset;
      event.preventDefault();
      selection.modify(event.shiftKey ? 'extend' : 'move', forward ? 'forward' : 'backward', granularity);
      if (!selection.focusNode || !root.contains(selection.focusNode)) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let boundary = walker.nextNode(), next: Node | null;
        if (forward) while ((next = walker.nextNode())) boundary = next;
        if (boundary) {
          const offset = forward ? boundary.textContent!.length : 0;
          if (event.shiftKey && anchor && root.contains(anchor)) selection.setBaseAndExtent(anchor, anchorOffset, boundary, offset);
          else selection.collapse(boundary, offset);
        }
      }
      document.dispatchEvent(new Event('selectionchange'));
    };
    root.addEventListener('mousedown', focus);
    root.addEventListener('keydown', navigate);
    return () => { root.removeEventListener('mousedown', focus); root.removeEventListener('keydown', navigate); };
  }, [ref, ready]);
}
