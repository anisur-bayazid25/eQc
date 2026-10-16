import type {Code,MapAnnotation,Project} from '../domain';
export interface ObjectBox {x:number;y:number;width:number;height:number;}
export interface MapObject {key:string;id:string;kind:'annotation'|'code';box:ObjectBox;anchor?:{x:number;y:number};group?:string;layer:number;shape?:boolean;}
export type ObjectCommand={type:'transform';from:ObjectBox;to:ObjectBox;positions?:Record<string,{x:number;y:number}>}|{type:'group';group:string}|{type:'ungroup'}|{type:'align';axis:'left'|'center'|'right'|'top'|'middle'|'bottom';items:MapObject[]}|{type:'layers';order:string[]};
export function objectBounds(items:MapObject[]):ObjectBox {const x=Math.min(...items.map(i=>i.box.x)),y=Math.min(...items.map(i=>i.box.y));return {x,y,width:Math.max(1,...items.map(i=>i.box.x+i.box.width-x)),height:Math.max(1,...items.map(i=>i.box.y+i.box.height-y))};}
export function applyObjectCommand(project:Project,keys:string[],command:ObjectCommand):Project {
 if(command.type==='align'){const bounds=objectBounds(command.items);let result=project;for(const item of command.items){const b=item.box,to={...b};if(command.axis==='left')to.x=bounds.x;if(command.axis==='center')to.x=bounds.x+(bounds.width-b.width)/2;if(command.axis==='right')to.x=bounds.x+bounds.width-b.width;if(command.axis==='top')to.y=bounds.y;if(command.axis==='middle')to.y=bounds.y+(bounds.height-b.height)/2;if(command.axis==='bottom')to.y=bounds.y+bounds.height-b.height;result=applyObjectCommand(result,[item.key],{type:'transform',from:b,to,positions:item.anchor?{[item.id]:item.anchor}:undefined});}return result;}
 const selected=new Set(keys),layers=command.type==='layers'?new Map(command.order.map((key,i)=>[key,i])):null;
 const geometry=(x:number,y:number)=>{if(command.type!=='transform')return {x,y};const sx=command.to.width/command.from.width,sy=command.to.height/command.from.height;return {x:command.to.x+(x-command.from.x)*sx,y:command.to.y+(y-command.from.y)*sy};};
 const sx=command.type==='transform'?command.to.width/command.from.width:1,sy=command.type==='transform'?command.to.height/command.from.height:1,font=Math.min(sx,sy);
 if(![sx,sy].every(v=>Number.isFinite(v)&&v>0))return project;
 const codes=project.codes.map(c=>{const key='code:'+c.id;if(layers)return layers.has(key)?{...c,mapLayer:layers.get(key)}:c;if(!selected.has(key))return c;
  if(command.type==='group'||command.type==='ungroup')return {...c,mapGroupId:command.type==='group'?command.group:undefined};
  if(command.type!=='transform')return c;const position=command.positions?.[c.id]||c.mapPosition||{x:0,y:0};if(sx===1&&sy===1)return {...c,mapPosition:geometry(position.x,position.y)};const a=c.mapAppearance||{fill:c.color,stroke:c.color,width:180,height:c.mapShape==='ellipse'?80:60,fontSize:c.mapShape==='ellipse'?16:12};return {...c,mapPosition:geometry(position.x,position.y),mapScale:(c.mapScale||1)*font,mapAppearance:{...a,width:a.width*sx,height:a.height*sy,fontSize:Math.max(8,Math.min(256,a.fontSize*font))}};
 });
 const mapAnnotations=project.mapAnnotations?.map(a=>{const key='annotation:'+a.id;if(layers)return layers.has(key)?{...a,layer:layers.get(key)}:a;if(!selected.has(key))return a;
  if(command.type==='group'||command.type==='ungroup')return {...a,groupId:command.type==='group'?command.group:undefined};
  if(command.type!=='transform')return a;return {...a,...geometry(a.x,a.y),...(a.x2!==undefined&&a.y2!==undefined?{x2:geometry(a.x2,a.y2).x,y2:geometry(a.x2,a.y2).y}:{}),width:(a.width??(a.kind==='text'?250:0))*sx,height:(a.height??(a.kind==='text'?90:0))*sy,fontSize:Math.max(8,Math.min(256,(a.fontSize||(a.labelInside?20:14))*font))};
 });
 return {...project,codes,mapAnnotations};
}
