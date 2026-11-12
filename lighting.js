/* 조명과 태양.
 * - 실내 조명: 트랙 스포트라이트·넓은 스포트라이트·천장 다운라이트·진열장 LED·펜던트 전구.
 *   종류·색온도·밝기·빔 각도·위치·겨냥 대상을 바꿀 수 있고 켜고 끌 수 있다. 기본 배치는 전시 자리에서 자동으로 만든다.
 * - 태양: 부천(북위 37.50°, 동경 126.78°, 한국 표준시) 날짜·시각으로 고도와 방위를 계산한다(NOAA 근사식).
 *   건물에는 천장이 있다고 보고 햇빛은 실외(야외 마당·외벽·지붕 높이 윗면)에만 닿는다. 실내 밝기는 조명이 정한다.
 * 화면 그리기는 viewer.js가 하고, 이 파일은 상태·계산·편집 화면을 맡는다. */
window.MuseumLighting=(()=>{
 'use strict';
 const L=MuseumLayout,G=MuseumGeometry,DS=MuseumDisplaySupports;
 let MAX_LIGHTS=32;const STORAGE_KEY='museum-lighting-v3';
 const SITE={name:'부천',lat:37.50,lon:126.78,tz:9};
 const CEILING=2.74;
 const TYPES={
  spot:{label:'트랙 스포트라이트',angle:26,intensity:4.2,range:7,fixture:'can'},
  flood:{label:'넓은 스포트라이트',angle:55,intensity:4.6,range:7,fixture:'can'},
  down:{label:'천장 다운라이트',angle:100,intensity:3.4,range:6.5,fixture:'disc'},
  case:{label:'진열장 LED',angle:140,intensity:1.9,range:3,fixture:'none'},
  pendant:{label:'펜던트 전구',angle:360,intensity:2.2,range:5,fixture:'bulb'}
 };
 // 색온도(K) → 대략의 RGB(정규화). 낮을수록 따뜻한 빛.
 const TEMPS={2700:[1,.78,.56],3000:[1,.83,.66],3500:[1,.88,.76],4000:[1,.92,.84],5000:[1,.97,.94],6500:[.92,.95,1]};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const norm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
 const sub=(a,b)=>a.map((v,i)=>v-b[i]);

 /* ---------------- 방·건물 외곽 ---------------- */
 const insidePoly=(poly,x,z)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
 const rooms=L.rooms.map(r=>{const poly=r.polygon.map(G.point),xs=poly.map(p=>p[0]),zs=poly.map(p=>p[1]);
  return {id:r.id,name:r.name,poly,bounds:[Math.min(...xs)-.15,Math.min(...zs)-.15,Math.max(...xs)+.15,Math.max(...zs)+.15],center:[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...zs)+Math.max(...zs))/2]};});
 // 방 영역은 서로 겹치는 곳이 있다(중앙 복도 다각형이 넓다). 복도를 먼저 칠하고 다른 방을 위에 덮는 순서를 기준으로 한다.
 rooms.forEach((r,i)=>r.index=i+1);
 const paintOrder=[...rooms.filter(r=>r.id==='link'),...rooms.filter(r=>r.id!=='link')];
 const roomAt=(x,z)=>[...paintOrder].reverse().find(r=>insidePoly(r.poly,x,z))||null;
 const envelope=(L.envelope||L.floor.polygon).map(G.point);
 const isIndoor=(x,z)=>insidePoly(envelope,x,z);

 /* ---------------- 겨냥 대상(전시 자리) ---------------- */
 const targets=[];
 for(const g of MuseumAssetCatalog)for(const [id,title,type,at,placement] of g.items){
  if(type==='3d'){const s=DS.supports.get(placement.support);if(!s)continue;
   targets.push({id,label:`${g.room} ${title}`,point:[s.center[0],s.y+Math.min(.35,s.maxHeight/2),s.center[1]],support:s});}
  else{const s=DS.imageSurface(placement);if(!s)continue;
   targets.push({id,label:`${g.room} ${title}`,point:[(s.a[0]+s.b[0])/2,(s.top+s.bottom)/2,(s.a[1]+s.b[1])/2],surface:s,wallType:placement.wallType});}
 }

 /* ---------------- 기본 배치 ---------------- */
 let serial=0;
 function make(type,pos,target,extra={}){
  const t=TYPES[type];
  return {id:'light-'+(++serial),type,name:extra.name||t.label,pos:[...pos],target:[...target],temp:extra.temp||3000,
   level:1,angle:extra.angle||t.angle,on:true,caseBounds:extra.caseBounds||null,targetId:extra.targetId||null};
 }
 function defaults(){
  serial=0;const list=[];
  // 진열장 LED: 유리로 덮인 받침면마다 안쪽 천장에서 아래로. 빛은 진열장 안에만 닿는다.
  for(const s of DS.supports.values()){
   if(!s.glass||/:(L|R|C)$/.test(s.id))continue;
   const top=s.y+s.maxHeight+.01,ex=Math.abs(s.u[0])*s.halfU+Math.abs(s.v[0])*s.halfV+.06,ez=Math.abs(s.u[1])*s.halfU+Math.abs(s.v[1])*s.halfV+.06;
   list.push(make('case',[s.center[0],top,s.center[1]],[s.center[0],s.y,s.center[1]],{temp:3500,name:'진열장 LED · '+s.label,caseBounds:[s.center[0]-ex,s.center[1]-ez,s.center[0]+ex,s.center[1]+ez]}));
  }
  // 열린 전시대·테이블·작업대: 관람객 쪽 천장에서 유물을 겨누는 스포트라이트.
  for(const t of targets){
   if(!t.support||t.support.glass||t.support.id.startsWith('ground:'))continue;
   const s=t.support,dist=Math.min(1.4,s.halfV+.9);
   const pos=[s.center[0]+s.v[0]*dist,CEILING,s.center[1]+s.v[1]*dist];
   list.push(make(s.halfU>1?'flood':'spot',pos,t.point,{targetId:t.id,temp:3000,name:'스포트 · '+t.label}));
  }
  // 벽 액자·부조 사진: 1.1m 앞 천장에서 비추는 벽 조명. 폭에 맞춰 빔을 넓힌다.
  for(const t of targets){
   if(!t.surface||t.wallType==='niche-display'||t.wallType==='recess-display')continue;
   const s=t.surface,w=Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]),dist=1.15;
   const pos=[t.point[0]+s.normal[0]*dist,CEILING,t.point[2]+s.normal[1]*dist];
   const reach=Math.hypot(dist,CEILING-t.point[1]);
   const angle=clamp(2*Math.atan(w/2/reach)*180/Math.PI,30,95);
   list.push(make(angle>50?'flood':'spot',pos,t.point,{targetId:t.id,temp:3000,angle,name:'벽 조명 · '+t.label}));
  }
  // 천장 다운라이트: 방마다 약 3.6m 간격. 야외는 제외.
  for(const r of rooms){
   if(r.id==='outdoor')continue;
   const [x0,z0,x1,z1]=r.bounds,step=3.6;
   const nx=Math.max(1,Math.round((x1-x0)/step)),nz=Math.max(1,Math.round((z1-z0)/step));
   let k=0;
   for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
    const x=x0+(i+.5)*(x1-x0)/nx,z=z0+(j+.5)*(z1-z0)/nz;
    if(roomAt(x,z)!==r)continue;
    list.push(make('down',[x,CEILING,z],[x,0,z],{temp:3000,name:`다운라이트 · ${r.name} ${++k}`}));
   }
  }
  return list;
 }

 /* ---------------- 상태와 저장 ---------------- */
 const today=new Date();
 const pad=n=>String(n).padStart(2,'0');
 const state={
  lights:[],selected:null,master:true,indoor:.26,exposure:1,
  date:`${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`,
  hour:14,mode:'manual',playSpeed:1800,northOffset:0,showMarkers:true
 };
 function load(){
  try{
   const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
   if(saved&&Array.isArray(saved.lights)&&saved.lights.length){
    state.lights=saved.lights.filter(l=>TYPES[l.type]);
    serial=Math.max(0,...state.lights.map(l=>Number(String(l.id).split('-')[1])||0));
    for(const key of ['master','indoor','exposure','northOffset','showMarkers'])if(key in saved)state[key]=saved[key];
    return true;
   }
  }catch{}
  return false;
 }
 let saveTimer=null;
 function save(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify({lights:state.lights,master:state.master,indoor:state.indoor,exposure:state.exposure,northOffset:state.northOffset,showMarkers:state.showMarkers}));}catch{}},250);
 }
 if(!load())state.lights=defaults();

 /* ---------------- 태양 ---------------- */
 function dayOfYear(dateText){const [y,m,d]=dateText.split('-').map(Number);const t=Date.UTC(y,m-1,d),s=Date.UTC(y,0,1);return {doy:Math.round((t-s)/864e5)+1,leap:(y%4===0&&y%100!==0)||y%400===0};}
 function solar(dateText,hour){
  const {doy,leap}=dayOfYear(dateText),days=leap?366:365;
  const g=2*Math.PI/days*(doy-1+(hour-12)/24);
  const eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
  const decl=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
  const tst=hour*60+eq+4*SITE.lon-60*SITE.tz,ha=(tst/4-180)*Math.PI/180,phi=SITE.lat*Math.PI/180;
  const cosZ=clamp(Math.sin(phi)*Math.sin(decl)+Math.cos(phi)*Math.cos(decl)*Math.cos(ha),-1,1);
  const elevation=Math.PI/2-Math.acos(cosZ);
  // 방위각: 북쪽에서 시계 방향.
  const azimuth=(Math.atan2(Math.sin(ha),Math.cos(ha)*Math.sin(phi)-Math.tan(decl)*Math.cos(phi))+Math.PI)%(2*Math.PI);
  return {elevation,azimuth};
 }
 function sunTimes(dateText){
  let rise=null,set=null,prev=solar(dateText,0).elevation;
  for(let m=5;m<=1440;m+=5){const h=m/60,e=solar(dateText,h).elevation;
   if(prev<=-.0145&&e>-.0145&&rise===null)rise=h;if(prev>-.0145&&e<=-.0145)set=h;prev=e;}
  return {rise,set};
 }
 const hhmm=h=>h===null?'—':`${pad(Math.floor(h)%24)}:${pad(Math.round((h%1)*60)%60)}`;
 const mixc=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
 function environment(){
  const {elevation,azimuth}=solar(state.date,state.hour);
  // 평면도 위쪽(-Z)을 북쪽으로 보고, 북쪽 보정 각도만큼 돌린다. 동쪽 +X, 위 +Y.
  const az=azimuth-state.northOffset*Math.PI/180,ce=Math.cos(elevation);
  const sunDir=[Math.sin(az)*ce,Math.sin(elevation),-Math.cos(az)*ce];
  const deg=elevation*180/Math.PI;
  const day=clamp((deg+6)/12,0,1),high=clamp(deg/40,0,1);   // -6°(시민박명)~+6° 사이에서 하늘이 밝아진다
  const nightSky=[.025,.03,.06],duskSky=[.55,.42,.40],daySky=[.60,.74,.90];
  const skyColor=deg<0?mixc(nightSky,duskSky,clamp((deg+8)/8,0,1)):mixc(duskSky,daySky,clamp(deg/12,0,1));
  const sunStrength=clamp(deg/4,0,1)*(.55+.45*high);
  const sunColor=mixc([1,.55,.30],[1,.96,.90],clamp(deg/25,0,1)).map(v=>v*sunStrength*.95);
  const skyAmbient=mixc([.035,.04,.07],[.36,.40,.47],day).map((v,i)=>v*(.75+.25*high));
  return {sunDir,sunColor,skyColor,skyAmbient,elevation:deg,azimuth:azimuth*180/Math.PI,day,
   indoorAmbient:state.indoor,indoorEnv:[.62,.60,.56].map(v=>v*(.5+state.indoor))};
 }

 /* ---------------- 셰이더로 보낼 값 ---------------- */
 const uni={count:0};
 function setMaxLights(n){MAX_LIGHTS=n;for(const k of ['pos','dir','color','bounds'])uni[k]=new Float32Array(n*4);}
 setMaxLights(MAX_LIGHTS);
 function boundsOf(light){
  if(light.caseBounds)return light.caseBounds;
  const r=roomAt(light.pos[0],light.pos[2])||roomAt(light.target[0],light.target[2]);
  return r?r.bounds:[light.pos[0]-4,light.pos[2]-4,light.pos[0]+4,light.pos[2]+4];
 }
 function rectDistance(b,x,z){const dx=Math.max(b[0]-x,0,x-b[2]),dz=Math.max(b[1]-z,0,z-b[3]);return Math.hypot(dx,dz);}
 // 카메라 가까운 조명부터 그래픽 카드 한도(MAX_LIGHTS)만큼 셰이더로 보낸다(같은 방 조명이 먼저 뽑힌다).
 function pack(eye){
  const live=state.master?state.lights.filter(l=>l.on):[];
  const scored=live.map(l=>{const b=boundsOf(l);return {l,b,score:rectDistance(b,eye[0],eye[2])*10+Math.hypot(l.pos[0]-eye[0],l.pos[2]-eye[2])};}).sort((a,b)=>a.score-b.score).slice(0,MAX_LIGHTS);
  uni.count=scored.length;
  scored.forEach(({l,b},i)=>{
   const t=TYPES[l.type],dir=l.type==='pendant'?[0,-1,0]:norm(sub(l.target,l.pos)),half=l.angle/2*Math.PI/180;
   const temp=TEMPS[l.temp]||TEMPS[3000],power=t.intensity*l.level;
   // pos.w = 도달 거리 + 방 번호×100 (셰이더에서 방 번호로 벽 너머 다른 방에 빛이 새지 않게 거른다). 진열장 LED는 방 검사 없이 진열장 범위만 쓴다.
   const room=l.caseBounds?null:(roomAt(l.pos[0],l.pos[2])||roomAt(l.target[0],l.target[2]));
   uni.pos.set([l.pos[0],l.pos[1],l.pos[2],t.range+(room?room.index*100:0)],i*4);
   uni.dir.set([dir[0],dir[1],dir[2],l.type==='pendant'?-2:Math.cos(half)],i*4);
   uni.color.set([temp[0]*power,temp[1]*power,temp[2]*power,l.type==='pendant'?-2:Math.cos(half*.62)],i*4);
   uni.bounds.set(b,i*4);
  });
  return uni;
 }

 /* ---------------- 시간 흐름 ---------------- */
 let lastLive=0;
 // dt: 초 단위. 하루 재생은 실제 1초에 playSpeed초(기본 1800초=30분)씩 흐른다. 하루가 48초.
 function tick(dt){
  if(state.mode==='play'){state.hour=(state.hour+dt*state.playSpeed/3600)%24;ui.syncTime();}
  else if(state.mode==='live'){const now=Date.now();if(now-lastLive>15000){lastLive=now;setNow();}}
 }
 function setNow(){const d=new Date();state.date=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;state.hour=d.getHours()+d.getMinutes()/60;ui.syncTime();}

 /* ---------------- 편집 화면 ---------------- */
 const ui={syncTime(){},syncLight(){},syncList(){}};
 const listeners=new Set();
 const changed=()=>{save();listeners.forEach(f=>f());};
 const selectedLight=()=>state.lights.find(l=>l.id===state.selected)||null;
 function el(tag,props={},...children){const e=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k in e)e[k]=v;else e.setAttribute(k,v);}e.append(...children);return e;}
 function buildUI(host){
  if(!host)return;
  // 시간과 태양
  const date=el('input',{type:'date',value:state.date,'aria-label':'날짜'});
  const hour=el('input',{type:'range',min:'0',max:'24',step:'0.25',value:String(state.hour),'aria-label':'시각'});
  const hourOut=el('output',{class:'light-value'});
  const sunInfo=el('p',{class:'light-note'});
  const modeButtons=[['manual','직접'],['live','현재 시각'],['play','하루 재생']].map(([mode,label])=>el('button',{type:'button',textContent:label,onclick:()=>{state.mode=mode;if(mode==='live')setNow();ui.syncTime();}}));
  date.addEventListener('input',()=>{if(date.value){state.date=date.value;state.mode='manual';ui.syncTime();}});
  hour.addEventListener('input',()=>{state.hour=Number(hour.value)%24;state.mode='manual';ui.syncTime();});
  ui.syncTime=()=>{
   if(date.value!==state.date)date.value=state.date;hour.value=String(state.hour);hourOut.textContent=hhmm(state.hour);
   const env=environment(),times=sunTimes(state.date);
   sunInfo.textContent=`태양 고도 ${env.elevation.toFixed(1)}° · 방위 ${env.azimuth.toFixed(0)}° · 일출 ${hhmm(times.rise)} · 일몰 ${hhmm(times.set)} (${SITE.name})`;
   modeButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(['manual','live','play'][i]===state.mode)));
  };
  const north=el('input',{type:'number',min:'-180',max:'180',step:'5',value:String(state.northOffset),'aria-label':'건물 북쪽 보정 각도'});
  north.addEventListener('change',()=>{state.northOffset=clamp(Number(north.value)||0,-180,180);north.value=String(state.northOffset);changed();ui.syncTime();});
  // 실내 전체
  const master=el('input',{type:'checkbox',checked:state.master});
  master.addEventListener('change',()=>{state.master=master.checked;changed();});
  const indoor=el('input',{type:'range',min:'0.1',max:'1',step:'0.02',value:String(state.indoor),'aria-label':'실내 기본 밝기'});
  indoor.addEventListener('input',()=>{state.indoor=Number(indoor.value);changed();});
  const exposure=el('input',{type:'range',min:'0.4',max:'2.5',step:'0.05',value:String(state.exposure),'aria-label':'노출'});
  const exposureOut=el('output',{class:'light-value',textContent:state.exposure.toFixed(2)});
  exposure.addEventListener('input',()=>{state.exposure=Number(exposure.value);exposureOut.textContent=state.exposure.toFixed(2);changed();});
  const markers=el('input',{type:'checkbox',checked:state.showMarkers});
  markers.addEventListener('change',()=>{state.showMarkers=markers.checked;changed();});
  const reset=el('button',{type:'button',class:'asset-reset-button',textContent:'기본 조명으로 되돌리기',onclick:()=>{state.lights=defaults();state.selected=null;changed();ui.syncList();ui.syncLight();}});
  // 조명 목록과 편집
  const list=el('select',{class:'light-list','aria-label':'편집할 조명'});
  list.addEventListener('change',()=>select(list.value||null));
  const add=el('button',{type:'button',class:'asset-reset-button',textContent:'이 방에 조명 추가',onclick:()=>addLight()});
  const editor=el('div',{class:'light-editor'});
  ui.syncList=()=>{
   list.replaceChildren(el('option',{value:'',textContent:`조명 선택 (${state.lights.length}개)`}));
   for(const r of rooms){
    const items=state.lights.filter(l=>(roomAt(l.pos[0],l.pos[2])||roomAt(l.target[0],l.target[2]))?.id===r.id);
    if(!items.length)continue;
    const group=el('optgroup',{label:`${r.name} (${items.length})`});
    for(const l of items)group.append(el('option',{value:l.id,textContent:(l.on?'':'[꺼짐] ')+l.name}));
    list.append(group);
   }
   list.value=state.selected||'';
  };
  ui.syncLight=()=>{
   const l=selectedLight();editor.replaceChildren();
   if(!l){editor.append(el('p',{class:'light-note',textContent:'평면도의 노란 점을 누르거나 목록에서 조명을 고르세요.'}));return;}
   const update=fn=>{fn();changed();ui.syncList();};
   const type=el('select',{'aria-label':'조명 종류'});
   for(const [key,t] of Object.entries(TYPES))type.append(el('option',{value:key,textContent:t.label}));
   type.value=l.type;
   type.addEventListener('change',()=>update(()=>{l.type=type.value;l.angle=TYPES[l.type].angle;if(l.type!=='case')l.caseBounds=null;if(l.type==='down')l.target=[l.pos[0],0,l.pos[2]];ui.syncLight();}));
   const temp=el('select',{'aria-label':'색온도'});
   for(const k of Object.keys(TEMPS))temp.append(el('option',{value:k,textContent:`${k}K ${Number(k)<=3000?'(따뜻한 빛)':Number(k)>=5000?'(차가운 빛)':''}`}));
   temp.value=String(l.temp);temp.addEventListener('change',()=>update(()=>l.temp=Number(temp.value)));
   const level=el('input',{type:'range',min:'0',max:'2.5',step:'0.05',value:String(l.level),'aria-label':'밝기'});
   const levelOut=el('output',{class:'light-value',textContent:`${Math.round(l.level*100)}%`});
   level.addEventListener('input',()=>{l.level=Number(level.value);levelOut.textContent=`${Math.round(l.level*100)}%`;changed();});
   const angle=el('input',{type:'range',min:'10',max:'160',step:'2',value:String(l.angle),disabled:l.type==='pendant','aria-label':'빔 각도'});
   const angleOut=el('output',{class:'light-value',textContent:`${Math.round(l.angle)}°`});
   angle.addEventListener('input',()=>{l.angle=Number(angle.value);angleOut.textContent=`${Math.round(l.angle)}°`;changed();});
   const on=el('input',{type:'checkbox',checked:l.on});on.addEventListener('change',()=>update(()=>l.on=on.checked));
   const move=(dx,dy,dz)=>update(()=>{
    l.pos[0]+=dx;l.pos[1]=clamp(l.pos[1]+dy,.3,CEILING+.02);l.pos[2]+=dz;
    if(l.type==='down'||l.type==='pendant')l.target=[l.pos[0],0,l.pos[2]];
    if(l.caseBounds){const b=l.caseBounds;l.pos[0]=clamp(l.pos[0],b[0],b[2]);l.pos[2]=clamp(l.pos[2],b[1],b[3]);}
    posOut.textContent=posText();
   });
   const posText=()=>`x ${l.pos[0].toFixed(2)} · 높이 ${l.pos[1].toFixed(2)} · z ${l.pos[2].toFixed(2)} m`;
   const posOut=el('span',{class:'light-note',textContent:posText()});
   const pad=el('div',{class:'light-pad'},
    el('button',{type:'button',textContent:'↑',title:'북쪽(평면도 위)으로 10cm',onclick:()=>move(0,0,-.1)}),
    el('button',{type:'button',textContent:'←',title:'서쪽으로 10cm',onclick:()=>move(-.1,0,0)}),
    el('button',{type:'button',textContent:'↓',title:'남쪽으로 10cm',onclick:()=>move(0,0,.1)}),
    el('button',{type:'button',textContent:'→',title:'동쪽으로 10cm',onclick:()=>move(.1,0,0)}),
    el('button',{type:'button',textContent:'높이 ▲',onclick:()=>move(0,.1,0)}),
    el('button',{type:'button',textContent:'높이 ▼',onclick:()=>move(0,-.1,0)}));
   const aim=el('select',{'aria-label':'겨냥 대상',disabled:l.type==='down'||l.type==='pendant'});
   aim.append(el('option',{value:'',textContent:'겨냥 대상 고르기…'}),el('option',{value:'__below',textContent:'바로 아래'}));
   const here=roomAt(l.pos[0],l.pos[2]);
   const sorted=[...targets].sort((a,b)=>Math.hypot(a.point[0]-l.pos[0],a.point[2]-l.pos[2])-Math.hypot(b.point[0]-l.pos[0],b.point[2]-l.pos[2]));
   for(const t of sorted.slice(0,40))aim.append(el('option',{value:t.id,textContent:(roomAt(t.point[0],t.point[2])===here?'':'↗ ')+t.label}));
   aim.value=l.targetId||'';
   aim.addEventListener('change',()=>update(()=>{
    if(aim.value==='__below'){l.target=[l.pos[0],0,l.pos[2]];l.targetId=null;}
    else{const t=targets.find(t=>t.id===aim.value);if(t){l.target=[...t.point];l.targetId=t.id;}}
   }));
   const name=el('input',{type:'text',value:l.name,'aria-label':'조명 이름'});
   name.addEventListener('change',()=>update(()=>l.name=name.value.trim()||TYPES[l.type].label));
   const remove=el('button',{type:'button',class:'asset-reset-button',textContent:'조명 삭제',onclick:()=>{state.lights=state.lights.filter(x=>x!==l);state.selected=null;changed();ui.syncList();ui.syncLight();}});
   const row=(label,...c)=>el('label',{class:'light-row'},el('span',{textContent:label}),...c);
   editor.append(row('이름',name),row('켜기',on),row('종류',type),row('색온도',temp),row('밝기',level,levelOut),row('빔 각도',angle,angleOut),row('겨냥',aim),
    el('div',{class:'light-row'},el('span',{textContent:'위치'}),pad),posOut,remove);
  };
  host.append(
   el('h3',{textContent:'시간과 햇빛'}),
   el('label',{class:'light-row'},el('span',{textContent:'날짜'}),date),
   el('label',{class:'light-row'},el('span',{textContent:'시각'}),hour,hourOut),
   el('div',{class:'light-modes'},...modeButtons),sunInfo,
   el('label',{class:'light-row'},el('span',{textContent:'북쪽 보정'}),north,el('span',{class:'light-value',textContent:'°'})),
   el('p',{class:'light-note',textContent:'평면도 위쪽을 북쪽으로 계산합니다. 실제 건물 방향이 다르면 각도를 넣으세요. 실내는 천장이 있다고 보고 햇빛이 닿지 않습니다.'}),
   el('h3',{textContent:'실내 조명'}),
   el('label',{class:'light-row'},el('span',{textContent:'조명 켜기'}),master),
   el('label',{class:'light-row'},el('span',{textContent:'기본 밝기'}),indoor),
   el('label',{class:'light-row'},el('span',{textContent:'노출'}),exposure,exposureOut),
   el('label',{class:'light-row'},el('span',{textContent:'평면도 표시'}),markers),
   el('div',{class:'light-list-row'},list,add),editor,reset);
  ui.syncTime();ui.syncList();ui.syncLight();
 }
 function select(id){state.selected=id;ui.syncList();ui.syncLight();listeners.forEach(f=>f());}
 let cameraEye=[0,0,0];
 function addLight(){
  const base=selectedLight(),r=roomAt(cameraEye[0],cameraEye[2])||(base&&roomAt(base.pos[0],base.pos[2]))||rooms[0];
  const l=make('spot',[r.center[0],CEILING,r.center[1]],[r.center[0],0,r.center[1]],{name:`트랙 스포트라이트 · ${r.name}`});
  state.lights.push(l);changed();select(l.id);
 }

 /* ---------------- 평면도 조명 점 ---------------- */
 const markerHost=document.getElementById('light-markers'),markerEls=new Map();
 function updateMarkers(vp,rect,visible){
  if(!markerHost)return;
  const show=visible&&state.showMarkers;
  markerHost.hidden=!show;if(!show)return;
  const alive=new Set();
  for(const l of state.lights){
   alive.add(l.id);
   let m=markerEls.get(l.id);
   if(!m){m=el('button',{type:'button',class:'light-marker',onclick:()=>select(l.id)});markerHost.append(m);markerEls.set(l.id,m);}
   m.title=l.name;m.setAttribute('aria-label',l.name+' 조명 편집');
   m.dataset.type=l.type;m.classList.toggle('light-off',!l.on||!state.master);m.classList.toggle('light-selected',l.id===state.selected);
   const p=[l.pos[0],l.pos[1],l.pos[2]],clip=[0,1,2,3].map(i=>vp[i]*p[0]+vp[4+i]*p[1]+vp[8+i]*p[2]+vp[12+i]);
   const x=clip[0]/clip[3],y=clip[1]/clip[3];
   m.hidden=clip[3]<=0||Math.abs(x)>1||Math.abs(y)>1;
   m.style.left=(x*.5+.5)*rect.width+'px';m.style.top=(-y*.5+.5)*rect.height+'px';
  }
  for(const [id,m] of markerEls)if(!alive.has(id)){m.remove();markerEls.delete(id);}
 }

 buildUI(document.getElementById('lighting-panel'));
 return {
  TYPES,get MAX_LIGHTS(){return MAX_LIGHTS;},setMaxLights,state,paintOrder,rooms,targets,environment,pack,tick,updateMarkers,isIndoor,envelope,select,
  fixtures:()=>state.lights.map(l=>({light:l,fixture:TYPES[l.type].fixture,dir:l.type==='pendant'||l.type==='down'?[0,-1,0]:norm(sub(l.target,l.pos)),lit:l.on&&state.master,selected:l.id===state.selected,color:TEMPS[l.temp]||TEMPS[3000]})),
  setCamera:eye=>{cameraEye=eye;},
  onChange:f=>listeners.add(f),
  solar,sunTimes,defaults
 };
})();
