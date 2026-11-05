/* 모델 데이터 → GPU와 독립적인 메시/부재. 바닥은 ear clipping으로 삼각분할. */
window.MuseumGeometry = (()=>{
  const data=MuseumLayout;
  const point=p=>[(p[0]-data.origin[0])*data.scale,(p[1]-data.origin[1])*data.scale];
  function floor(polygon,height=0){
    const p=polygon.map(point),pos=[],nrm=[],idx=[];
    p.forEach(v=>{pos.push(v[0],height,v[1]);nrm.push(0,1,0);});
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const area=p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0);
    const order=p.map((_,i)=>i);if(area<0)order.reverse();
    while(order.length>3){let found=false;
      for(let j=0;j<order.length;j++){
        const a=order[(j+order.length-1)%order.length],b=order[j],c=order[(j+1)%order.length];
        if(cross(p[a],p[b],p[c])<=1e-8)continue;
        if(order.some(k=>k!==a&&k!==b&&k!==c&&cross(p[a],p[b],p[k])>=-1e-8&&cross(p[b],p[c],p[k])>=-1e-8&&cross(p[c],p[a],p[k])>=-1e-8))continue;
        idx.push(a,c,b);order.splice(j,1);found=true;break;
      }
      if(!found)throw new Error('바닥 다각형 삼각분할 실패');
    }
    idx.push(order[0],order[2],order[1]);
    return {pos:new Float32Array(pos),nrm:new Float32Array(nrm),idx:new Uint16Array(idx)};
  }
  function build(){
    const parts=[],floors=[{...data.floor,mesh:floor(data.floor.polygon,data.floor.height),group:'floor'},
      ...(data.ceilings||[]).map(c=>({...c,mesh:floor(c.polygon,c.height),group:'ceiling'}))];
    if(data.outdoorGrass){
      const g=data.outdoorGrass,poly=g.polygon.map(point),pos=[],nrm=[],idx=[];
      floors.push({...g,mesh:floor(g.polygon,g.height),group:'grass'});
      const inside=(x,z)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>z)!==(poly[j][1]>z)&&x<(poly[j][0]-poly[i][0])*(z-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])yes=!yes;return yes;};
      let seed=1031;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      const lo=[Math.min(...poly.map(p=>p[0])),Math.min(...poly.map(p=>p[1]))],hi=[Math.max(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[1]))];
      for(let x=lo[0]+.05;x<hi[0]-.05;x+=g.spacing)for(let z=lo[1]+.05;z<hi[1]-.05;z+=g.spacing){
        const px=x+(random()-.5)*.12,pz=z+(random()-.5)*.12,w=.025,h=g.bladeHeight*(.7+random()*.7);
        if(![[-w,-w],[w,-w],[w,w],[-w,w]].every(v=>inside(px+v[0],pz+v[1])))continue;
        for(const angle of [random()*Math.PI,random()*Math.PI]){
          const dx=Math.cos(angle)*w,dz=Math.sin(angle)*w,base=pos.length/3;
          pos.push(px-dx,g.height,pz-dz,px+dx,g.height,pz+dz,px+dx*.2,g.height+h,pz+dz*.2);
          for(let k=0;k<3;k++)nrm.push(-Math.sin(angle),.3,Math.cos(angle));idx.push(base,base+1,base+2);
        }
      }
      parts.push({id:g.id+'-blades',mesh:{pos:new Float32Array(pos),nrm:new Float32Array(nrm),idx:new Uint16Array(idx)},position:[0,0,0],size:[1,1,1],yaw:0,color:g.color,group:'grass',room:'outdoor'});
    }
    const wallColor=[.85,.86,.83],frameColor=[.43,.48,.47];
    function span(id,a,b,low,high,thickness,color,group,room){
      const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      if(length<=0||high<=low)throw new Error('잘못된 부재 '+id);
      parts.push({id,position:[(a[0]+b[0])/2,(low+high)/2,(a[1]+b[1])/2],size:[length,high-low,thickness],yaw:-Math.atan2(dz,dx),color,group,room});
    }
    function glazing(id,a,b,height,divisions,room){
      const at=t=>a.map((v,i)=>v+(b[i]-v)*t);
      span(id+'-header',a,b,height-.08,height,.10,frameColor,'frame',room);
      for(let i=0;i<=divisions;i++){
        const p=at(i/divisions);
        parts.push({id:id+'-post-'+i,position:[p[0],height/2,p[1]],size:[.08,height,.08],yaw:0,color:frameColor,group:'frame',room});
        if(i<divisions){span(id+'-pane-'+i,p,at((i+1)/divisions),.04,height-.08,.025,[.56,.75,.77],'glass',room);parts[parts.length-1].alpha=.20;}
      }
    }
    for(const w of [...(data.shell||[]),...data.walls]){
      const h=w.height||data.wallHeight,t=w.thickness||data.wallThickness,bottom=w.bottom||0;
      const inset=w.inset||[0,0],a=point(w.a).map((v,i)=>v+inset[i]*t/2),b=point(w.b).map((v,i)=>v+inset[i]*t/2),at=t=>a.map((v,i)=>v+(b[i]-v)*t);
      let cursor=0;
      for(const [i,o] of (w.openings||[]).entries()){
        if(o.from<cursor||o.to<=o.from||o.to>1||o.height<=0||o.height>=h)throw new Error('잘못된 개구부 '+w.id);
        if(o.from>cursor)span(w.id+'-pier-'+i,at(cursor),at(o.from),bottom,h,t,wallColor,'wall',w.room);
        span(w.id+'-lintel-'+i,at(o.from),at(o.to),o.height,h,t,wallColor,'wall',w.room);
        const sill=o.sill||bottom;
        if(sill>bottom)span(w.id+'-sill-'+i,at(o.from),at(o.to),bottom,sill,t,wallColor,'wall',w.room);
        if(o.kind==='recess'){
          const dir=o.recessDirection||[0,-1],back=p=>p.map((v,k)=>v+dir[k]*(t/2-.035));
          span(w.id+'-recess-back-'+i,back(at(o.from)),back(at(o.to)),sill,o.height,.07,wallColor,'wall',w.room);
          if(o.glazed){
            const front=p=>p.map((v,k)=>v-dir[k]*(t/2+.012));
            span(w.id+'-recess-glass-'+i,front(at(o.from)),front(at(o.to)),sill,o.height,.018,[.62,.78,.79],'displayGlass',w.room);parts[parts.length-1].alpha=.12;
          }
        }
        const length=Math.hypot(b[0]-a[0],b[1]-a[1]),trim=.06/length;
        if(o.kind!=='recess'){
          span(w.id+'-jamb-left-'+i,at(o.from),at(o.from+trim),sill,o.height,t+.025,frameColor,'frame',w.room);
          span(w.id+'-jamb-right-'+i,at(o.to-trim),at(o.to),sill,o.height,t+.025,frameColor,'frame',w.room);
          span(w.id+'-door-header-'+i,at(o.from),at(o.to),o.height-.06,o.height,t+.025,frameColor,'frame',w.room);
        }
        if(o.kind==='glazed')glazing(w.id+'-glazing-'+i,at(o.from),at(o.to),o.height,o.divisions||3,w.room);
        if(o.leaves){
          const gap=.015/length;
          for(let k=0;k<o.leaves;k++)span(w.id+'-door-leaf-'+i+'-'+k,at(o.from+(o.to-o.from)*k/o.leaves+gap),at(o.from+(o.to-o.from)*(k+1)/o.leaves-gap),.025,o.height-.06,.065,[.62,.65,.63],'frame',w.room);
        }
        cursor=o.to;
      }
      if(cursor<1)span(w.id+'-end',at(cursor),b,bottom,h,t,wallColor,'wall',w.room);
    }
    // 같은 기준점에서 만나는 벽의 inset 때문에 생기는 모서리 빈 사분면을 메운다.
    // 문 개구부 내부에는 보강재를 만들지 않으며 서로 떨어진 벽을 임의로 잇지 않는다.
    const wallEnds=new Map();
    for(const w of [...(data.shell||[]),...data.walls])for(const at of [w.a,w.b]){
      const key=at.map(v=>v.toFixed(5)).join(',');if(!wallEnds.has(key))wallEnds.set(key,{at,walls:[]});wallEnds.get(key).walls.push(w);
    }
    let joint=0;
    for(const {at,walls} of wallEnds.values())if(walls.length>1){
      const p=point(at),low=Math.max(...walls.map(w=>w.bottom||0)),high=Math.min(...walls.map(w=>w.height||data.wallHeight));
      const vertical=walls.filter(w=>w.a[0]===w.b[0]),horizontal=walls.filter(w=>w.a[1]===w.b[1]);
      // 일직선 접합에는 보강 상자를 두지 않고 직각부는 각 벽 두께의 교차 범위만 메운다.
      if(!vertical.length||!horizontal.length)continue;
      const bounds=(list,axis)=>{
        const ranges=list.map(w=>{const t=w.thickness||data.wallThickness,c=p[axis]+(w.inset?.[axis]||0)*t/2;return [c-t/2,c+t/2];});
        return [Math.min(...ranges.map(r=>r[0])),Math.max(...ranges.map(r=>r[1]))];
      };
      const x=bounds(vertical,0),z=bounds(horizontal,1);
      if(high>low)parts.push({id:'wall-joint-'+joint++,position:[(x[0]+x[1])/2,(low+high)/2,(z[0]+z[1])/2],size:[x[1]-x[0],high-low,z[1]-z[0]],yaw:0,color:wallColor,group:'wall',room:walls[0].room,junction:at});
    }
    for(const f of data.frames){
      const inset=f.inset||[0,0],a=point(f.a).map((v,i)=>v+inset[i]*.07),b=point(f.b).map((v,i)=>v+inset[i]*.07),n=f.divisions||1;
      span(f.id+'-header',a,b,f.height-.14,f.height,.14,frameColor,'frame',f.room);
      for(let i=0;i<=n;i++){
        const p=a.map((v,k)=>v+(b[k]-v)*i/n);
        parts.push({id:f.id+'-post-'+i,position:[p[0],f.height/2,p[1]],size:[.11,f.height,.11],yaw:0,color:frameColor,group:'frame',room:f.room});
        if(f.glazed&&i<n){
          const next=a.map((v,k)=>v+(b[k]-v)*(i+1)/n);
          span(f.id+'-glass-'+i,p,next,.06,f.height-.14,.025,[.56,.75,.77],'glass',f.room);
          parts[parts.length-1].alpha=.20;
        }
      }
    }
    for(const b of data.beams||[])span(b.id,point(b.a),point(b.b),b.bottom,b.bottom+b.height,b.thickness,wallColor,'structure','long');
    for(const c of data.columns||[]){const p=point(c.at),h=c.height+.012;parts.push({id:c.id,position:[p[0],h/2,p[1]],size:[c.width,h,c.depth],yaw:0,color:wallColor,group:'structure',room:'long'});}
    for(const w of data.solidWalls||[])parts.push({id:w.id,mesh:extrude(w.polygon,w.height),position:[0,0,0],size:[1,1,1],yaw:0,color:wallColor,group:'wall',room:w.room});
    const wood=[.43,.29,.19],displayColor=[.58,.44,.30];
    function box(id,at,size,bottom=0,color=displayColor,group='displays',room='bow'){
      const p=point(at);parts.push({id,position:[p[0],bottom+size[1]/2,p[1]],size,yaw:0,color,group,room});
    }
    function custom(id,mesh,room){parts.push({id,mesh,position:[0,0,0],size:[1,1,1],yaw:0,color:wood,group:'details',room});}
    for(const b of data.detailBoxes||[])box(b.id,b.at,b.size,b.bottom||0,b.color,'details',b.room);
    for(const e of data.detailExtrusions||[])parts.push({id:e.id,mesh:extrude(e.polygon,e.height),position:[0,e.bottom,0],size:[1,1,1],yaw:0,color:e.color,group:'details',room:e.room});
    for(const r of data.reliefDisplays||[]){
      const a=point(r.a),b=point(r.b),len=Math.hypot(b[0]-a[0],b[1]-a[1]),at=t=>a.map((v,i)=>v+(b[i]-v)*t),off=p=>p.map((v,i)=>v+r.inward[i]*r.depth/2),front=p=>p.map((v,i)=>v+r.inward[i]*r.depth);
      span(r.id+'-back',a,b,r.bottom,r.top,.035,[.80,.80,.74],'details',r.room);
      span(r.id+'-plinth',off(a),off(b),0,r.bottom,r.depth,wallColor,'wall',r.room);
      span(r.id+'-sill',off(a),off(b),r.bottom,r.bottom+.10,r.depth,wood,'displays',r.room);
      span(r.id+'-header',front(a),front(b),r.top-.12,r.top,.12,wood,'details',r.room);
      span(r.id+'-left-frame',front(a),front(at(.12/len)),r.bottom,r.top,.12,wood,'details',r.room);
      span(r.id+'-right-frame',front(at(1-.12/len)),front(b),r.bottom,r.top,.12,wood,'details',r.room);
    }
    for(const r of data.detailRibbons||[]){
      custom(r.id,sweep(r.path.map(p=>{const q=point(p);return [q[0],r.bottom+r.height/2,q[1]];}),r.width*data.scale,r.height),r.room);
    }
    for(const r of data.detailRails||[])span(r.id,point(r.a),point(r.b),2.42,2.53,.10,wood,'details','bow');
    for(const a of data.detailArches||[]){
      const start=point(a.a),end=point(a.b),path=Array.from({length:33},(_,i)=>{const t=i/32;return [start[0]+(end[0]-start[0])*t,a.spring+a.rise*Math.sin(Math.PI*t),start[1]+(end[1]-start[1])*t];});
      custom(a.id,sweep(path,a.depth,a.thickness),a.room);
      if(a.posts)for(const [i,at] of [a.a,a.b].entries())box(a.id+'-post-'+i,at,[.17,a.spring,.17],0,wood,'details',a.room);
    }
    for(const d of data.displays||[]){
      box(d.id+'-base',d.at,d.size,0,displayColor,'displays',d.room);
      const overhang=d.topOverhang??.04;
      box(d.id+'-top',d.at,[d.size[0]+overhang,.045,d.size[2]+overhang],d.size[1],[.83,.82,.74],'displays',d.room);
      if(d.type!=='platform'){
        const h=d.type==='case'?1.30:.38,p=point(d.at),w=d.size[0],z=d.size[2],low=d.size[1]+.045;
        for(const [i,v] of [[0,-1],[1,1]]){
          parts.push({id:d.id+'-glass-side-'+i,position:[p[0]+v*w/2,low+h/2,p[1]],size:[.018,h,z],yaw:0,color:[.62,.78,.79],alpha:.14,group:'displayGlass',room:d.room});
          parts.push({id:d.id+'-glass-front-'+i,position:[p[0],low+h/2,p[1]+v*z/2],size:[w,h,.018],yaw:0,color:[.62,.78,.79],alpha:.14,group:'displayGlass',room:d.room});
        }
        parts.push({id:d.id+'-glass-top',position:[p[0],low+h,p[1]],size:[w,.018,z],yaw:0,color:[.62,.78,.79],alpha:.14,group:'displayGlass',room:d.room});
      }
    }
    // 기둥 사이 목재 테이블: 얇은 상판·하부 턱·중앙 지지대, 전후면은 개방.
    for(const t of data.galleryTables||[]){
      const a=point(t.a),b=point(t.b),center=a.map((v,i)=>(v+b[i])/2),dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),yaw=-Math.atan2(dz,dx);
      span(t.id+'-deck',a,b,t.height-.14,t.height,t.depth,[.55,.36,.20],'displays',t.room);
      span(t.id+'-apron',a,b,t.height-.22,t.height-.14,t.depth-.10,[.37,.23,.14],'displays',t.room);
      parts.push({id:t.id+'-pedestal',position:[center[0],(t.height-.22)/2,center[1]],size:[.55,t.height-.22,.48],yaw,color:[.34,.23,.16],group:'displays',room:t.room});
      parts.push({id:t.id+'-foot',position:[center[0],.035,center[1]],size:[.63,.07,.56],yaw,color:[.21,.22,.20],group:'displays',room:t.room});
    }
    // 곡면 액자는 벽의 실제 굴곡을 따라 연속 띠 메시로 만든다.
    for(const f of data.curvedArtFrames||[]){
      const path=f.path,width=.035,depth=.035,gap=.008,color=[.31,.28,.23];
      const normals=path.map((p,i)=>{const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);return [dz/l,-dx/l];});
      const offset=(i,d)=>path[i].map((v,k)=>v+normals[i][k]*d/data.scale);
      const belt=path.map((_,i)=>offset(i,gap)).concat(path.map((_,i)=>offset(i,gap+depth)).reverse());
      for(const [name,y] of [['bottom',f.bottom],['top',f.top-width]])parts.push({id:f.id+'-'+name,mesh:extrude(belt,width),position:[0,y,0],size:[1,1,1],yaw:0,color,group:'details',room:f.room});
      for(const [name,i,j] of [['left',0,1],['right',path.length-1,path.length-2]]){
        const a=point(offset(i,gap+depth/2)),b=point(offset(j,gap+depth/2)),l=Math.hypot(b[0]-a[0],b[1]-a[1]);
        span(f.id+'-'+name,a,a.map((v,k)=>v+(b[k]-v)*width/l),f.bottom+width,f.top-width,depth,color,'details',f.room);
      }
    }
    // 얇은 액자 네 변만 생성한다. 뒤판/작품은 비워 벽면이 그대로 보인다.
    for(const f of data.wallArtFrames||[]){
      if(f.imageOnly)continue;
      const thickness=.035,width=.035,color=[.31,.28,.23];
      const offset=p=>point(p).map((v,i)=>v+f.inward[i]*(thickness/2+.008));
      const a=offset(f.a),b=offset(f.b),len=Math.hypot(b[0]-a[0],b[1]-a[1]),at=t=>a.map((v,i)=>v+(b[i]-v)*t);
      span(f.id+'-bottom',a,b,f.bottom,f.bottom+width,thickness,color,'details',f.room);
      span(f.id+'-top',a,b,f.top-width,f.top,thickness,color,'details',f.room);
      span(f.id+'-left',a,at(width/len),f.bottom+width,f.top-width,thickness,color,'details',f.room);
      span(f.id+'-right',at(1-width/len),b,f.bottom+width,f.top-width,thickness,color,'details',f.room);
    }
    // 바닥까지 내려오지 않는 목재 벽걸이 진열장: 불투명 목재 함체와 전면 유리.
    for(const n of data.wallCases||[]){
      const a=point(n.a),b=point(n.b),len=Math.hypot(b[0]-a[0],b[1]-a[1]),at=t=>a.map((v,i)=>v+(b[i]-v)*t),off=(p,d)=>p.map((v,i)=>v+n.inward[i]*d),midA=off(a,n.depth/2),midB=off(b,n.depth/2),frontA=off(a,n.depth),frontB=off(b,n.depth);
      if(n.glassOnly){
        span(n.id+'-front',frontA,frontB,n.bottom,n.top,.018,[.62,.78,.79],'displayGlass',n.room);parts[parts.length-1].alpha=.16;
        span(n.id+'-left',a,frontA,n.bottom,n.top,.018,[.62,.78,.79],'displayGlass',n.room);parts[parts.length-1].alpha=.16;
        span(n.id+'-right',b,frontB,n.bottom,n.top,.018,[.62,.78,.79],'displayGlass',n.room);parts[parts.length-1].alpha=.16;
        span(n.id+'-bottom',a,b,n.bottom,n.bottom+.018,n.depth,[.62,.78,.79],'displayGlass',n.room);parts[parts.length-1].alpha=.16;
        span(n.id+'-top',a,b,n.top-.018,n.top,n.depth,[.62,.78,.79],'displayGlass',n.room);parts[parts.length-1].alpha=.16;
        continue;
      }
      span(n.id+'-back',a,b,n.bottom,n.top,.055,wood,'displays',n.room);
      span(n.id+'-sill',midA,midB,n.bottom,n.bottom+.09,n.depth,wood,'displays',n.room);
      span(n.id+'-header',midA,midB,n.top-.09,n.top,n.depth,wood,'displays',n.room);
      span(n.id+'-left',midA,off(at(.08/len),n.depth/2),n.bottom,n.top,n.depth,wood,'displays',n.room);
      span(n.id+'-right',off(at(1-.08/len),n.depth/2),midB,n.bottom,n.top,n.depth,wood,'displays',n.room);
      span(n.id+'-glass',frontA,frontB,n.bottom+.09,n.top-.09,.018,[.62,.78,.79],'displayGlass',n.room);parts[parts.length-1].alpha=.16;
    }
    // 바닥 기단과 프레임 없는 유리 덮개. 뒷면은 기존 벽에 밀착한다.
    for(const n of data.glassCases||[]){
      const a=point(n.a),b=point(n.b),offset=(p,d)=>p.map((v,i)=>v+n.inward[i]*d),midA=offset(a,n.depth/2),midB=offset(b,n.depth/2),fa=offset(a,n.depth),fb=offset(b,n.depth);
      span(n.id+'-toe',midA,midB,0,.06,n.depth,[.16,.17,.16],'displays',n.room);
      span(n.id+'-base',midA,midB,.06,n.baseHeight-.035,n.depth,[.62,.60,.55],'displays',n.room);
      span(n.id+'-deck',midA,midB,n.baseHeight-.035,n.baseHeight,n.depth,[.86,.85,.80],'displays',n.room);
      for(const [id,start,end] of [['front',fa,fb],['left',a,fa],['right',b,fb]]){
        span(n.id+'-glass-'+id,start,end,n.baseHeight,n.top,.018,[.62,.78,.79],'displayGlass',n.room);parts[parts.length-1].alpha=.16;
      }
      span(n.id+'-glass-roof',midA,midB,n.top-.018,n.top,n.depth,[.62,.78,.79],'displayGlass',n.room);parts[parts.length-1].alpha=.14;
    }
    for(const n of data.niches||[]){
      const a=point(n.a),b=point(n.b),len=Math.hypot(b[0]-a[0],b[1]-a[1]),at=t=>a.map((v,i)=>v+(b[i]-v)*t),offset=(p,d)=>p.map((v,i)=>v+n.inward[i]*d),midA=offset(a,n.depth/2),midB=offset(b,n.depth/2),faceA=offset(a,n.depth),faceB=offset(b,n.depth),h=data.wallHeight;
      span(n.id+'-back',a,b,0,h,.10,wallColor,'wall',n.room);
      span(n.id+'-base',midA,midB,0,n.sill,n.depth,wallColor,'wall',n.room);
      span(n.id+'-soffit',midA,midB,n.top,h,n.depth,wallColor,'wall',n.room);
      span(n.id+'-left',midA,offset(at(.13/len),n.depth/2),n.sill,n.top,n.depth,wallColor,'wall',n.room);
      span(n.id+'-right',offset(at(1-.13/len),n.depth/2),midB,n.sill,n.top,n.depth,wallColor,'wall',n.room);
      span(n.id+'-shelf',midA,midB,n.sill,n.sill+.045,n.depth,[.83,.82,.75],'displays',n.room);
      span(n.id+'-front-glass',faceA,faceB,n.sill+.05,n.top,.018,[.62,.78,.79],'displayGlass',n.room);parts[parts.length-1].alpha=.12;
    }
    return {floors,parts};
  }
  function sweep(path,width,height){
    const rings=path.map((p,i)=>{const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz),nx=-dz/len*width/2,nz=dx/len*width/2;return [[p[0]+nx,p[1]-height/2,p[2]+nz],[p[0]-nx,p[1]-height/2,p[2]-nz],[p[0]-nx,p[1]+height/2,p[2]-nz],[p[0]+nx,p[1]+height/2,p[2]+nz]];});
    const pos=[],nrm=[],idx=[];
    function tri(a,b,c){const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n),base=pos.length/3;pos.push(...a,...b,...c);for(let j=0;j<3;j++)nrm.push(...n.map(v=>v/len));idx.push(base,base+1,base+2);}
    for(let i=0;i<rings.length-1;i++)for(let j=0;j<4;j++){const k=(j+1)%4;tri(rings[i][j],rings[i+1][j],rings[i+1][k]);tri(rings[i][j],rings[i+1][k],rings[i][k]);}
    for(const r of [rings[0],rings[rings.length-1]]){tri(r[0],r[1],r[2]);tri(r[0],r[2],r[3]);}
    return {pos:new Float32Array(pos),nrm:new Float32Array(nrm),idx:new Uint16Array(idx)};
  }
  // 임의 평면 다각형을 위로 돌출한다. 상·하면과 수직면의 법선을 분리한다.
  function extrude(polygon,height){
    const cap=floor(polygon,height),bottom=floor(polygon,0),pos=[...cap.pos,...bottom.pos],nrm=[...cap.nrm,...bottom.nrm].map((v,i)=>i>=cap.nrm.length?-v:v),idx=[...cap.idx];
    const n=polygon.length;
    for(let i=0;i<bottom.idx.length;i+=3)idx.push(n+bottom.idx[i],n+bottom.idx[i+2],n+bottom.idx[i+1]);
    const p=polygon.map(point),area=p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0),sign=area>0?1:-1;
    p.forEach((a,i)=>{const b=p[(i+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),base=pos.length/3;
      pos.push(a[0],0,a[1],b[0],0,b[1],b[0],height,b[1],a[0],height,a[1]);
      for(let k=0;k<4;k++)nrm.push(sign*dz/len,0,-sign*dx/len);
      if(sign>0)idx.push(base,base+2,base+1,base,base+3,base+2);else idx.push(base,base+1,base+2,base,base+2,base+3);
    });
    return {pos:new Float32Array(pos),nrm:new Float32Array(nrm),idx:new Uint16Array(idx)};
  }
  return {point,build,floor,extrude};
})();
