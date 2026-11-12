/* 전시실별 전시 자리. [id, 이름, 2d|3d, 평면 위치(null이면 자리에서 자동 계산), 배치]
 * 3D: support = display-supports.js의 받침면 id. 유물은 받침면 위에 바닥을 맞춰 놓이고 진열장 밖으로 나가지 않는다.
 * 2D: wall + wallType = 사진이 붙는 면(진열장 뒷벽·매입부 뒷벽·액자 안쪽).
 * 예시 파일은 전시 컨셉 "국궁 — 활을 만들고, 쏘고, 겨루는 사람들"로 통일한다. (tools/generate_exhibits.py) */
(()=>{
 const M=name=>'assets/exhibits/'+name+'.obj',P=id=>'assets/panels/'+id+'.svg';
 const obj=(id,title,support,model,extra={})=>[id,title,'3d',null,{support,sampleModel:M(model),...extra}];
 const img=(id,title,wall,wallType,extra={})=>[id,title,'2d',null,{wall,...(wallType?{wallType}:{}),sampleImage:P(id),...extra}];
 window.MuseumAssetCatalog=[
  {room:'주 전시실',items:[
   img('main-1','1번 사진','gallery-tall-wall-0','niche-display'),
   obj('main-1-obj','1번 유물(좌)','niche:gallery-tall-wall-0:L','bow-strung'),
   obj('main-1-obj-b','1번 유물(우)','niche:gallery-tall-wall-0:R','quiver'),
   img('main-2','2번 사진','gallery-tall-wall-1','niche-display'),
   obj('main-2-obj','2번 유물(좌)','niche:gallery-tall-wall-1:L','helmet'),
   obj('main-2-obj-b','2번 유물(우)','niche:gallery-tall-wall-1:R','bow-rack'),
   img('main-3','3번 사진','gallery-tall-wall-2','niche-display'),
   obj('main-3-obj','3번 유물(좌)','niche:gallery-tall-wall-2:L','bow-unstrung'),
   obj('main-3-obj-b','3번 유물(우)','niche:gallery-tall-wall-2:R','target-model'),
   obj('main-4','4번 유물','case:gallery-end-showcase','bow-rack'),
   img('main-5-img','5번 사진','gallery-transition-display','niche-display'),
   obj('main-5','5번 유물','niche:gallery-transition-display','quiver'),
   img('main-6-img','6번 사진','arch-cabinet-frame'),
   obj('main-6','6번 유물','display:arch-corridor-case','thumb-ring'),
   obj('main-7','7번 유물(좌)','table:gallery-table-1:north:L','arrow-bundle'),
   obj('main-7-b','7번 유물(우)','table:gallery-table-1:north:R','pyeonjeon'),
   obj('main-8','8번 유물(좌)','table:gallery-table-2:north:L','materials'),
   obj('main-8-b','8번 유물(우)','table:gallery-table-2:north:R','bow-case'),
   obj('main-9','9번 유물(좌)','display:horse-platform:L','bow-rack'),
   obj('main-9-b','9번 과녁(우)','display:horse-platform:R','target')
  ]},
  {room:'기획전시실',items:[
   img('planned-1','1번 사진','shell-planned-south','recess-display'),
   obj('planned-2','1번 유물(좌)','recess:shell-planned-south:L','bow-strung'),
   obj('planned-2-b','1번 유물(우)','recess:shell-planned-south:R','bow-unstrung'),
   obj('planned-3','2번 유물','table:planned-round','materials')
  ]},
  {room:'중앙 로비',items:[
   img('lobby-1','1번 사진','entry-partition-frame'),
   img('lobby-2','2번 사진','lobby-partition-frame'),
   obj('lobby-3-l','3번 유물(좌)','display:bow-central-platform:L','bow-rack'),
   obj('lobby-3','3번 유물(가운데)','display:bow-central-platform:C','bow-strung',{scale:1.6}),
   obj('lobby-3-r','3번 유물(우)','display:bow-central-platform:R','quiver'),
   img('lobby-4','4번 사진','lobby-south-number-4'),
   obj('lobby-4-obj-a','4번 유물(서)','recess:shell-lobby-recess:1','quiver'),
   obj('lobby-4-obj-b','4번 유물(동)','recess:shell-lobby-recess:0','bow-unstrung'),
   img('lobby-5','5번 사진','bow-relief-wall','relief-display'),
   obj('lobby-5-obj','5번 유물(좌)','relief:bow-relief-wall:L','thumb-ring'),
   obj('lobby-5-obj-b','5번 유물(우)','relief:bow-relief-wall:R','arrowheads'),
   obj('lobby-6','6번 유물','display:bow-north-case','arrowheads'),
   img('lobby-7','7번 사진','central-platform-frame'),
   obj('lobby-8','8번 유물','desk:reception','target-model')
  ]},
  {room:'중앙 복도',items:[
   obj('corridor-1','1번 유물(좌)','table:gallery-table-1:south:L','bow-case'),
   obj('corridor-1-b','1번 유물(우)','table:gallery-table-1:south:R','arrowheads'),
   obj('corridor-2','2번 유물(좌)','table:gallery-table-2:south:L','thumb-ring'),
   obj('corridor-2-b','2번 유물(우)','table:gallery-table-2:south:R','arrow-bundle'),
   img('corridor-3','3번 사진','corridor-east-exit-frame'),
   img('corridor-4','4번 사진','planned-corridor-frame')
  ]},
  {room:'영상실',items:[
   img('video-1-left','1번 사진(좌)','video-end-frame','',{fileLabel:'1번 사진파일 선택(좌)'}),
   img('video-1-back','1번 사진(뒤)','video-partition-frame','',{fileLabel:'1번 사진 파일 선택 (뒤)'}),
   img('video-2','2번 사진','video-flat-wall-frame'),
   img('video-3','3번 사진','gallery-west-entry-frame'),
   obj('video-4','4번 유물','wallcase:video-point-4-showcase','bow-strung')
  ]},
  {room:'실감형체험장',items:[
   img('immersive-1','1번 사진','gallery-tall-wall-3','niche-display'),
   obj('immersive-1-obj','1번 유물(좌)','niche:gallery-tall-wall-3:L','quiver'),
   obj('immersive-1-obj-b','1번 유물(우)','niche:gallery-tall-wall-3:R','helmet'),
   img('immersive-2-img','2번 사진','immersive-front','recess-display'),
   obj('immersive-2','2번 유물(좌)','recess:immersive-front:L','target-model'),
   obj('immersive-2-b','2번 유물(우)','recess:immersive-front:R','bow-strung')
  ]},
  {room:'기증전시실',items:[
   img('donated-1-img','1번 사진','donated-peninsula-recess','niche-display'),
   obj('donated-1','1번 유물','niche:donated-peninsula-recess','helmet'),
   img('donated-2-img','2번 사진','donated-west-lower-recess','niche-display'),
   obj('donated-2','2번 유물','niche:donated-west-lower-recess','bow-rack'),
   obj('donated-3','3번 유물','display:donated-workbench','bow-press'),
   obj('donated-4','4번 유물','display:donated-small-south','thumb-ring'),
   obj('donated-5','5번 유물','display:donated-north-horizontal','arrow-bundle'),
   obj('donated-6','6번 유물','display:donated-peninsula-side','pyeonjeon'),
   obj('donated-7','7번 유물','display:donated-peninsula-square','arrowheads'),
   obj('donated-8','8번 유물','display:donated-south-right','bow-case'),
   img('donated-9','9번 사진','donated-east-long-frame')
  ]},
  {room:'체험마루',items:[
   obj('maru-1','1번 유물','worktop:maru','bow-press')
  ]},
  {room:'야외체험장',items:[
   obj('outdoor-1','1번 과녁','ground:outdoor-target','target'),
   obj('outdoor-2','2번 유물','ground:outdoor-line','bow-rack')
  ]}
 ];
})();
