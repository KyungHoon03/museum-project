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
    // 조명 수: 그래픽 카드의 프래그먼트 유니폼 한도에 맞춘다(조명 1개 = vec4 4개). 일반 PC 128, 휴대폰은 더 적을 수 있다.
    const maxLights=Math.max(16,Math.min(128,Math.floor((gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)-48)/4)));
    MuseumLighting.setMaxLights(maxLights);
    const program=D.program(gl,`#version 300 es
      layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNormal;layout(location=2) in vec2 aUV;layout(location=3) in vec3 aColor;
      uniform mat4 uModel,uVP;uniform mat3 uNormal;out vec3 vN;out vec3 vWorld;out vec2 vUV;out vec3 vColor;
      void main(){vN=uNormal*aNormal;vUV=aUV;vColor=aColor;vec4 world=uModel*vec4(aPos,1.);vWorld=world.xyz;gl_Position=uVP*world;}
    `,`#version 300 es
      precision highp float;precision highp sampler2DShadow;
      in vec3 vN;in vec3 vWorld;in vec2 vUV;in vec3 vColor;
      uniform vec3 uColor,uEye;uniform float uAlpha;uniform int uSurface;uniform bool uFloorTexture,uUseAssetTexture,uVertexColor;
      uniform sampler2D uWood,uAssetTexture,uMask,uRoomMap,uAO;uniform float uExposure;uniform bool uCeilingOn;uniform sampler2DShadow uShadow;
      uniform vec4 uWoodBounds,uGrassBounds,uMaskBounds;uniform vec2 uWoodTile,uGrassNotch,uImageFit;
      // 태양·하늘(실외)과 실내 기본 밝기
      uniform vec3 uSunDir,uSunColor,uSkyAmbient,uSkyColor,uIndoorEnv;uniform float uIndoorAmbient;uniform mat4 uSunVP;uniform bool uShadowOn;
      // 실내 조명: pos.w=도달 거리, dir.w=바깥 원뿔 cos(-2이면 전구), color.w=안쪽 원뿔 cos, bounds=빛이 닿는 평면 범위
      const int MAX_LIGHTS=${maxLights};uniform int uLightCount;uniform vec4 uLightPos[MAX_LIGHTS],uLightDir[MAX_LIGHTS],uLightColor[MAX_LIGHTS],uLightBounds[MAX_LIGHTS];
      out vec4 outColor;
      // 선형 색공간에서 빛을 더한 뒤 ACES 근사 톤 매핑과 sRGB 감마로 화면에 낸다.
      vec3 toLinear(vec3 c){return pow(max(c,vec3(0.)),vec3(2.2));}
      vec3 display(vec3 c){c*=uExposure;c=clamp(c*(2.51*c+.03)/(c*(2.43*c+.59)+.14),0.,1.);return pow(c,vec3(1./2.2));}
      float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      bool within(vec4 b){return vWorld.x>=b.x&&vWorld.z>=b.y&&vWorld.x<=b.z&&vWorld.z<=b.w;}
      float sunShadow(vec3 n){
        if(!uShadowOn)return 1.;
        vec4 p=uSunVP*vec4(vWorld+n*.04,1.);vec3 q=p.xyz/p.w*.5+.5;
        if(any(lessThan(q,vec3(0.)))||any(greaterThan(q,vec3(1.))))return 1.;
        float sum=0.;vec2 texel=1./vec2(textureSize(uShadow,0));
        for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)sum+=texture(uShadow,vec3(q.xy+vec2(x,y)*texel,q.z-.0015));
        return sum/9.;
      }
      void artificial(vec3 n,vec3 V,float shininess,float roomHere,inout vec3 diffuse,inout vec3 specular){
        for(int i=0;i<MAX_LIGHTS;i++){
          if(i>=uLightCount)break;
          vec4 b=uLightBounds[i];if(vWorld.x<b.x||vWorld.z<b.y||vWorld.x>b.z||vWorld.z>b.w)continue;
          float info=uLightPos[i].w,lightRoom=floor(info/100.),range=info-lightRoom*100.;
          if(lightRoom>0.&&roomHere>0.&&abs(lightRoom-roomHere)>.5)continue; // 다른 방 조명은 벽 너머로 새지 않는다
          vec3 toLight=uLightPos[i].xyz-vWorld;float d=length(toLight);if(d>range)continue;
          vec3 L=toLight/d;float ndl=dot(n,L);if(ndl<=0.)continue;
          float cosOuter=uLightDir[i].w,spot=cosOuter<-1.5?1.:smoothstep(cosOuter,uLightColor[i].w,dot(-L,uLightDir[i].xyz));
          if(spot<=0.)continue;
          float f=clamp(1.-pow(d/range,4.),0.,1.);vec3 c=uLightColor[i].rgb*spot*f*f/(.35+d*d);
          diffuse+=c*ndl;
          specular+=c*pow(max(dot(n,normalize(L+V)),0.),shininess)*ndl;
        }
      }
      void main(){
        if(uSurface==9){outColor=vec4(uColor,1.);return;} // 조명 기구의 발광면
        if(uSurface==8){ // 유물 접지 그림자: 받침면에 깔리는 부드러운 타원
          float r=length(vUV*2.-1.);outColor=vec4(0.,0.,0.,uAlpha*(1.-smoothstep(.25,1.,r)));return;
        }
        vec3 n=normalize(vN),V=normalize(uEye-vWorld);
        if(uVertexColor&&dot(n,V)<0.)n=-n; // 업로드 모델은 면 방향이 제각각이라 양면으로 본다
        vec3 albedo=uVertexColor?vColor:uColor;float shininess=24.,ks=.06;
        if(uSurface==1){
          // 잔디 아래의 기존 바닥 픽셀을 생략해 얇은 받침면과의 깊이 충돌을 방지한다.
          if(within(uGrassBounds)&&(vWorld.x>=uGrassNotch.x||vWorld.z>=uGrassNotch.y))discard;
          float grain=hash(floor(vWorld*260.)),fleck=hash(floor(vWorld*115.));
          float aa=clamp(length(fwidth(vWorld.xz))*160.,0.,1.);
          albedo=vec3(.43,.49,.52)+(grain-.5)*.095*(1.-aa)+step(.93,fleck)*.025*(1.-aa);
          vec2 edge=min(fract(vWorld.xz/.60),1.-fract(vWorld.xz/.60));
          albedo*=1.-.035*(1.-smoothstep(0.,max(.002,fwidth(vWorld.x)*2.),min(edge.x,edge.y)));
          shininess=70.;ks=.35; // 광택 있는 석재 바닥
        }
        if(uSurface==4){
          float fine=hash(floor(vWorld*190.)),patchNoise=hash(vec3(floor(vWorld.xz*5.),0.));
          float aa=clamp(length(fwidth(vWorld.xz))*110.,0.,1.);
          albedo=vec3(.24,.39,.13)+(fine-.5)*.12*(1.-aa)+(patchNoise-.5)*.045;ks=0.;
        }
        if(uSurface==2){float aa=clamp(length(fwidth(vWorld))*160.,0.,1.);albedo=vec3(.89,.885,.86)*(1.+(hash(floor(vWorld*210.))-.5)*.025*(1.-aa));shininess=8.;ks=.02;if(vWorld.y<.075&&abs(n.y)<.5){albedo=vec3(.065,.064,.062);ks=.1;}}
        if(uSurface==3){
          vec2 woodUV=abs(n.y)>.7?vWorld.xz:abs(n.x)>.7?vWorld.zy:vWorld.xy;
          float grain=sin(woodUV.x*190.+sin(woodUV.y*2.4)*2.+sin(woodUV.x*37.)*1.4);
          float aa=clamp(length(fwidth(woodUV))*60.,0.,1.);albedo=uColor*(.96+grain*.055*(1.-aa));shininess=40.;ks=.16;
        }
        if(uFloorTexture&&vWorld.x>=uWoodBounds.x&&vWorld.z>=uWoodBounds.y&&vWorld.x<=uWoodBounds.z&&vWorld.z<=uWoodBounds.w){
          albedo=texture(uWood,(vWorld.xz-uWoodBounds.xy)/uWoodTile).rgb;shininess=48.;ks=.24;
        }
        if(uSurface==5){albedo=vec3(.72,.72,.70);shininess=4.;ks=0.;} // 천장(1인칭 전용)
        if(uVertexColor){shininess=36.;ks=.22;}
        bool glass=uAlpha<.99&&!uUseAssetTexture;
        if(glass){shininess=160.;ks=1.;if(dot(n,V)<0.)n=-n;}
        if(uUseAssetTexture){
          vec2 uv=(vUV-.5)/uImageFit+.5;
          if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))discard;
          vec4 image=texture(uAssetTexture,uv);
          if(image.a<.01)discard;
          albedo=image.rgb;shininess=14.;ks=.035; // 무광 인쇄 패널
        }
        albedo=toLinear(albedo);
        // 실내/실외 판정: 건물 외곽 안쪽은 천장이 있다고 본다. 외벽 바깥면·지붕 높이 윗면은 실외.
        bool roof=n.y>.5&&vWorld.y>2.6;
        vec2 mq=(vWorld.xz+n.xz*.06-uMaskBounds.xy)/(uMaskBounds.zw-uMaskBounds.xy);
        bool indoor=!roof&&texture(uMask,mq).r>.5;
        // 구석 어두움(차폐광 근사): 벽·전시대 가까운 바닥, 바닥·천장과 만나는 벽 아래·위.
        float ao=1.;
        if(n.y>.7&&vWorld.y<.12)ao*=mix(.5,1.,smoothstep(0.,.75,texture(uAO,(vWorld.xz-uMaskBounds.xy)/(uMaskBounds.zw-uMaskBounds.xy)).r));
        if(abs(n.y)<.3){ao*=1.-.30*(1.-smoothstep(0.,.5,vWorld.y));if(uCeilingOn&&indoor)ao*=1.-.25*smoothstep(2.3,2.8,vWorld.y);} // 위: 가상 천장과 만나는 모서리
        if(uSurface==5)ao*=.85;
        vec3 ambient=vec3(0.),diffuse=vec3(0.),specular=vec3(0.);
        if(indoor){
          ambient+=vec3(uIndoorAmbient)*(.80+.20*abs(n.y))*vec3(1.,.985,.96);
        }else{
          ambient+=uSkyAmbient*(.72+.28*(n.y*.5+.5));
          float ndl=dot(n,uSunDir);
          if(ndl>0.&&uSunDir.y>-.05){
            float shade=sunShadow(n);
            diffuse+=uSunColor*ndl*shade;
            specular+=uSunColor*pow(max(dot(n,normalize(uSunDir+V)),0.),shininess)*ndl*shade;
          }
        }
        float roomHere=floor(texture(uRoomMap,mq).r*255.+.5);
        artificial(n,V,shininess,roomHere,diffuse,specular);
        diffuse=ambient*ao+diffuse*mix(1.,ao,.45);
        vec3 color=albedo*diffuse+specular*ks;
        if(glass){
          // 유리: 비스듬히 볼수록 주변(하늘·실내)을 더 많이 반사한다(프레넬).
          float F=.04+.96*pow(1.-abs(dot(n,V)),5.);
          vec3 env=toLinear(indoor?uIndoorEnv:uSkyColor);
          color=mix(albedo*diffuse,env,F*.6)+specular;
          outColor=vec4(display(color),clamp(uAlpha+F*.28+dot(specular,vec3(.33)),0.,.85));return;
        }
        outColor=vec4(display(color),uUseAssetTexture?1.:uAlpha);
      }
    `);
    const U=D.uniforms(gl,program,['uModel','uVP','uNormal','uColor','uAlpha','uEye','uFloorTexture','uWood','uAssetTexture','uUseAssetTexture','uVertexColor','uImageFit','uWoodBounds','uWoodTile','uSurface','uGrassBounds','uGrassNotch','uMask','uRoomMap','uAO','uExposure','uCeilingOn','uMaskBounds','uShadow','uShadowOn','uSunVP','uSunDir','uSunColor','uSkyAmbient','uSkyColor','uIndoorEnv','uIndoorAmbient','uLightCount','uLightPos','uLightDir','uLightColor','uLightBounds']);
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
    /* 실내/실외 판정용 건물 외곽 마스크(평면 1px ≈ 3cm). 외곽 안쪽 = 천장이 있는 실내. */
    const maskPoly=MuseumLighting.envelope,maskBounds=[Math.min(...maskPoly.map(p=>p[0]))-2,Math.min(...maskPoly.map(p=>p[1]))-2,Math.max(...maskPoly.map(p=>p[0]))+2,Math.max(...maskPoly.map(p=>p[1]))+2];
    const maskTexture=gl.createTexture(),roomTexture=gl.createTexture();
    {
      const size=2048,c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');
      g.fillStyle='#000';g.fillRect(0,0,size,size);g.fillStyle='#fff';g.beginPath();
      maskPoly.forEach((p,i)=>{const x=(p[0]-maskBounds[0])/(maskBounds[2]-maskBounds[0])*size,y=(p[1]-maskBounds[1])/(maskBounds[3]-maskBounds[1])*size;i?g.lineTo(x,y):g.moveTo(x,y);});
      g.closePath();g.fill();
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,maskTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);
      for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
      // 방 번호 지도: 빨강 채널 = 방 번호(1~). 조명은 자기 방 픽셀에만 닿는다.
      g.fillStyle='#000';g.fillRect(0,0,size,size);g.imageSmoothingEnabled=false;
      for(const room of MuseumLighting.paintOrder){
        g.fillStyle=`rgb(${room.index},0,0)`;g.beginPath();
        room.poly.forEach((p,i)=>{const x=(p[0]-maskBounds[0])/(maskBounds[2]-maskBounds[0])*size,y=(p[1]-maskBounds[1])/(maskBounds[3]-maskBounds[1])*size;i?g.lineTo(x,y):g.moveTo(x,y);});
        g.closePath();g.fill();
      }
      gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,roomTexture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);
      for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
    }
    /* 구석 어두움용 거리 지도: 바닥에 닿는 벽·기둥·전시대 발자국에서의 거리(0~1m)를 평면 텍스처로 굽는다. */
    const aoTexture=gl.createTexture();
    {
      const W=1024,H=Math.max(64,Math.round(W*(maskBounds[3]-maskBounds[1])/(maskBounds[2]-maskBounds[0]))),px=(maskBounds[2]-maskBounds[0])/W;
      const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
      g.fillStyle='#000';g.fillRect(0,0,W,H);g.fillStyle='#fff';
      for(const p of model.parts){
        if(p.mesh||['glass','displayGlass','grass','frame'].includes(p.group))continue;
        if(p.position[1]-p.size[1]/2>.06||p.size[1]<.05)continue;
        g.save();g.translate((p.position[0]-maskBounds[0])/px,(p.position[2]-maskBounds[1])/px);g.rotate(-(p.yaw||0));
        g.fillRect(-p.size[0]/2/px,-p.size[2]/2/px,p.size[0]/px,p.size[2]/px);g.restore();
      }
      const src=g.getImageData(0,0,W,H).data,dist=new Float32Array(W*H);
      for(let i=0;i<W*H;i++)dist[i]=src[i*4]>127?0:1e9;
      // 2-패스 체임퍼 거리 변환(대각선 1.414).
      const at=(x,y)=>dist[y*W+x];
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){let d=at(x,y);if(x>0)d=Math.min(d,at(x-1,y)+1);if(y>0){d=Math.min(d,at(x,y-1)+1);if(x>0)d=Math.min(d,at(x-1,y-1)+1.414);if(x<W-1)d=Math.min(d,at(x+1,y-1)+1.414);}dist[y*W+x]=d;}
      for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){let d=at(x,y);if(x<W-1)d=Math.min(d,at(x+1,y)+1);if(y<H-1){d=Math.min(d,at(x,y+1)+1);if(x<W-1)d=Math.min(d,at(x+1,y+1)+1.414);if(x>0)d=Math.min(d,at(x-1,y+1)+1.414);}dist[y*W+x]=d;}
      const out=new Uint8Array(W*H*4);
      for(let i=0;i<W*H;i++){const v=Math.min(255,Math.round(dist[i]*px*255));out[i*4]=out[i*4+1]=out[i*4+2]=v;out[i*4+3]=255;}
      gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,aoTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,out);
      for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
    }
    /* 천장: 빛 계산에서는 항상 "건물 외곽 안쪽 2.8m 높이에 천장이 있다"고 본다
     * (실내에 햇빛이 들지 않고, 벽 위쪽 천장 모서리가 어두워짐).
     * 천장 면은 1인칭에서만 그리고, 둘러보기·평면도에서는 내부가 보이도록 그리지 않는다. */
    const ceilingMesh=(()=>{
      const m=MuseumGeometry.floor(MuseumLayout.envelope,MuseumLayout.wallHeight-.002);
      return D.upload(gl,{pos:m.pos,nrm:m.nrm.map(v=>-v),idx:m.idx});
    })();
    /* 유물 접지 그림자용 사각형(uv 0~1). */
    const decalMesh=D.upload(gl,{pos:new Float32Array([-1,0,-1,1,0,-1,1,0,1,-1,0,1]),nrm:new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]),uv:new Float32Array([0,0,1,0,1,1,0,1]),idx:new Uint16Array([0,1,2,0,2,3])});
    /* 햇빛 그림자 지도: 태양 방향에서 본 깊이. 태양이 움직이거나 유물이 바뀔 때만 다시 그린다. */
    const shadowSize=2048,shadowTexture=gl.createTexture(),shadowFramebuffer=gl.createFramebuffer();
    gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,shadowTexture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,shadowSize,shadowSize,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
    for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE],[gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL]])gl.texParameteri(gl.TEXTURE_2D,k,v);
    gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFramebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,shadowTexture,0);
    gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    const shadowProgram=D.program(gl,`#version 300 es
      layout(location=0) in vec3 aPos;uniform mat4 uModel,uVP;void main(){gl_Position=uVP*uModel*vec4(aPos,1.);}
    `,`#version 300 es
      precision mediump float;out vec4 o;void main(){o=vec4(1.);}
    `);
    const SU=D.uniforms(gl,shadowProgram,['uModel','uVP']);
    const sunVP=M.create();let shadowKey='',modelRevision=0;
    function renderShadows(env){
      const key=env.sunDir.map(v=>v.toFixed(4)).join()+':'+modelRevision;
      if(key===shadowKey)return;shadowKey=key;
      if(env.sunDir[1]<=-.05)return;
      const R=radius*1.15,eye=center.map((v,i)=>v+env.sunDir[i]*R*1.6),up=Math.abs(env.sunDir[1])>.98?[0,0,1]:[0,1,0];
      const lv=M.create(),lp=M.create();M.lookAt(lv,eye,center,up);M.ortho(lp,-R,R,-R,R,.1,R*3.4);M.multiply(sunVP,lp,lv);
      gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFramebuffer);gl.viewport(0,0,shadowSize,shadowSize);gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(shadowProgram);gl.uniformMatrix4fv(SU.uVP,false,sunVP);
      for(const p of model.parts){if(!p.renderGpu||['glass','displayGlass','grass'].includes(p.group))continue;gl.uniformMatrix4fv(SU.uModel,false,matrix(p));gl.bindVertexArray(p.renderGpu.vao);gl.drawElements(gl.TRIANGLES,p.renderGpu.count,gl.UNSIGNED_SHORT,0);}
      for(const u of uploadedModels.values()){gl.uniformMatrix4fv(SU.uModel,false,u.matrix);gl.bindVertexArray(u.renderGpu.vao);gl.drawElements(gl.TRIANGLES,u.renderGpu.count,gl.UNSIGNED_SHORT,0);}
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    /* 조명 기구 모형: 원통(트랙 스포트 몸체·전선), 원판(다운라이트·발광면). */
    function unitCylinder(seg=16){
      const pos=[],nrm=[],idx=[];
      for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2,c=Math.cos(a),s=Math.sin(a);pos.push(c,s,0,c,s,1);nrm.push(c,s,0,c,s,0);}
      for(let i=0;i<seg;i++){const k=i*2;idx.push(k,k+1,k+3,k,k+3,k+2);}
      const back=pos.length/3;pos.push(0,0,0);nrm.push(0,0,-1);
      for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2;pos.push(Math.cos(a),Math.sin(a),0);nrm.push(0,0,-1);}
      for(let i=0;i<seg;i++)idx.push(back,back+2+i,back+1+i);
      return D.upload(gl,{pos:new Float32Array(pos),nrm:new Float32Array(nrm),idx:new Uint16Array(idx)});
    }
    function unitDisc(seg=20){
      const pos=[0,0,0],nrm=[0,0,1],idx=[];
      for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2;pos.push(Math.cos(a),Math.sin(a),0);nrm.push(0,0,1);}
      for(let i=0;i<seg;i++)idx.push(0,1+i,2+i);
      return D.upload(gl,{pos:new Float32Array(pos),nrm:new Float32Array(nrm),idx:new Uint16Array(idx)});
    }
    const cylinderMesh=unitCylinder(),discMesh=unitDisc();
    // 위치 p에서 dir 방향을 +Z로 하는 변환. (sx,sy,sz) 배율, z 방향 offset.
    function oriented(p,dir,sx,sy,sz,offset=0){
      const z=dir,ref=Math.abs(z[1])>.95?[1,0,0]:[0,1,0];
      let x=[ref[1]*z[2]-ref[2]*z[1],ref[2]*z[0]-ref[0]*z[2],ref[0]*z[1]-ref[1]*z[0]];const xl=Math.hypot(...x);x=x.map(v=>v/xl);
      const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
      const m=new Float32Array(16);
      m.set([x[0]*sx,x[1]*sx,x[2]*sx,0,y[0]*sy,y[1]*sy,y[2]*sy,0,z[0]*sz,z[1]*sz,z[2]*sz,0,p[0]+z[0]*offset,p[1]+z[1]*offset,p[2]+z[2]*offset,1]);
      return m;
    }
    function drawFixtures(){
      const housing=[.13,.13,.14],selectedColor=[.95,.62,.12];
      for(const f of MuseumLighting.fixtures()){
        const l=f.light,glow=f.lit?f.color.map(v=>Math.min(1,v*1.15)):[.32,.32,.30],body=f.selected?selectedColor:housing;
        if(f.fixture==='can'){
          draw(cylinderMesh,oriented(l.pos,[0,1,0],.007,.007,Math.max(.02,2.8-l.pos[1])),[.2,.2,.2]);
          draw(cylinderMesh,oriented(l.pos,f.dir,.038,.038,.13,-.13),body);
          draw(discMesh,oriented(l.pos,f.dir,.03,.03,1,.002),glow,1,false,9);
        }else if(f.fixture==='disc'){
          draw(cylinderMesh,oriented(l.pos,[0,-1,0],.10,.10,.02,-.02),f.selected?selectedColor:[.86,.86,.84]);
          draw(discMesh,oriented(l.pos,[0,-1,0],.075,.075,1,.002),glow,1,false,9);
        }else if(f.fixture==='bulb'){
          draw(cylinderMesh,oriented(l.pos,[0,1,0],.004,.004,Math.max(.02,2.8-l.pos[1])),[.15,.15,.15]);
          draw(cylinderMesh,oriented(l.pos,[0,-1,0],.045,.045,.08,-.03),glow,1,false,9);
        }else if(f.selected){
          draw(discMesh,oriented(l.pos,[0,-1,0],.05,.05,1,.002),selectedColor,1,false,9);
        }
      }
    }
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
    const panelScroll=document.querySelector('.panel-scroll');
    const minimap=MuseumMinimap(panelScroll,model);
    function revealAsset(id){
      const item=panelScroll.querySelector(`[data-asset-id="${CSS.escape(id)}"]`);
      if(!item)return;
      mobileControls.openPanel();
      const group=item.closest('details');
      if(group)group.open=true;
      const top=item.getBoundingClientRect().top-panelScroll.getBoundingClientRect().top;
      panelScroll.scrollTop+=top;
    }
    const assetMarkers=new Map(),uploadedModels=new Map(),uploadedWallImages=new Map(),assetVersions=new Map();
    let selectedAssetId=null;
    const markerHost=document.querySelector('#asset-markers');
    const locationHost=document.querySelector('#asset-locations');
    const locationMarkers=MuseumAssetLocationMarkers;
    for(const [id,location] of locationMarkers){
      location.element.addEventListener('click',()=>{
        if(!controls.state.orthographic||controls.state.mode==='interior')preset('top');
        revealAsset(id);
      });
    }
    function imageFit(image,width,height){
      const relativeAspect=(image.naturalWidth/image.naturalHeight)/(width/height);
      return [Math.min(1,relativeAspect),Math.min(1,1/relativeAspect)];
    }
    /* 3D 유물을 받침면 위에 놓는다.
     * - 모델 단위 추정: 가장 긴 변이 5 이하면 m, 300 이하면 cm, 그보다 크면 mm.
     * - 실제 크기 × 배치 배율 × 사용자 배율로 놓되, 받침면(진열장 안쪽·유리 덮개 아래)을 넘지 않게 줄인다.
     * - 바닥(회전 후 최저점)을 받침면 높이에 맞추고, 앞뒤·좌우 이동은 받침면 안으로 제한한다. */
    function fitModel(asset,uploaded,first=false){
      const placement=asset.placement||{},mesh=uploaded.mesh;
      let s=MuseumDisplaySupports.supports.get(placement.support);
      if(!s){const p=MuseumGeometry.point(asset.at);s={center:p,u:[1,0],v:[0,1],halfU:.5,halfV:.5,y:placement.baseHeight||0,maxHeight:2};}
      const e=mesh.extent||1,metersPerUnit=e<=5?e:e<=300?e/100:e/1000;
      const bounds=yaw=>{
        const ca=Math.cos(yaw),sa=Math.sin(yaw),tb=uploaded.tilt?-Math.PI/2:0,cb=Math.cos(tb),sb=Math.sin(tb);
        const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],p=mesh.pos;
        for(let i=0;i<p.length;i+=3){
          const x=p[i],y=p[i+1]*cb-p[i+2]*sb,z=p[i+1]*sb+p[i+2]*cb;
          const r=[ca*x+sa*z,y,-sa*x+ca*z];
          for(let k=0;k<3;k++){if(r[k]<min[k])min[k]=r[k];if(r[k]>max[k])max[k]=r[k];}
        }
        return {min,max,size:max.map((v,k)=>Math.max(v-min[k],1e-6))};
      };
      const capOf=b=>Math.min(2*s.halfU*.98/b.size[0],2*s.halfV*.98/b.size[2],s.maxHeight/b.size[1]);
      let b=bounds(uploaded.yaw);
      // 처음 놓을 때는 긴 변이 받침면의 긴 쪽을 따르게 돌린다.
      if(first){const turned=bounds(uploaded.yaw+Math.PI/2);if(capOf(turned)>capOf(b)*1.05){uploaded.yaw+=Math.PI/2;b=turned;}}
      const desired=metersPerUnit*(placement.scale||1)*uploaded.scale,cap=capOf(b),scale=Math.min(desired,cap);
      uploaded.fitted=desired>cap*1.001;
      const limitU=Math.max(0,s.halfU-scale*b.size[0]/2),limitV=Math.max(0,s.halfV-scale*b.size[2]/2);
      uploaded.offsetU=Math.max(-limitU,Math.min(limitU,uploaded.offsetU));
      uploaded.offsetV=Math.max(-limitV,Math.min(limitV,uploaded.offsetV));
      const tu=uploaded.offsetU-scale*(b.min[0]+b.max[0])/2,ty=s.y+.002-scale*b.min[1],tv=uploaded.offsetV-scale*(b.min[2]+b.max[2])/2;
      const ca=Math.cos(uploaded.yaw),sa=Math.sin(uploaded.yaw),tb=uploaded.tilt?-Math.PI/2:0,cb=Math.cos(tb),sb=Math.sin(tb);
      // 받침면 좌표계 회전 R = Ry(yaw)·Rx(tilt), 열 우선.
      const R=[[ca,0,-sa],[sa*sb,cb,ca*sb],[sa*cb,-sb,ca*cb]];
      const basis=c=>[s.u[0]*c[0]+s.v[0]*c[2],c[1],s.u[1]*c[0]+s.v[1]*c[2]];
      const m=new Float32Array(16);
      R.forEach((column,k)=>{const w=basis(column);m[k*4]=w[0]*scale;m[k*4+1]=w[1]*scale;m[k*4+2]=w[2]*scale;});
      m[12]=s.center[0]+s.u[0]*tu+s.v[0]*tv;m[13]=ty;m[14]=s.center[1]+s.u[1]*tu+s.v[1]*tv;m[15]=1;
      uploaded.matrix=m;uploaded.metersPerUnit=scale;
      const hu=scale*b.size[0]/2*1.18,hv=scale*b.size[2]/2*1.18,cu=uploaded.offsetU,cv=uploaded.offsetV;
      const decal=new Float32Array(16);
      decal.set([s.u[0]*hu,0,s.u[1]*hu,0, 0,1,0,0, s.v[0]*hv,0,s.v[1]*hv,0, s.center[0]+s.u[0]*cu+s.v[0]*cv,s.y+.001,s.center[1]+s.u[1]*cu+s.v[1]*cv,1]);
      uploaded.decal=decal;
    }
    /* 유물 명패: 받침면 앞쪽 오른편에 관람객 쪽으로 30° 기울여 세운 작은 설명 카드(16×8cm). */
    const LABEL_NAMES={'bow-strung':'각궁 (얹은활)','bow-unstrung':'부린활','arrow-bundle':'죽시 (대나무 화살)','quiver':'전통 (箭筒)','thumb-ring':'깍지','target':'과녁','pyeonjeon':'편전과 통아','bow-rack':'궁가 (활걸이)','helmet':'투구','arrowheads':'화살촉','materials':'각궁 재료','bow-case':'활집','target-model':'과녁 모형','bow-press':'활 만들기 체험대'};
    function makeLabel(asset,uploaded){
      if(uploaded.label){uploaded.label.mesh.dispose();gl.deleteTexture(uploaded.label.texture);uploaded.label=null;}
      const s=MuseumDisplaySupports.supports.get(asset.placement?.support);
      if(!s||s.id.startsWith('ground:'))return;
      const file=(asset.file?.name||asset.url||'').split('/').pop().replace(/\.[^.]+$/,'');
      const title=asset.isSample?(LABEL_NAMES[file]||file):file;
      const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');
      g.fillStyle='#f3eee2';g.fillRect(0,0,512,256);g.fillStyle='#9b2b1f';g.fillRect(28,34,8,64);
      g.fillStyle='#2a2420';g.font="700 58px 'Noto Serif KR','Nanum Myeongjo','Batang',serif";g.fillText(title,52,92,430);
      g.fillStyle='#6d6257';g.font="400 30px 'Noto Serif KR','Nanum Myeongjo','Batang',serif";
      g.fillText(asset.isSample?'재현 모형 · 예시 전시물':'업로드 전시물',52,150,430);g.fillText(`${asset.room} ${asset.title}`,52,198,430);
      const w=Math.min(.16,s.halfU*2*.5),h=w/2,tilt=30*Math.PI/180;
      const n=[s.v[0]*Math.sin(tilt),Math.cos(tilt),s.v[1]*Math.sin(tilt)],away=[-s.v[0]*Math.cos(tilt),Math.sin(tilt),-s.v[1]*Math.cos(tilt)];
      const along=Math.max(0,s.halfU-w/2-.03),front=Math.max(0,s.halfV-h/2-.02);
      const c0=[s.center[0]+s.u[0]*along+s.v[0]*front,s.y+.006+h/2*Math.sin(tilt),s.center[1]+s.u[1]*along+s.v[1]*front];
      const corner=(su,sv)=>[0,1,2].map(k=>c0[k]+([s.u[0],0,s.u[1]][k])*su*w/2+away[k]*sv*h/2);
      const pts=[corner(-1,1),corner(1,1),corner(1,-1),corner(-1,-1)];
      const mesh=D.upload(gl,{pos:new Float32Array(pts.flat()),nrm:new Float32Array([...n,...n,...n,...n]),uv:new Float32Array([0,1,1,1,1,0,0,0]),idx:new Uint16Array([0,1,2,0,2,3])});
      const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      uploaded.label={mesh,texture,fit:[1,1]};
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
        marker.addEventListener('click',()=>revealAsset(asset.id));
        markerHost.append(marker);assetMarkers.set(asset.id,marker);
        if(!asset.placement.wall)return;
        const version=(assetVersions.get(asset.id)||0)+1;assetVersions.set(asset.id,version);
        const image=new Image();
        image.onload=()=>{
          if(assetVersions.get(asset.id)!==version||MuseumAssetFiles.get(asset.id)!==asset)return;
          const relief=asset.placement.wallType==='relief-display';
          const niche=asset.placement.wallType==='niche-display';
          const curved=asset.placement.wallType==='curved-display';
          const surface=curved?null:MuseumDisplaySupports.imageSurface(asset.placement);
          if(!curved){
            if(!surface){showAssetError(asset.id,niche?'연결된 유리 진열장 위치를 찾을 수 없습니다.':'연결된 액자 위치를 찾을 수 없습니다.');return;}
            // 진열장 뒷벽·매입부 뒷벽·액자 안쪽 면(display-supports.js)에 붙인다.
            const topA=surface.a,topB=surface.b,top=surface.top,bottom=surface.bottom;
            const positions=[topA[0],top,topA[1],topB[0],top,topB[1],topB[0],bottom,topB[1],topA[0],bottom,topA[1]];
            const normal=[surface.normal[0],0,surface.normal[1]];
            const leftU=asset.placement.flipX?1:0,rightU=1-leftU;
            const mesh=D.upload(gl,{pos:new Float32Array(positions),nrm:new Float32Array([...normal,...normal,...normal,...normal]),
              uv:new Float32Array([leftU,1,rightU,1,rightU,0,leftU,0]),idx:new Uint16Array([0,1,2,0,2,3])});
            const texture=gl.createTexture();
            gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
            const previous=uploadedWallImages.get(asset.id);
            if(previous){previous.mesh.dispose();gl.deleteTexture(previous.texture);}
            uploadedWallImages.set(asset.id,{mesh,texture,fit:imageFit(image,Math.hypot(topB[0]-topA[0],topB[1]-topA[1]),top-bottom)});
            return;
          }
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
        const uploaded={renderGpu,mesh,scale:1,yaw:0,tilt:false,offsetU:0,offsetV:0};
        fitModel(asset,uploaded,true);
        makeLabel(asset,uploaded);
        uploadedModels.set(asset.id,uploaded);modelRevision++;
        document.dispatchEvent(new CustomEvent('museumassetready',{detail:{id:asset.id,fitted:uploaded.fitted}}));
      }catch(e){showAssetError(asset.id,e.message);}
    });
    document.addEventListener('museumassettransform',event=>{
      const {id,scale,rotationDelta,positionDelta,tiltToggle}=event.detail||{};
      const uploaded=uploadedModels.get(id),asset=MuseumAssetFiles.get(id);
      if(!uploaded||!asset)return;
      if(Number.isFinite(scale))uploaded.scale=scale;
      if(Number.isFinite(rotationDelta))uploaded.yaw+=rotationDelta;
      if(tiltToggle)uploaded.tilt=!uploaded.tilt;
      // 위치는 받침면 기준: [오른쪽(+)/왼쪽(-), 앞(+)/안쪽(-)] 미터.
      if(Array.isArray(positionDelta)&&positionDelta.length===2&&positionDelta.every(Number.isFinite)){
        uploaded.offsetU+=positionDelta[0];
        uploaded.offsetV+=positionDelta[1];
      }
      fitModel(asset,uploaded);modelRevision++;
      document.dispatchEvent(new CustomEvent('museumassetfit',{detail:{id,fitted:uploaded.fitted}}));
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
      if(modelAsset){modelAsset.renderGpu.dispose();if(modelAsset.label){modelAsset.label.mesh.dispose();gl.deleteTexture(modelAsset.label.texture);}uploadedModels.delete(id);modelRevision++;}
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
    function draw(mesh,m,color,alpha=1,textured=false,surface=0,assetImage=null,vertexColor=false){gl.uniform1i(U.uVertexColor,vertexColor?1:0);gl.uniformMatrix4fv(U.uModel,false,m);gl.uniformMatrix3fv(U.uNormal,false,M.normalFrom(m));gl.uniform3fv(U.uColor,color);gl.uniform1f(U.uAlpha,alpha);gl.uniform1i(U.uSurface,surface);gl.uniform1i(U.uFloorTexture,textured&&woodReady?1:0);gl.uniform1i(U.uUseAssetTexture,assetImage?1:0);if(assetImage){gl.uniform2fv(U.uImageFit,assetImage.fit);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,assetImage.texture);gl.uniform1i(U.uAssetTexture,1);}gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);}
    const normalize=v=>{const length=Math.hypot(...v)||1;return v.map(value=>value/length);};
    const subtract=(a,b)=>a.map((value,index)=>value-b[index]);
    const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);
    function modelHitDistance(origin,direction,asset,uploaded){
      const mesh=uploaded.mesh,m=uploaded.matrix;
      let nearest=Infinity;
      const world=index=>{
        const x=mesh.pos[index*3],y=mesh.pos[index*3+1],z=mesh.pos[index*3+2];
        return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
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
      MuseumLighting.tick(dt);
      const env=MuseumLighting.environment();
      renderShadows(env);
      const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      gl.viewport(0,0,w,h);
      // 배경: 실외·조감도는 시간에 따른 하늘색, 1인칭 실내는 천장이 있다고 보고 실내 천장 밝기.
      {const e=(lastCamera||controls.camera()).eye,inside=controls.state.mode==='interior'&&MuseumLighting.isIndoor(e[0],e[2]),bg=inside?env.indoorEnv:env.skyColor;gl.clearColor(bg[0],bg[1],bg[2],1);}
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
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
      MuseumLighting.setCamera(camera.eye);
      const lights=MuseumLighting.pack(camera.eye);
      gl.uniform1i(U.uLightCount,lights.count);gl.uniform4fv(U.uLightPos,lights.pos);gl.uniform4fv(U.uLightDir,lights.dir);gl.uniform4fv(U.uLightColor,lights.color);gl.uniform4fv(U.uLightBounds,lights.bounds);
      gl.uniform3fv(U.uSunDir,env.sunDir);gl.uniform3fv(U.uSunColor,env.sunColor);gl.uniform3fv(U.uSkyAmbient,env.skyAmbient);gl.uniform3fv(U.uSkyColor,env.skyColor);
      gl.uniform3fv(U.uIndoorEnv,env.indoorEnv);gl.uniform1f(U.uIndoorAmbient,env.indoorAmbient);gl.uniformMatrix4fv(U.uSunVP,false,sunVP);gl.uniform1i(U.uShadowOn,env.sunDir[1]>-.05?1:0);
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,maskTexture);gl.uniform1i(U.uMask,2);gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,aoTexture);gl.uniform1i(U.uAO,5);gl.uniform1f(U.uExposure,MuseumLighting.state.exposure);gl.uniform1i(U.uCeilingOn,1);gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,roomTexture);gl.uniform1i(U.uRoomMap,4);gl.uniform4fv(U.uMaskBounds,maskBounds);
      gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,shadowTexture);gl.uniform1i(U.uShadow,3);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,woodTexture);gl.uniform1i(U.uWood,0);gl.uniform3fv(U.uEye,camera.eye);gl.uniform4fv(U.uWoodBounds,[...woodMin,...woodMax]);gl.uniform2fv(U.uWoodTile,woodRegion.tileSize);
      gl.uniform4fv(U.uGrassBounds,[...MuseumGeometry.point([492,480]),...MuseumGeometry.point([900,584])]);gl.uniform2fv(U.uGrassNotch,MuseumGeometry.point([552,496]));
      for(const f of model.floors){if(!f.renderGpu)continue;draw(f.renderGpu,identity,f.color,1,f.group==='floor',MuseumMaterials.classify(f));}
      if(controls.state.mode==='interior')draw(ceilingMesh,identity,[.9,.9,.88],1,false,5);
      for(const p of model.parts){if(['glass','displayGlass'].includes(p.group))continue;draw(p.renderGpu,matrix(p),p.color,1,false,MuseumMaterials.classify(p));}
      // 얇은 유리판은 불투명 부재 뒤에, 카메라에서 먼 순서로 그린다.
      const distance=p=>p.position.reduce((s,v,i)=>s+(v-camera.eye[i])**2,0);
      drawFixtures();
      // 유리 안쪽 유물과 사진을 먼저 그리고, 반투명 유리는 마지막에 카메라에서 먼 순서로 덮는다.
      for(const uploaded of uploadedModels.values())draw(uploaded.renderGpu,uploaded.matrix,[.42,.36,.28],1,false,0,null,Boolean(uploaded.mesh.col));
      // 유물 접지 그림자: 받침면 위에 부드러운 타원을 깐다(실내 조명은 그림자 지도를 쓰지 않으므로 접촉 그림자로 대신).
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      for(const uploaded of uploadedModels.values())if(uploaded.decal)draw(decalMesh,uploaded.decal,[0,0,0],.42,false,8);
      gl.depthMask(true);gl.disable(gl.BLEND);
      for(const uploaded of uploadedWallImages.values())draw(uploaded.mesh,identity,[1,1,1],1,false,0,uploaded);
      for(const uploaded of uploadedModels.values())if(uploaded.label)draw(uploaded.label.mesh,identity,[1,1,1],1,false,0,uploaded.label);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      for(const p of model.parts.filter(p=>['glass','displayGlass'].includes(p.group)).sort((a,b)=>distance(b)-distance(a)))draw(p.renderGpu,matrix(p),p.color,p.alpha);
      gl.depthMask(true);gl.disable(gl.BLEND);
      for(const [id,marker] of assetMarkers){
        const asset=MuseumAssetFiles.get(id);if(!asset)continue;
        const at=MuseumGeometry.point(asset.at),anchor=[at[0],.06,at[1]];
        const clip=[0,1,2,3].map(i=>vp[i]*anchor[0]+vp[4+i]*anchor[1]+vp[8+i]*anchor[2]+vp[12+i]);
        const x=clip[0]/clip[3],y=clip[1]/clip[3];
        marker.hidden=!controls.state.orthographic||controls.state.mode==='interior'||clip[3]<=0||Math.abs(x)>1||Math.abs(y)>1;
        marker.style.left=(x*.5+.5)*r.width+'px';marker.style.top=(-y*.5+.5)*r.height+'px';
      }
      for(const location of locationMarkers.values()){
        const at=MuseumGeometry.point(location.at),anchor=[at[0],.09,at[1]];
        const clip=[0,1,2,3].map(i=>vp[i]*anchor[0]+vp[4+i]*anchor[1]+vp[8+i]*anchor[2]+vp[12+i]);
        const x=clip[0]/clip[3],y=clip[1]/clip[3];
        location.element.hidden=!controls.state.orthographic||controls.state.mode==='interior'||
          clip[3]<=0||Math.abs(x)>1||Math.abs(y)>1;
        location.element.style.left=(x*.5+.5)*r.width+'px';
        location.element.style.top=(-y*.5+.5)*r.height+'px';
      }
      waypointControls.update(vp,r);
      MuseumLighting.updateMarkers(vp,r,controls.state.orthographic&&controls.state.mode!=='interior');
      minimap.update(camera,controls.state,r);
      for(const {el,p} of labels){const anchor=controls.state.mode==='interior'?[p[0],1.85,p[2]]:p,clip=[0,1,2,3].map(i=>vp[i]*anchor[0]+vp[4+i]*anchor[1]+vp[8+i]*anchor[2]+vp[12+i]),x=clip[0]/clip[3],y=clip[1]/clip[3];el.hidden=clip[3]<=0||Math.abs(x)>1||Math.abs(y)>1||(controls.state.mode==='interior'&&labelVisibility.countWalls(camera.eye,anchor)>1);el.style.left=(x*.5+.5)*r.width+'px';el.style.top=(-y*.5+.5)*r.height+'px';}
    });
    window.MuseumViewer={gl,model,controls,home,exhibits:uploadedModels,wallImages:uploadedWallImages,groundNavigation:waypointControls,partMatrix:matrix,get camera(){return lastCamera;},get surfaceStats(){return surfaceStats;},get woodReady(){return woodReady;}};
  } catch(e){error.hidden=false;error.textContent=e.message;console.error(e);}
})();
