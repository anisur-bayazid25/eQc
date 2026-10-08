import React from 'react';
// Original small vector illustrations; motion is applied to separate parts by CSS.
export default function MilestoneArtwork({character,animate=false}:{character:string;animate?:boolean}) {
  const eyes=(x=84,y=99,gap=32)=><g className="milestone-eyes" stroke="none"><ellipse cx={x} cy={y} rx="5" ry="7" fill="#272c3d"/><ellipse cx={x+gap} cy={y} rx="5" ry="7" fill="#272c3d"/><circle cx={x-1} cy={y-2} r="1.7" fill="white"/><circle cx={x+gap-1} cy={y-2} r="1.7" fill="white"/></g>;
  const smile=<path d="M91 115Q100 122 109 115" fill="none"/>;
  let art:React.ReactNode;
  switch(character){
    case 'Satoru Gojo':art=<>
      <path d="M65 161L71 113L128 114L139 161Z" fill="#28334d"/><path d="M75 116L79 99L121 100L128 119Z" fill="#36425e"/><ellipse cx="101" cy="77" rx="34" ry="35" fill="#ffe0c8"/>
      <path d="M65 71L57 54L72 55L69 37L83 45L89 24L99 38L116 20L119 44L139 32L133 56L149 55L136 76L123 58L108 69L97 53L80 70L76 56Z" fill="#f1f5f7"/>
      <path d="M65 71Q98 65 137 72L134 87Q98 80 66 87Z" fill="#222b40"/><path d="M89 97Q101 106 115 94" fill="none"/>
      <path className="milestone-wave" d="M130 130L147 111L143 91" fill="none" stroke="#ffe0c8" strokeWidth="12"/><path d="M141 96L136 80M147 96L148 77" stroke="#ffe0c8" strokeWidth="5"/>
      <g className="milestone-sparkles" fill="none" stroke="#8dbef0" opacity=".7"><circle cx="45" cy="115" r="15"/><circle cx="45" cy="115" r="8"/></g>
    </>;break;
    case 'Lucario':art=<>
      <path d="M121 137Q156 145 155 123L166 134Q166 166 126 153" fill="#448fc0"/><path d="M75 68L63 25L77 27L91 64M111 63L127 23L138 29L128 74" fill="#448fc0"/><path d="M72 34L76 56M129 33L121 58" stroke="#283746" strokeWidth="6"/>
      <path d="M76 150L68 171L84 171L94 148M114 149L120 171L138 170L128 145" fill="#448fc0"/><ellipse cx="103" cy="128" rx="29" ry="32" fill="#448fc0"/><path d="M78 108L91 102L104 110L118 102L129 113L119 148L91 149Z" fill="#efe0a7"/><path d="M101 125L111 138L97 139Z" fill="#edf0ee"/>
      <path d="M66 74Q84 50 111 61L133 84L124 106L103 112L78 97L57 95Z" fill="#448fc0"/><path d="M69 76L92 75L114 69L121 81L95 88L77 88Z" fill="#283746"/><path d="M71 84L56 92L75 101L94 94" fill="#448fc0"/><path d="M76 99L74 119L86 117L94 98M113 104L124 118L132 112L125 98" fill="#283746"/><ellipse cx="101" cy="80" rx="5" ry="6" fill="#ca5b5f" stroke="none"/><circle cx="102" cy="78" r="1.5" fill="white" stroke="none"/>
      <path className="milestone-wave" d="M129 123L148 109" stroke="#448fc0" strokeWidth="13"/><circle cx="149" cy="107" r="10" fill="#283746"/><path d="M143 102L148 92L153 103" fill="#edf0ee"/>
    </>;break;
    case 'Saitama':art=<>
      <path className="milestone-tail" d="M77 106Q47 107 35 151L74 157L101 118L129 162L166 152Q152 110 125 105Z" fill="#f8f5e9"/>
      <path d="M72 162L77 108L125 108L136 162Z" fill="#f2c84f"/><path d="M78 111L99 125L122 111" fill="none" stroke="#fff8ec" strokeWidth="6"/><path d="M100 122L101 153" stroke="#61524b" strokeWidth="1.4"/><path d="M72 150L135 150L136 158L72 158Z" fill="#453c3c"/><rect x="94" y="149" width="15" height="10" rx="2" fill="#e5d2aa"/>
      <ellipse cx="101" cy="75" rx="33" ry="38" fill="#ffdbb9"/><path d="M80 78L90 78M111 78L121 78M96 96L107 96" fill="none" strokeWidth="1.8"/>
      <path d="M75 124L61 142M129 124L143 111" stroke="#f2c84f" strokeWidth="13"/><ellipse cx="57" cy="147" rx="11" ry="12" fill="#c85452"/><g className="milestone-wave"><ellipse cx="149" cy="105" rx="12" ry="13" fill="#c85452"/><path d="M143 98L150 98M143 104L152 104" fill="none" strokeWidth="1.3"/></g>
    </>;break;
    case 'Charmander':art=<>
      <g className="milestone-tail"><path d="M122 143Q165 150 163 107Q151 125 126 119" fill="#f29a54"/>
        <g className="milestone-flame"><path d="M153 111Q139 96 151 81Q154 69 149 59Q174 69 174 84Q189 82 181 101Q172 115 153 111Z" fill="#f47837"/><path d="M158 106Q152 93 162 84Q165 77 162 74Q181 92 169 106Z" fill="#ffdc72" stroke="none"/></g>
      </g><ellipse cx="99" cy="128" rx="31" ry="36" fill="#f29a54"/><ellipse cx="99" cy="132" rx="20" ry="27" fill="#ffe3a9"/>
      <path d="M77 149L62 164L88 167L93 151M111 151L119 167L143 164L126 148" fill="#f29a54"/><path d="M72 113L54 130M125 114L142 125" stroke="#f29a54" strokeWidth="13"/>
      <path d="M65 86Q59 54 87 44Q113 33 129 60Q144 83 130 103Q104 117 76 104Z" fill="#f29a54"/>{eyes(81,77,33)}<path d="M83 94Q100 108 119 92" fill="#fff6da"/><path d="M117 93L112 99L120 97" fill="white" strokeWidth="1"/>
    </>;break;
    case 'Eevee':art=<><path className="milestone-tail" d="M129 124Q189 123 170 74L149 91L154 113L133 109" fill="#ba7847"/><path d="M170 74L149 91L153 106L164 100L175 108Q181 92 170 74" fill="#ffe5bd"/><path d="M63 73L41 23Q68 22 82 64M119 66Q135 25 163 23L141 78" fill="#bc804f"/><path d="M63 62L52 38L72 56M133 62L151 38L143 65" fill="#5a3940" stroke="none"/><ellipse cx="102" cy="127" rx="35" ry="38" fill="#ba7847"/><path d="M61 117L72 106L66 91L86 102L102 89L115 103L135 92L133 110L143 118L128 130L122 141L105 130L84 141L76 128Z" fill="#ffe5bd"/><ellipse cx="101" cy="85" rx="42" ry="33" fill="#bd804e"/>{eyes(84,85)}<path d="M98 98L105 98L101 102" fill="#3c3033"/><path d="M89 105Q101 112 113 105" fill="none"/></>;break;
    case 'No-Face':art=<><path d="M47 160Q45 43 100 35Q155 44 157 160Z" fill="#292d43"/><ellipse cx="101" cy="80" rx="32" ry="42" fill="#fff9df"/><path d="M80 66L89 65M112 65L122 66" strokeWidth="4"/><path d="M80 75L82 92M121 75L120 92" stroke="#ba91b9" strokeWidth="6"/><ellipse cx="101" cy="105" rx="8" ry="4" fill="#272c3d"/><g className="milestone-prop"><path d="M69 134L126 132L135 162L74 163Z" fill="#f8e0a0"/><path d="M81 142L116 141M83 150L109 149" stroke="#ac7c57"/></g></>;break;
    case 'Luffy':art=<><path d="M65 142L76 113L124 113L137 159L115 163L112 133L90 133L88 163L63 162Z" fill="#d75051"/><path d="M88 119L113 119L113 161L89 161Z" fill="#ffd5b0"/><ellipse cx="101" cy="88" rx="37" ry="35" fill="#ffd5b0"/><path d="M66 85L69 55L80 69L92 53L103 67L118 55L136 75L135 87" fill="#303541"/><g className="milestone-hat"><ellipse cx="101" cy="57" rx="59" ry="12" fill="#edc979"/><path d="M68 54Q69 18 101 19Q134 20 137 55Z" fill="#f8dc96"/><path d="M69 44L134 45L137 54L67 54Z" fill="#c95355"/></g>{eyes(85,87)}<path d="M86 105Q100 121 117 104Z" fill="#fffaf0"/><path d="M119 96L126 98M122 93L122 101" strokeWidth="1.5"/><path d="M135 136L156 118" stroke="#ffd5b0" strokeWidth="13"/></>;break;
    case 'Psyduck':art=<><ellipse cx="105" cy="132" rx="40" ry="33" fill="#f7d460"/><path d="M79 160L57 163L69 173L94 168M116 166L138 173L151 163L130 159" fill="#e6c794"/><ellipse cx="101" cy="84" rx="42" ry="35" fill="#f7d460"/><path d="M92 51L88 34M100 49L101 31M108 50L116 35" strokeWidth="4"/>{eyes(83,78,34)}<ellipse cx="102" cy="101" rx="32" ry="17" fill="#ebd5a5"/><path d="M88 95L89 97M113 95L114 97"/><path className="milestone-wave" d="M74 134Q48 119 62 83" fill="none" stroke="#f7d460" strokeWidth="17"/><path d="M132 134Q154 114 139 87" fill="none" stroke="#f7d460" strokeWidth="17"/></>;break;
    case 'Naruto':art=<><path d="M64 158L69 122L131 121L140 161Z" fill="#f9a147"/><path d="M94 125L109 125L111 161L92 161" fill="#35435c"/><ellipse cx="100" cy="86" rx="37" ry="38" fill="#ffd6b0"/><path d="M59 76L57 59L70 60L66 42L81 48L88 28L99 43L112 26L117 47L136 36L135 57L149 57L138 77" fill="#f5cc52"/><path d="M62 70L138 69L139 84L62 84Z" fill="#3d4e69"/><rect x="80" y="69" width="42" height="17" rx="4" fill="#dce3e4"/><path d="M100 73Q112 78 103 82Q94 85 94 78Q96 72 101 77L107 78" fill="none" strokeWidth="1.4"/>{eyes(85,95,31)}<path d="M70 96L78 99M69 103L78 105M121 99L132 96M121 105L132 103" strokeWidth="1.5"/>{smile}<path className="milestone-wave" d="M135 134L149 109" stroke="#ffd6b0" strokeWidth="13"/></>;break;
    case 'Son Goku':art=<>
      <path d="M64 157L72 115L128 115L138 158Z" fill="#f6963d"/><path d="M77 115L100 137L122 115" fill="#37629b"/><path d="M68 145L133 145L135 153L65 153Z" fill="#37629b"/>
      <path className="milestone-wave" d="M72 131L56 113L50 95" fill="none" stroke="#ffd2aa" strokeWidth="13"/><path d="M128 132L143 108" stroke="#ffd2aa" strokeWidth="13"/>
      <ellipse cx="100" cy="85" rx="35" ry="36" fill="#ffd2aa"/>
      <path d="M65 88L50 61L68 63L56 41L81 48L79 23L98 41L111 16L119 43L147 28L134 55L153 56L136 84L121 60L109 77L98 62L82 83L78 65Z" fill="#26303d"/>
      {eyes(85,91,30)}<path d="M85 105Q100 118 116 103Z" fill="#fff8df"/><circle cx="121" cy="137" r="11" fill="#fff1d3"/><path d="M117 132L124 141M124 132L117 140M116 136L126 136" strokeWidth="1.5"/>
    </>;break;
    case 'Catbus':art=<><path d="M28 135L21 153L40 158L54 138M62 141L62 158L80 159L85 138M102 141L110 159L129 156L126 138M141 131L156 149L172 143L160 126" fill="#c49759"/><rect x="20" y="72" width="143" height="71" rx="31" fill="#c49759"/><path d="M24 110L161 107" stroke="#815e44" strokeWidth="9"/><rect x="40" y="82" width="24" height="25" rx="8" fill="#fce6a3"/><rect x="75" y="80" width="24" height="25" rx="8" fill="#fce6a3"/><path d="M115 61L117 30L140 47L167 36L166 67" fill="#c49759"/><ellipse cx="143" cy="85" rx="36" ry="34" fill="#c49759"/>{eyes(128,76,27)}<path d="M118 92Q143 120 169 92Z" fill="#fff9de"/><path d="M128 98L129 106M141 100L141 110M155 99L154 107"/><path d="M143 86L149 84L148 88" fill="#674c3c"/><path d="M117 86L99 81M118 91L99 96M168 81L181 74M169 90L185 93" strokeWidth="1.5"/><g className="milestone-prop"><rect x="68" y="58" width="39" height="17" rx="4" fill="#ece7c9"/><path d="M77 66L97 66" stroke="#815e44"/></g></>;break;
    case 'Bulbasaur':art=<><path className="milestone-leaf" d="M83 96Q43 55 78 49Q80 25 105 44Q137 35 148 65Q155 94 119 112Z" fill="#6caa74"/><path d="M89 93L104 50L126 86" fill="none" stroke="#477953"/><ellipse cx="105" cy="132" rx="47" ry="27" fill="#85c8b2"/><path d="M64 140L65 166L81 166L87 141M116 146L120 166L138 165L142 138" fill="#85c8b2"/><path d="M47 95L47 70L65 81L88 77L103 63L110 94Q124 124 96 137Q39 147 37 120Z" fill="#8dcfbc"/>{eyes(57,109,35)}<path d="M55 126Q73 136 92 123" fill="none"/><path d="M41 110L53 92L63 97L54 113M104 140L97 129L109 126L115 140" fill="#3f917c" stroke="none"/></>;break;
    case 'L':art=<>
      <path d="M73 159L61 140L77 122L111 123L139 141L129 164L111 148L100 163Z" fill="#49617b"/>
      <path d="M72 124L81 105L122 110L133 139L113 148L90 143Z" fill="#f8f4e9"/>
      <path d="M91 117L94 151L78 162M121 120L124 142L135 117" fill="none" stroke="#f8f4e9" strokeWidth="13"/>
      <ellipse cx="100" cy="82" rx="34" ry="36" fill="#f9d9bd"/>
      <path d="M64 100L54 79L62 71L58 50L75 54L80 32L96 45L111 29L118 49L137 45L132 68L145 72L133 99L121 76L115 56L104 80L98 60L88 83L82 61L73 87Z" fill="#252c36"/>
      <path d="M79 94Q84 100 91 95M109 95Q116 100 123 93" fill="none" stroke="#937a83" strokeWidth="2.8"/>{eyes(85,90,29)}<path d="M95 108L105 107" fill="none"/>
      <path className="milestone-prop" d="M138 124L134 109L145 101L153 120Z" fill="#f9d9bd"/><path d="M135 115L143 93" stroke="#f9d9bd" strokeWidth="5"/>
      <g className="milestone-prop"><path d="M33 143L61 147L62 160L34 156Z" fill="#f4ddaa"/><path d="M32 138L55 130L63 145L33 143Z" fill="#fff4e5"/><circle cx="49" cy="130" r="5" fill="#da6a6c"/></g>
    </>;break;
    case 'Dragonite':art=<><path d="M76 107L36 64L28 117L69 129M124 104L164 65L178 116L133 128" fill="#76b9ae"/><path d="M59 150Q23 150 24 127Q35 141 74 124" fill="#e9b16e"/><ellipse cx="102" cy="124" rx="42" ry="40" fill="#edb777"/><ellipse cx="104" cy="135" rx="25" ry="27" fill="#ffe7b1"/><path d="M79 60L66 36M121 58L134 34" stroke="#edb777" strokeWidth="6"/><ellipse cx="102" cy="81" rx="35" ry="33" fill="#edb777"/>{eyes(87,77,29)}<path d="M88 98Q102 106 118 97" fill="none"/><path d="M72 149L58 163L84 169L90 157M115 158L124 170L149 163L132 149" fill="#edb777"/><path d="M80 134L98 139M128 127L113 136" stroke="#edb777" strokeWidth="12"/></>;break;
    case 'Howl’s moving castle':art=<>
      <g className="milestone-castle-legs"><path d="M64 145L49 164L61 172M126 145L144 162L136 173" fill="none" stroke="#7b8c86" strokeWidth="8"/><path d="M48 170L64 172M130 173L145 170" stroke="#504b4a" strokeWidth="7"/></g>
      <path d="M44 135Q28 107 53 85L131 74Q169 90 158 136Q111 164 44 135Z" fill="#8d9d91"/>
      <path d="M57 129L37 133L34 123L52 115M145 118L168 124L166 133L146 131" fill="#bd976e"/>
      <path d="M54 93L57 54L92 50L97 99Z" fill="#c4ae84"/><path d="M49 55L73 28L99 51Z" fill="#947259"/>
      <path d="M97 90L99 43L130 43L133 93Z" fill="#b8a99b"/><path d="M94 44L115 21L137 45Z" fill="#756b69"/>
      <path d="M131 97L137 63L157 68L157 109Z" fill="#b68c6d"/><path d="M132 65L146 44L164 70Z" fill="#776868"/>
      <path d="M69 36L68 14L78 14L80 36M119 27L125 8L134 11L129 38" fill="#807775"/>
      <rect x="66" y="66" width="14" height="17" rx="3" fill="#f5d689"/><rect x="106" y="57" width="15" height="20" rx="4" fill="#f5d689"/><rect x="141" y="82" width="10" height="14" rx="3" fill="#f5d689"/>
      <path d="M57 111Q69 96 81 109M106 105Q120 91 133 103" fill="none" stroke="#515b57" strokeWidth="5"/><circle cx="69" cy="111" r="8" fill="#fff1bc"/><circle cx="119" cy="105" r="8" fill="#fff1bc"/>
      <path d="M68 133Q98 148 128 126L117 141L79 145Z" fill="#655e55"/><path d="M84 136L87 142M98 136L100 141M111 132L112 138" stroke="#eee1c1"/>
      <g className="milestone-smoke" stroke="none" fill="#bcc6cf" opacity=".65"><circle cx="73" cy="6" r="5"/><circle cx="132" cy="3" r="6"/><circle cx="144" cy="10" r="4"/></g>
    </>;break;
    default:art=null;
  }
  return <svg className={`milestone-art${animate?' milestone-art-animated':''}`} viewBox="0 0 200 190" role="img" aria-label={`${character} illustration`}><ellipse cx="100" cy="171" rx="69" ry="8" fill="currentColor" opacity=".08"/><g className="milestone-character" stroke="#3c3a45" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">{art}</g><g className="milestone-sparkles" fill="#dbb75c"><path d="M23 37L26 46L35 49L26 52L23 61L20 52L11 49L20 46Z"/><path d="M174 17L177 24L184 27L177 30L174 37L171 30L164 27L171 24Z"/></g></svg>;
}
