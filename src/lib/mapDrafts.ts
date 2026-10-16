import {CodeMapDraft, CodeMapView, Project, uid} from '../domain';

export function saveMapDraft(project:Project,name:string,view:CodeMapView):Project {
  const title=name.trim();if(!title)throw new Error('Enter a draft name.');
  const existing=project.mapDrafts?.find(d=>d.name===title);
  const draft:CodeMapDraft=structuredClone({id:existing?.id||uid('mapdraft'),name:title,updatedAt:Date.now(),
    nodes:project.codes.map(({id,mapPosition,mapShape,mapAppearance,mapLabel,mapGroupId,mapLayer,mapScale})=>({id,mapPosition,mapShape,mapAppearance,mapLabel,mapGroupId,mapLayer,mapScale})),
    annotations:project.mapAnnotations||[],edges:project.mapEdgeStyles||[],hiddenIds:project.hiddenMapCodeIds||[],design:project.mapDesign,view});
  return {...project,mapView:structuredClone(view),mapDrafts:[...(project.mapDrafts||[]).filter(d=>d.id!==draft.id),draft]};
}

export function restoreMapDraft(project:Project,id:string):Project {
  const draft=project.mapDrafts?.find(d=>d.id===id);if(!draft)throw new Error('This map draft is no longer available.');
  const saved=structuredClone(draft),ids=new Set(project.codes.map(c=>c.id)),nodes=new Map(saved.nodes.map(n=>[n.id,n]));
  return {...project,codes:project.codes.map(code=>{const node=nodes.get(code.id);return node?{...code,mapPosition:node.mapPosition,mapShape:node.mapShape,mapAppearance:node.mapAppearance,mapLabel:node.mapLabel,mapGroupId:node.mapGroupId,mapLayer:node.mapLayer,mapScale:node.mapScale}:code;}),
    mapAnnotations:saved.annotations,mapEdgeStyles:saved.edges.filter(e=>ids.has(e.fromCodeId)&&ids.has(e.toCodeId)),
    hiddenMapCodeIds:project.codes.filter(c=>!nodes.has(c.id)||saved.hiddenIds.includes(c.id)).map(c=>c.id),
    // Retain the complete design for backup compatibility; the view records the final resized canvas.
    mapDesign:saved.design?{...saved.design,width:saved.view.width,height:saved.view.height,rootIds:saved.design.rootIds.filter(id=>ids.has(id))}:undefined,
    mapView:saved.view};
}
