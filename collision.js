/* 실내 1인칭 전용 수평 충돌: swept OBB + 벽을 따라 미끄러지는 이동. */
window.MuseumCollision=function(model,layout){
 const radius=.08,groups=['wall','frame','glass','structure','displays','displayGlass','details'];
 const boxes=model.parts.filter(p=>!p.mesh&&groups.includes(p.group));
 for(const w of layout.navigationBarriers||[]){
  const a=MuseumGeometry.point(w.a),b=MuseumGeometry.point(w.b);
  boxes.push({position:[(a[0]+b[0])/2,w.height/2,(a[1]+b[1])/2],size:[Math.hypot(b[0]-a[0],b[1]-a[1]),w.height,w.thickness],yaw:-Math.atan2(b[1]-a[1],b[0]-a[0])});
 }
 const meshTriangles=[];
 for(const part of model.parts.filter(p=>p.mesh&&['details','displays'].includes(p.group))){
  const {pos,idx}=part.mesh,size=part.size||[1,1,1],position=part.position||[0,0,0],c=Math.cos(part.yaw||0),s=Math.sin(part.yaw||0);
  const vertex=index=>{
   const x=pos[index*3]*size[0],y=pos[index*3+1]*size[1],z=pos[index*3+2]*size[2];
   return [position[0]+c*x+s*z,position[1]+y,position[2]-s*x+c*z];
  };
  const count=idx?idx.length:pos.length/3;
  for(let i=0;i+2<count;i+=3){
   const a=vertex(idx?idx[i]:i),b=vertex(idx?idx[i+1]:i+1),d=vertex(idx?idx[i+2]:i+2);
   meshTriangles.push({a,b,c:d,minX:Math.min(a[0],b[0],d[0]),maxX:Math.max(a[0],b[0],d[0]),
    minZ:Math.min(a[2],b[2],d[2]),maxZ:Math.max(a[2],b[2]),minY:Math.min(a[1],b[1],d[1]),maxY:Math.max(a[1],b[1],d[1])});
  }
 }
 for(const w of layout.solidWalls||[])for(let i=0;i<w.polygon.length;i++){
  const a=MuseumGeometry.point(w.polygon[i]),b=MuseumGeometry.point(w.polygon[(i+1)%w.polygon.length]);
  boxes.push({position:[(a[0]+b[0])/2,w.height/2,(a[1]+b[1])/2],size:[Math.hypot(b[0]-a[0],b[1]-a[1]),w.height,.001],yaw:-Math.atan2(b[1]-a[1],b[0]-a[0])});
 }
 const solidAreas=(layout.solidWalls||[]).map(w=>({polygon:w.polygon.map(MuseumGeometry.point),height:w.height}));
 const local=(p,b)=>{const x=p[0]-b.position[0],z=p[2]-b.position[2],c=Math.cos(b.yaw),s=Math.sin(b.yaw);return [c*x-s*z,s*x+c*z];};
 function inPolygon(x,z,polygon){let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
 function segmentIntersects(a,b,c,d){
  const orient=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const on=(p,q,r)=>q[0]>=Math.min(p[0],r[0])-1e-9&&q[0]<=Math.max(p[0],r[0])+1e-9&&q[1]>=Math.min(p[1],r[1])-1e-9&&q[1]<=Math.max(p[1],r[1])+1e-9;
  const x=orient(a,b,c),y=orient(a,b,d),z=orient(c,d,a),w=orient(c,d,b);
  return x*y<=1e-12&&z*w<=1e-12&&(!x?on(a,c,b):true)&&(!y?on(a,d,b):true)&&(!z?on(c,a,d):true)&&(!w?on(c,b,d):true);
 }
 function blocksSolidArea(p,area){
  if(p[1]+.18<=0||p[1]-1.525>=area.height)return false;
  return inPolygon(p[0],p[2],area.polygon);
 }
 function meshBlocks(p,triangles,r){
  const low=p[1]-1.525,high=p[1]+.18;
  for(const tri of triangles){
   if(tri.maxY<low||tri.minY>high||p[0]<tri.minX-r||p[0]>tri.maxX+r||p[2]<tri.minZ-r||p[2]>tri.maxZ+r)continue;
   const {a,b,c}=tri,den=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
   if(Math.abs(den)>1e-10){
    const wb=((p[0]-a[0])*(c[2]-a[2])-(p[2]-a[2])*(c[0]-a[0]))/den;
    const wc=((b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]))/den,wa=1-wb-wc;
    if(wa>=-1e-8&&wb>=-1e-8&&wc>=-1e-8){
     const y=wa*a[1]+wb*b[1]+wc*c[1];if(y>=low&&y<=high)return true;
    }
   }
   for(const [u,v] of [[a,b],[b,c],[c,a]]){
    const dx=v[0]-u[0],dz=v[2]-u[2],length=dx*dx+dz*dz;
    const t=length?Math.max(0,Math.min(1,((p[0]-u[0])*dx+(p[2]-u[2])*dz)/length)):0;
    const x=u[0]+dx*t,z=u[2]+dz*t,y=u[1]+(v[1]-u[1])*t;
    if((p[0]-x)**2+(p[2]-z)**2<r*r&&y>=low&&y<=high)return true;
   }
  }
  return false;
 }
 // 눈높이가 아닌 발끝~머리 범위. 낮은 받침/상판도 막고 상부 보는 통과한다.
 const relevant=(b,y)=>y+.18>b.position[1]-b.size[1]/2&&y-1.525<b.position[1]+b.size[1]/2;
 // r: 몸 반지름. 기본은 1인칭 카메라(8cm), 관람 인원 배치(visitors.js)는 카테고리별 반지름을 넘긴다.
 function blocked(p,r=radius){return boxes.some(b=>{const q=local(p,b);return relevant(b,p[1])&&Math.abs(q[0])<b.size[0]/2+r&&Math.abs(q[1])<b.size[2]/2+r;})||solidAreas.some(area=>blocksSolidArea(p,area))||meshBlocks(p,meshTriangles,r);}
 function hit(a,b,box){
  if(!relevant(box,a[1]))return null;const p=local(a,box),q=local(b,box),half=[box.size[0]/2+radius,box.size[2]/2+radius];let enter=-Infinity,exit=Infinity,normal=null;
  for(let i=0;i<2;i++){const d=q[i]-p[i];if(Math.abs(d)<1e-10){if(Math.abs(p[i])>=half[i])return null;continue;}
   let lo=(-half[i]-p[i])/d,hi=(half[i]-p[i])/d;const sign=d>0?-1:1;if(lo>hi)[lo,hi]=[hi,lo];
   if(lo>enter){enter=lo;normal=i===0?[Math.cos(box.yaw)*sign,0,-Math.sin(box.yaw)*sign]:[Math.sin(box.yaw)*sign,0,Math.cos(box.yaw)*sign];}
   exit=Math.min(exit,hi);if(enter>exit)return null;
  }
  return enter>=0&&enter<=1&&exit>=0?{t:enter,normal}:null;
 }
 function move(from,to){let pos=[...from],remaining=to.map((v,i)=>v-from[i]);remaining[1]=0;
  for(let iteration=0;iteration<3;iteration++){
   const dest=pos.map((v,i)=>v+remaining[i]);let nearest=null;for(const box of boxes){const h=hit(pos,dest,box);if(h&&(!nearest||h.t<nearest.t))nearest=h;}
   if(!nearest)return dest;const len=Math.hypot(...remaining),t=Math.max(0,nearest.t-.001/Math.max(.001,len));pos=pos.map((v,i)=>v+remaining[i]*t);
   remaining=remaining.map(v=>v*(1-t));const dot=remaining.reduce((s,v,i)=>s+v*nearest.normal[i],0);if(dot<0)remaining=remaining.map((v,i)=>v-dot*nearest.normal[i]);
  }return pos;
 }
 function inside(p){const v=(layout.floor?.polygon||layout.envelope).map(MuseumGeometry.point);let yes=false;for(let i=0,j=v.length-1;i<v.length;j=i++){if((v[i][1]>p[2])!==(v[j][1]>p[2])&&p[0]<(v[j][0]-v[i][0])*(p[2]-v[i][1])/(v[j][1]-v[i][1])+v[i][0])yes=!yes;}return yes;}
 function clear(from,to){
  if(!inside(from)||!inside(to)||blocked(from)||blocked(to))return false;
  for(const box of boxes)if(hit(from,to,box))return false;
  for(const area of solidAreas){
   if(from[1]+.18<=0||from[1]-1.525>=area.height)continue;
   if(inPolygon((from[0]+to[0])/2,(from[2]+to[2])/2,area.polygon))return false;
   for(let i=0;i<area.polygon.length;i++){
    const a=area.polygon[i],b=area.polygon[(i+1)%area.polygon.length];
    if(segmentIntersects([from[0],from[2]],[to[0],to[2]],a,b))return false;
   }
  }
  const steps=Math.max(1,Math.ceil(Math.hypot(to[0]-from[0],to[2]-from[2])/.08));
  for(let i=1;i<steps;i++){
   const t=i/steps,p=from.map((v,k)=>v+(to[k]-v)*t);
   if(!inside(p)||blocked(p))return false;
  }
  return true;
 }
 function spawn(wanted){if(inside(wanted)&&!blocked(wanted))return [...wanted];for(let r=.2;r<40;r+=.2)for(let i=0;i<32;i++){const p=[wanted[0]+r*Math.cos(i*Math.PI/16),wanted[1],wanted[2]+r*Math.sin(i*Math.PI/16)];if(inside(p)&&!blocked(p))return p;}throw Error('진입 가능한 실내 위치를 찾지 못했습니다.');}
 // 평면 범위(lo~hi) 근처 부재만 미리 골라 검사하는 blocked. 방 하나의 바닥을 촘촘히 검사할 때 쓴다.
 function region(lo,hi,pad=1){
  const sub=boxes.filter(b=>{const e=Math.hypot(b.size[0],b.size[2])/2+pad;return b.position[0]+e>lo[0]&&b.position[0]-e<hi[0]&&b.position[2]+e>lo[1]&&b.position[2]-e<hi[1];});
  const areas=solidAreas.filter(area=>{const xs=area.polygon.map(p=>p[0]),zs=area.polygon.map(p=>p[1]);return Math.max(...xs)+pad>lo[0]&&Math.min(...xs)-pad<hi[0]&&Math.max(...zs)+pad>lo[1]&&Math.min(...zs)-pad<hi[1];});
  const triangles=meshTriangles.filter(t=>t.maxX+pad>lo[0]&&t.minX-pad<hi[0]&&t.maxZ+pad>lo[1]&&t.minZ-pad<hi[1]);
  return (p,r=radius)=>sub.some(b=>{const q=local(p,b);return relevant(b,p[1])&&Math.abs(q[0])<b.size[0]/2+r&&Math.abs(q[1])<b.size[2]/2+r;})||
   areas.some(area=>blocksSolidArea(p,area))||meshBlocks(p,triangles,r);
 }
 return {move,spawn,blocked,region,inside,clear};
};
