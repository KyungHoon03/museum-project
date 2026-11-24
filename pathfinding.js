/* 충돌 검사를 사용하는 수평 A* 경로. 목적지는 임의 좌표를 그대로 유지한다. */
window.MuseumPathfinding={find(from,to,collision){
 const step=.25,inside=p=>collision.inside(p),dist=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]),clear=(a,b)=>collision.clear(a,b);
 if(collision.blocked(to)||!inside(to))return null;if(clear(from,to))return [from,to];
 const nodes=new Map(),open=[],closed=new Set(),key=(x,z)=>x+','+z,heur=p=>dist(p,to);
 const first={x:0,z:0,p:from,g:0,f:heur(from),parent:null};nodes.set('0,0',first);open.push(first);let end=null;
 for(let iteration=0;open.length&&iteration<18000;iteration++){
  let best=0;for(let i=1;i<open.length;i++)if(open[i].f<open[best].f)best=i;const n=open.splice(best,1)[0],id=key(n.x,n.z);if(closed.has(id))continue;closed.add(id);
  if(heur(n.p)<.65&&clear(n.p,to)){end=n;break;}
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=n.x+dx,z=n.z+dz,k=key(x,z);if(closed.has(k))continue;const p=[from[0]+x*step,from[1],from[2]+z*step];if(!inside(p)||collision.blocked(p)||!clear(n.p,p))continue;const g=n.g+dist(n.p,p);let next=nodes.get(k);if(next&&g>=next.g)continue;if(!next){next={x,z,p};nodes.set(k,next);open.push(next);}Object.assign(next,{g,f:g+heur(p),parent:n});}
 }
 if(!end)return null;const route=[to];for(let n=end;n;n=n.parent)route.push(n.p);route.reverse();const result=[route[0]];let i=0;while(i<route.length-1){let j=route.length-1;while(j>i+1&&!clear(route[i],route[j]))j--;result.push(route[j]);i=j;}return result;
}};
