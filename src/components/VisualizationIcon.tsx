import React from 'react';
/** Each gallery type has its own miniature diagram, including a real merge tree and temporal bands. */
export default function VisualizationIcon({type}:{type:string}){
 const node=(x:number,y:number,r=9)=><circle key={x+':'+y} cx={x} cy={y} r={r} fill="var(--panel)"/>;
 const icons:Record<string,React.ReactNode>={
  cooccurrence:<><path d="M30 25L72 44L126 20 M72 44L121 80 M30 25L35 80L72 44"/>{[[30,25,13],[72,44,18],[126,20,10],[121,80,12],[35,80,9]].map(([x,y,r])=>node(x,y,r))}<text x="95" y="43" fontSize="14" stroke="none" fill="currentColor">6</text></>,
  network:<><path d="M28 25L80 17L132 35L115 82L45 80Z M28 25L115 82 M80 17L45 80 M132 35L45 80"/>{[[28,25],[80,17],[132,35],[115,82],[45,80]].map(([x,y])=>node(x,y))}</>,
  radial:<><path d="M80 50L35 20H12 M80 50L125 20H148 M80 50L35 80H12 M80 50L125 80H148"/><ellipse cx="80" cy="50" rx="23" ry="14" fill="var(--panel)"/><path d="M12 12H40 M120 12H148 M12 90H40 M120 90H148"/></>,
  tree:<><path d="M80 25V48H25V70 M80 48V70 M80 48H135V70"/>{[[65,8],[10,70],[65,70],[120,70]].map(([x,y])=><rect key={x+':'+y} x={x} y={y} width="30" height="22" rx="3" fill="var(--panel)"/>)}</>,
  grid:<>{Array.from({length:15},(_,i)=><rect key={i} x={18+i%5*25} y={14+Math.floor(i/5)*25} width="20" height="20" fill="currentColor" opacity={.12+(i%5)*.18}/>)}</>,
  words:<><path d="M15 50H66L100 15H150 M66 50H150 M66 50L100 85H150"/><path d="M9 40H36V60H9 M112 9H143 M105 44H138 M112 79H147" strokeWidth="5"/></>,
  flow:<><path d="M42 50H65 M59 44L65 50L59 56 M99 50H122 M116 44L122 50L116 56"/>{[6,65,124].map(x=><rect key={x} x={x} y="34" width="30" height="32" rx="4"/>)}</>,
  journey:<><path d="M12 10V88H151 M18 69L50 34L82 60L114 21L146 43"/>{[[18,69],[50,34],[82,60],[114,21],[146,43]].map(([x,y])=>node(x,y,5))}<path d="M18 84H43 M50 84H76 M83 84H109 M116 84H147" strokeWidth="7"/></>,
  pyramid:<path d="M80 7L149 94H11Z M57 36H103 M35 65H125"/>,
  venn:<><circle cx="59" cy="40" r="30"/><circle cx="102" cy="40" r="30"/><circle cx="80" cy="69" r="29"/></>,
  hex:<>{[[45,25],[85,25],[125,25],[25,60],[65,60],[105,60]].map(([x,y])=><path key={x+':'+y} transform={`translate(${x} ${y})`} d="M-20 0L-10-17H10L20 0L10 17H-10Z"/>)}</>,
  ecology:<><ellipse cx="80" cy="50" rx="66" ry="43"/><ellipse cx="80" cy="55" rx="45" ry="30"/><ellipse cx="80" cy="62" rx="23" ry="17"/>{[[26,25],[134,26],[80,12]].map(([x,y])=>node(x,y,5))}</>,
  histomap:<><path d="M18 12H143V88H18Z"/><path d="M18 12H53L75 38L40 64L62 88H18Z" fill="currentColor" opacity=".25"/><path d="M53 12H98L110 38L85 64L115 88H62L40 64L75 38Z" fill="currentColor" opacity=".55"/><path d="M98 12H143V88H115L85 64L110 38Z" fill="currentColor" opacity=".12"/><path d="M10 12H3 M10 38H3 M10 64H3 M10 88H3"/></>,
  dendrogram:<><path d="M145 12H107V31H145 M107 22H70V59H145 M70 41H30V83H145"/><path d="M25 95H145 M30 91V98 M88 91V98 M145 91V98" strokeWidth="2"/>{[[145,12],[145,31],[145,59],[145,83]].map(([x,y])=>node(x,y,4))}</>,
  'word-cloud':<g fill="currentColor" stroke="none"><text x="30" y="48" fontSize="28" fontWeight="700">words</text><text x="60" y="70" fontSize="19">themes</text><text x="48" y="25" fontSize="13">voices</text><text x="14" y="71" fontSize="12" transform="rotate(-90 14 71)">ideas</text><text x="42" y="88" fontSize="13">meaning</text></g>,
  sankey:<><path d="M12 12V43 M12 61V90 M147 8V35 M147 51V90" strokeWidth="8"/><path d="M16 16C75 16 75 58 143 58L143 84C75 84 75 38 16 38Z" fill="currentColor" opacity=".25"/><path d="M16 65C65 65 70 12 143 12V31C70 31 65 86 16 86Z" fill="currentColor" opacity=".5"/></>,
  blank:<><path d="M42 8H101L119 26V92H42Z M101 8V26H119 M56 42H90 M56 55H78"/><path d="M85 79L111 53L119 61L93 87L82 90Z M106 58L114 66" fill="var(--panel)"/></>,
 };
 return <svg viewBox="0 0 160 100" aria-hidden="true" className="visualization-icon" data-visualization-icon={type}><g stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">{icons[type]||icons.blank}</g></svg>;
}
