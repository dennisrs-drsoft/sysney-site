import { swanOutline } from "./swan-outline";
type P = [number,number];
const cross=(a:P,b:P,c:P)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function triangulate(points:P[]) {
  const ids=points.map((_,i)=>i),faces:P[][]=[];
  const area=points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
  if(area<0)ids.reverse();
  while(ids.length>2){
    let found=false;
    for(let i=0;i<ids.length;i++){
      const face=[ids[(i+ids.length-1)%ids.length],ids[i],ids[(i+1)%ids.length]];
      const [a,b,c]=face.map(id=>points[id]);
      if(cross(a,b,c)<=.0000001)continue;
      if(ids.some(id=>!face.includes(id)&&cross(a,b,points[id])>=0&&cross(b,c,points[id])>=0&&cross(c,a,points[id])>=0))continue;
      faces.push([a,b,c]);ids.splice(i,1);found=true;break;
    }
    if(!found)break;
  }
  return faces;
}
// Clip triangles into rigid wing/body pieces without changing the brand outline.
function clip(polygon:P[],plane:number[],inside=true):P[]{
  const out:P[]=[];
  const distance=(p:P)=>(plane[0]*p[0]+plane[1]*p[1]+plane[2])*(inside?1:-1);
  polygon.forEach((a,i)=>{
    const b=polygon[(i+1)%polygon.length],da=distance(a),db=distance(b);
    if(da>=0)out.push(a);
    if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  });
  return out;
}
function extrude(polygons:P[][]){
  const data:number[]=[],edges=new Map<string,[P,P]>();
  const key=(p:P)=>p.map(n=>Math.round(n*100000)).join(',');
  const triangle=(a:number[],b:number[],c:number[],normal:number[])=>{for(const p of [a,b,c])data.push(...p,...normal);};
  for(const polygon of polygons){
    for(let i=1;i<polygon.length-1;i++){
      const [a,b,c]=[polygon[0],polygon[i],polygon[i+1]];
      triangle([...a,.075],[...b,.075],[...c,.075],[0,0,1]);
      triangle([...c,-.075],[...b,-.075],[...a,-.075],[0,0,-1]);
    }
    polygon.forEach((a,i)=>{const b=polygon[(i+1)%polygon.length],forward=key(a)+'|'+key(b),reverse=key(b)+'|'+key(a);if(edges.has(reverse))edges.delete(reverse);else edges.set(forward,[a,b]);});
  }
  for(const [a,b] of edges.values()){
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,n=[dy/len,-dx/len,0];
    triangle([...a,-.075],[...b,-.075],[...b,.075],n);
    triangle([...a,-.075],[...b,.075],[...a,.075],n);
  }
  return new Float32Array(data);
}
export function brandMeshes(){
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',swanOutline);
  const length=path.getTotalLength();
  const points:P[]=Array.from({length:520},(_,i)=>{const p=path.getPointAtLength(length*i/520);return [(p.x-457)/285,(295-p.y)/285];});
  const body:P[][]=[],wings:P[][]=[];
  const planes=[[0,1,.64],[-1,0,.26],[-.6,-1,-.08]];
  for(const triangle of triangulate(points)){
    let remaining=triangle;
    for(const plane of planes){
      if(remaining.length<3)break;
      const outside=clip(remaining,plane,false);if(outside.length>=3)body.push(outside);
      remaining=clip(remaining,plane);
    }
    if(remaining.length>=3)wings.push(remaining);
  }
  return [extrude(body),extrude(wings)];
}
