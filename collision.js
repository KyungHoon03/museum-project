/* 실내 1인칭 전용 수평 충돌: swept OBB + 벽을 따라 미끄러지는 이동. */
window.MuseumCollision=function(model,layout){
 const radius=.08,groups=['wall','frame','glass','structure','displays','displayGlass','details'];
 const boxes=model.parts.filter(p=>!p.mesh&&groups.includes(p.group));
 for(const w of layout.navigationBarriers||[]){
  const a=MuseumGeometry.point(w.a),b=MuseumGeometry.point(w.b);
  boxes.push({position:[(a[0]+b[0])/2,w.height/2,(a[1]+b[1])/2],size:[Math.hypot(b[0]-a[0],b[1]-a[1]),w.height,w.thickness],yaw:-Math.atan2(b[1]-a[1],b[0]-a[0])});
 }
 // 둥근 작업대 등 사용자 정의 상세 메시도 보수적인 경계 상자로 포함한다.
 // 머리 위 격자·아치는 아래의 몸체 높이 검사에서 제외된다.
 for(const p of model.parts.filter(p=>p.mesh&&['details','displays'].includes(p.group))){
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.mesh.pos.length;i++){
   const axis=i%3,v=p.mesh.pos[i]*p.size[axis];lo[axis]=Math.min(lo[axis],v);hi[axis]=Math.max(hi[axis],v);
  }
  const localCenter=lo.map((v,i)=>(v+hi[i])/2),c=Math.cos(p.yaw),s=Math.sin(p.yaw);
  boxes.push({position:[p.position[0]+c*localCenter[0]+s*localCenter[2],p.position[1]+localCenter[1],p.position[2]-s*localCenter[0]+c*localCenter[2]],size:lo.map((v,i)=>hi[i]-v),yaw:p.yaw});
 }
 for(const w of layout.solidWalls||[])for(let i=0;i<w.polygon.length;i++){
  const a=MuseumGeometry.point(w.polygon[i]),b=MuseumGeometry.point(w.polygon[(i+1)%w.polygon.length]);
  boxes.push({position:[(a[0]+b[0])/2,w.height/2,(a[1]+b[1])/2],size:[Math.hypot(b[0]-a[0],b[1]-a[1]),w.height,.001],yaw:-Math.atan2(b[1]-a[1],b[0]-a[0])});
 }
 const local=(p,b)=>{const x=p[0]-b.position[0],z=p[2]-b.position[2],c=Math.cos(b.yaw),s=Math.sin(b.yaw);return [c*x-s*z,s*x+c*z];};
 // 눈높이가 아닌 발끝~머리 범위. 낮은 받침/상판도 막고 상부 보는 통과한다.
 const relevant=(b,y)=>y+.18>b.position[1]-b.size[1]/2&&y-1.525<b.position[1]+b.size[1]/2;
 function blocked(p){return boxes.some(b=>{const q=local(p,b);return relevant(b,p[1])&&Math.abs(q[0])<b.size[0]/2+radius&&Math.abs(q[1])<b.size[2]/2+radius;});}
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
 function spawn(wanted){if(inside(wanted)&&!blocked(wanted))return [...wanted];for(let r=.2;r<40;r+=.2)for(let i=0;i<32;i++){const p=[wanted[0]+r*Math.cos(i*Math.PI/16),wanted[1],wanted[2]+r*Math.sin(i*Math.PI/16)];if(inside(p)&&!blocked(p))return p;}throw Error('진입 가능한 실내 위치를 찾지 못했습니다.');}
 return {move,spawn,blocked};
};
