/* 1인칭 방향 이동과 이동 가능한 대표점의 바닥 링 표시. */
window.MuseumPointNavigation=function(canvas,controls,collision,model,onTravel,onSelect){
 const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const layer=document.createElement('div');layer.id='navigation-points';canvas.parentElement.append(layer);
 const points=MuseumNavigationPoints.map(data=>{const q=MuseumGeometry.point(data.at),eye=[q[0],controls.state.minEyeHeight,q[1]];if(collision.blocked(eye))throw Error('대표점이 장애물과 겹칩니다: '+data.name);return {...data,eye};});
 const directional=MuseumDirectionalNavigation(canvas,controls,collision,points,onTravel);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('ground-rings');layer.append(svg);
 const planButtons=points.map(point=>{
  const button=document.createElement('button');button.type='button';button.className='plan-point';button.hidden=true;button.dataset.point=point.id;
  button.setAttribute('aria-label',point.name+'으로 이동');button.title=point.name+'으로 이동';
  const pointLabels={
   'video-west':'1번',
   'video':'2번',
   'video-east':'3번',
   'horse-approach':'4번',
   'gallery-west':'1번',
   'long':'2번',
   'gallery-east':'3번',
   'gallery-corridor-1':'1번',
   'link':'2번',
   'donation-front':'3번',
   'immersive-west':'1번',
   'planned':'1번',
   'entrance':'1번',
   'entrance-inside':'2번',
   'lobby-west-view':'3번',
   'lobby-south-west':'4번',
   'lobby-east-view':'5번'
  };
  if(pointLabels[point.id]){
   const label=document.createElement('span');
   label.className='plan-point-name';
   label.textContent=pointLabels[point.id];
   button.append(label);
   button.setAttribute('aria-label',`${pointLabels[point.id]} 위치`);
   button.title=`${pointLabels[point.id]} 위치`;
   button.classList.add('plan-point-labeled');
  }
  button.addEventListener('click',()=>{if(controls.state.mode==='exterior'&&controls.state.orthographic)onSelect(point.eye);});
  layer.append(button);return button;
 });
 const rings=points.map(()=>{const p=document.createElementNS(svg.namespaceURI,'path');svg.append(p);return p;});
 function hitBox(o,d,p,max){const c=Math.cos(p.yaw),s=Math.sin(p.yaw),v=sub(o,p.position),origin=[c*v[0]-s*v[2],v[1],s*v[0]+c*v[2]],dir=[c*d[0]-s*d[2],d[1],s*d[0]+c*d[2]];let lo=0,hi=max;for(let i=0;i<3;i++){const h=p.size[i]/2;if(Math.abs(dir[i])<1e-9){if(Math.abs(origin[i])>h)return false;}else{let a=(-h-origin[i])/dir[i],b=(h-origin[i])/dir[i];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return false;}}return hi>.001&&lo<max-.002;}

 function hitMesh(o,d,p,max){const m=p.mesh,c=Math.cos(p.yaw),s=Math.sin(p.yaw),world=k=>{const v=Array.from(m.pos.slice(k*3,k*3+3),(v,i)=>v*p.size[i]);return [p.position[0]+c*v[0]+s*v[2],p.position[1]+v[1],p.position[2]-s*v[0]+c*v[2]];};for(let i=0;i<m.idx.length;i+=3){const a=world(m.idx[i]),b=world(m.idx[i+1]),e=world(m.idx[i+2]),u=sub(b,a),v=sub(e,a),h=cross(d,v),det=dot(u,h);if(Math.abs(det)<1e-9)continue;const q=sub(o,a),t=dot(q,h)/det;if(t<0||t>1)continue;const k=cross(q,u),w=dot(d,k)/det;if(w<0||t+w>1)continue;const distance=dot(v,k)/det;if(distance>.001&&distance<max-.002)return true;}return false;}
 function update(vp,r){
  directional.update();
  const active=controls.state.mode==='interior'&&!controls.state.transitioning;
  const plan=controls.state.mode==='exterior'&&controls.state.orthographic;
  layer.hidden=!active&&!plan;
  svg.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);
  const origin=controls.camera().eye;
  for(const [index,point] of points.entries()){
   const ground=[point.eye[0],.025,point.eye[2]],v=sub(ground,origin),length=Math.hypot(...v),d=v.map(x=>x/length);
   const clip=[0,1,2,3].map(i=>vp[i]*ground[0]+vp[4+i]*ground[1]+vp[8+i]*ground[2]+vp[12+i]),x=clip[0]/clip[3],y=clip[1]/clip[3];
   const button=planButtons[index];button.hidden=!plan||clip[3]<=0||Math.abs(x)>1||Math.abs(y)>1;
   if(!button.hidden){button.style.left=(x*.5+.5)*r.width+'px';button.style.top=(-y*.5+.5)*r.height+'px';}
   const inView=active&&Math.hypot(point.eye[0]-origin[0],point.eye[2]-origin[2])>.45&&clip[3]>0&&Math.abs(x)<.98&&Math.abs(y)<.98;
   const occluded=active&&inView&&model.parts.some(p=>!['glass','displayGlass','grass'].includes(p.group)&&(p.mesh?hitMesh(origin,d,p,length):hitBox(origin,d,p,length)));
   const ring=rings[index];ring.style.display='none';
   if(active&&inView&&!occluded&&directional.nextPoints.includes(point)){
    const outline=[];
    for(let i=0;i<40;i++){
     const angle=i*Math.PI/20,g=[ground[0]+Math.cos(angle)*.24,.025,ground[2]+Math.sin(angle)*.24];
     const c=[0,1,2,3].map(k=>vp[k]*g[0]+vp[4+k]*g[1]+vp[8+k]*g[2]+vp[12+k]);
     if(c[3]<=0){outline.length=0;break;}
     outline.push(`${i?'L':'M'}${(c[0]/c[3]*.5+.5)*r.width},${(-c[1]/c[3]*.5+.5)*r.height}`);
    }
    if(outline.length){ring.setAttribute('d',outline.join(' ')+'Z');ring.style.display='';}
   }

  }
 }
 return {update,points,directional};
};
