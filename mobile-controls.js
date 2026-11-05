/* 모바일 입력 전용. 카메라·충돌은 controls.input 공통 인터페이스를 사용한다. */
window.MuseumMobileControls=function(canvas,controls,options={}){
 const media=matchMedia('(any-pointer: coarse)'),touches=new Map();
 // 태블릿의 데스크톱 모드·마우스 연결 여부와 무관하게 터치 지원을 확인한다.
 const touchDevice=()=>media.matches||(navigator.maxTouchPoints||0)>0;
 const primaryTouch=matchMedia('(pointer: coarse)'),noHover=matchMedia('(hover: none)');
 let lastPointer=null;
 // 터치 지원은 패널 버튼용, 실제 입력 방식은 조이스틱용으로 따로 판단한다.
 const touchNavigation=()=>lastPointer==='touch'||(lastPointer===null&&primaryTouch.matches&&noHover.matches);
 let pair=null,revision=controls.state.revision;
 const panel=document.querySelector('aside'),panelToggle=document.createElement('button');
 panel.id='options-panel';panelToggle.type='button';panelToggle.className='mobile-panel-toggle';
 panelToggle.setAttribute('aria-controls',panel.id);document.body.append(panelToggle);
 let panelClosed=false;
 function syncPanel(){
  const hidden=touchDevice()&&panelClosed;
  document.body.classList.toggle('panel-hidden',hidden);
  panel.inert=hidden;panel.setAttribute('aria-hidden',String(hidden));
  panelToggle.setAttribute('aria-expanded',String(!hidden));
  panelToggle.setAttribute('aria-label',hidden?'패널 열기':'패널 숨기기');
  panelToggle.title=hidden?'패널 열기':'패널 숨기기';panelToggle.textContent=hidden?'‹':'›';
 }
 panelToggle.addEventListener('click',()=>{reset();controls.clear();panelClosed=!panelClosed;syncPanel();});
 const release=(target,id)=>{try{if(target.hasPointerCapture(id))target.releasePointerCapture(id);}catch{}};
 function reset(){for(const id of touches.keys())release(canvas,id);touches.clear();pair=null;}
 function sync(){document.body.classList.toggle('touch-navigation',touchNavigation());}
 function configure(){reset();document.body.classList.toggle('mobile-input',touchDevice());sync();syncPanel();}
 function usePointer(e){
  if(!['mouse','touch','pen'].includes(e.pointerType))return;
  const input=e.pointerType==='touch'?'touch':'mouse';
  if(lastPointer===input)return;reset();lastPointer=input;sync();
 }
 document.addEventListener('pointerdown',usePointer,true);
 document.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&(e.movementX||e.movementY))usePointer(e);},true);
 primaryTouch.addEventListener('change',configure);noHover.addEventListener('change',configure);
 const snapshot=()=>{const p=[...touches.values()];return p.length===2?{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)}:null;};
 canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch'||touches.size>=2)return;
  e.preventDefault();if(revision!==controls.state.revision){reset();revision=controls.state.revision;}
  touches.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);pair=snapshot();
  
 });
 canvas.addEventListener('pointermove',e=>{
  if(!touches.has(e.pointerId))return;e.preventDefault();
  if(revision!==controls.state.revision){reset();return;}
  const old=touches.get(e.pointerId),dx=e.clientX-old.x,dy=e.clientY-old.y;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const unit=Math.PI/Math.max(1,canvas.clientHeight);
  if(controls.state.mode==='interior'){
   if(touches.size===1)controls.input.rotate(-dx*unit*.5,dy*unit*.5);
   else{const current=snapshot();if(pair&&current.d>8&&pair.d>8)controls.input.zoom(Math.log(pair.d/current.d));pair=current;}
   return;
  }
  if(touches.size===1){controls.input.rotate(-dx*unit,dy*unit);return;}
  const current=snapshot();if(pair){controls.input.pan(current.x-pair.x,current.y-pair.y);if(current.d>8&&pair.d>8)controls.input.zoom(Math.log(pair.d/current.d));}pair=current;
 });
 const end=e=>{if(!touches.has(e.pointerId))return;touches.delete(e.pointerId);release(canvas,e.pointerId);pair=snapshot();};
 canvas.addEventListener('pointerup',end);canvas.addEventListener('lostpointercapture',end);canvas.addEventListener('pointercancel',reset);
 window.addEventListener('blur',reset);window.addEventListener('resize',reset);window.addEventListener('orientationchange',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});media.addEventListener('change',configure);configure();
 function update(dt){if(revision!==controls.state.revision){reset();revision=controls.state.revision;sync();}}
 return {update,reset};
};
