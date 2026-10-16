export interface PhotoCrop {zoom:number;x:number;y:number;aspect:number;}
export function photoGeometry(crop:PhotoCrop){
 const zoom=Math.max(1,Math.min(4,crop.zoom)),aspect=Math.max(.01,Math.min(100,crop.aspect)),width=Math.max(1,aspect)*zoom,height=Math.max(1,1/aspect)*zoom;
 return {width,height,left:(1-width)/2+Math.max(-1,Math.min(1,crop.x))*(width-1)/2,top:(1-height)/2+Math.max(-1,Math.min(1,crop.y))*(height-1)/2};
}
