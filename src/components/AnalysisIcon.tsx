import React from 'react';
/** Distinct analysis symbols, sized to the shared visualization-card grid. */
export default function AnalysisIcon({type}:{type:string}) {
  const icons:Record<string,React.ReactNode>={
    demographics:<><circle cx="60" cy="19" r="9"/><circle cx="29" cy="28" r="7"/><circle cx="91" cy="28" r="7"/><path d="M42 62V48c0-18 36-18 36 0v14M13 62V51c0-15 26-15 26-2M81 49c0-13 26-13 26 2v11"/></>,
    frequency:<><path d="M16 10v52h91"/><rect x="29" y="39" width="14" height="23" rx="2"/><rect x="53" y="25" width="14" height="37" rx="2"/><rect x="77" y="11" width="14" height="51" rx="2"/></>,
    docMatrix:<><path d="M26 7h52l17 17v40H26ZM77 7v18h18"/><path d="M36 35h48M36 46h48M36 57h48M50 35v22M68 35v22"/></>,
    coMatrix:<><circle cx="45" cy="36" r="25"/><circle cx="76" cy="36" r="25"/><path d="M60 17v38M52 23l16 26M52 49l16-26" opacity=".65"/></>,
    framework:<><rect x="13" y="11" width="91" height="49" rx="3"/><path d="M13 27h91M38 11v49M69 11v49M13 44h56"/><path d="m77 51 17-17 7 7-17 17-9 2Z" fill="var(--panel)"/></>,
    words:<><text x="12" y="33" fill="currentColor" stroke="none" fontSize="27" fontFamily="Georgia,serif" fontWeight="bold">Aa</text><path d="M62 16h41M62 29h27M17 47h86M17 60h63"/></>,
    kwic:<><path d="M12 18h96M12 54h96M10 36h22M88 36h22"/><rect x="40" y="26" width="40" height="20" rx="3"/><path d="m48 36 5 5 10-11M67 33h6M67 39h6"/></>,
    icr:<><rect x="17" y="9" width="34" height="52" rx="4"/><rect x="69" y="9" width="34" height="52" rx="4"/><path d="m24 23 4 4 8-9m-12 24 4 4 8-9m41-14 4 4 8-9m-12 24 4 4 8-9M54 30h12m-12 9h12"/></>,
    consensus:<><path d="M12 13h55v30H33L20 55V43h-8ZM74 27h32v29H90L77 66V56H55v-9"/><path d="m28 28 8 8 15-15M82 39h15M82 46h10"/></>
  };
  return <svg className="visualization-icon" viewBox="0 0 120 72" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-analysis-icon={type}>{icons[type]}</svg>;
}
