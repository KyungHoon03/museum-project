/* VR 순회 및 4방향 사진 대조에 따른 상세. 모든 위치/치수는 상대 비율 근사.
 * 전시대와 건축 장식은 보존하되 전시품·인쇄물·모니터는 생성하지 않는다. */
(()=>{
 const d=MuseumLayout;
 d.detailBoxes=[
  {id:'reception-body',at:[255,404],size:[3.15,.94,1.10],color:[.83,.84,.79],room:'bow'},
  {id:'reception-top',at:[255,404],bottom:.94,size:[3.22,.09,1.17],color:[.83,.84,.79],room:'bow'},
  {id:'reception-return',at:[218,414],size:[.60,.94,.80],color:[.83,.84,.79],room:'bow'}
 ];
 d.frames.push(
  {id:'entrance-glass-north',a:[205,318],b:[205,350],height:2.5,divisions:1,glazed:true,room:'bow',evidence:'상단·내부 캠 대조: 표찰 벽 쪽 유리 전실. 남쪽 책상과 문 위치를 함께 대응'},
  {id:'entrance-glass-south',a:[205,383],b:[205,496],height:2.5,divisions:3,glazed:true,room:'bow',evidence:'상단·내부 캠 대조: 문 남쪽에 안내 책상. 유리 전실 전체 꺾임은 별도 확인 필요'}
 );
 d.walls.push({id:'entrance-transom',a:[205,318],b:[205,496],bottom:2.5,height:2.8,thickness:.14,room:'bow',evidence:'기존 유리 전실의 상부 연결부. 출입구 아래는 개방 유지'});
 d.detailArches=[{id:'video-route-arch',a:[294,305],b:[400,305],spring:2.18,rise:.38,depth:.14,thickness:.14,posts:true,room:'bow',evidence:'하향 90도 회전한 구분벽 끝 (400,305)에 아치 기둥을 맞춰 직각 접합'}];
 d.detailRibbons=[];
 // 사용자 표시: 양쪽 활대의 볼록한 곡선과 중앙 안쪽 손잡이 꺾임을 가진 활 윤곽.
 // 높이 방향 아치가 아니라 상단 평면에서의 목재 전면 윤곽이다.
 const bowSegments=[
   [[350,310],[344,320],[330,330],[333,342]],
   [[333,342],[335,350],[352,354],[358,360]],
   [[358,360],[352,366],[335,370],[333,378]],
   [[333,378],[330,390],[344,400],[350,410]]
 ];
 const bowPath=[];
 for(const [segment,points] of bowSegments.entries())for(let i=segment?1:0;i<=16;i++){
   const t=i/16,u=1-t;bowPath.push([0,1].map(k=>u*u*u*points[0][k]+3*u*u*t*points[1][k]+3*u*t*t*points[2][k]+t*t*t*points[3][k]));
 }
 d.detailRibbons.push({id:'bow-left',path:bowPath,bottom:2.38,height:.30,width:5,room:'bow',evidence:'사용자 붉은 윤곽: 두 활대 곡선과 중앙 손잡이의 안쪽 꺾임'});
 d.detailRibbons.push({id:'bow-right',path:[[488,310],[488,410]],bottom:2.38,height:.30,width:5,room:'bow'});
 d.detailRails=[];
 for(let z=310;z<=410;z+=20){
   const index=bowPath.findIndex(p=>p[1]>=z),a=bowPath[Math.max(0,index-1)],b=bowPath[index];
   const x=b[1]===a[1]?b[0]:a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]);
   d.detailRails.push({id:'bow-cross-'+z,a:[x,z],b:[488,z]});
 }
 for(let x=373;x<488;x+=23)d.detailRails.push({id:'bow-long-'+x,a:[x,310],b:[x,410]});
 // 체험마루 서측 통로 끝에서 야외 방향으로 이어지는 작은 유리문.
 d.shell.find(w=>w.id==='shell-bow-south').openings=[{from:.022,to:.085,height:2.18,kind:'glazed',divisions:1,note:'VR 통로 끝 유리문. 남측 벽의 위치와 폭은 사진 대응 근사'}];
 d.displays=[
  {id:'bow-central-platform',at:[(333+442-.08/d.scale)/2,369],size:[(442-333)*d.scale-.08,.22,2.6],topOverhang:0,type:'platform',room:'bow',evidence:'사용자 추가 지시: 서측 활 구조물 X333까지 빈 공간을 채움. 동측 끝은 뒤 벽 실내 면에 맞춤'},
  {id:'bow-north-case',at:[172,335],size:[2.0,.68,.60],type:'low',room:'bow'},
  {id:'donated-workbench',at:[1039,403],size:[.97,.78,.67],type:'platform',room:'donated'},
  {id:'donated-small-south',at:[1075,404],size:[.69,.68,.54],type:'low',room:'donated'},
  {id:'donated-north-horizontal',at:[1124,266],size:[1.52,.70,.60],type:'low',room:'donated'},
  {id:'donated-peninsula-side',at:[1062,285],size:[.55,.70,1.52],type:'low',room:'donated'},
  {id:'donated-peninsula-square',at:[1082,335],size:[.98,.70,1.02],type:'low',room:'donated'},
  {id:'donated-south-right',at:[1124,407],size:[1.50,.70,.47],type:'low',room:'donated'}
 ];
 // 첨부 내부 사진의 기둥 사이는 유리 상자가 아니라 양면 접근형 목재 테이블.
 d.galleryTables=[
  {id:'gallery-table-1',a:[407,175],b:[541,175],depth:.90,height:.90,room:'long'},
  {id:'gallery-table-2',a:[555,175],b:[683,175],depth:.90,height:.90,room:'long'}
 ];
 d.displays.push({id:'horse-platform',at:[270+(d.wallThickness+4.15/2)/d.scale,24+(d.wallThickness+2.65/2)/d.scale],size:[4.15,.26,2.65],topOverhang:0,type:'platform',room:'long',evidence:'사용자 표시: 서측·북측 벽 실내 면에 빈틈 없이 붙인 대형 전시대'});
 // 벽 매입부: 뒤벽·측벽·상인방과 하부 받침을 갖는 두꺼운 내부 벽 라이닝.
 // 외벽을 투명 상자로 바꾸지 않는다. 전면 유리만 별도 생성한다.
 d.niches=[
  {id:'donated-peninsula-recess',a:[1093,256],b:[1093,317],inward:[-1,0],depth:.65,sill:.55,top:2.45,room:'donated',evidence:'사용자 제공 확대 상단도: 중앙 상부 세로 진열부. 하단 정사각 진열대와 분리. 높이는 기존 VR 근사'},
  {id:'donated-west-lower-recess',a:[989,338],b:[989,413],inward:[1,0],depth:.85,sill:.60,top:2.45,room:'donated',evidence:'사용자 제공 확대 상단도: 좌하단 긴 진열부. 상부까지 연장하지 않음'},
 ];
 for(const [i,ends] of [[407,541],[555,683],[697,811],[827,953]].entries()){
  d.niches.push({id:'gallery-tall-wall-'+i,a:[ends[0],29],b:[ends[1],29],inward:[0,1],depth:.65,sill:.25,top:2.50,room:'long',evidence:'첨부 내부 사진 3: 외벽 쪽 긴 받침과 상하로 긴 진열 공간. 낮은 독립 유리 상자로 표현하지 않음'});
 }
 // 오른쪽 끝 (400,175)을 고정한 하향 90도 회전: (x,z) → (400+z-175,175+400-x).
 d.walls.push({id:'gallery-transition',a:[400,305],b:[400,175],height:2.8,thickness:.18,room:'long',evidence:'사용자 빨간 선 지시: 오른쪽 끝을 고정하고 문·진열부를 아래로 90도 회전. 문짝·족자 없음',openings:[{from:.42,to:.73,height:2.30,kind:'opening',note:'회전 전과 동일한 폭과 상대 위치의 열린 문'}]});
 d.niches.push({id:'gallery-transition-display',a:[405,299],b:[405,257],inward:[1,0],depth:.42,sill:.45,top:2.30,room:'long',evidence:'문과 같은 기준점으로 90도 회전한 빈 세로 전시대. 높이·폭·깊이 유지'});
 d.beams.push({id:'gallery-to-bow-joint',a:[400,305],b:[400,310],bottom:2.42,height:.11,thickness:.14,evidence:'회전한 구분벽·아치 기둥과 기존 하부 격자 북측 보 사이의 짧은 접합부'});
 // 확대 상단도 x=186→153→58의 좌상단 꺾임을 기존 건물 좌표에 대응.
 // 벽선 바깥 좌상단은 인접 서비스/연결 영역이며 전시실을 직사각형으로 채우지 않는다.
 d.walls.push(
  {id:'donated-west-upper',a:[1028,256],b:[1028,326],thickness:.16,room:'donated',evidence:'제공 상단도: 좌상단 수직 벽선'},
  {id:'donated-west-jog-a',a:[1028,326],b:[1017,326],thickness:.16,room:'donated',evidence:'제공 상단도: 좌상단 벽의 첫 꺾임'},
  {id:'donated-west-jog-b',a:[1017,326],b:[1017,337],thickness:.16,room:'donated',evidence:'제공 상단도: 좌하단 진열부 위 되돌림'},
  {id:'donated-west-shoulder',a:[1017,337],b:[980,337],thickness:.16,room:'donated',evidence:'제공 상단도: 좌하단으로 넓어지는 공간 경계'}
 );
 d.walls.find(w=>w.id==='donated-entry').openings=[{from:48/165,to:88/165,height:2.25,kind:'opening',note:'제공 확대 상단도의 상부 진입부에 맞춰 이동. 좌표는 기존 전체 평면과의 대응 근사'}];
 d.shell.find(w=>w.id==='shell-donated-east').openings=[{from:.18,to:.40,height:2.4,kind:'opening',note:'제공 상단도 오른쪽 상부의 열린 연결부. 긴 벽은 그 아래에서 시작. 외측 연결 영역은 화면 밖이라 추가하지 않음'}];
 const donated=d.rooms.find(r=>r.id==='donated');
 donated.polygon=[[1028,256],[1145,256],[1145,414],[980,414],[980,337],[1017,337],[1017,326],[1028,326]];
 donated.note='사용자 제공 확대 평면도에 따라 좌상단 꺾임, 중앙 반도형 진열부, 좌하단 긴 진열부와 하단 책상을 재배치. 치수는 상대 비율 근사';
 // VR 전체 평면과 출입문을 기준으로 첨부 평면을 반시계 90도 정합.
 // 직사각 기존 외곽(165×158)에 맞춰 정규화하고 바닥/인접 전시실은 유지한다.
 const turn=p=>[980+(p[1]-256)*165/158,256+(1145-p[0])*158/165];
 const direction=v=>[v[1],-v[0]];
 for(const display of d.displays.filter(v=>v.room==='donated')){
   display.at=turn(display.at);
   const [w,h,depth]=display.size;display.size=[depth*165/158,h,w*158/165];
 }
 for(const niche of d.niches.filter(v=>v.room==='donated')){
   niche.a=turn(niche.a);niche.b=turn(niche.b);niche.inward=direction(niche.inward);
   niche.evidence+='; VR 문 방향을 기준으로 반시계 90도 정합';
 }
 for(const wall of d.walls.filter(v=>v.id.startsWith('donated-west-'))){wall.a=turn(wall.a);wall.b=turn(wall.b);}
 donated.polygon=donated.polygon.map(turn);
 donated.note='VR 전체 평면에 맞게 첨부 평면을 반시계 90도 정합. 중앙 복도 쪽(전체 평면 위쪽) 출입구와 내부 배치 대응';
 const entry=d.walls.find(w=>w.id==='donated-entry');
 entry.openings=[{from:(turn([1145,274.6])[0]-980)/165,to:(turn([1145,312])[0]-980)/165,height:2.4,kind:'opening',note:'첨부 평면 오른쪽 위 개방부를 반시계 90도 정합한 중앙 복도 방향 출입구. VR 문틀 너머 복도 확인'}];
 delete d.shell.find(w=>w.id==='shell-donated-east').openings;
 d.walls.push({id:'bow-worktop-backing',a:[442,320],b:[442,410],height:2.55,thickness:.16,room:'bow',evidence:'사용자 1번 빨간 선 지시: 벽과 작업대를 왼쪽으로 이동. 이전 x=478 배치는 폐기'});
 // 근접 사진의 벽 부착형 작업대. 동측 두 앞 모서리만 둥글게 처리.
 function roundedFront(back,front,north,south,r){
  const p=[[back,north],[front-r,north]];
  for(let i=1;i<=8;i++){const t=-Math.PI/2+i*Math.PI/16;p.push([front-r+r*Math.cos(t),north+r+r*Math.sin(t)]);}
  p.push([front,south-r]);
  for(let i=1;i<=8;i++){const t=i*Math.PI/16;p.push([front-r+r*Math.cos(t),south-r+r*Math.sin(t)]);}
  p.push([back,south]);return p;
 }
 d.detailExtrusions=[
  {id:'maru-worktop-plinth',polygon:roundedFront(444,460,332,402,5),bottom:.12,height:.54,color:[.79,.77,.71],room:'bow'},
  {id:'maru-worktop-kick',polygon:roundedFront(445,459,333,401,5),bottom:.045,height:.075,color:[.20,.21,.20],room:'bow'},
  {id:'maru-worktop',polygon:roundedFront(442,464,329,405,6),bottom:.66,height:.20,color:[.44,.27,.15],room:'bow'},
  {id:'maru-worktop-surface',polygon:roundedFront(442,464,329,405,6),bottom:.86,height:.035,color:[.61,.42,.24],room:'bow'}
 ];
 d.reliefDisplays=[{id:'bow-relief-wall',a:[550,315],b:[550,415],inward:[-1,0],depth:.24,bottom:.45,top:2.35,room:'bow',evidence:'사용자 2번 지시: 체험마루 서측 벽에 통합된 부조용 빈 전시부. 부조 자체는 생성하지 않음'}];
 // 기획전시실 앞 흰 구분벽과 오목한 전시부. 체험장 입구는 서측에 확보.
 d.walls.push(
  {id:'immersive-west',a:[818,24],b:[818,175],thickness:.18,room:'immersive',evidence:'사용자 붉은 영역: 북측 벽면 전시대 끝까지 입구를 확장. 기존 남측 문설주와 상부 보는 유지',openings:[{from:26/151,to:.95,height:2.30,kind:'opening',note:'전시대 끝 Z50부터 기존 출입구 남측 끝까지 하나로 연결한 넓은 열린 입구'}]},
  {id:'immersive-front',a:[818,175],b:[1056,175],thickness:.50,room:'immersive',evidence:'첨부 촬영 사진의 기획전시실 앞 흰 분리벽. 오목한 전시부는 작품 없이 비움',openings:[{from:.34,to:.82,sill:.65,height:2.15,kind:'recess',recessDirection:[0,-1],note:'통과하는 문이 아닌 막힌 뒷면을 가진 벽 전시 홈. 모서리는 직각 근사'}]},
  {id:'immersive-east-return',a:[1056,175],b:[1056,118],thickness:.18,room:'immersive',evidence:'기존 외곽의 북동측 꺾임으로 구분벽을 연결. 측면 세부 길이는 근사'}
 );
 d.rooms.find(r=>r.id==='long').name='상부 전시 영역';
 d.rooms.find(r=>r.id==='long').polygon=[[270,24],[818,24],[818,175],[270,175]];
 d.rooms.push({id:'immersive',name:'실감형체험장',color:[.67,.70,.73],polygon:[[818,24],[970,24],[970,118],[1056,118],[1056,175],[818,175]],note:'기획전시실 앞을 흰 벽으로 구분한 별도 공간. 서측 열린 출입구, 전면 벽의 빈 전시 홈. 치수는 사진 대응 근사'});
 d.niches.find(n=>n.id==='gallery-tall-wall-3').room='immersive';
 d.shell.find(w=>w.id==='shell-projection').room='immersive';
 // 사용자 빨간 선: 북동측 빈 꺾임을 채워 체험장 전체를 직사각형으로 확장.
 d.shell.find(w=>w.id==='shell-north').b=[1056,24];
 Object.assign(d.shell.find(w=>w.id==='shell-projection'),{a:[1056,24],b:[1056,118],evidence:'사용자 공간 확장 지시: 직사각 체험장 동측 투사벽으로 이동'});
 d.shell.find(w=>w.id==='shell-northeast-return').a=[1056,118];
 for(const polygon of [d.floor.polygon,d.envelope])for(const p of polygon){
  if(p[0]===970&&(p[1]===24||p[1]===118))p[0]=1056;
 }
 const immersive=d.rooms.find(r=>r.id==='immersive');
 immersive.polygon=[[818,24],[1056,24],[1056,175],[818,175]];
 immersive.note='사용자 빨간 선에 따라 북동측 빈 부분을 확장한 직사각형 체험장. 서측 출입구와 전면 전시 홈 유지';
 // 복도 끝과 기증전시실 사이 12px 틈을 닫고 그 뒤 좁은 잔여 바닥을 제거한다.
 d.shell.find(w=>w.id==='shell-east-door').b=[1120,256];
 Object.assign(d.shell.find(w=>w.id==='shell-east-step'),{a:[1120,256],b:[1145,256]});
 d.shell.find(w=>w.id==='shell-donated-east').a=[1145,256];
 for(const polygon of [d.floor.polygon,d.envelope])for(const p of polygon){
  if((p[0]===1120||p[0]===1145)&&p[1]===244)p[1]=256;
 }
 // 회전한 전시실의 꺾인 후면을 실제 외곽으로 사용해, 뒤의 닫힌 주머니 공간도 없앤다.
 const backWalls=['donated-west-shoulder','donated-west-jog-b','donated-west-jog-a','donated-west-upper'].map(id=>d.walls.find(w=>w.id===id));
 const southIndex=d.shell.findIndex(w=>w.id==='shell-donated-south');
 const backBoundary=backWalls.map(w=>({...w,a:[...w.b],b:[...w.a]}));
 const backEnd=backBoundary[backBoundary.length-1].b;
 d.shell.splice(southIndex,2,
  {id:'shell-donated-south',a:[1145,414],b:[...backBoundary[0].a],inset:[0,-1],room:'donated'},
  ...backBoundary,
  {id:'shell-donated-step',a:[...backEnd],b:[980,394],inset:[-1,0],room:'planned'});
 d.walls=d.walls.filter(w=>!backWalls.includes(w));
 d.envelope=d.shell.map(w=>[...w.a]);
 const floorStart=d.floor.polygon.findIndex(p=>p[0]===1145&&p[1]===414);
 d.floor.polygon.splice(floorStart+1,1,...backBoundary.map(w=>[...w.a]),[...backEnd]);
 d.walls.find(w=>w.id==='gallery-transition').thickness=.44;
 // 아치 오른쪽 기둥(400,305)의 동쪽 돌출면보다 뒤로 물린 홈에서 시작한다.
 // 전시대 사이 틈을 ㄱ자로 막고 X442의 작업대 뒤 벽에 연결한다.
 const notchX=400+.22/d.scale;
 d.walls.push(
   {id:'bow-recess-return',a:[notchX,301],b:[442,301],height:2.55,thickness:.16,room:'bow',evidence:'사용자 표시 ㄱ자: 기둥 동쪽 홈에서 시작하여 기둥 전면은 노출'},
   {id:'bow-recess-side',a:[442,301],b:[442,320],height:2.55,thickness:.16,room:'bow',evidence:'사용자 표시 ㄱ자: 작업대 뒤 벽 시작점(442,320)에 접합'}
 );
 // 아치 옆 사진은 벽걸이 함이 아니라 바닥에 닿는 목재 하부장 + 낮은 상부 유리장.
 d.wallCases=[];
 d.displays.push({id:'arch-corridor-case',at:[400-(.22+.30)/d.scale,280],size:[.60,.85,38*d.scale],type:'low',room:'long',evidence:'사용자 근접 사진 정정: 바닥부터 목재 하부장, 밝은 상판 위 낮은 유리 진열부. 벽걸이 형태 아님'});
 // 테이블 진행 방향(X)에 수직인 벽(Z). 가운데 벽에는 장을 달지 않는다.
 for(const x of [400,548,690]){
  d.walls.push({id:'gallery-display-pier-'+x,a:[x,155],b:[x,195],thickness:.44,height:2.8,room:'long',evidence:'사용자 정정: 목재 테이블의 진행방향에 수직인 벽. 가운데 벽에는 전시대 없음'});
  if(x!==548){
   const side=x===400?-1:1,face=x+side*.22/d.scale;
   d.wallCases.push({id:'gallery-hanging-case-'+x,a:[face,160],b:[face,190],inward:[side,0],depth:.38,bottom:.65,top:2.20,room:'long'});
  }
 }
 Object.assign(d.galleryTables[0],{a:[400+.22/d.scale,175],b:[548-.22/d.scale,175]});
 Object.assign(d.galleryTables[1],{a:[548+.22/d.scale,175],b:[690-.22/d.scale,175]});
 // 상단도 분홍 선: 테이블 양쪽 끝을 가로 구분벽의 바깥 끝(Z155~195)에 정렬.
 for(const table of d.galleryTables)table.depth=(195-155)*d.scale;
 // 사용자 표시: 주 전시실 오른쪽 끝의 벽걸이 함을 기단+통유리 대형 진열장으로 교체.
 d.wallCases=d.wallCases.filter(c=>c.id!=='gallery-hanging-case-690'&&c.id!=='gallery-hanging-case-400');
 const videoShowcaseWall=400-.22/d.scale;
 d.wallCases.push({id:'video-point-4-showcase',a:[videoShowcaseWall,160],b:[videoShowcaseWall,190],inward:[-1,0],depth:.38,bottom:.65,top:2.20,glassOnly:true,room:'long',evidence:'영상실 4번 점 오른쪽 벽에 붙인 3D 에셋용 유리 진열장. 기존 벽걸이 목재 함체를 제거'});
 d.glassCases=[{id:'gallery-end-showcase',a:[690+.22/d.scale,155],b:[690+.22/d.scale,195],inward:[1,0],depth:1.15,baseHeight:.45,top:d.columns.find(c=>c.id==='gallery-pier-3').height,room:'long',evidence:'사용자 붉은 표시: 기둥 상단 높이까지 통유리. 돌출1.15, 옆 구획까지 통로 약2.89 유지'}];
 // 외피는 항상 경계 안쪽으로 두께를 두어 꺾인 구간의 바깥면을 일치시킨다.
 for(const w of d.shell){const dx=w.b[0]-w.a[0],dz=w.b[1]-w.a[1],len=Math.hypot(dx,dz);w.inset=[-dz/len,dx/len];}
 d.walls.find(w=>w.id==='maru-west').inset=[-1,0];
 d.walls.find(w=>w.id==='planned-east').inset=[-1,0];
 d.walls.find(w=>w.id==='planned-entry').inset=[0,-1];
 // 남측 외벽의 실내 면에서 끝내어 전실 프레임이 외벽을 관통하지 않게 한다.
 d.frames.find(f=>f.id==='entrance-glass-south').b=[205,496-(d.wallThickness+.055)/d.scale];
 // 사용자 표시: 남측 유리의 첫 칸을 열고 안내 테이블을 같은 한 칸만큼 아래로 이동.
 const entranceSouth=d.frames.find(f=>f.id==='entrance-glass-south');
 const entranceBay=(entranceSouth.b[1]-entranceSouth.a[1])/entranceSouth.divisions;
 entranceSouth.a=[205,entranceSouth.a[1]+entranceBay];entranceSouth.divisions=2;
 for(const item of d.detailBoxes.filter(p=>p.id.startsWith('reception-')))item.at[1]+=entranceBay;
 d.walls.find(w=>w.id==='entrance-transom').b=[205,496-d.wallThickness/d.scale];
 // 사용자 빨간 테두리: 체험마루 남측을 따라 넓힌 야외 마당과 낮은 경계벽.
 d.eyeHeight=1.575;
 d.floor.woodRegion={bounds:[552,256,790,480],tileSize:[2.4,2.4],asset:'maruWood'};
 const terrace=d.rooms.find(r=>r.id==='outdoor');
 terrace.name='야외체험장';
 terrace.polygon=[[492,496],[552,496],[552,480],[900,480],[900,584],[492,584]];
 terrace.note='사용자 지정 확장 마당. 열린 서측 쪽문으로 출입하며 높이 0.63의 경계벽은 통과할 수 없음';
 d.outdoorGrass={id:'outdoor-turf',polygon:terrace.polygon.map(p=>[...p]),height:.002,spacing:.28,bladeHeight:.035,color:[.24,.39,.13],room:'outdoor'};
 const terraceStart=d.floor.polygon.findIndex(p=>p[0]===790&&p[1]===480);
 const terraceEnd=d.floor.polygon.findIndex(p=>p[0]===492&&p[1]===496);
 d.floor.polygon.splice(terraceStart+1,terraceEnd-terraceStart,[900,480],[900,584],[492,584],[492,496]);
 const boundary=[[492,496],[492,584],[900,584],[900,480],[790,480]];
 for(let i=0;i<boundary.length-1;i++)d.walls.push({id:'outdoor-boundary-'+i,a:boundary[i],b:boundary[i+1],height:d.eyeHeight*.4,thickness:.16,room:'outdoor',evidence:'사용자 빨간 테두리: 카메라 높이 0.4배의 통과 불가능한 낮은 경계벽'});
 Object.assign(d.shell.find(w=>w.id==='shell-bow-south').openings[0],{kind:'opening',note:'사용자 체크한 쪽문: 유리 없이 야외로 걸어서 통과'});
 const roomNames={bow:'중앙 로비',video:'영상실',long:'주 전시실',link:'중앙 복도'};
 const entryPoints={bow:[320,420],video:[185,260],long:[620,110],link:[610,220],maru:[650,350],planned:[910,325],donated:[1100,290],outdoor:[700,540],immersive:[930,110]};
 for(const room of d.rooms){if(roomNames[room.id])room.name=roomNames[room.id];room.entryAt=entryPoints[room.id];}
 d.unresolved=d.unresolved.filter(s=>!s.includes('전시품·전시대'));
 d.unresolved.push('전시대·입구 책상·활 모양 천장·동선 아치를 추가. 전시품과 인쇄물은 제외. 위치·곡률·개수는 관찰에 따른 근사이며 실측 복제는 아님');
 // 족자 설치 예정 통로: 렌더링하지 않는 이동 차단면.
 d.navigationBarriers=[{id:'scroll-passage-blocker',a:[400,210],b:[400,251],height:2.8,thickness:.18}];
 const circle=(x,z,r)=>Array.from({length:48},(_,i)=>[x+Math.cos(i*Math.PI/24)*r,z+Math.sin(i*Math.PI/24)*r]);
 d.detailExtrusions.push(
  {id:'planned-round-table-top',polygon:circle(910,325,26),bottom:.75,height:.09,color:[.52,.33,.18],room:'planned'},
  {id:'planned-round-table-pedestal',polygon:circle(910,325,8),bottom:.08,height:.67,color:[.36,.24,.15],room:'planned'},
  {id:'planned-round-table-foot',polygon:circle(910,325,16),bottom:.02,height:.06,color:[.29,.22,.16],room:'planned'}
 );
 d.rooms.find(r=>r.id==='planned').entryAt=[910,280];
 // 사용자 표시 세 곳: 상부에 매단 얇은 가림막. 아래는 바닥/상판에서 띄운다.
 for(const table of d.galleryTables){
  d.detailBoxes.push({id:table.id+'-hanging-screen',at:[(table.a[0]+table.b[0])/2,175],bottom:table.height+.20,size:[(table.b[0]-table.a[0])*d.scale,2.48-table.height-.20,.035],color:[.82,.81,.76],room:'long'});
 }
 const scrollWall=d.walls.find(w=>w.id==='gallery-transition'),scrollOpening=scrollWall.openings[0];
 const scrollEnds=[scrollOpening.from,scrollOpening.to].map(t=>scrollWall.a.map((v,i)=>v+(scrollWall.b[i]-v)*t));
 d.detailBoxes.push({id:'gallery-door-hanging-screen',at:[400,(scrollEnds[0][1]+scrollEnds[1][1])/2],bottom:.25,size:[.035,scrollOpening.height-.25,Math.abs(scrollEnds[1][1]-scrollEnds[0][1])*d.scale],color:[.82,.81,.76],room:'long'});
 // 사방의 여백을 남기고 보 아래에 두 가닥으로 매단다. 기존 하부 간격은 유지.
 for(const screen of d.detailBoxes.filter(b=>b.id.endsWith('-hanging-screen'))){
  const axis=screen.size[0]>screen.size[2]?0:2,topGap=.18,sideGap=.12;
  screen.size[axis]-=sideGap*2;
  screen.size[1]-=topGap;
  const top=screen.bottom+screen.size[1];
  for(const sign of [-1,1]){
   const at=[...screen.at];at[axis===0?0:1]+=sign*screen.size[axis]*.32/d.scale;
   d.detailBoxes.push({id:screen.id+'-wire-'+(sign<0?'left':'right'),at,bottom:top,size:[.012,topGap,.012],color:[.30,.32,.31],room:'long'});
  }
 }
 // 빈 벽걸이 액자: 좌표는 벽 표면, inward는 관람 공간 방향. 후속 사진도 이 목록에 추가.
 d.wallArtFrames=[
  {id:'entry-partition-frame',a:[57,318],b:[145,318],inward:[0,1],bottom:.65,top:2.35,room:'bow'},
  {id:'lobby-partition-frame',a:[216,318],b:[284,318],inward:[0,1],bottom:.45,top:2.40,room:'bow'},
  {id:'central-platform-frame',a:[442-.08/d.scale,329],b:[442-.08/d.scale,402],inward:[-1,0],bottom:.65,top:2.35,room:'bow'},
  {id:'arch-cabinet-frame',a:[400-.22/d.scale,260],b:[400-.22/d.scale,298],inward:[-1,0],bottom:1.48,top:2.62,room:'long'},
  {id:'video-end-frame',a:[36+d.wallThickness/d.scale,235],b:[36+d.wallThickness/d.scale,292],inward:[1,0],bottom:.50,top:2.42,room:'video'},
  {id:'video-partition-frame',a:[52,305],b:[108,305],inward:[0,-1],bottom:.40,top:2.42,room:'video'},
  {id:'gallery-west-entry-frame',a:[270+d.wallThickness/d.scale,145],b:[270+d.wallThickness/d.scale,211],inward:[1,0],bottom:.40,top:2.45,room:'long'},
  {id:'corridor-east-exit-frame',a:[1120-d.wallThickness/d.scale,188],b:[1120-d.wallThickness/d.scale,241],inward:[-1,0],bottom:.35,top:2.45,room:'link'},
  {id:'donated-east-long-frame',a:[1145-d.wallThickness/d.scale,270],b:[1145-d.wallThickness/d.scale,365],inward:[-1,0],bottom:1.45,top:2.50,room:'donated'}
 ];
 // 매입부 뒤판 실내 쪽 면(벽선에서 .07)에 액자를 건다. 이전 .11은 액자가 뒤판에서 4cm 떠 있었다.
 const lobbySouthFrameOffset=.07/d.scale;
 d.wallArtFrames.push({id:'lobby-south-number-4',a:[210,496-lobbySouthFrameOffset],b:[490,496-lobbySouthFrameOffset],inward:[0,-1],bottom:.55,top:2.40,room:'bow'});
 d.wallArtFrames.push({id:'video-flat-wall-frame',a:[149.7,298.5],b:[236.3,298.5],inward:[0,-1],bottom:.60,top:2.35,room:'video'});
 // 로비 남측 외벽의 긴 매입 전시부. 외곽선은 유지하고 실내 쪽 벽 두께를 확보한다.
 const lobbySouth=d.shell.find(w=>w.id==='shell-bow-south');
 // 출입문 주변은 기존 두께를 유지해 12→27의 대각 통과 폭을 보존한다.
 lobbySouth.b=[490,496];
 for(const opening of lobbySouth.openings){opening.from*=516/62;opening.to*=516/62;}
 d.shell.push(
  {id:'shell-lobby-recess',a:[490,496],b:[210,496],inset:[0,-1],thickness:.50,room:'bow',openings:[{from:0,to:1,sill:.35,height:2.45,kind:'recess',recessDirection:[0,1],note:'외부로 뚫리지 않는 뒤판 포함 매입 전시대'}]},
  {id:'shell-lobby-south-tail',a:[210,496],b:[36,496],inset:[0,-1],room:'bow'}
 );
 const southSections=d.shell.splice(-2);
 d.shell.splice(d.shell.indexOf(lobbySouth)+1,0,...southSections);
 d.envelope=d.shell.map(w=>[...w.a]);
 // 사용자 V/F: 기획전시실 남측 매입 유리 전시부와 복도 북측에서 보는 액자.
 const plannedSouth=d.shell.find(w=>w.id==='shell-planned-south');
 plannedSouth.thickness=.50;
 plannedSouth.openings=[{from:.10,to:.90,sill:.60,height:2.45,kind:'recess',recessDirection:[0,1],glazed:true,note:'사용자 V: 막힌 뒤벽과 전면 유리를 갖춘 매입형 전시대'}];
 const plannedDisplayZ=394-(plannedSouth.thickness+.012)/d.scale;
 d.wallArtFrames.push({id:'planned-display-glass',a:[966,plannedDisplayZ],b:[854,plannedDisplayZ],inward:[0,-1],bottom:.60,top:2.45,room:'planned',imageOnly:true});
 d.wallArtFrames.push({id:'planned-corridor-frame',a:[800,256-d.wallThickness/d.scale],b:[857,256-d.wallThickness/d.scale],inward:[0,-1],bottom:.40,top:2.45,room:'link'});
 // 실감형 체험장 북측 벽의 멀티미디어 모니터: 얇은 검정 본체만 배치.
 d.detailBoxes.push({id:'immersive-multimedia-monitor',at:[1004,24+(d.wallThickness+.03+.005)/d.scale],bottom:.75,size:[3.05,1.52,.06],color:[.025,.028,.03],room:'immersive'});
})();
