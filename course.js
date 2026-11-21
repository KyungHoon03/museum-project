/* 평면도에서 직접 그린 경로를 벽 충돌을 피하는 연속 1인칭 코스로 재생한다. */
window.MuseumCourse=function(viewer){
 'use strict';
 const canvas=document.querySelector('#cv'),viewport=canvas.parentElement;
 const start=document.querySelector('#course-add-start'),controls=document.querySelector('#course-drawing-controls');
 const finish=document.querySelector('#course-finish'),add=document.querySelector('#course-add'),exitButton=document.querySelector('#course-exit');
 const list=document.querySelector('#course-list'),playSelect=document.querySelector('#course-play-select'),play=document.querySelector('#course-play'),stopButton=document.querySelector('#course-stop-playback'),status=document.querySelector('#course-status');
 const ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');svg.classList.add('course-drawing-overlay');viewport.append(svg);
 const loading=document.createElement('div');loading.className='course-loading';loading.hidden=true;loading.setAttribute('role','status');loading.setAttribute('aria-live','polite');
 const loadingCard=document.createElement('div');loadingCard.className='course-loading-card';
 const spinner=document.createElement('span');spinner.className='course-loading-spinner';spinner.setAttribute('aria-hidden','true');
 const loadingText=document.createElement('span');loadingText.textContent='경로를 확인하고 있습니다…';
 loadingCard.append(spinner,loadingText);loading.append(loadingCard);viewport.append(loading);
 const draftShadow=document.createElementNS(ns,'polyline');draftShadow.setAttribute('class','course-draft-line-shadow');
 const draft=document.createElementNS(ns,'polyline');draft.setAttribute('class','course-draft-line');
 const final=document.createElementNS(ns,'polyline');final.setAttribute('class','course-final-line');
 const added=document.createElementNS(ns,'g');
 const handleGroup=document.createElementNS(ns,'g');handleGroup.setAttribute('class','course-route-handles');
 svg.append(draftShadow,draft,final,added,handleGroup);
 let drawing=false,stroke=null,panDrag=null,draftWorld=[],finalized=null,courses=[],playback=null,selectedCourseId=null,nextCourseId=1;
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const tableAreas=(MuseumLayout.galleryTables||[]).map(table=>{
  const a=MuseumGeometry.point(table.a),b=MuseumGeometry.point(table.b),dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  return {center:[(a[0]+b[0])/2,(a[1]+b[1])/2],along:[dx/length,dz/length],across:[-dz/length,dx/length],halfLength:length/2+.18,halfDepth:table.depth/2+.20};
 });
 function allowedFloor(point){
  if(!viewer.isWalkable(point))return false;
  return !tableAreas.some(area=>{
   const dx=point[0]-area.center[0],dz=point[2]-area.center[1];
   return Math.abs(dx*area.along[0]+dz*area.along[1])<area.halfLength&&
    Math.abs(dx*area.across[0]+dz*area.across[1])<area.halfDepth;
  });
 }
 function allowedSegment(from,to){
  if(!viewer.isSafe([from,to]))return false;
  const steps=Math.max(1,Math.ceil(Math.hypot(to[0]-from[0],to[2]-from[2])/.08));
  for(let i=1;i<steps;i++){
   const t=i/steps,point=from.map((value,index)=>value+(to[index]-value)*t);
   if(!allowedFloor(point))return false;
  }
  return true;
 }

 function currentControls(){return window.MuseumViewer?.controls;}
 function worldToScreen(world){
  const c=currentControls(),rect=canvas.getBoundingClientRect(),state=c.state,target=state.target,half=state.halfHeight;
  const aspect=rect.width/Math.max(1,rect.height);
  return [rect.width*(.5+(world[0]-target[0])/(2*half*aspect)),rect.height*(.5+(world[1]-target[2])/(2*half))];
 }
 function screenToWorld(clientX,clientY){
  const c=currentControls(),rect=canvas.getBoundingClientRect(),state=c.state,target=state.target,half=state.halfHeight;
  const aspect=rect.width/Math.max(1,rect.height);
  return [target[0]+((clientX-rect.left)/rect.width-.5)*2*half*aspect,target[2]+((clientY-rect.top)/rect.height-.5)*2*half];
 }
 function setLine(element,route){
  element.setAttribute('points',route.map(worldToScreen).map(point=>point.join(',')).join(' '));
 }
 function redrawDraft(){
  setLine(draft,draftWorld);setLine(draftShadow,draftWorld);redrawHandles();
 }
 function redrawFinal(){if(finalized)setLine(final,finalized.route.map(point=>[point[0],point[2]]));}
 function redrawHandles(){
  handleGroup.replaceChildren();
  if(!drawing||draftWorld.length===0)return;
  for(const [index,point] of [draftWorld[0],draftWorld[draftWorld.length-1]].entries()){
   const [x,y]=worldToScreen(point),circle=document.createElementNS(ns,'circle');
   circle.setAttribute('class','course-route-handle');circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r','8');
   circle.setAttribute('aria-label',index===0?'코스 시작 연결점':'코스 끝 연결점');handleGroup.append(circle);
  }
 }
 function clearDraft(){
  draftWorld=[];finalized=null;
  for(const element of [draft,draftShadow,final])element.removeAttribute('points');
  add.disabled=true;redrawHandles();
 }
 function updateDrawing(){
  svg.style.width=`${canvas.clientWidth}px`;svg.style.height=`${canvas.clientHeight}px`;
  if(drawing)redrawDraft();
  redrawFinal();renderAdded();
 }
 function enter(){
  if(playback)return;
  document.querySelector('[data-navigation="plan"]')?.click();
  drawing=true;clearDraft();controls.hidden=false;start.hidden=true;svg.classList.add('active');canvas.style.cursor='crosshair';
  document.dispatchEvent(new CustomEvent('museumcoursedrawingchange',{detail:{active:true}}));
  status.textContent='바닥이 드러난 곳만 그릴 수 있습니다. 테이블 영역은 제외됩니다.';
 }
 function exit(){
  if(finalized&&!window.confirm('추가되지 않은 코스가 존재합니다. 그래도 설정을 완료하고 뷰 모드로 돌아가시겠습니까?'))return;
  drawing=false;stroke=null;panDrag=null;clearDraft();controls.hidden=true;start.hidden=false;svg.classList.remove('active');canvas.style.cursor='';
  document.dispatchEvent(new CustomEvent('museumcoursedrawingchange',{detail:{active:false}}));
  document.querySelector('[data-navigation="orbit"]')?.click();
 }
 start.addEventListener('click',enter);exitButton.addEventListener('click',exit);

 function beginStroke(event){
  if(!drawing||!currentControls()?.state.orthographic)return;
  const world=screenToWorld(event.clientX,event.clientY);
  if(draftWorld.length===0&&!allowedFloor([world[0],viewer.eyeHeight,world[1]])){
   status.textContent='벽이나 구조물 위에서는 코스를 시작할 수 없습니다.';
   return;
  }
  if(draftWorld.length===0){
   stroke={side:'end',points:[world],id:event.pointerId};
  }else{
   const rect=canvas.getBoundingClientRect(),cursor=[event.clientX-rect.left,event.clientY-rect.top];
   const ends=[{side:'start',point:draftWorld[0]},{side:'end',point:draftWorld[draftWorld.length-1]}];
   ends.forEach(end=>{const p=worldToScreen(end.point);end.distance=Math.hypot(cursor[0]-p[0],cursor[1]-p[1]);});
   ends.sort((a,b)=>a.distance-b.distance);
   if(ends[0].distance>18){status.textContent='선을 이어 그리려면 시작 또는 끝 노드를 잡아 주세요.';return;}
   stroke={side:ends[0].side,points:[ends[0].point],id:event.pointerId};
   finalized=null;final.removeAttribute('points');add.disabled=true;
  }
  event.preventDefault();svg.setPointerCapture?.(event.pointerId);
  if(draftWorld.length===0)redrawDraft();
 }
 svg.addEventListener('pointerdown',event=>{
  if(!drawing)return;
  if(event.button===1){
   event.preventDefault();panDrag={id:event.pointerId,x:event.clientX,y:event.clientY};
   svg.setPointerCapture?.(event.pointerId);svg.classList.add('panning');return;
  }
  if(event.button!==0)return;
  event.preventDefault();event.stopPropagation();beginStroke(event);
 });
 svg.addEventListener('click',event=>{if(drawing){event.preventDefault();event.stopPropagation();}});
 svg.addEventListener('pointermove',event=>{
  if(panDrag&&event.pointerId===panDrag.id){
   const dx=event.clientX-panDrag.x,dy=event.clientY-panDrag.y;panDrag.x=event.clientX;panDrag.y=event.clientY;
   currentControls().input.pan(dx,dy);event.preventDefault();return;
  }
  if(!stroke||!currentControls()?.state.orthographic)return;
  const world=screenToWorld(event.clientX,event.clientY),last=stroke.points[stroke.points.length-1];
  const minimum=Math.max(.008,2*currentControls().state.halfHeight/Math.max(1,canvas.clientHeight));
  if(distance(world,last)<minimum)return;
  const from=[last[0],viewer.eyeHeight,last[1]],to=[world[0],viewer.eyeHeight,world[1]];
  if(!allowedFloor(to)||!allowedSegment(from,to)){
   status.textContent='벽과 구조물 위로는 그릴 수 없습니다. 통행 가능한 공간을 따라 그려 주세요.';
   return;
  }
  stroke.points.push(world);redrawDraft();
  status.textContent='경로를 이어 그릴 수 있습니다.';
 });
 function finishPointer(event){
  if(panDrag&&event.pointerId===panDrag.id){
   panDrag=null;svg.classList.remove('panning');
   if(svg.hasPointerCapture?.(event.pointerId))svg.releasePointerCapture(event.pointerId);
   return;
  }
  if(!stroke||event.pointerId!==stroke.id)return;
  if(draftWorld.length===0)draftWorld=stroke.points.slice();
  else if(stroke.side==='end')draftWorld.push(...stroke.points.slice(1));
  else draftWorld.unshift(...stroke.points.slice(1).reverse());
  stroke=null;redrawDraft();
  if(svg.hasPointerCapture?.(event.pointerId))svg.releasePointerCapture(event.pointerId);
  status.textContent=draftWorld.length>1?'경로를 더 이어 그리거나 코스 설정을 완료하세요.':'평면도 위에 코스를 그려 주세요.';
 }
 svg.addEventListener('pointerup',finishPointer);
 svg.addEventListener('pointercancel',event=>{
  if(panDrag&&event.pointerId===panDrag.id){panDrag=null;svg.classList.remove('panning');}
  if(stroke){stroke=null;redrawDraft();}
 });

 function sampleStroke(source,spacing=.12){
  const samples=source.length?[source[0]]:[];
  for(let i=1;i<source.length;i++){
   const a=source[i-1],b=source[i],length=distance(a,b),steps=Math.max(1,Math.ceil(length/spacing));
   for(let j=1;j<=steps;j++){const t=j/steps;samples.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  return samples;
 }
 function buildSafeRoute(){
  const samples=sampleStroke(draftWorld);
  if(samples.length<2)return null;
  const route=[];
  for(const sample of samples){
   const point=[sample[0],viewer.eyeHeight,sample[1]];
   if(!allowedFloor(point))return null;
   if(route.length&&!allowedSegment(route[route.length-1],point))return null;
   route.push(point);
  }
  return route.length>=2?route:null;
 }
 async function withLoading(work){
  if(!loading.hidden)return;
  loading.hidden=false;finish.disabled=true;add.disabled=true;exitButton.disabled=true;start.disabled=true;
  playSelect.disabled=true;play.disabled=true;stopButton.disabled=true;
  await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,40)));
  try{work();}
  finally{
   loading.hidden=true;finish.disabled=false;exitButton.disabled=false;start.disabled=Boolean(playback);
   playSelect.disabled=Boolean(playback)||courses.length===0;play.disabled=Boolean(playback)||selectedCourseId===null;
   stopButton.disabled=!playback;
  }
 }
 finish.addEventListener('click',()=>withLoading(()=>{
  if(draftWorld.length<2){status.textContent='그려진 코스가 없습니다.';return;}
  finalized=null;final.removeAttribute('points');
  const route=buildSafeRoute();
  if(!route){status.textContent='벽이나 구조물과 겹치는 구간이 있습니다. 통행 가능한 공간만 따라 다시 그려 주세요.';return;}
  finalized={route};setLine(final,route.map(point=>[point[0],point[2]]));add.disabled=false;
  status.textContent='그린 경로를 유지해 코스 설정이 완료되었습니다.';
 }));

 function render(){
  list.replaceChildren();
  courses.forEach((course,index)=>{
   const item=document.createElement('li');item.textContent=course.name;
   const remove=document.createElement('button');remove.type='button';remove.textContent='삭제';remove.disabled=Boolean(playback);
   remove.addEventListener('click',()=>{courses.splice(index,1);courses.forEach((value,i)=>value.name=`관람 코스 ${i+1}`);render();});
   item.append(remove);list.append(item);
  });
  if(!courses.some(course=>course.id===selectedCourseId))selectedCourseId=courses[0]?.id??null;
  playSelect.replaceChildren();
  for(const course of courses){const option=document.createElement('option');option.value=course.id;option.textContent=course.name;playSelect.append(option);}
  playSelect.disabled=Boolean(playback)||courses.length===0;
  if(selectedCourseId!==null)playSelect.value=selectedCourseId;
  play.disabled=Boolean(playback)||selectedCourseId===null;stopButton.disabled=!playback;start.disabled=Boolean(playback);
 }
 playSelect.addEventListener('change',()=>{selectedCourseId=playSelect.value;});
 add.addEventListener('click',()=>{
  if(!finalized)return;
  const course={id:String(nextCourseId++),name:`관람 코스 ${courses.length+1}`,route:finalized.route.slice()};
  courses.push(course);selectedCourseId=course.id;render();clearDraft();status.textContent=`${course.name}이(가) 추가되었습니다.`;
 });
 function renderAdded(){
  added.replaceChildren();
  if(!drawing||!currentControls()?.state.orthographic)return;
  for(const course of courses){
   const line=document.createElementNS(ns,'polyline');line.setAttribute('class','course-added-line');
   setLine(line,course.route.map(point=>[point[0],point[2]]));added.append(line);
  }
 }
 function stop(message='코스 재생을 중지했습니다.'){
  if(!playback)return;
  playback=null;viewer.release();status.textContent=message;render();
 }
 stopButton.addEventListener('click',()=>stop());
 play.addEventListener('click',()=>{
  if(playback)return;
  const course=courses.find(item=>item.id===selectedCourseId);
  if(!course||course.route.length<2)return;
  const first=course.route[0],last=course.route[course.route.length-1],next=course.route[1],before=course.route[course.route.length-2];
  const startYaw=Math.atan2(first[0]-next[0],first[2]-next[2]),endYaw=Math.atan2(before[0]-last[0],before[2]-last[2]);
  playback={course};viewer.enter(first,startYaw);viewer.travel(last,course.route,endYaw);status.textContent=`${course.name} 재생 중`;render();
 });
 function update(){
  if(!playback||viewer.isMoving())return;
  stop('코스 재생을 마쳤습니다.');
 }
 window.addEventListener('resize',updateDrawing);
 function frame(){updateDrawing();requestAnimationFrame(frame);}render();requestAnimationFrame(frame);
 return {update,stop};
};
