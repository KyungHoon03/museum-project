/* 겹친 공면의 교집합을 실제 삼각형에서 잘라낸다.
 * 충돌용 부피는 유지하고, 현재 표시 중인 부재로만 렌더링 면을 구성한다.
 * 깊이 오프셋이나 위치 이동으로 Z-fighting을 숨기지 않는다. */
window.MuseumSurfaces=(()=>{
 const EPS=1e-9;
 const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0)/2;
 const edge=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
 const transparent=p=>['glass','displayGlass'].includes(p.group);
 const cube={pos:[],nrm:[],idx:[]};
 for(const [n,v] of [
  [[1,0,0],[[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]]],
  [[-1,0,0],[[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]]],
  [[0,1,0],[[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]]],
  [[0,-1,0],[[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]]],
  [[0,0,1],[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]],
  [[0,0,-1],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]]
 ]){const base=cube.pos.length/3;for(const p of v){cube.pos.push(...p);cube.nrm.push(...n);}cube.idx.push(base,base+1,base+2,base,base+2,base+3);}
 function transform(v,p,inverse=false){
  const s=p.size||[1,1,1],o=p.position||[0,0,0],c=Math.cos(p.yaw||0),t=Math.sin(p.yaw||0);
  if(inverse){const q=sub(v,o);return [(c*q[0]-t*q[2])/s[0],q[1]/s[1],(t*q[0]+c*q[2])/s[2]];}
  const q=v.map((v,i)=>v*s[i]);return [o[0]+c*q[0]+t*q[2],o[1]+q[1],o[2]-t*q[0]+c*q[2]];
 }
 function clip(poly,a,b,sign,inside){
  const result=[];
  for(let i=0;i<poly.length;i++){
   const p=poly[i],q=poly[(i+1)%poly.length],dp=sign*edge(a,b,p),dq=sign*edge(a,b,q);
   const ip=inside?dp>=-EPS:dp<=EPS,iq=inside?dq>=-EPS:dq<=EPS;
   if(ip)result.push(p);
   if(ip!==iq&&Math.abs(dp-dq)>EPS){const t=dp/(dp-dq);result.push(p.map((v,k)=>v+(q[k]-v)*t));}
  }return result;
 }
 function difference(poly,triangle){
  const sign=area(triangle)>0?1:-1;let remaining=poly;const pieces=[];
  for(let i=0;i<3&&remaining.length>=3;i++){
   const a=triangle[i],b=triangle[(i+1)%3],outside=clip(remaining,a,b,sign,false);
   if(outside.length>=3&&Math.abs(area(outside))>EPS)pieces.push(outside);
   remaining=clip(remaining,a,b,sign,true);
  }
  if(remaining.length<3||Math.abs(area(remaining))<=EPS)return [poly];
  return pieces;
 }
 function resolve(elements){
  const bins=new Map(),meshes=new Map();let trimmed=0,removedArea=0;
  // 불투명 면이 유리보다 우선한다. 같은 평면은 첫 부재가 한 번만 소유한다.
  const ordered=[...elements].sort((a,b)=>Number(transparent(a))-Number(transparent(b)));
  for(const p of ordered){
   const source=p.mesh||cube,out={pos:[],nrm:[],idx:[]};
   for(let i=0;i<source.idx.length;i+=3){
    const indices=Array.from(source.idx.slice(i,i+3));
    const world=indices.map(k=>transform(Array.from(source.pos.slice(k*3,k*3+3)),p));
    const raw=cross(sub(world[1],world[0]),sub(world[2],world[0])),len=Math.hypot(...raw);if(len<EPS)continue;
    const normal=raw.map(v=>v/len),n=[...normal];if(n.find(v=>Math.abs(v)>1e-6)<0)for(let k=0;k<3;k++)n[k]*=-1;
    const d=dot(n,world[0]),drop=n.reduce((best,v,i)=>Math.abs(v)>Math.abs(n[best])?i:best,0),axes=[0,1,2].filter(k=>k!==drop);
    const poly=world.map(v=>axes.map(k=>v[k])),key=[...n,d].map(v=>Math.round(v*1e5)).join(',');
    if(!bins.has(key))bins.set(key,[]);const previous=bins.get(key);
    let pieces=[poly];const originalArea=Math.abs(area(poly));
    const bounds=poly=>[Math.min(...poly.map(p=>p[0])),Math.min(...poly.map(p=>p[1])),Math.max(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[1]))];
    const box=bounds(poly);
    for(const old of previous){
     if(!pieces.length)break;
     if(box[2]<=old.box[0]+EPS||box[0]>=old.box[2]-EPS||box[3]<=old.box[1]+EPS||box[1]>=old.box[3]-EPS)continue;
     if(world.some(v=>Math.abs(dot(old.n,sub(v,old.origin)))>2e-6))continue;
     pieces=pieces.flatMap(piece=>difference(piece,old.poly));
    }
    const left=pieces.reduce((sum,p)=>sum+Math.abs(area(p)),0);
    if(originalArea-left>1e-8){trimmed++;removedArea+=(originalArea-left)/Math.abs(n[drop]);}
    previous.push({poly,box,n,origin:world[0]});
    const localNormal=Array.from(source.nrm.slice(indices[0]*3,indices[0]*3+3));
    for(const piece of pieces){
     const local=piece.map(v=>{const q=[0,0,0];q[axes[0]]=v[0];q[axes[1]]=v[1];q[drop]=(d-n[axes[0]]*v[0]-n[axes[1]]*v[1])/n[drop];return transform(q,p,true);});
     for(let j=1;j<local.length-1;j++){
      if(Math.hypot(...cross(sub(local[j],local[0]),sub(local[j+1],local[0])))<EPS)continue;
      const base=out.pos.length/3;out.pos.push(...local[0],...local[j],...local[j+1]);for(let k=0;k<3;k++)out.nrm.push(...localNormal);out.idx.push(base,base+1,base+2);
     }
    }
   }
   if(out.pos.length/3>65535)throw Error('정리한 메시의 정점 한도 초과: '+p.id);
   meshes.set(p.id,{pos:new Float32Array(out.pos),nrm:new Float32Array(out.nrm),idx:new Uint16Array(out.idx)});
  }
  return {meshes,trimmed,removedArea};
 }
 return {resolve};
})();
