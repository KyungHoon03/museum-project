/* 전시 목록의 각 항목에 업로드한 파일을 연결하고 미리보기를 관리한다. */
(function(){
 'use strict';
 const host=document.getElementById('asset-groups');
 const locationHost=document.getElementById('asset-locations');
 const files=new Map();
 window.MuseumAssetFiles=files;
 const locationMarkers=new Map();
 const sampleAssets=[];
 const sampleModels=[];

 MuseumAssetCatalog.forEach((group,groupIndex)=>{
  const section=document.createElement('details');
  section.className='asset-room';
  section.open=groupIndex===0||group.room==='중앙 로비';
  const summary=document.createElement('summary');
  summary.textContent=group.room;
  section.append(summary);

  group.items.forEach(([id,title,type,at])=>{
   const row=document.createElement('article');
   row.className='asset-entry';
   row.dataset.assetId=id;
   const heading=document.createElement('div');
   heading.className='asset-entry-heading';
   const name=document.createElement('span');
   name.textContent=title;
   const badge=document.createElement('span');
   badge.className=`asset-type asset-type-${type}`;
   badge.textContent=type==='3d'?'3D':'2D';
   heading.append(name,badge);

   const input=document.createElement('input');
   input.className='asset-file-input';
   input.type='file';
   input.accept=type==='3d'?'.glb,.obj,.stl':'image/*';
   const placement=group.items.find(item=>item[0]===id)[4]||{};
   let sampleAsset=null;
   const fileLabel=placement.fileLabel||`${title} ${type==='3d'?'3D 파일 선택':'사진 파일 선택'}`;
   input.setAttribute('aria-label',fileLabel);
   const button=document.createElement('button');
   button.type='button';
   button.className='asset-upload-button';
   button.textContent=fileLabel;
   button.addEventListener('click',()=>input.click());
   const reset=document.createElement('button');
   reset.type='button';
   reset.className='asset-reset-button';
   reset.textContent='초기화';
   reset.disabled=true;
   reset.setAttribute('aria-label',`${title} 업로드 파일 초기화`);
   reset.addEventListener('click',()=>{
    const asset=files.get(id);
    if(asset&&!asset.isSample&&asset.url.startsWith('blob:'))URL.revokeObjectURL(asset.url);
    input.value='';
    document.dispatchEvent(new CustomEvent('museumassetreset',{detail:{id}}));
    if(sampleAsset){
     files.set(id,sampleAsset);
     renderAsset(sampleAsset);
     document.dispatchEvent(new CustomEvent('museumassetchange',{detail:{asset:sampleAsset}}));
    }else{
     files.delete(id);
     status.textContent='선택된 파일 없음';
     preview.replaceChildren();
     reset.disabled=true;
    }
   });
   const actions=document.createElement('div');
   actions.className='asset-entry-actions';
   actions.append(button,reset);
   const status=document.createElement('p');
   status.className='asset-upload-status';
   status.setAttribute('aria-live','polite');
   status.textContent='선택된 파일 없음';
   const preview=document.createElement('div');
   preview.className='asset-preview';
   row.append(heading,actions,input,status,preview);
   const renderAsset=asset=>{
    status.textContent=asset.isSample
     ?`${type==='3d'?'예시 3D 모델':'예시 사진'} · ${asset.url.split('/').pop()}`
     :asset.file.name;
    reset.disabled=asset.isSample===true;
    preview.replaceChildren();
    if(type==='2d'){
     const media=document.createElement('img');
     media.className='asset-preview-media';
     media.src=asset.url;
     media.alt=`${title} 미리보기`;
     preview.append(media);
    }else{
     const placeholder=document.createElement('span');
     placeholder.className='asset-model-preview';
     placeholder.setAttribute('aria-hidden','true');
     placeholder.textContent='3D';
     preview.append(placeholder);
    }
   };
   if(type==='2d'&&placement.sampleImage){
    sampleAsset={id,title,type,room:group.room,at,placement,file:null,url:placement.sampleImage,isSample:true};
    files.set(id,sampleAsset);
    sampleAssets.push(sampleAsset);
    renderAsset(sampleAsset);
   }else if(type==='3d'&&placement.sampleModel){
    sampleAsset={id,title,type,room:group.room,at,placement,file:null,url:placement.sampleModel,isSample:true};
    files.set(id,sampleAsset);
    sampleModels.push({asset:sampleAsset,render:renderAsset});
    renderAsset(sampleAsset);
    status.textContent='예시 3D 모델 불러오는 중...';
   }
   let modelControls=null;
   if(type==='3d'){
    modelControls=document.createElement('div');
    modelControls.className='asset-model-controls';
    modelControls.dataset.assetControls=id;
    const hint=document.createElement('p');
    hint.className='asset-model-hint';
    hint.textContent='장면에서 모형을 클릭해 선택하세요.';
    const scaleLabel=document.createElement('label');
    scaleLabel.className='asset-scale-label';
    scaleLabel.textContent='크기 ';
    const scaleInput=document.createElement('input');
    scaleInput.type='range';scaleInput.min='0.5';scaleInput.max='4';scaleInput.step='0.1';scaleInput.value='1';
    scaleInput.disabled=true;scaleInput.setAttribute('aria-label',`${title} 크기`);
    const scaleValue=document.createElement('output');
    scaleValue.textContent='1.0x';
    scaleLabel.append(scaleInput,scaleValue);
    const positionControls=document.createElement('div');
    positionControls.className='asset-position-controls';
    const positionHint=document.createElement('span');
    positionHint.className='asset-position-hint';
    positionHint.textContent='위치 조정 · 10cm';
    positionControls.append(positionHint);
    const positionPad=document.createElement('div');
    positionPad.className='asset-position-pad';
    positionPad.setAttribute('role','group');
    positionPad.setAttribute('aria-label',`${title} 위치 조정`);
    const moveButtons=[
     {label:'위로 이동',text:'↑',delta:[0,-.1]},
     {label:'왼쪽으로 이동',text:'←',delta:[-.1,0]},
     {label:'아래로 이동',text:'↓',delta:[0,.1]},
     {label:'오른쪽으로 이동',text:'→',delta:[.1,0]}
    ];
    moveButtons.forEach(({label,text,delta})=>{
     const moveButton=document.createElement('button');
     moveButton.type='button';
     moveButton.textContent=text;
     moveButton.setAttribute('aria-label',`${title} ${label} 10cm`);
     moveButton.title=`${label} 10cm`;
     moveButton.disabled=true;
     moveButton.addEventListener('click',()=>updateTransform({positionDelta:delta}));
     positionPad.append(moveButton);
    });
    positionControls.append(positionPad);
    const rotation=document.createElement('div');
    rotation.className='asset-rotation-controls';
    const selectModel=document.createElement('button');
    selectModel.type='button';selectModel.textContent='모형 선택';selectModel.disabled=true;
    selectModel.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('museumassetselected',{detail:{id}})));
    const rotateLeft=document.createElement('button');
    rotateLeft.type='button';rotateLeft.textContent='↶ 90°';rotateLeft.disabled=true;
    rotateLeft.setAttribute('aria-label',`${title} 왼쪽으로 90도 회전`);
    const rotateRight=document.createElement('button');
    rotateRight.type='button';rotateRight.textContent='↷ 90°';rotateRight.disabled=true;
    rotateRight.setAttribute('aria-label',`${title} 오른쪽으로 90도 회전`);
    rotation.append(selectModel,rotateLeft,rotateRight);
    modelControls.append(hint,scaleLabel,positionControls,rotation);
    row.append(modelControls);
    const updateTransform=(delta={})=>document.dispatchEvent(new CustomEvent('museumassettransform',{
     detail:{id,scale:Number(scaleInput.value),...delta}
    }));
    scaleInput.addEventListener('input',()=>{
     scaleValue.textContent=`${Number(scaleInput.value).toFixed(1)}x`;
     updateTransform();
    });
    rotateLeft.addEventListener('click',()=>updateTransform({rotationDelta:-Math.PI/2}));
    rotateRight.addEventListener('click',()=>updateTransform({rotationDelta:Math.PI/2}));
    modelControls._setSelected=selected=>{
     row.classList.toggle('asset-entry-selected',selected);
     hint.textContent=selected?'모형 선택됨 · 크기와 방향을 조절할 수 있습니다.':'장면에서 모형을 클릭해 선택하세요.';
     scaleInput.disabled=!selected;
     selectModel.disabled=!modelControls.dataset.ready||selected;
     positionPad.querySelectorAll('button').forEach(button=>button.disabled=!selected);
     rotateLeft.disabled=!selected;
     rotateRight.disabled=!selected;
    };
    modelControls._reset=()=>{
     scaleInput.value='1';
     scaleValue.textContent='1.0x';
     modelControls.dataset.ready='';
     modelControls._setSelected(false);
    };
   }
   section.append(row);

   const location=document.createElement('button');
   location.type='button';
   location.className='asset-location';
   location.textContent=title.replace('번','');
   location.title=`${group.room} ${title} 위치 표시 · 눌러서 업로드 항목 보기`;
   location.setAttribute('aria-label',`${group.room} ${title} 위치 보기`);
   location.dataset.roomIndex=String(groupIndex);
   location.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('museumassetfocus',{detail:{id}})));
   locationHost.append(location);
   locationMarkers.set(id,{element:location,at,room:group.room});

   input.addEventListener('change',()=>{
    const file=input.files&&input.files[0];
    input.value='';
    if(!file)return;
    if(type==='3d'&&!/\.(glb|obj|stl)$/i.test(file.name)){
     status.textContent='GLB, OBJ 또는 STL 파일을 선택해 주세요.';
     return;
    }
    if(type==='2d'&&!file.type.startsWith('image/')){
     status.textContent='이미지 파일을 선택해 주세요.';
     return;
    }
    const old=files.get(id);
    if(old&&!old.isSample&&old.url.startsWith('blob:'))URL.revokeObjectURL(old.url);
    const asset={id,title,type,room:group.room,at,placement,file,url:URL.createObjectURL(file),isSample:false};
    files.set(id,asset);
    renderAsset(asset);
    document.dispatchEvent(new CustomEvent('museumassetchange',{detail:{asset}}));
   });
  });
  host.append(section);
 });
 window.MuseumAssetLocationMarkers=locationMarkers;
 window.addEventListener('load',()=>{
  sampleAssets.forEach(asset=>document.dispatchEvent(new CustomEvent('museumassetchange',{detail:{asset}})));
  sampleModels.forEach(async ({asset,render})=>{
   try{
    const response=await fetch(asset.url);
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const blob=await response.blob();
    if(files.get(asset.id)!==asset)return;
    asset.file=new File([blob],asset.url.split('/').pop(),{type:'text/plain'});
    render(asset);
    document.dispatchEvent(new CustomEvent('museumassetchange',{detail:{asset}}));
   }catch(error){
    if(files.get(asset.id)===asset){
     const row=host.querySelector(`[data-asset-id="${CSS.escape(asset.id)}"]`);
     const status=row?.querySelector('.asset-upload-status');
     if(status)status.textContent=`예시 3D 모델을 불러오지 못했습니다: ${error.message}`;
    }
   }
  });
 },{once:true});

 document.addEventListener('museumassetfocus',event=>{
  const row=host.querySelector(`[data-asset-id="${CSS.escape(event.detail?.id||'')}"]`);
  if(!row)return;
  const group=row.closest('.asset-room');
  if(group)group.open=true;
  row.scrollIntoView({block:'nearest',behavior:'smooth'});
 });
 document.addEventListener('museumassetselected',event=>{
  const {id}=event.detail||{};
  host.querySelectorAll('.asset-model-controls').forEach(controls=>controls._setSelected?.(controls.dataset.assetControls===id));
  const row=host.querySelector(`[data-asset-id="${CSS.escape(id||'')}"]`);
  if(row){
   const group=row.closest('.asset-room');
   if(group)group.open=true;
   row.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
 });
 document.addEventListener('museumassetready',event=>{
  const row=host.querySelector(`[data-asset-id="${CSS.escape(event.detail?.id||'')}"]`);
  const controls=row?.querySelector('.asset-model-controls');
  if(controls){
   controls.dataset.ready='true';
   controls._setSelected(false);
  }
 });
 document.addEventListener('museumassetreset',event=>{
  const row=host.querySelector(`[data-asset-id="${CSS.escape(event.detail?.id||'')}"]`);
  const controls=row?.querySelector('.asset-model-controls');
  if(controls)controls._reset?.();
 });
 document.addEventListener('museumasseterror',event=>{
  const {id,message}=event.detail||{};
  const row=host.querySelector(`[data-asset-id="${CSS.escape(id||'')}"]`);
  const status=row&&row.querySelector('.asset-upload-status');
  if(status)status.textContent=message||'파일을 불러오지 못했습니다.';
 });
})();
