/* 전시실별 에셋 번호와 배치. 기증전시실은 의도적으로 제외한다. */
window.MuseumAssetCatalog=[
 {room:'주 전시실',items:[
  ['main-1','1번','2d',[470,110],{wall:'gallery-tall-wall-0',wallType:'niche-display',sampleImage:'assets/examples/main-1.jpg'}],
  ['main-2','2번','2d',[620,110],{wall:'gallery-tall-wall-1',wallType:'niche-display',sampleImage:'assets/examples/main-2.jpg'}],
  ['main-3','3번','2d',[750,110],{wall:'gallery-tall-wall-2',wallType:'niche-display',sampleImage:'assets/examples/main-3.jpg'}]
 ]},
 {room:'기획전시실',items:[
  ['planned-1','1번','2d',[910,280],{wall:'planned-display-glass',surfaceOffset:.025,sampleImage:'assets/examples/planned-1.jpg'}]
 ]},
 {room:'중앙 로비',items:[
   ['lobby-1','1번','2d',[125,370],{wall:'entry-partition-frame',sampleImage:'assets/examples/lobby-1.jpg'}],
   ['lobby-2','2번','2d',[250,370],{wall:'lobby-partition-frame',sampleImage:'assets/examples/lobby-2.jpg'}],
   ['lobby-3','3번','3d',[386,369],{scale:1.05,baseHeight:.22,sampleModel:'assets/examples/lobby-3.obj'}],
   ['lobby-4','4번','2d',[335,450],{wall:'lobby-south-number-4',surfaceOffset:-.035,sampleImage:'assets/examples/lobby-4.jpg'}],
   ['lobby-5','5번','2d',[480,370],{wall:'bow-relief-wall',wallType:'relief-display',surfaceOffset:.07,sampleImage:'assets/examples/lobby-5.jpg'}]
 ]},
 {room:'중앙 복도',items:[
  ['corridor-1','1번','3d',[474,175],{baseHeight:.90,sampleModel:'assets/examples/corridor-1.obj'}],
  ['corridor-2','2번','3d',[619,175],{baseHeight:.90,sampleModel:'assets/examples/corridor-2.obj'}],
  ['corridor-3','3번','2d',[1015,220],{wall:'corridor-east-exit-frame',sampleImage:'assets/examples/corridor-3.jpg'}]
 ]},
 {room:'영상실',items:[
  ['video-1-left','1번 사진파일 선택(좌)','2d',[100,260],{wall:'video-end-frame',fileLabel:'1번 사진파일 선택(좌)',sampleImage:'assets/examples/video-1-left.jpg'}],
  ['video-1-back','1번 사진 파일 선택 (뒤)','2d',[100,260],{wall:'video-partition-frame',fileLabel:'1번 사진 파일 선택 (뒤)',sampleImage:'assets/examples/video-1-back.jpg'}],
  ['video-2','2번','2d',[185,260],{wall:'video-flat-wall-frame',flipX:true,sampleImage:'assets/examples/video-2.jpg'}],
  ['video-3','3번','2d',[335,170],{wall:'gallery-west-entry-frame',sampleImage:'assets/examples/video-3.jpg'}],
  ['video-4','4번','3d',[388.3,175],{scale:.3,baseHeight:.62,sampleModel:'assets/examples/video-4.obj'}]
 ]},
 {room:'실감형체험장',items:[
  ['immersive-1','1번','2d',[870,110],{wall:'gallery-tall-wall-3',wallType:'niche-display',sampleImage:'assets/examples/immersive-1.jpg'}]
 ]}
];
