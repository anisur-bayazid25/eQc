import React, { useEffect, useRef, useState } from 'react';
import { Code, CodedSegment } from '../domain';

export default function CodingMargin({ enabled, segments, codesById, onJump, children, readerStyle }: { enabled: boolean; segments: CodedSegment[]; codesById: Map<string, Code>; onJump: (s: CodedSegment) => void; children: React.ReactNode; readerStyle: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState<Array<{ id: string; top: number; height: number; lane: number }>>([]);
  useEffect(() => {
    const root = ref.current; if (!enabled || !root) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
        const origin = root.getBoundingClientRect();
        const bounds = new Map<string, { top: number; bottom: number }>();
        root.querySelectorAll<HTMLElement>('[data-seg-ids]').forEach(el => {
          const rect = el.getBoundingClientRect(); if (!rect.height) return;
          for (const id of el.dataset.segIds?.split(' ') || []) {
            const old = bounds.get(id); bounds.set(id, { top: Math.min(old?.top ?? Infinity, rect.top-origin.top), bottom: Math.max(old?.bottom ?? -Infinity,rect.bottom-origin.top) });
          }
        });
        const lanes: number[] = [];
        setMarks(Array.from(bounds, ([id,b]) => ({ id,top:b.top,height:Math.max(20,b.bottom-b.top),lane:0 })).sort((a,b)=>a.top-b.top).map(m => { let lane=lanes.findIndex(end=>end<=m.top); if(lane<0)lane=lanes.length;lanes[lane]=m.top+m.height;m.lane=lane;return m; }));
      });
    };
    const resize = new ResizeObserver(update), mutate = new MutationObserver(update);
    resize.observe(root); mutate.observe(root,{childList:true,subtree:true,characterData:true}); update();
    return () => { resize.disconnect();mutate.disconnect();cancelAnimationFrame(frame); };
  }, [enabled, segments, children]);
  return <div className={`coding-surface${enabled?' with-coding-margin':''}`} style={{ '--coding-bg':readerStyle.backgroundColor, '--coding-text':readerStyle.color, color:readerStyle.color } as React.CSSProperties}><div className="coding-reader" ref={ref}>{children}</div>{enabled&&<aside className="coding-margin" style={{ flexBasis: Math.max(28, (Math.max(-1,...marks.map(m=>m.lane)) + 1) * 20 + 8) }} aria-label="Coding stripes">{marks.map(m=>{const seg=segments.find(s=>s.id===m.id),code=seg&&codesById.get(seg.codeId);return seg&&<button key={m.id} aria-label={'Jump to '+code?.name} title={`${code?.name} · ${seg.coder||'Unattributed'}`} style={{top:m.top,height:m.height,left:m.lane*20,borderLeftColor:code?.color}} onClick={()=>onJump(seg)}><span style={{maxHeight:Math.max(14,m.height-4)}}>{code?.name}</span></button>;})}</aside>}</div>;
}
