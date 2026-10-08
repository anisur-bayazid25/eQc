import React from 'react';

export default function PikachuArtwork() {
  return <svg viewBox="0 0 180 160" aria-hidden="true">
    <defs>
      <linearGradient id="courier-gold" x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#ffe76b"/><stop offset=".65" stopColor="#ffd63e"/><stop offset="1" stopColor="#eeb72d"/></linearGradient>
      <linearGradient id="courier-paper" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fffdf5"/><stop offset="1" stopColor="#f2e6ce"/></linearGradient>
    </defs>
    <ellipse cx="100" cy="148" rx="57" ry="6" fill="#312923" opacity=".14"/>
    <g className="pikachu-trot" stroke="#594622" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
      <g className="pikachu-tail"><path d="M65 116L45 102L50 87L22 78L29 61L9 46L20 27L58 56L45 71L66 81L59 99L77 107Z" fill="url(#courier-gold)"/><path d="M65 116L52 105L61 98L77 107Z" fill="#986333"/></g>
      <g className="pikachu-leg-back"><path d="M71 119Q61 120 55 135Q51 146 67 145L84 134L88 121Z" fill="url(#courier-gold)"/><path d="M58 140L60 135M63 143L66 138" fill="none" strokeWidth="1.4"/></g>
      <path d="M83 73Q65 78 62 104Q59 129 81 139Q106 148 127 126Q137 104 122 80Z" fill="url(#courier-gold)"/>
      <path d="M65 94L79 99L76 106L62 102M62 111L76 115L73 122L64 119" fill="#a77638" stroke="none"/>
      <ellipse cx="100" cy="111" rx="20" ry="23" fill="#fff0a3" opacity=".5" stroke="none"/>
      <g className="pikachu-ear-back"><path d="M86 56Q66 40 58 9Q57 2 64 7Q86 24 96 48Z" fill="url(#courier-gold)"/><path d="M58 9Q57 2 64 7L78 22L66 28Z" fill="#333234" stroke="none"/></g>
      <g className="pikachu-ear-front"><path d="M112 45Q119 21 145 6Q151 3 147 13Q138 40 125 53Z" fill="url(#courier-gold)"/><path d="M132 15L145 6Q151 3 147 13L141 28L129 25Z" fill="#333234" stroke="none"/></g>
      <path d="M84 45Q104 33 126 47Q144 57 145 78Q145 93 132 97Q119 107 91 95Q74 96 73 82Q65 64 84 45Z" fill="url(#courier-gold)"/>
      <path d="M81 51Q89 44 100 45" fill="none" stroke="#fff1a0" strokeWidth="4"/>
      <ellipse cx="101" cy="64" rx="6.6" ry="8.4" fill="#302b28" strokeWidth="1"/><ellipse cx="132" cy="65" rx="5.3" ry="7.3" fill="#302b28" strokeWidth="1"/>
      <ellipse cx="99" cy="61" rx="2.6" ry="3.1" fill="#fff" stroke="none"/><ellipse cx="131" cy="62" rx="2" ry="2.6" fill="#fff" stroke="none"/>
      <ellipse cx="85" cy="80" rx="8.8" ry="8" fill="#ed654c" stroke="#bd5036" strokeWidth="1.3"/><ellipse cx="139" cy="80" rx="6.1" ry="7" fill="#ed654c" stroke="#bd5036" strokeWidth="1.3"/>
      <path d="M115 76L121 76L118 79Z" fill="#37302a" strokeWidth="1"/>
      <path d="M108 83Q113 88 118 84Q122 88 128 82" fill="none" strokeWidth="1.8"/>
      <path d="M113 89Q120 93 125 88" fill="none" stroke="#d99239" strokeWidth="1.1"/>
      <g className="pikachu-leg-front"><path d="M112 125Q111 135 120 140Q135 149 145 140Q149 134 138 132L127 120" fill="url(#courier-gold)"/><path d="M141 139L136 138M143 135L138 135" fill="none" strokeWidth="1.4"/></g>
      <path d="M99 98Q101 101 111 101L132 97Q141 98 138 106L113 114Q98 113 93 106" fill="url(#courier-gold)"/>
      <g transform="rotate(-8 135 111)"><rect x="112" y="95" width="50" height="35" rx="4" fill="url(#courier-paper)" stroke="#8b7455" strokeWidth="1.8"/><path d="M114 98L137 114L160 98M114 127L131 113M160 127L144 113" fill="none" stroke="#c5ac84" strokeWidth="1.5"/><path d="M151 100H157V107H151Z" fill="#75b8a8" stroke="none"/></g>
      <path d="M105 115Q113 108 121 109Q128 112 122 118L114 123Q108 125 105 120" fill="url(#courier-gold)"/><path d="M117 115L121 114M116 119L120 117" fill="none" strokeWidth="1.2"/>
    </g>
  </svg>;
}
