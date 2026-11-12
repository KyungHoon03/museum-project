/* 전시 자리 계산.
 * 3D 유물은 진열장 선반·유리장 바닥·테이블 상판·전시대 윗면 같은 "받침면" 위에 놓고,
 * 사진은 진열장 뒷벽·매입부 뒷벽·액자 안쪽 같은 "부착면"에 붙인다.
 * 좌표는 geometry.js가 실제로 만드는 부재 치수에서 그대로 계산해 형상과 어긋나지 않게 한다. */
window.MuseumDisplaySupports=(()=>{
 'use strict';
 const L=MuseumLayout,G=MuseumGeometry,S=L.scale;
 const glassThickness=.018;
 // v: 관람객 쪽(유물 정면) 방향, u: 관람객이 볼 때 오른쪽 방향. (u, 위, v)는 오른손 좌표계.
 const rightOf=v=>[v[1],-v[0]];
 const lerp=(a,b,t)=>a.map((value,i)=>value+(b[i]-value)*t);
 const add=(p,d,k)=>p.map((value,i)=>value+d[i]*k);
 function support(id,info){
  const {center,v,halfU,halfV,y,maxHeight,glass,room,label}=info;
  return {id,center,v,u:rightOf(v),halfU,halfV,y,maxHeight,glass,room,label};
 }
 // 벽선(a→b, 계획 좌표)을 따라 앞으로 inward 방향 깊이 [near, far] 구간을 받침면으로 만든다.
 function strip(id,a,b,inward,near,far,along0,along1,y,maxHeight,glass,room,label){
  const A=G.point(a),B=G.point(b),length=Math.hypot(B[0]-A[0],B[1]-A[1]);
  const start=lerp(A,B,along0/length),end=lerp(A,B,1-along1/length);
  const middle=lerp(start,end,.5),center=add(middle,inward,(near+far)/2);
  return support(id,{center,v:[...inward],halfU:Math.hypot(end[0]-start[0],end[1]-start[1])/2,halfV:(far-near)/2,y,maxHeight,glass,room,label});
 }
 const supports=new Map(),put=s=>supports.set(s.id,s);
 // 벽 매입 진열장: 뒤판(두께 .10, 벽선 중심) 앞면 ~ 전면 유리 사이의 선반.
 for(const n of L.niches||[]){
  const y=n.sill+.045;
  put(strip('niche:'+n.id,n.a,n.b,n.inward,.05+.03,n.depth-glassThickness/2-.03,.13+.03,.13+.03,y,n.top-y-.03,true,n.room,'벽 매입 진열장'));
 }
 // 바닥 기단형 통유리 진열장.
 for(const n of L.glassCases||[]){
  const y=n.baseHeight;
  put(strip('case:'+n.id,n.a,n.b,n.inward,.03,n.depth-.03,.04,.04,y,n.top-glassThickness-y-.02,true,n.room,'통유리 진열장'));
 }
 // 벽 부착 유리 진열장(유리 바닥판 위).
 for(const n of L.wallCases||[]){
  const y=n.bottom+glassThickness;
  put(strip('wallcase:'+n.id,n.a,n.b,n.inward,.03,n.depth-.03,.04,.04,y,n.top-glassThickness-y-.02,true,n.room,'벽 부착 유리장'));
 }
 // 독립 전시대: 낮은 유리 덮개장(low)과 덮개 없는 전시대(platform).
 for(const d of L.displays||[]){
  const p=G.point(d.at),y=d.size[1]+.045,low=d.type!=='platform';
  const glassHeight=d.type==='case'?1.30:.38;
  // 덮개 없는 전시대의 높이 한도: 로비는 활 모양 천장 장식(아래면 2.38m) 아래, 그 밖은 보(2.42m) 아래.
  const ceiling=d.room==='bow'?2.33:2.38;
  put(support('display:'+d.id,{center:p,v:[0,1],halfU:d.size[0]/2-(low?.04:.08),halfV:d.size[2]/2-(low?.04:.08),y,
   maxHeight:low?glassHeight-glassThickness-.02:ceiling-y,glass:low,room:d.room,label:low?'낮은 유리 진열대':'전시대'}));
 }
 // 양면 목재 테이블: 가운데 매단 가림막을 사이에 두고 양쪽을 각각 받침면으로 쓴다.
 for(const t of L.galleryTables||[]){
  const gap=.035/2+.03,edge=t.depth/2-.04;
  for(const [side,inward] of [['north',[0,-1]],['south',[0,1]]]){
   // 가림막 하단(상판 +0.20m)보다 유물이 커지면 가림막과 겹치므로 높이 제한은 가림막 아래 공간이 아닌 열린 쪽 기준.
   put(strip('table:'+t.id+':'+side,t.a,t.b,inward,gap,edge,.06,.06,t.height,1.0,false,t.room,'목재 전시 테이블'));
  }
 }
 // 외벽 매입 유리 전시부(벽 두께 안쪽의 막힌 뒤판 + 실내 쪽 유리).
 function recess(wallId,index=0){
  const w=[...(L.shell||[]),...L.walls].find(item=>item.id===wallId),o=w?.openings?.[index];
  if(!w||!o||o.kind!=='recess')return null;
  const t=w.thickness||L.wallThickness,inset=w.inset||[0,0];
  const a=G.point(w.a).map((v,i)=>v+inset[i]*t/2),b=G.point(w.b).map((v,i)=>v+inset[i]*t/2);
  const dir=o.recessDirection||[0,-1],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const from=lerp(a,b,o.from),to=lerp(a,b,o.to);
  // 실내면(유리) = 중심 - dir*t/2, 뒤판 실내 쪽 면 = 중심 + dir*(t/2-.07)
  const roomFace=p=>add(p,dir,-t/2),backFace=p=>add(p,dir,t/2-.07);
  return {w,o,t,dir,length,from,to,roomFace,backFace,inward:dir.map(v=>-v)};
 }
 // 매입부 바닥(sill) 위. 긴 매입부는 parts 개수만큼 나눠 각각 독립된 자리로 쓴다.
 for(const [wallId,parts,room] of [['shell-planned-south',1,'planned'],['shell-lobby-recess',2,'bow'],['immersive-front',1,'immersive']]){
  const r=recess(wallId);if(!r)continue;
  const depth=r.t-.07-(r.o.glazed?glassThickness:0);
  for(let k=0;k<parts;k++){
   const from=lerp(r.from,r.to,k/parts),to=lerp(r.from,r.to,(k+1)/parts);
   const middle=lerp(r.backFace(from),r.backFace(to),.5),center=add(middle,r.inward,depth/2);
   put(support('recess:'+wallId+(parts>1?':'+k:''),{center,v:r.inward,halfU:Math.hypot(to[0]-from[0],to[1]-from[1])/2-.06,halfV:depth/2-.03,
    y:r.o.sill||0,maxHeight:r.o.height-(r.o.sill||0)-.03,glass:Boolean(r.o.glazed),room,label:r.o.glazed?'벽 매입 유리 전시부':'벽 매입 전시부'}));
  }
 }
 // 부조 전시부: 뒤판이 실제로는 겹친 벽(체험마루 서벽 x=552, 두께 .16) 안에 묻혀 있으므로
 // 보이는 면은 그 벽의 실내 쪽 면이다. 벽선에서 inward 방향으로 가장 앞에 나온 벽면을 찾는다.
 function reliefFace(r){
  const A=G.point(r.a),B=G.point(r.b);let face=.0175;
  for(const w of [...(L.shell||[]),...L.walls]){
   const t=w.thickness||L.wallThickness,inset=w.inset||[0,0];
   const a=G.point(w.a).map((v,i)=>v+inset[i]*t/2),b=G.point(w.b).map((v,i)=>v+inset[i]*t/2);
   const along=[B[0]-A[0],B[1]-A[1]],len=Math.hypot(...along),dir=along.map(v=>v/len);
   const cross=Math.abs((b[0]-a[0])*dir[1]-(b[1]-a[1])*dir[0]);if(cross>1e-6)continue;  // 평행한 벽만
   const off=(a[0]-A[0])*r.inward[0]+(a[1]-A[1])*r.inward[1];
   if(Math.abs(off)>.3)continue;
   const proj=p=>(p[0]-A[0])*dir[0]+(p[1]-A[1])*dir[1],lo=Math.min(proj(a),proj(b)),hi=Math.max(proj(a),proj(b));
   if(hi<len*.25||lo>len*.75)continue;
   face=Math.max(face,off+t/2);
  }
  return face;
 }
 for(const r of L.reliefDisplays||[]){
  r.visibleFace=reliefFace(r);
  put(strip('relief:'+r.id,r.a,r.b,r.inward,r.visibleFace+.01,r.depth-.01,.12+.08,.12+.08,r.bottom+.10,r.top-.12-(r.bottom+.10)-.03,false,r.room,'부조 전시부 받침'));
 }
 // 체험마루 벽 부착 작업대 상판(뒤벽 x=442, 둥근 앞면 x=464, 상판 윗면 .86+.035).
 const worktop=(L.detailExtrusions||[]).find(e=>e.id==='maru-worktop-surface');
 if(worktop){
  const xs=worktop.polygon.map(p=>p[0]),zs=worktop.polygon.map(p=>p[1]);
  const back=Math.min(...xs),front=Math.max(...xs),north=Math.min(...zs),south=Math.max(...zs);
  put(strip('worktop:maru',[back,north],[back,south],[1,0],.08+.03,(front-back)*S-.05,.22,.22,worktop.bottom+worktop.height,1.2,false,'maru','체험 작업대'));
 }
 // 기획전시실 원형 탁자: 상판 원에 내접하는 정사각형 안쪽.
 const roundTop=(L.detailExtrusions||[]).find(e=>e.id==='planned-round-table-top');
 if(roundTop){
  const xs=roundTop.polygon.map(p=>p[0]),zs=roundTop.polygon.map(p=>p[1]);
  const c=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...zs)+Math.max(...zs))/2],radius=(Math.max(...xs)-Math.min(...xs))/2*S;
  put(support('table:planned-round',{center:G.point(c),v:[0,-1],halfU:radius*.68,halfV:radius*.68,y:roundTop.bottom+roundTop.height,maxHeight:1.0,glass:false,room:'planned',label:'원형 탁자'}));
 }
 // 안내 데스크 상판.
 const reception=(L.detailBoxes||[]).find(b=>b.id==='reception-top');
 if(reception){
  put(support('desk:reception',{center:G.point(reception.at),v:[0,-1],halfU:reception.size[0]/2-.12,halfV:reception.size[2]/2-.12,y:reception.bottom+reception.size[1],maxHeight:.8,glass:false,room:'bow',label:'안내 데스크'}));
 }
 // 야외체험장 잔디: 동쪽 끝 과녁 자리와 쪽문 앞 활 거치 자리. 정면은 쪽문(서쪽).
 const grass=L.outdoorGrass;
 if(grass){
  const y=grass.height;
  put(support('ground:outdoor-target',{center:G.point([860,532]),v:[-1,0],halfU:1.4,halfV:.9,y,maxHeight:2.75,glass:false,room:'outdoor',label:'야외 과녁 자리'}));
  put(support('ground:outdoor-line',{center:G.point([640,560]),v:[0,-1],halfU:1.2,halfV:.6,y,maxHeight:2.2,glass:false,room:'outdoor',label:'야외 사대 옆'}));
 }

 // 3m가 넘는 긴 진열장·테이블·전시부는 왼쪽(:L)·오른쪽(:R) 두 자리로도 나눈다(관람객이 바라본 기준).
 const splitTargets=id=>/^niche:gallery-tall-wall-|^recess:shell-planned-south$|^recess:immersive-front$|^table:gallery-table-|^relief:/.test(id);
 // 대형 전시대는 여러 점을 함께 올린다: 로비 중앙은 좌·중·우, 주 전시실 서북 전시대는 좌(1/3)·우(2/3, 과녁).
 const customSplits={'display:bow-central-platform':[['L',1/3],['C',1/3],['R',1/3]],'display:horse-platform':[['L',1/3],['R',2/3]]};
 for(const s of [...supports.values()]){
  const parts=customSplits[s.id]||(splitTargets(s.id)&&s.halfU*2>3?[['L',.5],['R',.5]]:null);
  if(!parts)continue;
  let start=-s.halfU;
  for(const [side,fraction] of parts){
   const width=2*s.halfU*fraction,center=add(s.center,s.u,start+width/2);start+=width;
   supports.set(s.id+':'+side,{...s,id:s.id+':'+side,center,halfU:width/2-.05});
  }
 }
 /* 사진 부착면: {a, b(실제 좌표 xz), bottom, top, normal} — a→b가 사진의 왼쪽→오른쪽. */
 function frameFor(placement){
  const type=placement.wallType,list=type==='relief-display'?L.reliefDisplays:type==='niche-display'?L.niches:type==='curved-display'?L.curvedArtFrames:L.wallArtFrames;
  return (list||[]).find(item=>item.id===placement.wall)||null;
 }
 function imageSurface(placement){
  if(placement.wallType==='recess-display'){
   const r=recess(placement.wall,placement.opening||0);if(!r)return null;
   const margin=.06,len=Math.hypot(r.to[0]-r.from[0],r.to[1]-r.from[1]);
   const back=p=>add(r.backFace(p),r.inward,.004);
   return facing({a:back(lerp(r.from,r.to,margin/len)),b:back(lerp(r.from,r.to,1-margin/len)),bottom:(r.o.sill||0)+.03,top:r.o.height-.04,normal:r.inward});
  }
  const frame=frameFor(placement);if(!frame||!frame.a)return null;
  const A=G.point(frame.a),B=G.point(frame.b),length=Math.hypot(B[0]-A[0],B[1]-A[1]);
  let offset,inset,bottom,top;
  if(placement.wallType==='niche-display'){
   // 진열장 뒤판 앞면(.05)에 붙인다. 앞의 선반·유물과 전면 유리 뒤에 있어야 한다.
   offset=.05+.004;inset=.13+.02;bottom=frame.sill+.045+.02;top=frame.top-.03;
  }else if(placement.wallType==='relief-display'){
   // 부조 전시부의 보이는 뒷면(겹친 벽의 실내 면). 앞쪽 목재 테두리 안쪽.
   offset=(frame.visibleFace??.0175)+.004;inset=.12+.01;bottom=frame.bottom+.10+.01;top=frame.top-.12-.01;
  }else{
   // 벽걸이 액자: 액자 테(벽에서 .008~.043) 안쪽 깊이에 사진을 끼운다.
   offset=.02;inset=.045;bottom=frame.bottom+.045;top=frame.top-.045;
  }
  if(Number.isFinite(placement.surfaceOffset))offset=placement.surfaceOffset;
  const along=t=>add(lerp(A,B,t),frame.inward,offset);
  return facing({a:along(inset/length),b:along(1-inset/length),bottom,top,normal:[...frame.inward]});
 }
 // 사진 왼쪽(a)이 관람객이 볼 때 왼쪽에 오도록 맞춘다. 벽 데이터의 a→b 방향과 상관없이 좌우가 뒤집히지 않는다.
 function facing(surface){
  const right=rightOf(surface.normal),d=[surface.b[0]-surface.a[0],surface.b[1]-surface.a[1]];
  if(d[0]*right[0]+d[1]*right[1]<0)[surface.a,surface.b]=[surface.b,surface.a];
  return surface;
 }
 // 계획 좌표(평면도 px)로 되돌림. 위치 표시 점에 쓴다.
 const toPlan=p=>[p[0]/S+L.origin[0],p[1]/S+L.origin[1]];
 // 위치가 비어 있는 카탈로그 항목은 받침면/부착면 중심으로 채운다.
 for(const group of window.MuseumAssetCatalog||[])for(const item of group.items){
  if(item[3])continue;
  const placement=item[4]||{};
  if(placement.support&&supports.has(placement.support))item[3]=toPlan(supports.get(placement.support).center);
  else{const s=imageSurface(placement);if(s)item[3]=toPlan(lerp(s.a,s.b,.5));}
 }
 return {supports,imageSurface,toPlan};
})();
