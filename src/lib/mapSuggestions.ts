import { Code, CodedSegment, MapAnnotation, MapDesign, MapEdgeStyle, Project } from '../domain';

export interface MapSuggestion {
  replaceCanvas?:boolean;
  design: MapDesign;
  codes: Array<{id: string; patch: Partial<Code>}>;
  hiddenIds: string[];
  annotations: MapAnnotation[];
  edges: MapEdgeStyle[];
}
const palette = [ ['#daf0dd','#287d48'], ['#ffe2c7','#bd591c'], ['#d7eaff','#246ba0'], ['#fff0bd','#b88713'], ['#cceff0','#237d86'], ['#ffd9e6','#ad3567'], ['#e5dafa','#7550a0'], ['#d4edf5','#227d94'] ];

export function mapLabelLines(text: string, max = 22): string[] {
  if(/[\r\n]/.test(text))return text.split(/\r?\n/).flatMap(line=>line.trim()?mapLabelLines(line,max):['']);
  const lines: string[] = []; let line = '';
  for (const word of text.trim().split(/\s+/)) {
    const parts = Array.from(word);
    while (parts.length > max) {
      if (line) { lines.push(line); line = ''; }
      lines.push(parts.splice(0,max).join(''));
    }
    const rest = parts.join('');
    if (line && Array.from(line+' '+rest).length > max) { lines.push(line); line = ''; }
    line += (line ? ' ' : '') + rest;
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['Untitled'];
}

// Project hidden descendants onto their nearest displayed ancestor. A document
// counts once per pair, even when several passages/subcodes match that pair.
export function mapSharedDocuments(codes: Code[], segments: CodedSegment[], visible: Set<string>): Map<string,number> {
  const byId = new Map(codes.map(c=>[c.id,c]));
  const projected = new Map<string,string|null>();
  const resolve = (id: string) => {
    if (projected.has(id)) return projected.get(id)!;
    const seen = new Set<string>(); let cursor: string|null = id;
    while (cursor && !visible.has(cursor) && !seen.has(cursor)) { seen.add(cursor); cursor = byId.get(cursor)?.parentId || null; }
    const result = cursor && visible.has(cursor) ? cursor : null;
    projected.set(id,result); return result;
  };
  const docs = new Map<string,Set<string>>();
  for (const s of segments) { const id = resolve(s.codeId); if (!id) continue; if (!docs.has(s.docId)) docs.set(s.docId,new Set()); docs.get(s.docId)!.add(id); }
  const pairs = new Map<string,number>();
  for (const set of docs.values()) { const ids=Array.from(set).sort(); for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const key=ids[i]+'::'+ids[j];pairs.set(key,(pairs.get(key)||0)+1);} }
  return pairs;
}

// Keep the strongest cross-theme links, spreading ties across nodes instead
// of letting the first code monopolise the diagram. These are display limits.
export function suggestedMapPairs(codes: Code[], pairs: Map<string,number>, limit: number): Array<[string,number]> {
  const byId=new Map(codes.map(c=>[c.id,c])), roots=new Map<string,string>();
  const root=(id:string)=>{if(roots.has(id))return roots.get(id)!;let cursor=id;const seen=new Set<string>();while(byId.get(cursor)?.parentId&&!seen.has(cursor)){seen.add(cursor);const next=byId.get(cursor)!.parentId!;if(!byId.has(next))break;cursor=next;}roots.set(id,cursor);return cursor;};
  const candidates=Array.from(pairs).filter(([key])=>{const [a,b]=key.split('::');return root(a)!==root(b);});
  const degree=new Map<string,number>(),branches=new Map<string,number>(),selected:Array<[string,number]>=[];
  while(candidates.length&&selected.length<limit){
    candidates.sort((a,b)=>{const degreeSum=(key:string)=>key.split('::').reduce((n,id)=>n+(degree.get(id)||0),0);return b[1]-a[1]||degreeSum(a[0])-degreeSum(b[0])||a[0].localeCompare(b[0]);});
    const pair=candidates.shift()!,[a,b]=pair[0].split('::'),branch=[root(a),root(b)].sort().join('::');
    if((degree.get(a)||0)>=3||(degree.get(b)||0)>=3||(branches.get(branch)||0)>=2)continue;
    selected.push(pair);degree.set(a,(degree.get(a)||0)+1);degree.set(b,(degree.get(b)||0)+1);branches.set(branch,(branches.get(branch)||0)+1);
  }
  return selected;
}

