/* 벽의 앞·뒷면을 한 번으로 세고, 접합부에서 겹치는 벽 부재는 합친다. */
window.MuseumLabelVisibility=function(model){
 const walls=model.parts.filter(p=>p.group==='wall'),EPS=1e-7;
 const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 function intervals(part,from,to){
  const c=Math.cos(part.yaw||0),s=Math.sin(part.yaw||0);
  const local=p=>{const v=sub(p,part.position);return [c*v[0]-s*v[2],v[1],s*v[0]+c*v[2]].map((x,i)=>x/part.size[i]);};
  const o=local(from),d=sub(local(to),o);
  if(!part.mesh){
   let lo=-Infinity,hi=Infinity;
   for(let i=0;i<3;i++){
    if(Math.abs(d[i])<EPS){if(Math.abs(o[i])>.5)return [];continue;}
    let a=(-.5-o[i])/d[i],b=(.5-o[i])/d[i];if(a>b)[a,b]=[b,a];
    lo=Math.max(lo,a);hi=Math.min(hi,b);if(hi-lo<EPS)return [];
   }
   return [[lo,hi]];
  }
  const hits=[],m=part.mesh,vertex=k=>Array.from(m.pos.slice(k*3,k*3+3));
  for(let i=0;i<m.idx.length;i+=3){
   const a=vertex(m.idx[i]),u=sub(vertex(m.idx[i+1]),a),v=sub(vertex(m.idx[i+2]),a),h=cross(d,v),det=dot(u,h);
   if(Math.abs(det)<EPS)continue;
   const q=sub(o,a),b=dot(q,h)/det,k=cross(q,u),g=dot(d,k)/det;
   if(b<-EPS||g<-EPS||b+g>1+EPS)continue;
   hits.push(dot(v,k)/det);
  }
  hits.sort((a,b)=>a-b);
  const unique=hits.filter((t,i)=>!i||t-hits[i-1]>EPS),ranges=[];
  for(let i=0;i+1<unique.length;i+=2)ranges.push([unique[i],unique[i+1]]);
  return ranges;
 }
 function countWalls(from,to){
  const length=Math.hypot(...sub(to,from));if(length<EPS)return 0;
  const margin=.001/length,ranges=walls.flatMap(p=>intervals(p,from,to))
   .map(([a,b])=>[Math.max(margin,a),Math.min(1-margin,b)]).filter(([a,b])=>b-a>EPS).sort((a,b)=>a[0]-b[0]);
  let count=0,end=-Infinity;
  for(const [a,b] of ranges){if(a>end+EPS)count++;end=Math.max(end,b);}
  return count;
 }
 return {countWalls};
};
