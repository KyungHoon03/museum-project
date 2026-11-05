/* VR 내부 관찰을 토대로 한 재질 분류. 사진 자체를 붙이지 않고 미세 표면을 재현한다. */
window.MuseumMaterials={
 classify(p){
  if(p.group==='grass')return 4;
  if(p.group==='floor')return 1;
  if(['glass','displayGlass'].includes(p.group))return 0;
  if(p.color[0]>p.color[1]*1.18&&p.color[1]>p.color[2]*1.15)return 3;
  if(['wall','structure','ceiling'].includes(p.group))return 2;
  return 0;
 },
 evidence:'VR 로비, 기마상 주변, 경기감영도 벽, 기증전시실 내부 관찰: 회청색 미세 점상 바닥, 밝은 도장 벽, 갈색 목재. 원본 재질 스캔이 아닌 절차적 근사.'
};