export function suggestCodeMap(project: Pick<Project,'id'|'name'|'codes'|'codedSegments'>, mode: 'simple'|'detailed', options: {title?:string;roots?:number;children?:number;links?:number} = {}): MapSuggestion {
  const codes=project.codes, byId=new Map(codes.map(c=>[c.id,c]));
  const children=new Map<string,Code[]>(), direct=new Map<string,number>();
  for(const c of codes)if(c.parentId&&byId.has(c.parentId)){if(!children.has(c.parentId))children.set(c.parentId,[]);children.get(c.parentId)!.push(c);}
  for(const s of project.codedSegments)direct.set(s.codeId,(direct.get(s.codeId)||0)+1);
  const totals=new Map<string,number>();
  for(const c of codes){let cursor: Code|undefined=c;const seen=new Set<string>();while(cursor&&!seen.has(cursor.id)){seen.add(cursor.id);totals.set(cursor.id,(totals.get(cursor.id)||0)+(direct.get(c.id)||0));cursor=cursor.parentId?byId.get(cursor.parentId):undefined;}}
  const rank=(a:Code,b:Code)=>(totals.get(b.id)||0)-(totals.get(a.id)||0)||(a.sortIndex??Infinity)-(b.sortIndex??Infinity)||codes.indexOf(a)-codes.indexOf(b);
  let roots=codes.filter(c=>!c.parentId||!byId.has(c.parentId));
  if(!roots.length&&codes.length)roots=[codes[0]];
  roots=roots.slice().sort(rank).slice(0,Math.max(1,Math.min(100,options.roots||8)));
  const factor=Math.max(1,Math.sqrt(roots.length/8)),width=Math.round((mode==='detailed'?2200:1600)*factor),height=Math.round((mode==='detailed'?1600:1100)*factor),cx=width/2,cy=height/2;
  const selected=new Set<string>(),updates:MapSuggestion['codes']=[];
  const place=(code:Code,x:number,y:number,group:number,major:boolean)=>{
    if(selected.has(code.id)||selected.size>=200)return;selected.add(code.id);
    const fontSize=major?30:26, nodeWidth=major?290:240;
    const nodeHeight=Math.max(major?150:120,mapLabelLines(code.name,major?18:19).length*fontSize*1.15+28);
    updates.push({id:code.id,patch:{mapPosition:{x:Math.round(Math.max(nodeWidth/2+40,Math.min(width-nodeWidth/2-40,x))),y:Math.round(Math.max(nodeHeight/2+40,Math.min(height-nodeHeight/2-40,y)))},mapShape:'ellipse',mapAppearance:{fill:palette[group%8][0],stroke:palette[group%8][1],width:nodeWidth,height:nodeHeight,fontSize}}});
  };
  roots.forEach((root,i)=>{
    const angle=-Math.PI/2+i*2*Math.PI/Math.max(roots.length,1);
    const rx=(mode==='detailed'?680:520)*factor,ry=(mode==='detailed'?480:340)*factor;
    const x=cx+Math.cos(angle)*rx,y=cy+Math.sin(angle)*ry;place(root,x,y,i,true);
    if(mode==='simple')return;
    const limit=Math.max(1,Math.min(200,options.children||5));
    const queue=(children.get(root.id)||[]).slice().sort(rank);const branch:Code[]=[];
    const visited=new Set([root.id]);
    while(queue.length&&branch.length<limit){const c=queue.shift()!;if(visited.has(c.id))continue;visited.add(c.id);branch.push(c);queue.push(...(children.get(c.id)||[]).slice().sort(rank));}
    branch.forEach((child,j)=>{const childAngle=angle+(branch.length===1?0:(j/(branch.length-1)-.5)*2.25);place(child,x+Math.cos(childAngle)*285,y+Math.sin(childAngle)*235,i,false);});
  });
  // Resolve overlapping label boxes deterministically, within the paper.
  for(let pass=0;pass<30;pass++)for(let i=0;i<updates.length;i++)for(let j=i+1;j<updates.length;j++){
    const a=updates[i].patch,b=updates[j].patch,pa=a.mapPosition!,pb=b.mapPosition!,sa=a.mapAppearance!,sb=b.mapAppearance!;
    const dx=pb.x-pa.x,dy=pb.y-pa.y,ox=(sa.width+sb.width)/2+24-Math.abs(dx),oy=(sa.height+sb.height)/2+24-Math.abs(dy);
    if(ox<=0||oy<=0)continue;
    if(ox<oy)pb.x=Math.max(sb.width/2+24,Math.min(width-sb.width/2-24,pb.x+(dx>=0?1:-1)*(ox+1)));
    else pb.y=Math.max(sb.height/2+24,Math.min(height-sb.height/2-24,pb.y+(dy>=0?1:-1)*(oy+1)));
  }
  const rootIds=roots.map(c=>c.id), maxLinks=Math.max(0,Math.min(30,options.links??(mode==='simple'?6:12)));
  const appearance=new Map(updates.map(u=>[u.id,u.patch.mapAppearance!]));
  const pairs=maxLinks?Array.from(mapSharedDocuments(codes,project.codedSegments,selected)).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])):[];
  const edges:MapEdgeStyle[]=updates.flatMap(u=>{const c=byId.get(u.id)!;return c.parentId&&selected.has(c.parentId)?[{id:'suggested:hierarchy:'+c.id,fromCodeId:c.parentId,toCodeId:c.id,kind:'hierarchy' as const,color:appearance.get(c.id)!.stroke,width:1.8,lineStyle:'solid' as const,curve:'curved' as const,arrow:'none' as const}]:[];});
  const strongest=pairs[0]?.[1]||1;
  suggestedMapPairs(codes,new Map(pairs),maxLinks).forEach(([key,count])=>{const [a,b]=key.split('::');edges.push({id:'suggested:cooccurrence:'+key,fromCodeId:a,toCodeId:b,kind:'cooccurrence',color:appearance.get(a)!.stroke,width:1+4*count/strongest,lineStyle:'dashed',curve:'curved',arrow:'none'});});
  const hubId='suggested:hub';
  const annotations:MapAnnotation[]=[{id:hubId,kind:'circle',x:cx-160,y:cy-105,width:320,height:210,color:'#6f4d89',fill:'#f0e6f6',text:options.title?.trim()||project.name,lineStyle:'solid',fontSize:32,labelInside:true}];
  annotations.push({id:'suggested:method',kind:'text',x:40,y:height-34,width:width-80,height:30,text:maxLinks?'Solid branches: code hierarchy. Dashed links: shared documents, including hidden descendants; association does not establish causation.':'Branches show code hierarchy; position and size do not measure importance.',fontSize:24,bold:false,color:'#475569',lineStyle:'solid'});
  return {design:{mode,width,height,maxLinks,hubId,rootIds},codes:updates,hiddenIds:codes.filter(c=>!selected.has(c.id)).map(c=>c.id),edges,annotations};
}

