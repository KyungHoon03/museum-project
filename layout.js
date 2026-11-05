/* 사진의 픽셀 평면을 사용한다. Y는 위쪽, 1px=0.035 상대 단위.
 * 외벽은 실내 경계 envelope에 폐합한다. 야외 바닥 외곽은 건물 경계가 아니다.
 * 관찰 근거와 연결을 위해 보간한 부분은 evidence에서 구분한다. */
window.MuseumLayout = {
  scale:0.035, origin:[650,340], wallHeight:2.8, wallThickness:0.16,
  floor:{id:'unified-floor',name:'통합 바닥',height:0,color:[.69,.72,.70],polygon:[[270,24],[970,24],[970,118],[1120,118],[1120,244],[1145,244],[1145,414],[980,414],[980,394],[840,394],[840,256],[790,256],[790,480],[690,480],[690,548],[640,548],[640,584],[492,584],[492,496],[36,496],[36,220],[270,220]]},
  // 단일 실내 외피. 야외체험장 영역을 제외한 정규화 평면이며 실측 외벽선은 아니다.
  envelope:[[270,24],[970,24],[970,118],[1120,118],[1120,244],[1145,244],[1145,414],[980,414],[980,394],[840,394],[840,256],[790,256],[790,480],[552,480],[552,496],[36,496],[36,220],[270,220]],
  rooms:[
    {id:'long',name:'상부 전시 영역 · 실감형체험장',color:[.63,.67,.69],polygon:[[270,62],[955,30],[960,132],[818,150],[400,175],[274,179]],note:'전시 설치물을 제외한 긴 전시 영역.'},
    {id:'link',name:'중앙 연결 영역',color:[.70,.73,.74],polygon:[[274,179],[818,150],[960,153],[960,175],[1056,175],[1056,123],[1096,123],[1116,234],[750,251],[552,258],[552,303],[292,303],[274,288]],note:'영상실 앞부터 두 전시실까지 이어지는 열린 연결 영역.'},
    {id:'video',name:'영상실 앞 공간',color:[.64,.69,.71],polygon:[[40,235],[274,226],[274,280],[292,303],[40,303]],note:'VR의 닫힌 양개문 앞 공간. 문 뒤 영상실의 내부 크기는 확인되지 않음.'},
    {id:'bow',name:'부천활박물관',color:[.67,.70,.70],polygon:[[40,328],[205,328],[292,328],[552,328],[552,460],[208,468],[200,489],[49,489]],note:'북측은 VR의 곡면·돌출부를 가진 분리벽. 동측 열린 통로로 연결.'},
    {id:'maru',name:'체험마루',color:[.70,.63,.49],polygon:[[563,266],[731,266],[740,329],[740,405],[755,447],[571,458]],note:'북측 넓은 개구부와 남측 야외 방향 연속 유리문.'},
    {id:'planned',name:'기획전시실',color:[.73,.71,.66],polygon:[[852,266],[960,266],[968,382],[853,387]],note:'복도 쪽 문틀 개구부 보존.'},
    {id:'donated',name:'기증전시실',color:[.69,.70,.65],polygon:[[988,266],[1134,266],[1137,382],[1082,386],[1062,409],[998,393]],note:'동측·남측 외벽 연결. 외곽 꺾임은 기존 직각 평면 기준의 근사.'},
    {id:'outdoor',name:'야외체험장 · 확인 범위',color:[.58,.66,.59],polygon:[[516,490],[634,490],[634,522],[688,522],[687,546],[635,546],[635,579],[500,579],[500,552],[516,552]],note:'실내 외피 밖의 바닥. 야외 둘레에는 건물 외벽을 생성하지 않음.'}
  ],
  // 외피 각 선분은 위치·문·유리 폭을 개별 수정할 수 있다. 중복 내부벽을 만들지 않는다.
  shell:[
    {id:'shell-north',a:[270,24],b:[970,24],inset:[0,1],room:'long',evidence:'정면·양측면: 긴 전시 영역 외측. 디오라마 뒤 미노출 구간은 양끝 벽선으로 연결한 근사'},
    {id:'shell-projection',a:[970,24],b:[970,118],inset:[-1,0],room:'long',evidence:'실감형체험장 투사면 바탕 벽'},
    {id:'shell-northeast-return',a:[970,118],b:[1120,118],inset:[0,1],room:'link',evidence:'상단·반대 측면 연결부 외곽. 스캔 결손은 직각 경계로 보간'},
    {id:'shell-east-door',a:[1120,118],b:[1120,244],inset:[-1,0],room:'link',evidence:'반대 측면의 붉은 출입문 끝벽. 상대 위치 근사',openings:[{from:.15,to:.48,height:2.15,kind:'door',leaves:1,note:'문 존재 확인. 위치와 폭은 상대 비율 추정'}]},
    {id:'shell-east-step',a:[1120,244],b:[1145,244],inset:[0,1],room:'link',evidence:'연결부와 기증전시실 외곽 모서리 보간'},
    {id:'shell-donated-east',a:[1145,244],b:[1145,414],inset:[-1,0],room:'donated',evidence:'상단·양측면: 진열장 뒤 동측 벽. 가려진 끝부분 연결'},
    {id:'shell-donated-south',a:[1145,414],b:[980,414],inset:[0,-1],room:'donated',evidence:'기증전시실 남측에 관찰된 벽 조각을 같은 외곽선으로 연결. 미노출 부분 근사'},
    {id:'shell-donated-step',a:[980,414],b:[980,394],inset:[1,0],room:'donated',evidence:'기증·기획전시실의 외곽 차이 연결 보간'},
    {id:'shell-planned-south',a:[980,394],b:[840,394],inset:[0,-1],room:'planned',evidence:'정면·반대 측면: 기획전시실 남측 벽'},
    {id:'shell-planned-west',a:[840,394],b:[840,256],inset:[1,0],room:'planned',evidence:'정면·양측면: 기획전시실 측벽'},
    {id:'shell-recess',a:[840,256],b:[790,256],inset:[0,-1],room:'link',evidence:'체험마루·기획전시실 사이 스캔 공백의 정규화 경계. 짧은 연결부는 추정'},
    {id:'shell-maru-east',a:[790,256],b:[790,480],inset:[-1,0],room:'maru',evidence:'체험마루 VR 및 양측면: 동측 실벽'},
    {id:'shell-maru-glass',a:[790,480],b:[552,480],inset:[0,-1],room:'maru',evidence:'체험마루 VR: 야외 방향 연속 유리문. 사진 인쇄 제거',openings:[{from:.015,to:.985,height:2.65,kind:'glazed',divisions:7,note:'유리문 전체 폭 근사. 개별 문짝 분할 수는 근사'}]},
    {id:'shell-maru-west-return',a:[552,480],b:[552,496],inset:[-1,0],room:'bow',evidence:'부천활박물관 남측과 체험마루 유리문 사이 연결 모서리 근사'},
    {id:'shell-bow-south',a:[552,496],b:[36,496],inset:[0,-1],room:'bow',evidence:'상단·양측면: 남측 외곽의 벽면들을 연속 연결. 스캔 누락 구간 보간'},
    {id:'shell-west',a:[36,496],b:[36,220],inset:[1,0],room:'bow',evidence:'서측 바닥 외곽의 벽과 유리 출입부. 유리 출입부의 이 경계상 대응은 근사',openings:[{from:.20,to:.45,height:2.4,kind:'glazed',divisions:3,note:'VR에서 유리 출입부 확인. 정확한 평면 위치·폭은 추정'}]},
    {id:'shell-video-north',a:[36,220],b:[270,220],inset:[0,1],room:'video',evidence:'영상실 앞 VR: 흰 벽과 닫힌 양개문. 문 뒤 내부는 모델 범위 밖',openings:[{from:.62,to:.82,height:2.1,kind:'door',leaves:2,note:'VR에서 양개문과 문틀 확인. 평면 위치는 상대 비율 추정'}]},
    {id:'shell-long-west',a:[270,220],b:[270,24],inset:[1,0],room:'long',evidence:'정면·상단의 되돌아가는 서측 외곽. 디오라마 뒤 구간은 직각 보간'}
  ],
  walls:[
    {id:'maru-west',a:[552,256],b:[552,480],room:'maru',evidence:'체험마루 VR와 양측면: 서측 실벽'},
    {id:'maru-entry',a:[552,256],b:[790,256],room:'maru',evidence:'체험마루 VR의 넓은 출입 개방부',openings:[{from:.28,to:.82,height:2.45,kind:'opening',note:'형태 확인, 치수 근사'}]},
    {id:'planned-east',a:[980,256],b:[980,394],room:'planned',evidence:'기획·기증전시실 공통 경계'},
    {id:'planned-entry',a:[840,256],b:[980,256],room:'planned',evidence:'기획전시실 VR: 목재 문틀 형태. 질감 없이 구조만 보존',openings:[{from:.18,to:.67,height:2.25,kind:'opening',note:'폭·위치 근사'}]},
    {id:'donated-entry',a:[980,256],b:[1145,256],room:'donated',evidence:'정면·반대 측면의 복도 방향 출입부',openings:[{from:.12,to:.48,height:2.25,kind:'opening',note:'폭·위치 근사'}]}
  ],
  // VR 확대 평면: 서측부터 연결된 분리벽, 영상실 쪽 평평한 벽면과 양쪽 돌출부.
  // 높이·깊이는 사진과 VR의 상대 비율 추정이다.
  solidWalls:[{id:'video-bow-partition',room:'bow',height:2.8,
    polygon:[[36,305],[117,305],[117,285],[136,285],[136,298.5],[250,298.5],
      [250,285],[270,285],[270,303],[292,303],[292,318],[36,318]],
    evidence:'영상실 2번 액자에 사진이 평평하게 맞도록 곡면 벽 구간을 직선 벽면으로 변경. 서측부터 이어지는 벽과 양끝 돌출 유지. 동쪽 x=292 이후는 통로로 개방'}],
  frames:[],
  beams:[
    {id:'gallery-cross-1',a:[400,24],b:[400,175],bottom:2.48,height:.32,thickness:.22,evidence:'정면·양측면 흰색 상부 부재'},
    {id:'gallery-cross-2',a:[548,24],b:[548,175],bottom:2.48,height:.32,thickness:.22,evidence:'정면·양측면 흰색 상부 부재'},
    {id:'gallery-cross-3',a:[690,24],b:[690,175],bottom:2.48,height:.32,thickness:.22,evidence:'정면·양측면 흰색 상부 부재'},
    {id:'gallery-cross-4',a:[818,24],b:[818,175],bottom:2.48,height:.32,thickness:.22,evidence:'정면·양측면 흰색 상부 부재'},
    {id:'gallery-longitudinal',a:[400,175],b:[818,175],bottom:2.48,height:.32,thickness:.22,evidence:'중앙 연결 영역 위 종방향 부재'}
  ],
  columns:[
    {id:'gallery-pier-1',at:[400,175],width:.32,depth:.40,height:2.48,evidence:'정면·양측면 흰 수직 부재'},
    {id:'gallery-pier-2',at:[548,175],width:.32,depth:.40,height:2.48,evidence:'정면·양측면 흰 수직 부재'},
    {id:'gallery-pier-3',at:[690,175],width:.32,depth:.40,height:2.48,evidence:'정면·양측면 흰 수직 부재'},
    {id:'gallery-pier-4',at:[818,175],width:.32,depth:.40,height:2.48,evidence:'정면·양측면 흰 수직 부재'}
  ],
  ceilings:[
    {id:'maru-ceiling',polygon:[[552,256],[790,256],[790,480],[552,480]],height:2.8,color:[.88,.89,.87],evidence:'체험마루 VR 천장 확인. 높이 근사'},
    {id:'planned-ceiling',polygon:[[840,256],[980,256],[980,394],[840,394]],height:2.8,color:[.88,.89,.87],evidence:'기획전시실 VR 천장 확인. 높이 근사'}
  ],
  unresolved:[
    '외벽은 단순화된 실내 외곽을 폐합했으며, 가려진 구간의 연결은 추정이다. 실제 외벽선의 실측 복원은 아니다',
    '영상실 앞 양개문 뒤의 영상실 내부는 확인되지 않아 생성하지 않음',
    '영상실·부천활박물관 분리벽의 곡률·깊이·돌출부 치수는 VR의 상대 비율에 따른 근사',
    '서측 유리 출입부의 정확한 평면 위치, 문 치수·분할, 높이·두께는 실측 미확정',
    '야외체험장은 건물 외피에서 제외. 모든 바닥은 기존 단일 높이·색상 유지',
    '전시품·전시대·목재 격자·설명판·벽 질감 및 전체 지붕은 이번 단계에서 제외'
  ]
};
