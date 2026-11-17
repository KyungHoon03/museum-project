/* 관람 인원(더미 인간) 배치.
 * - 카테고리별 실제 평균 키(cm)와 머리 비율로 단순 마네킹을 계산해 만든다(외부 모델 파일 없음).
 * - 고른 방의 바닥에 사람끼리 겹치지 않게, 벽·진열장을 피해 고르게 놓는다.
 * - 모든 마네킹을 정점 색이 들어간 메시 몇 개로 합쳐 그리기 호출을 최소화한다(화면 부담 최소화).
 * 단위: 1 = 1m. 건물 평면은 사진 기준 근사이므로 사람 치수만 실측 통계에 근거한다. */
window.MuseumVisitors=function(gl,options){
  'use strict';
  const {collision,host,onChange}=options;
  /* 키(stature)는 출처 확인값. 머리 수·다리·어깨·몸 두께 비율과 점유 반지름은 화면용 비율 추정.
   * radius: 다른 사람과 겹치지 않게 잡는 바닥 원의 반지름(몸 + 최소 간격). wall: 벽·진열장과의 최소 거리. */
  const CATEGORIES=[
    {id:'adult',name:'성인',age:'20~69세',stature:166.1,heads:7.5,leg:.53,shoulder:.25,depth:.13,radius:.30,wall:.20,color:[.55,.61,.68],
      source:'사이즈코리아 제8차 인체치수조사 평균 키 남 172.5cm·여 159.6cm의 평균'},
    {id:'teen',name:'청소년',age:'15세',stature:164.4,heads:7,leg:.52,shoulder:.245,depth:.125,radius:.275,wall:.19,color:[.42,.63,.55],
      source:'2017 소아청소년 성장도표 15세(180개월) 키 50백분위수 남 169.2cm·여 159.5cm의 평균'},
    {id:'child',name:'어린이',age:'9세',stature:133.0,heads:6,leg:.49,shoulder:.24,depth:.12,radius:.225,wall:.16,color:[.86,.60,.36],
      source:'2017 소아청소년 성장도표 9세(108개월) 키 50백분위수 남 133.4cm·여 132.6cm의 평균'},
    {id:'preschool',name:'유아',age:'5세',stature:109.0,heads:5,leg:.45,shoulder:.245,depth:.125,radius:.20,wall:.14,color:[.90,.77,.38],
      source:'2017 소아청소년 성장도표 5세(60개월) 키 50백분위수 남 109.6cm·여 108.4cm의 평균'},
    {id:'wheelchair',name:'휠체어 사용자',age:'성인 탑승',stature:166.1,heads:7.5,leg:.53,shoulder:.25,depth:.13,radius:.60,wall:.45,color:[.60,.54,.74],seated:true,
      source:'탑승자는 성인 평균 키. 휠체어 모형은 폭 약 66cm·길이 약 100cm의 일반 수동 휠체어(치수 추정)'}
  ];
  const PRESETS=[
    {name:'초등 1학급 견학',counts:{child:25,adult:2}},
    {name:'유치원 1반',counts:{preschool:15,adult:2}},
    {name:'중학교 1학급',counts:{teen:28,adult:2}},
    {name:'휠체어 동반 가족',counts:{adult:4,child:2,wheelchair:2}}
  ];
  const STEP=.08; // 바닥 후보점 간격(8cm)
  const rooms=MuseumLayout.rooms.map(room=>{
    const poly=room.polygon.map(MuseumGeometry.point);let area=0;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++)area+=(poly[j][0]+poly[i][0])*(poly[j][1]-poly[i][1]);
    return {id:room.id,name:room.name,poly,area:Math.abs(area)/2,grid:null};
  });
  const counts=Object.fromEntries(CATEGORIES.map(c=>[c.id,0]));
  // '전체': 모든 방의 바닥 후보를 합쳐 건물 전체에 고르게 놓는다(방별 인원도 함께 표시).
  const ALL={id:'all',name:'전체',poly:null,area:rooms.reduce((s,r)=>s+r.area,0),grid:null};
  let room=rooms.find(r=>r.id==='maru')||rooms[0],placed=[],seed=1,meshes=[];

  /* ---------- 마네킹 형상: 몸 기준 좌표(앞 = +Z)의 상자·원통을 위치·방향으로 옮겨 하나의 버퍼에 쌓는다 ---------- */
  function builder(){
    const chunks=[];let cur=null;
    const start=()=>{cur={pos:[],nrm:[],col:[],idx:[]};chunks.push(cur);};start();
    function reserve(n){if(cur.pos.length/3+n>60000)start();}
    return {chunks,
      box(t,c,s,color){ // t: {x,z,yaw}, c: 몸 기준 중심, s: [폭,높이,깊이]
        reserve(24);const ca=Math.cos(t.yaw),sa=Math.sin(t.yaw),h=s.map(v=>v/2);
        const W=(x,y,z)=>[t.x+ca*x+sa*z,y,t.z-sa*x+ca*z],N=(x,y,z)=>[ca*x+sa*z,y,-sa*x+ca*z];
        const faces=[[[1,0,0],[0,0,-1],[0,1,0]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]]];
        for(const [n,u,v] of faces){
          const base=cur.pos.length/3;
          for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
            const l=[0,1,2].map(k=>c[k]+(n[k]+u[k]*a+v[k]*b)*h[k]);
            cur.pos.push(...W(...l));cur.nrm.push(...N(...n));cur.col.push(...color);
          }
          cur.idx.push(base,base+1,base+2,base,base+2,base+3);
        }
      },
      wheel(t,c,r,width,color,seg=14){ // 축이 몸 기준 X인 원통(바퀴)
        reserve(seg*6+6);const ca=Math.cos(t.yaw),sa=Math.sin(t.yaw);
        const W=(x,y,z)=>[t.x+ca*x+sa*z,y,t.z-sa*x+ca*z],N=(x,y,z)=>[ca*x+sa*z,y,-sa*x+ca*z];
        const ring=[];for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2;ring.push([Math.cos(a),Math.sin(a)]);}
        let base=cur.pos.length/3;
        for(const [cy,sz] of ring)for(const side of [-1,1]){cur.pos.push(...W(c[0]+side*width/2,c[1]+cy*r,c[2]+sz*r));cur.nrm.push(...N(0,cy,sz));cur.col.push(...color);}
        for(let i=0;i<seg;i++){const k=base+i*2;cur.idx.push(k,k+1,k+3,k,k+3,k+2);}
        for(const side of [-1,1]){
          base=cur.pos.length/3;cur.pos.push(...W(c[0]+side*width/2,c[1],c[2]));cur.nrm.push(...N(side,0,0));cur.col.push(...color);
          for(const [cy,sz] of ring){cur.pos.push(...W(c[0]+side*width/2,c[1]+cy*r,c[2]+sz*r));cur.nrm.push(...N(side,0,0));cur.col.push(...color);}
          for(let i=0;i<seg;i++)cur.idx.push(base,base+1+i,base+2+i);
        }
      }
    };
  }
  const tint=(c,k)=>c.map(v=>Math.min(1,v*k));
  /* 선 자세: 키 H, 머리 높이 = H/머리 수. 어깨 높이 = 정수리 - 머리 1.37개(머리+목),
   * 엉덩이 높이 = H×다리 비율, 무릎 = 엉덩이의 54%, 발목 = H×3.9%, 손끝 높이 = 엉덩이의 72%. */
  function body(cat,H){
    const head=H/cat.heads,hip=H*cat.leg,sw=H*cat.shoulder,dp=H*cat.depth;
    return {head,hip,sw,dp,knee:hip*.54,ankle:H*.039,legW:sw*.27,legX:sw*.2,armW:sw*.17,armLen:(H-head*1.37)-.72*hip};
  }
  function standing(b,t,cat){
    const H=cat.stature/100,d=body(cat,H),skin=tint(cat.color,1.25),shoulderY=H-d.head*1.37;
    for(const sx of [-1,1]){
      b.box(t,[sx*d.legX,d.ankle/2,H*.03],[d.legW*.95,d.ankle,H*.15],tint(cat.color,.7));            // 발
      b.box(t,[sx*d.legX,(d.ankle+d.knee)/2,0],[d.legW*.8,d.knee-d.ankle,d.legW*.85],cat.color);   // 정강이
      b.box(t,[sx*d.legX,(d.knee+d.hip)/2,0],[d.legW,d.hip-d.knee,d.legW*1.05],cat.color);         // 허벅지
      const ax=sx*(d.sw/2-d.armW/2),up=d.armLen*.45,low=d.armLen*.55,top=shoulderY-H*.01;
      b.box(t,[ax,top-up/2,0],[d.armW,up,d.armW*1.05],cat.color);                                   // 위팔
      b.box(t,[ax,top-up-low/2,0],[d.armW*.85,low,d.armW*.9],skin);                                 // 아래팔·손
    }
    b.box(t,[0,d.hip+H*.025,0],[d.sw*.7,H*.09,d.dp*.9],tint(cat.color,.85));                        // 골반
    b.box(t,[0,(d.hip+H*.07+shoulderY)/2,0],[d.sw*.68,shoulderY-d.hip-H*.07,d.dp],cat.color);       // 몸통
    b.box(t,[0,shoulderY-H*.025,0],[d.sw,H*.05,d.dp*.9],cat.color);                                 // 어깨
    b.box(t,[0,(shoulderY+H-d.head)/2,0],[d.head*.38,H-d.head-shoulderY+.01,d.head*.4],skin);       // 목
    b.box(t,[0,H-d.head/2,0],[d.head*.72,d.head,d.head*.85],skin);                                  // 머리
    b.box(t,[0,H-d.head*.45,d.head*.42],[d.head*.4,d.head*.12,d.head*.04],tint(cat.color,.6));     // 앞 표시(시선 방향)
  }
  /* 휠체어(앞 = +Z): 시트 높이 48cm, 뒷바퀴 지름 60cm, 등받이 90cm, 전체 폭 약 66cm·길이 약 100cm.
   * 탑승자: 앉은키 = 키의 52%(추정), 허벅지 수평, 정강이 수직, 아래팔은 팔걸이 위. */
  function seated(b,t,cat){
    const frame=[.22,.23,.25],tire=[.10,.10,.11],H=cat.stature/100,d=body(cat,H),skin=tint(cat.color,1.25);
    b.box(t,[0,.47,0],[.44,.03,.44],frame);                       // 시트
    b.box(t,[0,.70,-.235],[.42,.42,.03],frame);                   // 등받이
    for(const sx of [-1,1]){
      b.wheel(t,[sx*.31,.30,-.12],.30,.03,tire);                  // 뒷바퀴
      b.wheel(t,[sx*.20,.075,.32],.075,.03,tire);                 // 앞바퀴(캐스터)
      b.box(t,[sx*.235,.69,0],[.04,.03,.36],frame);               // 팔걸이
      b.box(t,[sx*.235,.34,.18],[.025,.30,.025],frame);           // 앞 다리
      b.box(t,[sx*.17,.30,.37],[.025,.38,.025],frame);            // 발판 걸이
      b.box(t,[sx*.20,.92,-.30],[.03,.03,.14],frame);             // 손잡이
    }
    b.box(t,[0,.11,.45],[.36,.02,.16],frame);                     // 발판
    const seat=.50,hipZ=-.10,thigh=H*.24,knee=[hipZ+thigh,seat+d.legW*.55];
    const headTop=seat+H*.52,shoulderY=headTop-d.head*1.37,pelvisTop=seat+H*.10;
    for(const sx of [-1,1]){
      b.box(t,[sx*d.legX,knee[1],(hipZ+knee[0])/2],[d.legW,d.legW*1.05,thigh],cat.color);              // 허벅지(수평)
      b.box(t,[sx*d.legX,(.13+knee[1])/2,knee[0]],[d.legW*.8,knee[1]-.13,d.legW*.85],cat.color);        // 정강이(수직)
      b.box(t,[sx*d.legX,.13,knee[0]+H*.05],[d.legW*.95,d.ankle,H*.15],tint(cat.color,.7));            // 발(발판 위)
      const ax=sx*(d.sw/2-d.armW/2),up=d.armLen*.45,low=d.armLen*.55,top=shoulderY-H*.01,elbow=top-up;
      b.box(t,[ax,top-up/2,hipZ],[d.armW,up,d.armW*1.05],cat.color);                                     // 위팔
      b.box(t,[ax,elbow,hipZ+low/2],[d.armW*.85,d.armW*.9,low],skin);                                    // 아래팔(앞으로)
    }
    b.box(t,[0,(seat+pelvisTop)/2,hipZ],[d.sw*.7,pelvisTop-seat,d.dp*.9],tint(cat.color,.85));       // 골반
    b.box(t,[0,(pelvisTop+shoulderY)/2,hipZ],[d.sw*.68,shoulderY-pelvisTop,d.dp],cat.color);          // 몸통
    b.box(t,[0,shoulderY-H*.025,hipZ],[d.sw,H*.05,d.dp*.9],cat.color);                                // 어깨
    b.box(t,[0,(shoulderY+headTop-d.head)/2,hipZ],[d.head*.38,headTop-d.head-shoulderY+.01,d.head*.4],skin);
    b.box(t,[0,headTop-d.head/2,hipZ],[d.head*.72,d.head,d.head*.85],skin);
    b.box(t,[0,headTop-d.head*.45,hipZ+d.head*.42],[d.head*.4,d.head*.12,d.head*.04],tint(cat.color,.6));
  }

  /* ---------- 배치: 바닥 후보점(8cm 간격) → 사람끼리 겹치지 않는 점 중 가장 여유로운 곳 ---------- */
  const WALLS=[...new Set(CATEGORIES.map(c=>c.wall))].sort((a,b)=>a-b);
  function inPoly(poly,x,z){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){if((poly[i][1]>z)!==(poly[j][1]>z)&&x<(poly[j][0]-poly[i][0])*(z-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])yes=!yes;}return yes;}
  function grid(r){
    if(r.grid)return r.grid;
    if(r===ALL){ // 방 경계가 맞닿아 겹치는 후보점은 하나만 남긴다.
      const seen=new Set(),pts=[];let freeArea=0;
      for(const rm of rooms){const g=grid(rm);freeArea+=g.freeArea;for(const p of g.pts){const k=Math.round(p.x/STEP)+','+Math.round(p.z/STEP);if(!seen.has(k)){seen.add(k);pts.push(p);}}}
      return r.grid={pts,freeArea};
    }
    const xs=r.poly.map(p=>p[0]),zs=r.poly.map(p=>p[1]),pts=[];let free=0;
    const blocked=collision.region([Math.min(...xs),Math.min(...zs)],[Math.max(...xs),Math.max(...zs)],WALLS.at(-1)+.05);
    for(let x=Math.min(...xs)+STEP/2;x<Math.max(...xs);x+=STEP)for(let z=Math.min(...zs)+STEP/2;z<Math.max(...zs);z+=STEP){
      if(!inPoly(r.poly,x,z))continue;const p=[x,1.575,z];
      if(blocked(p,0))continue;free++;
      // 대부분의 점은 벽에서 멀다: 가장 큰 거리부터 보고, 막힐 때만 작은 거리로 내려간다.
      let clear=0;if(!blocked(p,WALLS.at(-1)))clear=WALLS.at(-1);else for(const w of WALLS){if(blocked(p,w))break;clear=w;}
      if(clear>0)pts.push({x,z,clear,room:r.id});
    }
    return r.grid={pts,freeArea:free*STEP*STEP};
  }
  function rng(){seed=(seed+0x6D2B79F5)|0;let t=seed;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}
  function margin(p,cat){let m=Infinity;for(const q of placed){const d=Math.hypot(p.x-q.x,p.z-q.z)-cat.radius-q.cat.radius;if(d<m)m=d;}return m;}
  function placeOne(cat){
    const pts=grid(room).pts.filter(p=>p.clear>=cat.wall);if(!pts.length)return false;
    let best=null,bestScore=-Infinity,found=0;
    for(let i=0;i<120&&found<10;i++){const p=pts[Math.floor(rng()*pts.length)],m=margin(p,cat);if(m<0)continue;found++;if(m>bestScore){best=p;bestScore=m;}}
    if(!best){ // 무작위로 못 찾으면 전체 후보를 훑어 남은 빈자리를 찾는다(가득 찼는지 판정).
      const offset=Math.floor(rng()*pts.length);
      for(let i=0;i<pts.length;i++){const p=pts[(i+offset)%pts.length];if(margin(p,cat)>=0){best=p;break;}}
    }
    if(!best)return false;
    placed.push({cat,x:best.x,z:best.z,yaw:rng()*Math.PI*2,room:best.room});return true;
  }
  function placedCount(id){return placed.filter(p=>p.cat.id===id).length;}
  // 인원을 줄이면 그 카테고리의 마지막 사람부터 빼고, 늘리면 기존 사람은 그대로 둔 채 빈자리에 더한다.
  function adjust(){
    for(const cat of CATEGORIES){
      while(placedCount(cat.id)>counts[cat.id]){const i=placed.map(p=>p.cat.id).lastIndexOf(cat.id);placed.splice(i,1);}
    }
    // 큰 점유(휠체어)부터 놓아야 자리가 남는다.
    for(const cat of [...CATEGORIES].sort((a,b)=>b.radius-a.radius)){
      while(placedCount(cat.id)<counts[cat.id]&&placeOne(cat));
    }
    rebuild();
  }
  function replaceAll(){placed=[];seed=(seed*16807+11)|0||1;adjust();}
  function rebuild(){
    for(const m of meshes)m.dispose();meshes=[];
    const b=builder();
    for(const p of placed)(p.cat.seated?seated:standing)(b,{x:p.x,z:p.z,yaw:p.yaw},p.cat);
    for(const c of b.chunks)if(c.idx.length)meshes.push(D.upload(gl,{pos:new Float32Array(c.pos),nrm:new Float32Array(c.nrm),col:new Float32Array(c.col),idx:new Uint16Array(c.idx)}));
    onChange&&onChange();render();
  }

  /* ---------- 설정 패널 ---------- */
  const el=(tag,props={},...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k.includes('-'))e.setAttribute(k,v);else e[k]=v;}e.append(...kids);return e;};
  const roomSelect=el('select',{id:'visitors-room'});
  for(const r of [ALL,...rooms])roomSelect.append(el('option',{value:r.id,textContent:r.name}));
  roomSelect.value=room.id;
  roomSelect.addEventListener('change',()=>{room=[ALL,...rooms].find(r=>r.id===roomSelect.value);status.textContent=room===ALL&&!ALL.grid?'건물 전체 바닥을 계산하는 중… (처음 한 번, 몇 초)':'바닥을 계산하는 중…';setTimeout(replaceAll,20);});
  const rows=new Map();
  const list=el('div',{className:'visitor-rows'});
  for(const cat of CATEGORIES){
    const range=el('input',{type:'range',min:0,max:60,step:1,value:0,'aria-label':`${cat.name} 인원`});
    const number=el('input',{type:'number',min:0,max:300,step:1,value:0,'aria-label':`${cat.name} 인원 숫자`});
    const swatch=el('i',{className:'visitor-swatch'});swatch.style.background=`rgb(${cat.color.map(v=>Math.round(v*255)).join()})`;
    const got=el('span',{className:'visitor-placed'});
    const set=v=>{counts[cat.id]=Math.max(0,Math.min(300,Math.round(+v||0)));range.value=Math.min(60,counts[cat.id]);number.value=counts[cat.id];adjust();};
    range.addEventListener('input',()=>set(range.value));number.addEventListener('change',()=>set(number.value));
    list.append(el('div',{className:'visitor-row'},el('span',{className:'visitor-name'},swatch,`${cat.name}`,el('small',{textContent:` ${cat.age} · ${cat.seated?'앉은 머리 높이 '+Math.round(50+cat.stature*.52)+'cm':'키 '+cat.stature.toFixed(1)+'cm'}`})),range,number,got));
    rows.set(cat.id,{range,number,got});
  }
  const presets=el('div',{className:'visitor-presets'});
  for(const p of PRESETS){
    const btn=el('button',{type:'button',textContent:p.name,title:Object.entries(p.counts).map(([k,v])=>`${CATEGORIES.find(c=>c.id===k).name} ${v}명`).join(', ')});
    btn.addEventListener('click',()=>{for(const c of CATEGORIES)counts[c.id]=p.counts[c.id]||0;syncInputs();replaceAll();});
    presets.append(btn);
  }
  const reshuffle=el('button',{type:'button',textContent:'다시 배치'});reshuffle.addEventListener('click',replaceAll);
  const clear=el('button',{type:'button',textContent:'모두 비우기'});clear.addEventListener('click',()=>{for(const c of CATEGORIES)counts[c.id]=0;syncInputs();adjust();});
  const status=el('div',{className:'visitor-status',role:'status'});
  const sources=el('details',{className:'visitor-sources'},el('summary',{textContent:'치수 근거'}),
    el('ul',{},...CATEGORIES.map(c=>el('li',{textContent:`${c.name}: ${c.source}. 점유 지름 ${Math.round(c.radius*200)}cm(추정)`}))),
    el('p',{className:'light-note',textContent:'머리 높이(키÷머리 수), 어깨너비, 몸 두께, 점유 지름은 화면 표시용 비율 추정입니다. 건물 평면은 사진을 비율로 맞춘 근사값이라 실제 수용 인원은 실측 도면으로 다시 확인해야 합니다.'}));
  function syncInputs(){for(const c of CATEGORIES){const r=rows.get(c.id);r.range.value=Math.min(60,counts[c.id]);r.number.value=counts[c.id];}}
  function render(){
    syncInputs();
    let total=0,short=0;
    for(const c of CATEGORIES){const n=placedCount(c.id),want=counts[c.id];total+=n;short+=want-n;rows.get(c.id).got.textContent=want?`${n}/${want}`:'';rows.get(c.id).got.classList.toggle('short',n<want);}
    // 바닥 계산은 처음 인원을 놓을 때 한다(첫 화면 로딩을 늦추지 않도록).
    const g=room.grid||(total?grid(room):null),per=total?g.freeArea/total:Infinity;
    const level=!total?'':per>=2?'여유':per>=1?'보통':'혼잡';
    status.dataset.level=level;
    status.replaceChildren(
      el('div',{textContent:`${room.name} · 방 면적 약 ${room.area.toFixed(1)}㎡`+(g?`, 비어 있는 바닥 약 ${g.freeArea.toFixed(1)}㎡`:'')}),
      el('div',{className:'visitor-density',textContent:total?`총 ${total}명 · 1인당 바닥 ${per.toFixed(2)}㎡ · ${level}`:'인원을 올리면 바닥에 배치됩니다.'}),
      ...(short>0?[el('div',{className:'visitor-short',textContent:`자리가 부족해 ${short}명을 놓지 못했습니다. ${room===ALL?'건물 전체가':'이 방은'} 지금 간격 기준으로 가득 찼습니다.`})]:[]),
      ...(room===ALL&&total?[el('ul',{className:'visitor-rooms'},...rooms.map(rm=>{const n=placed.filter(p=>p.room===rm.id).length;if(!n)return null;const f=grid(rm).freeArea/n;return el('li',{},el('span',{textContent:rm.name}),el('span',{textContent:`${n}명 · ${f.toFixed(1)}㎡/인`}));}).filter(Boolean))]:[]),
      el('div',{className:'light-note',textContent:'표시 기준(팀 기준): 1인당 2㎡ 이상 여유, 1~2㎡ 보통, 1㎡ 미만 혼잡'})
    );
  }
  if(host){
    host.append(
      el('div',{className:'light-row'},el('span',{textContent:'배치할 방'}),roomSelect),
      el('h3',{textContent:'예시 단체 구성'}),presets,
      el('h3',{textContent:'카테고리별 인원'}),list,
      el('div',{className:'visitor-actions'},reshuffle,clear),status,sources);
  }
  render();
  return {get meshes(){return meshes;},get placed(){return placed;},categories:CATEGORIES,counts,
    setRoom(id){const r=[ALL,...rooms].find(x=>x.id===id);if(r){room=r;roomSelect.value=id;replaceAll();}},
    set(id,n){counts[id]=n;adjust();}};
};
