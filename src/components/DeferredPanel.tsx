import React from 'react';
export function deferPanel<P extends object>(load:()=>Promise<{default:React.ComponentType<P>}>,label:string):React.ComponentType<P> {
  const Component=React.lazy(load);
  return function DeferredPanel(props:P){return <React.Suspense fallback={<div className="deferred-panel" role="status">Loading {label}…</div>}>{React.createElement(Component,props as any)}</React.Suspense>;};
}
