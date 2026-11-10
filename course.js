/* 입구와 전시 슬롯을 기존 이동점에 연결해 관람 코스를 재생한다. */
window.MuseumCourse=function(points, viewer){
  const form=document.querySelector('#course-form');
  const select=document.querySelector('#course-stop');
  const seconds=document.querySelector('#course-seconds');
  const list=document.querySelector('#course-list');
  const playButton=document.querySelector('#course-play');
  const stopButton=document.querySelector('#course-stop-playback');
  const status=document.querySelector('#course-status');
  const entrance=points.find(point=>point.id==='entrance');
  const inside=points.find(point=>point.id==='entrance-inside');
  const yawTo=(from,x,z)=>Math.atan2(from[0]-x,from[2]-z);
  const nodes=new Map([[entrance.id,{
    name:entrance.name,eye:entrance.eye,yaw:yawTo(entrance.eye,inside.eye[0],inside.eye[2])
  }]]);

  for(const {room,items} of MuseumAssetCatalog){
    for(const [id,label,,at,placement] of items){
      const [x,z]=MuseumGeometry.point(at);
      const distance=point=>Math.hypot(point.eye[0]-x,point.eye[2]-z);
      const closest=points.reduce((a,b)=>distance(a)<=distance(b)?a:b);
      const frames=[
        ...MuseumLayout.wallArtFrames,
        ...(MuseumLayout.niches||[]),
        ...(MuseumLayout.reliefDisplays||[]),
        ...(MuseumLayout.curvedArtFrames||[])
      ];
      const frame=frames.find(item=>item.id===placement?.wall);
      const target=frame?.a&&frame?.b
        ? MuseumGeometry.point(frame.a.map((value,i)=>(value+frame.b[i])/2))
        : [x,z];
      nodes.set(id,{
        name:room+' '+label,eye:closest.eye,
        yaw:Math.hypot(closest.eye[0]-target[0],closest.eye[2]-target[1])>.01
          ? yawTo(closest.eye,...target) : undefined
      });
    }
  }
  for(const [id,node] of nodes){
    const option=document.createElement('option');
    option.value=id;
    option.textContent=node.name;
    select.append(option);
  }

  const stops=[];
  let playback=null;
  function render(){
    list.replaceChildren();
    for(const [index,stop] of stops.entries()){
      const item=document.createElement('li');
      item.textContent=stop.node.name+' · '+stop.seconds+'초';
      const remove=document.createElement('button');
      remove.type='button';
      remove.textContent='삭제';
      remove.setAttribute('aria-label',stop.node.name+' 코스 지점 삭제');
      remove.disabled=Boolean(playback);
      remove.addEventListener('click',()=>{stops.splice(index,1);render();});
      item.append(remove);
      list.append(item);
    }
    for(const field of form.elements)field.disabled=Boolean(playback);
    playButton.disabled=Boolean(playback)||stops.length===0;
    stopButton.disabled=!playback;
  }

  form.addEventListener('submit',event=>{
    event.preventDefault();
    const node=nodes.get(select.value);
    if(playback||!node||!seconds.reportValidity())return;
    stops.push({node,seconds:seconds.valueAsNumber});
    status.textContent='';
    render();
  });

  function stop(message='코스 재생을 중지했습니다.'){
    if(!playback)return;
    playback=null;
    viewer.release();
    status.textContent=message;
    render();
  }

  playButton.addEventListener('click',()=>{
    if(playback||!stops.length)return;
    const paths=[];
    for(let i=1;i<stops.length;i++){
      const from=stops[i-1].node,to=stops[i].node;
      const path=viewer.find(from.eye,to.eye);
      if(!path){
        status.textContent=from.name+'에서 '+to.name+'까지 이동 경로를 찾지 못했습니다.';
        return;
      }
      paths.push(path);
    }
    playback={index:0,until:null,paths};
    const first=stops[0].node;
    viewer.enter(first.eye,first.yaw??entrance.yaw);
    viewer.hold();
    status.textContent=first.name+' 관람 중';
    render();
  });
  stopButton.addEventListener('click',()=>stop());

  function update(now){
    if(!playback||viewer.isMoving())return;
    const current=stops[playback.index];
    if(playback.until===null){
      viewer.hold();
      playback.until=now+current.seconds;
      status.textContent=current.node.name+' 관람 중';
    }
    if(now<playback.until)return;
    const next=stops[playback.index+1];
    if(!next){stop('코스 재생을 마쳤습니다.');return;}
    const path=playback.paths[playback.index++];
    playback.until=null;
    viewer.travel(next.node.eye,path,next.node.yaw);
    status.textContent=next.node.name+'으로 이동 중';
  }

  return {update,stop};
};