export function applyCodeMapSuggestion(project:Project,suggestion:MapSuggestion):Project {
  const patches=new Map(suggestion.codes.map(c=>[c.id,c.patch]));
  const samePair=(a:MapEdgeStyle,b:MapEdgeStyle)=>a.kind===b.kind&&[a.fromCodeId,a.toCodeId].includes(b.fromCodeId)&&[a.fromCodeId,a.toCodeId].includes(b.toCodeId);
  const previous=suggestion.replaceCanvas?[]:project.mapEdgeStyles||[];
  const edges=suggestion.edges.map(edge=>{const old=previous.find(e=>samePair(e,edge));return old?.label?{...edge,label:old.label,labelDx:old.labelDx,labelDy:old.labelDy,labelFontSize:old.labelFontSize,labelColor:old.labelColor,labelFontFamily:old.labelFontFamily,labelBold:old.labelBold,labelItalic:old.labelItalic,labelUnderline:old.labelUnderline}:edge;});
  return {...project,visualizationNotes:(project.mapDesign?.family||'code-map')===(suggestion.design.family||'code-map')?project.visualizationNotes:[],mapView:undefined,codes:project.codes.map(c=>patches.has(c.id)?{...c,mapGroupId:undefined,mapLayer:undefined,mapScale:undefined,...patches.get(c.id)}:c),hiddenMapCodeIds:suggestion.hiddenIds,mapDesign:suggestion.design,
    mapAnnotations:[...(suggestion.design.mode==='manual'||suggestion.replaceCanvas?[]:project.mapAnnotations||[]).filter(a=>!a.id.startsWith('suggested:')), ...suggestion.annotations],
    mapEdgeStyles:[...(suggestion.design.mode==='manual'||suggestion.replaceCanvas?[]:previous).filter(e=>(!e.id.startsWith('suggested:')||!!e.label)&&!edges.some(s=>samePair(s,e))),...edges]};
}

export function ellipseEndpoint(from:{x:number;y:number},to:{x:number;y:number},width:number,height:number){const dx=to.x-from.x,dy=to.y-from.y,ratio=Math.sqrt((dx/(width/2))**2+(dy/(height/2))**2);return ratio>1?{x:from.x+dx/ratio,y:from.y+dy/ratio}:from;}
