"use client";

import { useEffect, useRef, type RefObject } from "react";
import { brandMeshes } from "./brand-mesh";

type Matrix = number[];
const identity = (): Matrix => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
function multiply(a: Matrix, b: Matrix): Matrix {
  return Array.from({ length: 16 }, (_, i) => {
    const row = i % 4, col = Math.floor(i / 4);
    return a[row] * b[col * 4] + a[row + 4] * b[col * 4 + 1] + a[row + 8] * b[col * 4 + 2] + a[row + 12] * b[col * 4 + 3];
  });
}
function translation(x: number, y: number, z: number) { const m = identity(); m[12] = x; m[13] = y; m[14] = z; return m; }
function rotation(axis: "x" | "y" | "z", angle: number): Matrix {
  const c = Math.cos(angle), s = Math.sin(angle);
  if (axis === "x") return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1];
  if (axis === "y") return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1];
  return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1];
}
const compose = (...matrices: Matrix[]) => matrices.reduce(multiply, identity());
const smooth = (v: number, a: number, b: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// Inverse transpose keeps the lighting correct on scaled ellipsoids.
function normalMatrix(m: Matrix) {
  const a = [m[0],m[1],m[2]], b = [m[4],m[5],m[6]], c = [m[8],m[9],m[10]];
  const cross = (u: number[], v: number[]) => [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const x = cross(b,c), y = cross(c,a), z = cross(a,b);
  const determinant = a.reduce((sum, n, i) => sum + n*x[i], 0) || 1;
  return [...x,...y,...z].map(n => n/determinant);
}

const vertex = `
attribute vec3 position; attribute vec3 normal;
uniform mat4 model; uniform mat3 normalModel;
uniform vec4 framing; uniform float opacity;
varying vec3 vNormal; varying vec3 vPosition; varying vec3 vLocal;
void main(){
 vec3 p=(model*vec4(position,1.)).xyz;
 vNormal=normalize(normalModel*normal); vPosition=p; vLocal=position;
 float perspective=4.5/(4.5-p.z);
 gl_Position=vec4(framing.x+p.x*framing.z*perspective,framing.y+p.y*framing.w*perspective,-p.z*.18,1.);
}`;
const fragment = `
precision mediump float;
varying vec3 vNormal; varying vec3 vPosition; varying vec3 vLocal;
uniform vec3 color; uniform float opacity; uniform float flatAmount;
void main(){
 vec3 n=normalize(vNormal);
 if(abs(vLocal.z)>.07)n=normalize(n+vec3(sin(vLocal.x*3.)*.18,cos(vLocal.y*2.)*.24,0.));
 vec3 light=normalize(vec3(-.65,1.1,2.));
 float diffuse=max(dot(n,light),0.);
 float spec=pow(max(dot(reflect(-light,n),vec3(0.,0.,1.)),0.),48.);
 float rim=pow(1.-abs(n.z),3.);
 float studio=pow(.5+.5*sin(vLocal.x*3.-vLocal.y*2.+n.x*4.),12.);
 vec3 lit=color*(.25+.65*diffuse)+vec3(.48,.65,.78)*spec*.75+color*rim*.30+studio*vec3(.24,.33,.41);
 float eye=length(vLocal.xy-vec2(.281,.719));
 if(abs(vLocal.z)>.07)lit=mix(lit,vec3(.025,.07,.11),1.-smoothstep(.025,.034,eye));
 float pupil=1.-smoothstep(.025,.034,eye);
 gl_FragColor=vec4(mix(lit,vec3(.313725,.6,.8),flatAmount),opacity*(1.-pupil*flatAmount));
}`;
function flightPosition(progress: number, mobile: boolean) {
  const keys = [[0,.75,mobile?.70:.53],[.16,.65,mobile?.63:.58],[.30,.09,.56],[.44,.37,.54],[.58,.69,.56],[.74,mobile?.84:.92,mobile?.80:.69],[1,mobile?.84:.92,mobile?.81:.73]];
  const i=keys.findIndex((key,index)=>index>0&&progress<=key[0]);
  if(i<0)return keys[keys.length-1].slice(1);
  const a=keys[i-1],b=keys[i],t=smooth(progress,a[0],b[0]);
  return [a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
}

export default function SwanScene({ progress, reduced, onEyePosition, dock = 0, handoff = 0, brandTarget, screenBottom }: {
  progress: number;
  reduced: boolean;
  onEyePosition?: (position: { x: number; y: number }) => void;
  dock?: number;
  handoff?: number;
  brandTarget?: RefObject<HTMLImageElement | null>;
  screenBottom?: number;
}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const input=useRef({progress,reduced,dock,handoff,screenBottom});
  const eyeCallback=useRef(onEyePosition);
  useEffect(()=>{eyeCallback.current=onEyePosition;},[onEyePosition]);
  useEffect(()=>{input.current={progress,reduced,dock,handoff,screenBottom};},[progress,reduced,dock,handoff,screenBottom]);
  useEffect(()=>{
    const element=canvas.current;
    if(!element)return;
    const gl=element.getContext("webgl",{alpha:true,antialias:true,premultipliedAlpha:false});
    if(!gl)return;
    const shader=(type:number,source:string)=>{
      const value=gl.createShader(type)!;
      gl.shaderSource(value,source);gl.compileShader(value);
      if(!gl.getShaderParameter(value,gl.COMPILE_STATUS)){gl.deleteShader(value);return null;}
      return value;
    };
    const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);
    if(!vs||!fs)return;
    const program=gl.createProgram()!;
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))return;
    gl.useProgram(program);
    const meshes=brandMeshes().map(data=>{
      const buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
      return {buffer,count:data.length/6};
    });
    const attributes=[gl.getAttribLocation(program,"position"),gl.getAttribLocation(program,"normal")];
    attributes.forEach(location=>gl.enableVertexAttribArray(location));
    const uniforms=Object.fromEntries(["model","normalModel","framing","color","opacity","flatAmount"].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    const render=(matrix:Matrix,color:number[],mesh=0)=>{
      gl.bindBuffer(gl.ARRAY_BUFFER,meshes[mesh].buffer);
      attributes.forEach((location,i)=>gl.vertexAttribPointer(location,3,gl.FLOAT,false,24,i*12));
      gl.uniformMatrix4fv(uniforms.model,false,new Float32Array(matrix));
      gl.uniformMatrix3fv(uniforms.normalModel,false,new Float32Array(normalMatrix(matrix)));
      gl.uniform3fv(uniforms.color,new Float32Array(color));gl.drawArrays(gl.TRIANGLES,0,meshes[mesh].count);
    };
    let frame=0,previous=0,lastDraw=0,p=input.current.progress,turn=0;
    let visible=true,lost=false;
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;});observer.observe(element);
    const contextLost=(event:Event)=>{event.preventDefault();lost=true;delete element.dataset.ready;cancelAnimationFrame(frame);};
    element.addEventListener("webglcontextlost",contextLost);
    const draw=(time:number)=>{
      if(lost)return;
      frame=requestAnimationFrame(draw);
      if(!visible){previous=time;return;}
      if(time-lastDraw<40)return;
      lastDraw=time;
      const dt=Math.min((time-previous)/1000,.08);previous=time;
      p+=(input.current.progress-p)*(1-Math.exp(-dt*14));
      const canvasBounds=element.getBoundingClientRect();
      const {width:w,height:h}=canvasBounds;
      if(!w||!h)return;
      const ratio=Math.min(devicePixelRatio,1.25);
      if(element.width!==Math.round(w*ratio)||element.height!==Math.round(h*ratio)){element.width=Math.round(w*ratio);element.height=Math.round(h*ratio);}
      gl.viewport(0,0,element.width,element.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const mobile=w<=850,still=input.current.reduced;
      const inspect=smooth(p,.66,.76),moving=smooth(p,.1,.25)*(1-smooth(p,.63,.76));
      let size=(mobile?Math.min(w*.55,330):Math.min(w*.34,h*.61))*(1-smooth(p,.14,.3)*.35)*(1-inspect*.12);
      const [initialX,y]=flightPosition(p,mobile);
      let x=initialX;
      const docking=input.current.dock;
      const catalogBottom=input.current.screenBottom ?? h*.43+32+Math.min(w*.94,1100,h*1.05)*937/1784;
      if(mobile){
        const fitted=Math.min(size,Math.max(60,(h-catalogBottom-55)/.8));
        size+=(fitted-size)*inspect;
      }
      const below=Math.min(h-size*.20-45,catalogBottom+size*.50+12)/h;
      let guidedY=mobile?y+(below-y)*inspect:y;
      const target=brandTarget?.current?.getBoundingClientRect();
      if(target && docking>0){
        const targetX=(target.left-canvasBounds.left+target.width*417/940)/w;
        const targetY=(target.top-canvasBounds.top+target.height*285/920)/h;
        x+=(targetX-x)*docking;
        guidedY+=(targetY-guidedY)*docking;
        size+=(target.width*570/940-size)*docking;
      }
      gl.uniform4f(uniforms.framing,x*2-1,1-guidedY*2,size/w,size/h);
      gl.uniform1f(uniforms.opacity,1-input.current.handoff);
      gl.uniform1f(uniforms.flatAmount,docking);
      // Turn the whole animal toward the catalog; the head only makes small glances.
      const targetTurn=inspect*Math.PI;
      turn+=(targetTurn-turn)*(1-Math.exp(-dt*5));
      // Preserve the exact SYSNEY silhouette. Move the wing as one solid part.
      const flatten=identity();
      flatten[10]=1-docking*.999;
      const root=compose(rotation("y",(-.16+turn)*(1-docking)),rotation("z",still?0:Math.sin(time*.0018)*.012*moving*(1-docking)),flatten);
      const blue=[.31,.60,.80];
      render(root,blue,0);
      // Project the pupil with the same model matrix and camera as the shader.
      const eye=[.281,.719,root[10]>=0?.075:-.075];
      const world=[0,1,2].map(row=>root[row]*eye[0]+root[row+4]*eye[1]+root[row+8]*eye[2]+root[row+12]);
      const perspective=4.5/(4.5-world[2]);
      eyeCallback.current?.({x:x*w+world[0]*size*.5*perspective,y:guidedY*h-world[1]*size*.5*perspective});
      const beat=still?0:(.5+.5*Math.sin(time*.0038))*(.14+moving*.16)*(1-inspect*.65)*(1-docking);
      const pivot=[.24,-.55,0];
      const wing=compose(root,translation(...pivot as [number,number,number]),rotation("y",beat),translation(-pivot[0],-pivot[1],0));
      render(wing,blue,1);
      element.dataset.ready="true";
    };
    frame=requestAnimationFrame(draw);
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();element.removeEventListener("webglcontextlost",contextLost);meshes.forEach(mesh=>gl.deleteBuffer(mesh.buffer));gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);};
  },[brandTarget]);
  return <canvas ref={canvas} className="collection-swan-canvas" aria-hidden="true" />;
}
