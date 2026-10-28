import {createContext,RefObject,useCallback,useContext,useLayoutEffect,useRef} from 'react';

export const AnalysisActivityContext=createContext(true);
export const useAnalysisActive=()=>useContext(AnalysisActivityContext);

/** Keep the working view in memory without storing research text in browser storage. */
export function useAnalysisScrollMemory(root:RefObject<HTMLElement>,active:boolean) {
  const saved=useRef<Array<{element:HTMLElement;top:number;left:number}>>([]);
  const remember=useCallback(()=>{
    if(!root.current?.getClientRects().length)return;
    const elements=[root.current,...root.current.querySelectorAll<HTMLElement>('.matrix-viewport-scroll,.analysis-writing-column,.analysis-evidence-column,.cooc-excerpts-panel,.case-framework-drawer-body,.research-content,.memo-tab-workspace,textarea')];
    saved.current=elements.map(element=>({element,top:element.scrollTop,left:element.scrollLeft}));
  },[root]);
  useLayoutEffect(()=>{
    if(!active)return;
    const restore=()=>{for(const item of saved.current)if(item.element.isConnected){item.element.scrollTop=item.top;item.element.scrollLeft=item.left;}};
    restore();const frame=requestAnimationFrame(restore);
    return()=>{
      cancelAnimationFrame(frame);
      remember();
    };
  },[active,root,remember]);
  return remember;
}
