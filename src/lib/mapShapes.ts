import type {MapAnnotation} from '../domain';
export interface DrawingShape {id:string;name:string;kind:MapAnnotation['kind'];points?:number[];rounded?:boolean;arrowHead?:boolean;}
const regular=(n:number)=>Array.from({length:n},(_,i)=>[-Math.PI/2+i*2*Math.PI/n]).flatMap(([a])=>[.5+.5*Math.cos(a),.5+.5*Math.sin(a)]);
const star=Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,r=i%2?.22:.5;return [.5+r*Math.cos(a),.5+r*Math.sin(a)];}).flat();
export const drawingShapes:DrawingShape[]=[
 {id:'rectangle',name:'Rectangle',kind:'rect'},
 {id:'rounded',name:'Rounded rectangle',kind:'rect',rounded:true},
 {id:'ellipse',name:'Oval / circle',kind:'circle'},
 {id:'triangle',name:'Triangle',kind:'rect',points:[.5,0,1,1,0,1]},
 {id:'right-triangle',name:'Right triangle',kind:'rect',points:[0,0,1,1,0,1]},
 {id:'diamond',name:'Diamond',kind:'rect',points:[.5,0,1,.5,.5,1,0,.5]},
 {id:'pentagon',name:'Pentagon',kind:'rect',points:regular(5)},
 {id:'hexagon',name:'Hexagon',kind:'rect',points:[.25,0,.75,0,1,.5,.75,1,.25,1,0,.5]},
 {id:'octagon',name:'Octagon',kind:'rect',points:[.3,0,.7,0,1,.3,1,.7,.7,1,.3,1,0,.7,0,.3]},
 {id:'parallelogram',name:'Parallelogram',kind:'rect',points:[.25,0,1,0,.75,1,0,1]},
 {id:'trapezoid',name:'Trapezoid',kind:'rect',points:[.2,0,.8,0,1,1,0,1]},
 {id:'chevron',name:'Chevron',kind:'rect',points:[0,0,.65,0,1,.5,.65,1,0,1,.35,.5]},
 {id:'right-arrow',name:'Right block arrow',kind:'rect',points:[0,.3,.6,.3,.6,0,1,.5,.6,1,.6,.7,0,.7]},
 {id:'left-arrow',name:'Left block arrow',kind:'rect',points:[1,.3,.4,.3,.4,0,0,.5,.4,1,.4,.7,1,.7]},
 {id:'double-arrow',name:'Double block arrow',kind:'rect',points:[0,.5,.3,0,.3,.3,.7,.3,.7,0,1,.5,.7,1,.7,.7,.3,.7,.3,1]},
 {id:'star',name:'Star',kind:'rect',points:star},
 {id:'cross',name:'Plus / cross',kind:'rect',points:[.33,0,.67,0,.67,.33,1,.33,1,.67,.67,.67,.67,1,.33,1,.33,.67,0,.67,0,.33,.33,.33]},
 {id:'callout',name:'Speech callout',kind:'rect',points:[0,0,1,0,1,.75,.45,.75,.2,1,.25,.75,0,.75]},
 {id:'line',name:'Line',kind:'arrow',arrowHead:false},
 {id:'arrow',name:'Arrow connector',kind:'arrow',arrowHead:true},
 {id:'text',name:'Text box',kind:'text'},
];
export function drawingAnnotation(shape:DrawingShape,box:{x0:number;y0:number;x1:number;y1:number},id:string,color:string):MapAnnotation {
 const x=Math.min(box.x0,box.x1),y=Math.min(box.y0,box.y1),width=Math.abs(box.x1-box.x0),height=Math.abs(box.y1-box.y0);
 const base={id,shapeType:shape.id,color,lineStyle:'solid' as const};
 if(shape.kind==='arrow')return {...base,kind:'arrow',x:box.x0,y:box.y0,x2:box.x1,y2:box.y1,arrowHead:shape.arrowHead};
 return {...base,kind:shape.kind,x,y,width,height,polygonPoints:shape.points,cornerRadius:shape.rounded ? .12 : undefined,...(shape.kind==='text'?{}:{fill:'#eef2f6',textColor:'#17212b',labelInside:true,fontSize:20})};
}
