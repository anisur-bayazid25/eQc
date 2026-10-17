import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Project} from '../domain';
import {restoreMapDraft} from './mapDrafts';
import {ReportCodeMap} from '../components/CodeMap';
import {visualizationTypes} from './visualizations';
import type {ReportExtras} from './report';

class FigureBoundary extends React.Component<{children:React.ReactNode;onError:(error:Error)=>void},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error:Error){this.props.onError(error);}
  render(){return this.state.failed?null:this.props.children;}
}
const noop=()=>{};
const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));

/** Restore draft copies, never the working canvas. No persistence callbacks are supplied. */
export async function renderReportFigures(project:Project,ids:string[],includeNotes:boolean,onProgress:(message:string)=>void) {
  const figures:NonNullable<ReportExtras['draftFigures']>=[];
  for(const draft of (project.mapDrafts||[]).filter(d=>ids.includes(d.id))){
    onProgress(`Preparing graph ${figures.length+1} of ${ids.length}: ${draft.name}`);
    const host=document.createElement('div');
    host.setAttribute('aria-hidden','true');host.inert=true;
    Object.assign(host.style,{position:'fixed',left:'-20000px',top:'0',width:'1400px',height:'1000px',pointerEvents:'none'});
    document.body.append(host);
    const root=createRoot(host);
    const figure:NonNullable<ReportExtras['draftFigures']>[number]={id:draft.id,name:draft.name,updatedAt:draft.updatedAt,family:visualizationTypes.find(type=>type.id===draft.design?.family)?.name||'Code map',...(includeNotes?{notes:draft.notes||[]}: {})};
    try{
      const restored=restoreMapDraft(project,draft.id);
      let renderError:Error|undefined;
      flushSync(()=>root.render(<FigureBoundary onError={error=>{renderError=error;}}><ReportCodeMap
        active={false} projectId={project.id} projectName={project.name} mapDesign={restored.mapDesign} mapView={restored.mapView}
        codes={restored.codes} codedSegments={project.codedSegments} docs={project.docs} analysisPeriods={project.analysisPeriods}
        mapEdgeStyles={restored.mapEdgeStyles||[]} annotations={restored.mapAnnotations||[]} hiddenMapCodeIds={restored.hiddenMapCodeIds||[]}
        customMapPalettes={project.customMapPalettes} onUpdateCode={noop} onUpdateCodesBatch={noop} onUpdateEdgeStyle={noop}
        onAddEdgeStyle={noop} onDeleteEdgeStyle={noop} onUpdateAnnotations={noop} onUpdateHiddenMapCodes={noop}
      /></FigureBoundary>));
      // Allow saved view effects and text layout to settle before serializing.
      await frame();await frame();await frame();
      if(renderError)throw renderError;
      const svg=host.querySelector<SVGSVGElement>('.map-viewport svg');
      if(!svg)throw Error('The saved graph could not be rendered.');
      const clone=svg.cloneNode(true) as SVGSVGElement;
      clone.querySelectorAll('[data-map-editor],[data-map-edit-outline],[data-visualization-notes]').forEach(el=>el.remove());
      if(!draft.view.includeLegendInExport)clone.querySelectorAll('[data-map-legend]').forEach(el=>el.remove());
      for(const name of ['font-size','stroke','stroke-width','opacity'])clone.querySelectorAll('[data-export-'+name+']').forEach(el=>{el.setAttribute(name,el.getAttribute('data-export-'+name)!);el.removeAttribute('data-export-'+name);});
      const bounds=svg.viewBox.baseVal;
      clone.setAttribute('width',String(bounds.width));clone.setAttribute('height',String(bounds.height));
      clone.style.backgroundColor='#fff';clone.style.removeProperty('box-shadow');clone.style.removeProperty('cursor');
      clone.querySelector('[data-map-paper]')?.setAttribute('fill','#ffffff');
      figure.svg=new XMLSerializer().serializeToString(clone);
    }catch(error){figure.error=error instanceof Error?error.message:String(error);}
    finally{root.unmount();host.remove();}
    figures.push(figure);
  }
  return figures;
}
