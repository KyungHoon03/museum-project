/* 실제 모델의 수평 단면과 렌더링 중인 카메라를 사용하는 읽기 전용 미니맵. */
window.MuseumMinimap=function(host,model){
 const ns='http://www.w3.org/2000/svg';
 const make=(tag,attrs={},parent)=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);parent?.append(el);return el;};
 const section=document.createElement('section');section.className='minimap';section.hidden=true;section.setAttribute('aria-label','현재 위치 미니맵');
 const svg=make('svg',{role:'img','aria-label':'박물관 평면도: 빨간 점은 현재 위치, 파란 점은 이동점, 노란 부채꼴은 시야'},section);
 const floor=MuseumLayout.floor.polygon.map(MuseumGeometry.point),xs=floor.map(p=>p[0]),zs=floor.map(p=>p[1]);
 const minX=Math.min(...xs),minZ=Math.min(...zs),width=Math.max(...xs)-minX,height=Math.max(...zs)-minZ,padding=width*.035;
 svg.setAttribute('viewBox',`${minX-padding} ${minZ-padding} ${width+padding*2} ${height+padding*2}`);
 const blockers=[];
 const block=points=>{for(let i=0;i<points.length;i++)blockers.push([points[i],points[(i+1)%points.length]]);};
 const polygon=(points,cls)=>make('polygon',{points:points.map(p=>p.join(',')).join(' '),class:cls},svg);
 polygon(floor,'minimap-floor');
 if(MuseumLayout.outdoorGrass)polygon(MuseumLayout.outdoorGrass.polygon.map(MuseumGeometry.point),'minimap-outdoor');
 // 눈높이 단면으로 문·창문 개구부와 내부벽을 보존한다.
 for(const p of model.parts){
  if(p.mesh||!['wall','frame','glass','structure'].includes(p.group)||Math.abs(p.position[1]-MuseumLayout.eyeHeight)>p.size[1]/2)continue;
  const c=Math.cos(p.yaw||0),s=Math.sin(p.yaw||0);
  const outline=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>{x*=p.size[0]/2;z*=p.size[2]/2;return [p.position[0]+c*x+s*z,p.position[2]-s*x+c*z];});
  polygon(outline,p.group==='glass'?'minimap-glass':'minimap-wall');
  if(p.group!=='glass')block(outline);
 }
 for(const wall of MuseumLayout.solidWalls||[]){
  const outline=wall.polygon.map(MuseumGeometry.point);polygon(outline,'minimap-wall');
  if(MuseumLayout.eyeHeight<wall.height)block(outline);
 }
 const cone=make('path',{class:'minimap-view'},svg);
 for(const point of MuseumNavigationPoints){
  const [x,z]=MuseumGeometry.point(point.at);
  const marker=make('circle',{class:'minimap-waypoint',cx:x,cy:z,r:width*.007},svg);
  make('title',{},marker).textContent=point.name;
 }
 const dot=make('circle',{class:'minimap-position',r:width*.012},svg);
 host.append(section);
 const cross=(ax,az,bx,bz)=>ax*bz-az*bx;
 function visibleDistance(x,z,angle,radius){
  const dx=Math.cos(angle),dz=Math.sin(angle);let distance=radius;
  for(const [a,b] of blockers){
   const ex=b[0]-a[0],ez=b[1]-a[1],den=cross(dx,dz,ex,ez);if(Math.abs(den)<1e-10)continue;
   const ox=a[0]-x,oz=a[1]-z,t=cross(ox,oz,ex,ez)/den,u=cross(ox,oz,dx,dz)/den;
   if(t>=0&&u>=-1e-9&&u<=1+1e-9)distance=Math.min(distance,t);
  }
  return distance;
 }
 let lastView='';
 function update(camera,state,viewport){
  section.hidden=state.mode!=='interior';if(section.hidden)return;
  const x=camera.eye[0],z=camera.eye[2],dx=camera.target[0]-x,dz=camera.target[2]-z,angle=Math.atan2(dz,dx);
  // controls.fov는 수직 시야각이므로 실제 3D 화면 종횡비로 수평 시야각을 계산한다.
  const fov=2*Math.atan(Math.tan(state.fov*Math.PI/360)*viewport.width/Math.max(1,viewport.height));
  const key=[x,z,angle,fov].join(',');if(key===lastView)return;lastView=key;
  const radius=width*.22,angles=Array.from({length:97},(_,i)=>-fov/2+fov*i/96);
  // 모서리 양옆에도 광선을 쏘아 좁은 문과 벽 끝의 그림자 경계를 보존한다.
  for(const edge of blockers)for(const p of edge){
   const offset=Math.atan2(Math.sin(Math.atan2(p[1]-z,p[0]-x)-angle),Math.cos(Math.atan2(p[1]-z,p[0]-x)-angle));
   for(const epsilon of [-1e-6,0,1e-6]){const a=offset+epsilon;if(a>-fov/2&&a<fov/2)angles.push(a);}
  }
  angles.sort((a,b)=>a-b);
  const outline=angles.map(a=>{a+=angle;const distance=visibleDistance(x,z,a,radius);return `${x+Math.cos(a)*distance} ${z+Math.sin(a)*distance}`;});
  cone.setAttribute('d',`M ${x} ${z} L ${outline.join(' L ')} Z`);
  dot.setAttribute('cx',x);dot.setAttribute('cy',z);
 }
 return {update};
};
