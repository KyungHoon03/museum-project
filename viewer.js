/* baseline의 D.M4, D.upload, D.program, D.loop 재사용. PC 카메라는 MuseumControls.
 * 모델 생성·근거 기록은 layout.js/geometry.js에만 둔다. */
(()=>{
  'use strict';
  const canvas=document.querySelector('#cv'),error=document.querySelector('#error');
  try {
    const gl=canvas.getContext('webgl2',{antialias:true});
    if(!gl)throw new Error('WebGL2를 사용할 수 없습니다. WebGL2 지원 브라우저에서 열어 주세요.');
    const M=D.M4,model=MuseumGeometry.build(),collision=MuseumCollision(model,MuseumLayout);
    const initialEntry=MuseumGeometry.point([125,430]); // 사용자 체크 위치: 서측 입구 대기 공간
    let flight=null;
    function cancelFlight(){flight=null;controls.state.transitioning=false;}
    const controls=MuseumControls(canvas,{onHome:()=>home(),onInput:()=>{selected='free';sync();},onModeChange:()=>{cancelFlight();selected='free';sync();},initialInterior:{eye:[initialEntry[0],1.575,initialEntry[1]],yaw:Math.atan2(125-205,430-366.5)},spawn:collision.spawn});
    const program=D.program(gl,`#version 300 es
      layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNormal;layout(location=2) in vec2 aUV;
      uniform mat4 uModel,uVP;uniform mat3 uNormal;out vec3 vN;out vec3 vWorld;out vec2 vUV;
      void main(){vN=uNormal*aNormal;vUV=aUV;vec4 world=uModel*vec4(aPos,1.);vWorld=world.xyz;gl_Position=uVP*world;}
    `,`#version 300 es
      precision highp float;in vec3 vN;in vec3 vWorld;in vec2 vUV;uniform vec3 uColor,uEye;uniform float uAlpha;uniform int uSurface;uniform bool uFloorTexture,uUseAssetTexture;uniform sampler2D uWood,uAssetTexture;uniform vec4 uWoodBounds,uGrassBounds;uniform vec2 uWoodTile,uGrassNotch,uImageFit;out vec4 outColor;
      float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      bool within(vec4 b){return vWorld.x>=b.x&&vWorld.z>=b.y&&vWorld.x<=b.z&&vWorld.z<=b.w;}
      void main(){
        vec3 n=normalize(vN),light=normalize(vec3(-.3,1.,.5));float l=.62+.38*max(dot(n,light),0.);vec3 color=uColor*l;
        if(uSurface==1){
          // 잔디 아래의 기존 바닥 픽셀을 생략해 얇은 받침면과의 깊이 충돌을 방지한다.
          if(within(uGrassBounds)&&(vWorld.x>=uGrassNotch.x||vWorld.z>=uGrassNotch.y))discard;
          float grain=hash(floor(vWorld*260.)),fleck=hash(floor(vWorld*115.));
          float aa=clamp(length(fwidth(vWorld.xz))*160.,0.,1.);
          color=(vec3(.43,.49,.52)+(grain-.5)*.095*(1.-aa)+step(.93,fleck)*.025*(1.-aa))*l;
          vec2 edge=min(fract(vWorld.xz/.60),1.-fract(vWorld.xz/.60));
          color*=1.-.035*(1.-smoothstep(0.,max(.002,fwidth(vWorld.x)*2.),min(edge.x,edge.y)));

        }
        if(uSurface==4){
          float fine=hash(floor(vWorld*190.)),patchNoise=hash(vec3(floor(vWorld.xz*5.),0.));
          float aa=clamp(length(fwidth(vWorld.xz))*110.,0.,1.);
          color=(vec3(.24,.39,.13)+(fine-.5)*.12*(1.-aa)+(patchNoise-.5)*.045)*l;
        }
        if(uSurface==2){float aa=clamp(length(fwidth(vWorld))*160.,0.,1.);color=vec3(.89,.885,.86)*(1.+(hash(floor(vWorld*210.))-.5)*.025*(1.-aa))*l;if(vWorld.y<.075&&abs(n.y)<.5)color=vec3(.065,.064,.062)*l;}
        if(uSurface==3){
          vec2 woodUV=abs(n.y)>.7?vWorld.xz:abs(n.x)>.7?vWorld.zy:vWorld.xy;
          float grain=sin(woodUV.x*190.+sin(woodUV.y*2.4)*2.+sin(woodUV.x*37.)*1.4);
          float aa=clamp(length(fwidth(woodUV))*60.,0.,1.);color=uColor*(.96+grain*.055*(1.-aa))*l;
        }
        if(uFloorTexture&&vWorld.x>=uWoodBounds.x&&vWorld.z>=uWoodBounds.y&&vWorld.x<=uWoodBounds.z&&vWorld.z<=uWoodBounds.w){
          vec2 uv=(vWorld.xz-uWoodBounds.xy)/uWoodTile;
          color=texture(uWood,uv).rgb*l;
          vec3 halfVector=normalize(light+normalize(uEye-vWorld));
          color+=vec3(1.,.94,.83)*.12*pow(max(dot(n,halfVector),0.),32.);
        }
        if(uUseAssetTexture){
          vec2 uv=(vUV-.5)/uImageFit+.5;
          if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))discard;
          vec4 image=texture(uAssetTexture,uv);
          if(image.a<.01)discard;
          outColor=image;return;
        }
        outColor=vec4(color,uAlpha);
      }
    `);
    const U=D.uniforms(gl,program,['uModel','uVP','uNormal','uColor','uAlpha','uEye','uFloorTexture','uWood','uAssetTexture','uUseAssetTexture','uImageFit','uWoodBounds','uWoodTile','uSurface','uGrassBounds','uGrassNotch']);
    const woodTexture=gl.createTexture(),woodImage=new Image();let woodReady=false;
    gl.bindTexture(gl.TEXTURE_2D,woodTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([180,125,60,255]));
    woodImage.onload=()=>{
      gl.bindTexture(gl.TEXTURE_2D,woodTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,woodImage);gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      const anisotropy=gl.getExtension('EXT_texture_filter_anisotropic');if(anisotropy)gl.texParameterf(gl.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      woodReady=true;
    };
    woodImage.onerror=()=>{error.hidden=false;error.textContent='목재 바닥 텍스처를 불러오지 못했습니다.';};
    woodImage.src=MuseumTextureAssets[model.floors[0].woodRegion.asset];
    const woodRegion=model.floors[0].woodRegion,woodMin=MuseumGeometry.point(woodRegion.bounds.slice(0,2)),woodMax=MuseumGeometry.point(woodRegion.bounds.slice(2));
    const view=M.create(),projection=M.create(),vp=M.create(),identity=M.create();
    const points=MuseumLayout.floor.polygon.map(MuseumGeometry.point);
    const lo=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],hi=[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
    const center=[(lo[0]+hi[0])/2,.5,(lo[1]+hi[1])/2],radius=Math.hypot(hi[0]-lo[0],hi[1]-lo[1])/2;
    let selected='orbit',lastCamera=null;
    const mobileControls=MuseumMobileControls(canvas,controls);
    function travel(destination, path=MuseumPathfinding.find(controls.camera().eye,destination,collision), yaw, coursePlayback=false){
      const start=lastCamera||controls.camera(),pose={yaw:controls.state.yaw,pitch:controls.state.pitch,fov:controls.state.fov};
      if(!path)return;
      const lengths=[0];for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+Math.hypot(...path[i].map((v,k)=>v-path[i-1][k])));
      controls.setMode('interior',destination);Object.assign(controls.state,pose);if(yaw!==undefined)Object.assign(controls.state,{yaw,pitch:0});controls.clear();mobileControls.reset();
      flight={start,end:controls.camera(),began:performance.now(),duration:coursePlayback ? Math.max(380,lengths.at(-1)/1.8*1000) : Math.min(1600,Math.max(380,lengths.at(-1)*65)),path,lengths};controls.state.transitioning=true;
    }
    const waypointControls=MuseumPointNavigation(canvas,controls,collision,model,
      destination=>travel(destination),destination=>{
      cancelFlight();controls.setMode('interior',destination);controls.clear();mobileControls.reset();lastCamera=null;
    });
    const course=MuseumCourse(waypointControls.points,{
      find:(from,to)=>MuseumPathfinding.find(from,to,collision),
      enter:(eye,yaw)=>{
        controls.setMode('interior',eye);
        Object.assign(controls.state,{yaw,pitch:0});
        lastCamera=null;
        mobileControls.reset();
      },
      travel:(eye,path,yaw)=>travel(eye,path,yaw,true),
      isMoving:()=>Boolean(flight),
      hold:()=>{controls.state.transitioning=true;},
      release:()=>{
        if(flight){
          const eye=lastCamera?.eye??flight.start.eye;
          const yaw=controls.state.yaw;
          controls.setMode('interior',eye);
          controls.state.yaw=yaw;
        }
        cancelFlight();
        controls.clear();
        mobileControls.reset();
      }
    });
    function sync(){const choice=controls.state.mode==='interior'?'interior':controls.state.orthographic?'plan':'orbit';document.querySelectorAll('[data-navigation]').forEach(b=>{const active=b.dataset.navigation===choice;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
    function home(){course.stop();cancelFlight();lastCamera=null;const aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight),fit=matchMedia('(pointer: coarse)').matches?Math.max(1,1.2/aspect):1;controls.setView({target:center,distance:radius*1.8*fit});selected='orbit';sync();}
    window.addEventListener('resize',()=>{if(matchMedia('(pointer: coarse)').matches&&selected==='orbit')home();});
    function preset(name){
      cancelFlight();
      lastCamera=null;
      const poses={top:[0,1,0]};
      const v=poses[name];if(!v)return;
      let target=[...center],distance=radius*1.8;
      const aspect=Math.max(.1,canvas.clientWidth/Math.max(1,canvas.clientHeight));
      controls.setView({target,distance:distance*Math.hypot(...v),yaw:0,pitch:Math.PI/2,orthographic:true,halfHeight:Math.max(radius*.65,radius*1.08/aspect)});
      selected=name;sync();
    }
    document.querySelectorAll('[data-navigation]').forEach(b=>b.addEventListener('click',()=>{
      course.stop();
      cancelFlight();
      if(b.dataset.navigation==='plan')preset('top');
      else if(b.dataset.navigation==='orbit')home();
      else controls.setMode('interior');
    }));
    const minimap=MuseumMinimap(document.querySelector('aside'),model);
    const assetMarkers=new Map(),uploadedModels=new Map(),uploadedWallImages=new Map(),assetVersions=new Map();
    let selectedAssetId=null;
    const markerHost=document.querySelector('#asset-markers');
    const locationHost=document.querySelector('#asset-locations');
    const locationMarkers=MuseumAssetLocationMarkers;
    for(const [id,location] of locationMarkers){
      location.element.addEventListener('click',()=>{
        if(!controls.state.orthographic||controls.state.mode==='interior')preset('top');
        document.querySelector(`[data-asset-id="${CSS.escape(id)}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'});
      });
    }
    function imageFit(image,width,height){
      const relativeAspect=(image.naturalWidth/image.naturalHeight)/(width/height);
      return [Math.min(1,relativeAspect),Math.min(1,1/relativeAspect)];
    }
    function showAssetError(id,message){document.dispatchEvent(new CustomEvent('museumasseterror',{detail:{id,message}}));}
    document.addEventListener('museumassetchange',async event=>{
      const {asset}=event.detail||{};
      if(!asset)return;
      if(asset.type==='2d'){
        const old=assetMarkers.get(asset.id);
        if(old)old.remove();
        const marker=document.createElement('button');marker.type='button';marker.className='asset-marker';
        marker.setAttribute('aria-label',`${asset.title} 평면도 위치`);
        const media=document.createElement('img');media.src=asset.url;media.alt='';
        const title=document.createElement('span');title.textContent=asset.title;
        marker.append(media,title);
        marker.addEventListener('click',()=>document.querySelector(`[data-asset-id="${CSS.escape(asset.id)}"]`)?.scrollIntoView({block:'nearest'}));
        markerHost.append(marker);assetMarkers.set(asset.id,marker);
        if(!asset.placement.wall)return;
        const version=(assetVersions.get(asset.id)||0)+1;assetVersions.set(asset.id,version);
        const image=new Image();
        image.onload=()=>{
          if(assetVersions.get(asset.id)!==version||MuseumAssetFiles.get(asset.id)!==asset)return;
          const relief=asset.placement.wallType==='relief-display';
          const niche=asset.placement.wallType==='niche-display';
          const curved=asset.placement.wallType==='curved-display';
          const frame=relief
            ?(MuseumLayout.reliefDisplays||[]).find(item=>item.id===asset.placement.wall)
            :niche
              ?(MuseumLayout.niches||[]).find(item=>item.id===asset.placement.wall)
              :curved
                ?(MuseumLayout.curvedArtFrames||[]).find(item=>item.id===asset.placement.wall)
                :MuseumLayout.wallArtFrames.find(item=>item.id===asset.placement.wall);
          if(!frame){showAssetError(asset.id,niche?'연결된 유리 진열장 위치를 찾을 수 없습니다.':'연결된 액자 위치를 찾을 수 없습니다.');return;}
          if(curved){
            const path=frame.path.map(MuseumGeometry.point),lengths=[0];
            for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]));
            const totalLength=lengths[lengths.length-1],positions=[],normals=[],uv=[],indices=[];
            for(let i=0;i<path.length;i++){
              const previous=path[Math.max(0,i-1)],next=path[Math.min(path.length-1,i+1)];
              let nx=next[1]-previous[1],nz=previous[0]-next[0],normalLength=Math.hypot(nx,nz)||1;
              nx/=normalLength;nz/=normalLength;
              const tangentX=(next[0]-previous[0])/normalLength,tangentZ=(next[1]-previous[1])/normalLength;
              const endInset=(i===0||i===path.length-1) ? .055/MuseumLayout.scale : 0;
              const direction=i===0?1:i===path.length-1?-1:0;
              const x=path[i][0]+tangentX*endInset*direction+nx*((asset.placement.surfaceOffset??.075)/MuseumLayout.scale);
              const z=path[i][1]+tangentZ*endInset*direction+nz*((asset.placement.surfaceOffset??.075)/MuseumLayout.scale);
              positions.push(x,frame.top-.045,z,x,frame.bottom+.045,z);
              normals.push(nx,0,nz,nx,0,nz);
              const u=lengths[i]/totalLength;
              uv.push(u,1,u,0);
              if(i<path.length-1){
                const base=i*2;
                indices.push(base,base+2,base+3,base,base+3,base+1);
              }
            }
            const mesh=D.upload(gl,{pos:new Float32Array(positions),nrm:new Float32Array(normals),
              uv:new Float32Array(uv),idx:new Uint16Array(indices)});
            const texture=gl.createTexture();
            gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
            const previous=uploadedWallImages.get(asset.id);
            if(previous){previous.mesh.dispose();gl.deleteTexture(previous.texture);}
            uploadedWallImages.set(asset.id,{mesh,texture,fit:imageFit(image,totalLength,frame.top-frame.bottom-.09)});
            return;
          }
          const spanX=frame.b[0]-frame.a[0],spanZ=frame.b[1]-frame.a[1];
          const length=Math.hypot(spanX,spanZ)*MuseumLayout.scale;
          const inset=niche ? Math.min(.45,.13/length) : relief ? .12/length : Math.min(.45,.045/length);
          const surfaceOffset=niche
            ? frame.depth+(asset.placement.surfaceOffset??.015)
            : relief ? frame.depth+(asset.placement.surfaceOffset??.07) : (asset.placement.surfaceOffset??.05);
          const inward=frame.inward.map(v=>v*surfaceOffset/MuseumLayout.scale);
          const edge=(t)=>[frame.a[0]+spanX*t+inward[0],frame.a[1]+spanZ*t+inward[1]];
          const topA=MuseumGeometry.point(edge(inset)),topB=MuseumGeometry.point(edge(1-inset));
          const bottom=niche ? frame.sill+.07 : frame.bottom+(relief ? .135 : .045);
          const top=frame.top-(niche ? .035 : relief ? .155 : .045);
          const positions=[topA[0],top,topA[1],topB[0],top,topB[1],topB[0],bottom,topB[1],topA[0],bottom,topA[1]];
          const normal=[frame.inward[0],0,frame.inward[1]];
          const normals=[...normal,...normal,...normal,...normal];
          const leftU=asset.placement.flipX?1:0,rightU=1-leftU;
          const mesh=D.upload(gl,{pos:new Float32Array(positions),nrm:new Float32Array(normals),
            uv:new Float32Array([leftU,1,rightU,1,rightU,0,leftU,0]),idx:new Uint16Array([0,1,2,0,2,3])});
          const texture=gl.createTexture();
          gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,texture);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
          const previous=uploadedWallImages.get(asset.id);
          if(previous){previous.mesh.dispose();gl.deleteTexture(previous.texture);}
          uploadedWallImages.set(asset.id,{mesh,texture,fit:imageFit(image,Math.hypot(topB[0]-topA[0],topB[1]-topA[1]),top-bottom)});
        };
        image.onerror=()=>{
          if(assetVersions.get(asset.id)===version&&MuseumAssetFiles.get(asset.id)===asset)
            showAssetError(asset.id,'사진 파일을 액자에 불러오지 못했습니다.');
        };
        image.src=asset.url;
        return;
      }
      const version=(assetVersions.get(asset.id)||0)+1;assetVersions.set(asset.id,version);
      try{
        const mesh=await MuseumAssetModelLoader.load(asset.file);
        if(assetVersions.get(asset.id)!==version||MuseumAssetFiles.get(asset.id)!==asset)return;
        const renderGpu=D.upload(gl,mesh),old=uploadedModels.get(asset.id);
        if(old)old.renderGpu.dispose();
        uploadedModels.set(asset.id,{renderGpu,mesh,scale:1,yaw:0,offsetX:0,offsetZ:0});
        document.dispatchEvent(new CustomEvent('museumassetready',{detail:{id:asset.id}}));
      }catch(e){showAssetError(asset.id,e.message);}
    });
    document.addEventListener('museumassettransform',event=>{
      const {id,scale,rotationDelta,positionDelta}=event.detail||{};
      const uploaded=uploadedModels.get(id);
      if(!uploaded)return;
      if(Number.isFinite(scale))uploaded.scale=scale;
      if(Number.isFinite(rotationDelta))uploaded.yaw+=rotationDelta;
      if(Array.isArray(positionDelta)&&positionDelta.length===2&&positionDelta.every(Number.isFinite)){
        uploaded.offsetX+=positionDelta[0];
        uploaded.offsetZ+=positionDelta[1];
      }
    });
    document.addEventListener('museumassetreset',event=>{
      const {id}=event.detail||{};
      if(!id)return;
      if(selectedAssetId===id){
        selectedAssetId=null;
        document.dispatchEvent(new CustomEvent('museumassetselected',{detail:{id:null}}));
      }
      assetVersions.set(id,(assetVersions.get(id)||0)+1);
      const marker=assetMarkers.get(id);
      if(marker){marker.remove();assetMarkers.delete(id);}
      const modelAsset=uploadedModels.get(id);
      if(modelAsset){modelAsset.renderGpu.dispose();uploadedModels.delete(id);}
      const wallImage=uploadedWallImages.get(id);
      if(wallImage){
        wallImage.mesh.dispose();
        gl.deleteTexture(wallImage.texture);
        uploadedWallImages.delete(id);
      }
    });
    const labelVisibility=MuseumLabelVisibility(model);
    const labels=MuseumLayout.rooms.map(room=>{
      const el=document.createElement('span');el.className='room-label';el.textContent=room.name;el.dataset.room=room.id;document.querySelector('#labels').append(el);
      const pts=room.polygon.map(MuseumGeometry.point),p=[pts.reduce((s,v)=>s+v[0],0)/pts.length,.12,pts.reduce((s,v)=>s+v[1],0)/pts.length];
      return {el,p};
    });
    gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);home();
    function matrix(p){const m=M.create();M.translate(m,m,p.position);M.rotateY(m,m,p.yaw||0);M.scale(m,m,p.size);return m;}
    function draw(mesh,m,color,alpha=1,textured=false,surface=0,assetImage=null){gl.uniformMatrix4fv(U.uModel,false,m);gl.uniformMatrix3fv(U.uNormal,false,M.normalFrom(m));gl.uniform3fv(U.uColor,color);gl.uniform1f(U.uAlpha,alpha);gl.uniform1i(U.uSurface,surface);gl.uniform1i(U.uFloorTexture,textured&&woodReady?1:0);gl.uniform1i(U.uUseAssetTexture,assetImage?1:0);if(assetImage){gl.uniform2fv(U.uImageFit,assetImage.fit);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,assetImage.texture);gl.uniform1i(U.uAssetTexture,1);}gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);}
    const normalize=v=>{const length=Math.hypot(...v)||1;return v.map(value=>value/length);};
    const subtract=(a,b)=>a.map((value,index)=>value-b[index]);
    const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);
    function modelHitDistance(origin,direction,asset,uploaded){
      const placement=asset.placement||{},scale=(placement.scale||.7)*uploaded.scale;
      const center=MuseumGeometry.point(asset.at),cos=Math.cos(uploaded.yaw),sin=Math.sin(uploaded.yaw);
      center[0]+=uploaded.offsetX;center[1]+=uploaded.offsetZ;
      const mesh=uploaded.mesh;
      let nearest=Infinity;
      const world=index=>{
        const x=mesh.pos[index*3]*scale,z=mesh.pos[index*3+2]*scale;
        return [center[0]+cos*x+sin*z,
          (placement.baseHeight||0)+scale/2+.03+mesh.pos[index*3+1]*scale,
          center[1]-sin*x+cos*z];
      };
      for(let i=0;i<mesh.idx.length;i+=3){
        const a=world(mesh.idx[i]),b=world(mesh.idx[i+1]),c=world(mesh.idx[i+2]);
        const edge1=subtract(b,a),edge2=subtract(c,a),h=cross(direction,edge2),det=dot(edge1,h);
        if(Math.abs(det)<1e-8)continue;
        const inverse=1/det,s= subtract(origin,a),u=inverse*dot(s,h);
        if(u<0||u>1)continue;
        const q=cross(s,edge1),v=inverse*dot(direction,q);
        if(v<0||u+v>1)continue;
        const distance=inverse*dot(edge2,q);
        if(distance>0&&distance<nearest)nearest=distance;
      }
      return nearest;
    }
    canvas.addEventListener('click',event=>{
      if(event.detail===0||controls.state.transitioning)return;
      const rect=canvas.getBoundingClientRect(),nx=2*(event.clientX-rect.left)/rect.width-1,ny=1-2*(event.clientY-rect.top)/rect.height;
      const camera=controls.camera(),forward=normalize(subtract(camera.target,camera.eye)),right=normalize(cross(forward,camera.up)),up=normalize(cross(right,forward));
      let rayOrigin=[...camera.eye],rayDirection;
      if(controls.state.orthographic){
        const half=controls.state.halfHeight;
        rayOrigin=rayOrigin.map((value,index)=>value+right[index]*nx*half*rect.width/rect.height+up[index]*ny*half);
        rayDirection=forward;
      }else{
        const tangent=Math.tan(controls.state.fov*Math.PI/360);
        rayDirection=normalize(forward.map((value,index)=>value+right[index]*nx*rect.width/rect.height*tangent+up[index]*ny*tangent));
      }
      let nearest=null,nearestDistance=Infinity;
      for(const [id,uploaded] of uploadedModels){
        const asset=MuseumAssetFiles.get(id);if(!asset)continue;
        const distance=modelHitDistance(rayOrigin,rayDirection,asset,uploaded);
        if(distance<nearestDistance){nearest=id;nearestDistance=distance;}
      }
      if(nearest){
        selectedAssetId=nearest;
        document.dispatchEvent(new CustomEvent('museumassetselected',{detail:{id:nearest}}));
      }
    });
    const result=MuseumSurfaces.resolve([...model.floors.filter(p=>p.group!=='ceiling'),...model.parts]);
    for(const p of [...model.floors,...model.parts]){
      const mesh=result.meshes.get(p.id);if(mesh)p.renderGpu=D.upload(gl,mesh);
    }
    const surfaceStats={trimmed:result.trimmed,removedArea:result.removedArea};
    D.loop((now,dt)=>{
      course.update(now);
      controls.update(dt);
      mobileControls.update(dt);
      const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      gl.viewport(0,0,w,h);gl.clearColor(.91,.925,.90,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      let camera=controls.camera();
      if(flight){
        const t=Math.min(1,(performance.now()-flight.began)/flight.duration),s=t*t*(3-2*t),mix=(a,b)=>a.map((v,i)=>v+(b[i]-v)*s),normalize=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
        const a=flight.start,b=flight.end,eye=mix(a.eye,b.eye),direction=normalize(mix(normalize(a.target.map((v,i)=>v-a.eye[i])),normalize(b.target.map((v,i)=>v-b.eye[i]))));
        camera={eye,target:eye.map((v,i)=>v+direction[i]),up:normalize(mix(a.up,b.up))};
        if(flight.path){const distance=s*flight.lengths.at(-1);let i=1;while(i<flight.lengths.length-1&&flight.lengths[i]<distance)i++;const fraction=(distance-flight.lengths[i-1])/Math.max(1e-9,flight.lengths[i]-flight.lengths[i-1]);camera.eye=flight.path[i-1].map((v,k)=>v+(flight.path[i][k]-v)*fraction);camera.target=camera.eye.map((v,k)=>v+direction[k]);}
        if(t===1){camera=b;cancelFlight();controls.clear();mobileControls.reset();}
      }
      lastCamera=camera;M.lookAt(view,camera.eye,camera.target,camera.up);
      if(controls.state.orthographic){const half=controls.state.halfHeight;M.ortho(projection,-half*w/h,half*w/h,-half,half,.02,250);}
      else M.perspective(projection,controls.state.fov*Math.PI/180,w/h,.02,250);
      M.multiply(vp,projection,view);gl.useProgram(program);gl.uniformMatrix4fv(U.uVP,false,vp);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,woodTexture);gl.uniform1i(U.uWood,0);gl.uniform3fv(U.uEye,camera.eye);gl.uniform4fv(U.uWoodBounds,[...woodMin,...woodMax]);gl.uniform2fv(U.uWoodTile,woodRegion.tileSize);
      gl.uniform4fv(U.uGrassBounds,[...MuseumGeometry.point([492,480]),...MuseumGeometry.point([900,584])]);gl.uniform2fv(U.uGrassNotch,MuseumGeometry.point([552,496]));
      for(const f of model.floors){if(!f.renderGpu)continue;draw(f.renderGpu,identity,f.color,1,f.group==='floor',MuseumMaterials.classify(f));}
      for(const p of model.parts){if(['glass','displayGlass'].includes(p.group))continue;draw(p.renderGpu,matrix(p),p.color,1,false,MuseumMaterials.classify(p));}
      // 얇은 유리판은 불투명 부재 뒤에, 카메라에서 먼 순서로 그린다.
      const distance=p=>p.position.reduce((s,v,i)=>s+(v-camera.eye[i])**2,0);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      for(const p of model.parts.filter(p=>['glass','displayGlass'].includes(p.group)).sort((a,b)=>distance(b)-distance(a)))draw(p.renderGpu,matrix(p),p.color,p.alpha);
      gl.depthMask(true);gl.disable(gl.BLEND);
      for(const [id,uploaded] of uploadedModels){
        const asset=MuseumAssetFiles.get(id);if(!asset)continue;
        const at=MuseumGeometry.point(asset.at),placement=asset.placement||{},scale=(placement.scale||.7)*uploaded.scale;
        const item={position:[at[0]+uploaded.offsetX,(placement.baseHeight||0)+scale/2+.03,at[1]+uploaded.offsetZ],size:[scale,scale,scale],yaw:uploaded.yaw};
        const color=asset.id==='lobby-1'?[.52,.42,.27]:[.30,.27,.20];
        draw(uploaded.renderGpu,matrix(item),color);
      }
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      for(const uploaded of uploadedWallImages.values()){
        draw(uploaded.mesh,identity,[1,1,1],1,false,0,uploaded);
      }
      gl.depthMask(true);gl.disable(gl.BLEND);
      for(const [id,marker] of assetMarkers){
        const asset=MuseumAssetFiles.get(id);if(!asset)continue;
        const at=MuseumGeometry.point(asset.at),anchor=[at[0],.06,at[1]];
        const clip=[0,1,2,3].map(i=>vp[i]*anchor[0]+vp[4+i]*anchor[1]+vp[8+i]*anchor[2]+vp[12]);
        const x=clip[0]/clip[3],y=clip[1]/clip[3];
        marker.hidden=!controls.state.orthographic||controls.state.mode==='interior'||clip[3]<=0||Math.abs(x)>1||Math.abs(y)>1;
        marker.style.left=(x*.5+.5)*r.width+'px';marker.style.top=(-y*.5+.5)*r.height+'px';
      }
      for(const location of locationMarkers.values()){
        const at=MuseumGeometry.point(location.at),anchor=[at[0],.09,at[1]];
        const clip=[0,1,2,3].map(i=>vp[i]*anchor[0]+vp[4+i]*anchor[1]+vp[8+i]*anchor[2]+vp[12]);
        const x=clip[0]/clip[3],y=clip[1]/clip[3];
        location.element.hidden=!controls.state.orthographic||controls.state.mode==='interior'||
          clip[3]<=0||Math.abs(x)>1||Math.abs(y)>1;
        location.element.style.left=(x*.5+.5)*r.width+'px';
        location.element.style.top=(-y*.5+.5)*r.height+'px';
      }
      waypointControls.update(vp,r);
      minimap.update(camera,controls.state,r);
      for(const {el,p} of labels){const anchor=controls.state.mode==='interior'?[p[0],1.85,p[2]]:p,clip=[0,1,2,3].map(i=>vp[i]*anchor[0]+vp[4+i]*anchor[1]+vp[8+i]*anchor[2]+vp[12+i]),x=clip[0]/clip[3],y=clip[1]/clip[3];el.hidden=clip[3]<=0||Math.abs(x)>1||Math.abs(y)>1||(controls.state.mode==='interior'&&labelVisibility.countWalls(camera.eye,anchor)>1);el.style.left=(x*.5+.5)*r.width+'px';el.style.top=(-y*.5+.5)*r.height+'px';}
    });
    window.MuseumViewer={gl,model,controls,home,groundNavigation:waypointControls,partMatrix:matrix,get camera(){return lastCamera;},get surfaceStats(){return surfaceStats;},get woodReady(){return woodReady;}};
  } catch(e){error.hidden=false;error.textContent=e.message;console.error(e);}
})();
