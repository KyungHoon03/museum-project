/* GLB, OBJ, STL 파일을 작은 색상 메시로 읽는다. 외부 의존성이나 네트워크 요청은 없다. */
window.MuseumAssetModelLoader=(()=>{
 'use strict';
 const maxVertices=65535;
 const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 function multiply(a,b){
  const out=new Array(16).fill(0);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];
  return out;
 }
 function nodeMatrix(node){
  if(node.matrix)return node.matrix;
  const [x,y,z,w]=node.rotation||[0,0,0,1],s=node.scale||[1,1,1],t=node.translation||[0,0,0];
  return [
   (1-2*y*y-2*z*z)*s[0],(2*x*y+2*z*w)*s[0],(2*x*z-2*y*w)*s[0],0,
   (2*x*y-2*z*w)*s[1],(1-2*x*x-2*z*z)*s[1],(2*y*z+2*x*w)*s[1],0,
   (2*x*z+2*y*w)*s[2],(2*y*z-2*x*w)*s[2],(1-2*x*x-2*y*y)*s[2],0,
   t[0],t[1],t[2],1
  ];
 }
 function readAccessor(gltf,binary,index){
  const accessor=gltf.accessors[index],view=gltf.bufferViews[accessor.bufferView];
  if(!accessor||!view||accessor.sparse)throw new Error('희소 또는 잘못된 GLB 데이터는 지원하지 않습니다.');
  const componentBytes={5121:1,5123:2,5125:4,5126:4}[accessor.componentType];
  const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[accessor.type];
  if(!componentBytes||!components)throw new Error('지원하지 않는 GLB 정점 형식입니다.');
  const offset=(view.byteOffset||0)+(accessor.byteOffset||0),stride=view.byteStride||componentBytes*components;
  if(offset+(accessor.count-1)*stride+componentBytes*components>binary.byteLength)throw new Error('GLB 정점 데이터 범위를 벗어났습니다.');
  const getter={5121:DataView.prototype.getUint8,5123:DataView.prototype.getUint16,5125:DataView.prototype.getUint32,5126:DataView.prototype.getFloat32}[accessor.componentType];
  const data=new DataView(binary),values=new Array(accessor.count*components);
  for(let i=0;i<accessor.count;i++)for(let c=0;c<components;c++){
   values[i*components+c]=componentBytes===1?data.getUint8(offset+i*stride+c):getter.call(data,offset+i*stride+c*componentBytes,true);
  }
  return {values,count:accessor.count,components,componentType:accessor.componentType};
 }
 function transformPoint(matrix,p){
  return [matrix[0]*p[0]+matrix[4]*p[1]+matrix[8]*p[2]+matrix[12],
   matrix[1]*p[0]+matrix[5]*p[1]+matrix[9]*p[2]+matrix[13],
   matrix[2]*p[0]+matrix[6]*p[1]+matrix[10]*p[2]+matrix[14]];
 }
 function trianglesToMesh(positions,normals,indices){
  if(!positions.length||!indices.length||indices.length%3)throw new Error('삼각형 메시 데이터가 없습니다.');
  const count=positions.length/3;
  if(count>maxVertices||indices.some(i=>i>=count))throw new Error('모델이 너무 큽니다. 정점 65,535개 이하로 내보내 주세요.');
  if(!normals||normals.length!==positions.length){
   normals=new Array(positions.length).fill(0);
   for(let i=0;i<indices.length;i+=3){
    const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3,
     ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2],
     vx=positions[c]-positions[a],vy=positions[c+1]-positions[a+1],vz=positions[c+2]-positions[a+2],
     n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
    for(const j of [a,b,c])for(let k=0;k<3;k++)normals[j+k]+=n[k];
   }
  }
  const length=positions.length/3;
  let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<positions.length;i+=3)for(let k=0;k<3;k++){min[k]=Math.min(min[k],positions[i+k]);max[k]=Math.max(max[k],positions[i+k]);}
  const center=min.map((v,k)=>(v+max[k])/2),extent=Math.max(...max.map((v,k)=>v-min[k]));
  if(!Number.isFinite(extent)||extent<1e-8)throw new Error('크기가 0인 모델입니다.');
  const pos=positions.map((v,i)=>(v-center[i%3])/extent);
  const nrm=new Array(normals.length);
  for(let i=0;i<length;i++){
   const l=Math.hypot(normals[i*3],normals[i*3+1],normals[i*3+2])||1;
   nrm[i*3]=normals[i*3]/l;nrm[i*3+1]=normals[i*3+1]/l;nrm[i*3+2]=normals[i*3+2]/l;
  }
  return {pos:new Float32Array(pos),nrm:new Float32Array(nrm),idx:new Uint16Array(indices)};
 }
 async function glb(file){
  const buffer=await file.arrayBuffer(),view=new DataView(buffer);
  if(view.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)throw new Error('올바른 GLB 2.0 파일이 아닙니다.');
  let offset=12,json=null,binary=null;
  while(offset+8<=view.byteLength){
   const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
   if(offset+length>view.byteLength)throw new Error('GLB 청크가 잘렸습니다.');
   if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,offset,length)).trim());
   if(type===0x004e4942)binary=buffer.slice(offset,offset+length);
   offset+=length;
  }
  if(!json||!binary)throw new Error('GLB에 모델 데이터가 없습니다.');
  const positions=[],normals=[],indices=[];
  function append(meshIndex,matrix){
   const mesh=json.meshes[meshIndex];
   for(const primitive of mesh.primitives||[]){
    if(primitive.mode!==undefined&&primitive.mode!==4)continue;
    if(primitive.attributes.POSITION===undefined)continue;
    const p=readAccessor(json,binary,primitive.attributes.POSITION);
    if(p.components!==3)throw new Error('GLB 위치 데이터 형식이 올바르지 않습니다.');
    const base=positions.length/3;
    for(let i=0;i<p.values.length;i+=3){
     const v=transformPoint(matrix,p.values.slice(i,i+3));positions.push(...v);
    }
    if(primitive.attributes.NORMAL!==undefined){
     const n=readAccessor(json,binary,primitive.attributes.NORMAL);
     for(let i=0;i<n.values.length;i+=3){
      const v=[matrix[0]*n.values[i]+matrix[4]*n.values[i+1]+matrix[8]*n.values[i+2],
       matrix[1]*n.values[i]+matrix[5]*n.values[i+1]+matrix[9]*n.values[i+2],
       matrix[2]*n.values[i]+matrix[6]*n.values[i+1]+matrix[10]*n.values[i+2]];
      normals.push(...v);
     }
    }else normals.push(...new Array(p.count*3).fill(0));
    const ix=primitive.indices===undefined?Array.from({length:p.count},(_,i)=>i):readAccessor(json,binary,primitive.indices).values;
    for(let i=0;i+2<ix.length;i+=3)indices.push(base+ix[i],base+ix[i+1],base+ix[i+2]);
   }
  }
  const nodes=json.nodes||[],parents=new Set();nodes.forEach(n=>(n.children||[]).forEach(i=>parents.add(i)));
  const scenes=json.scenes||[],scene=scenes[json.scene||0],roots=scene?scene.nodes:nodes.map((_,i)=>i).filter(i=>!parents.has(i));
  function visit(index,parent){
   const node=nodes[index],matrix=multiply(parent,nodeMatrix(node));
   if(node.mesh!==undefined)append(node.mesh,matrix);
   (node.children||[]).forEach(child=>visit(child,matrix));
  }
  if(nodes.length)roots.forEach(i=>visit(i,identity()));
  else (json.meshes||[]).forEach((_,i)=>append(i,identity()));
  return trianglesToMesh(positions,normals,indices);
 }
 async function obj(file){
  const text=await file.text(),vertices=[],faces=[];
  for(const line of text.split(/\r?\n/)){
   const values=line.trim().split(/\s+/);
   if(values[0]==='v'&&values.length>=4)vertices.push(values.slice(1,4).map(Number));
   else if(values[0]==='f'&&values.length>=4){
    const face=values.slice(1).map(token=>{
     let index=Number(token.split('/')[0]);
     if(index<0)index=vertices.length+index+1;
     return index-1;
    });
    for(let i=1;i<face.length-1;i++)faces.push(face[0],face[i],face[i+1]);
   }
  }
  const pos=[],idx=[];
  for(const source of faces){if(!vertices[source])throw new Error('OBJ 면이 유효하지 않습니다.');pos.push(...vertices[source]);idx.push(idx.length);}
  return trianglesToMesh(pos,null,idx);
 }
 async function stl(file){
  const buffer=await file.arrayBuffer(),view=new DataView(buffer),pos=[],idx=[];
  const binary=buffer.byteLength>=84&&84+view.getUint32(80,true)*50===buffer.byteLength;
  if(binary){
   const facets=view.getUint32(80,true);
   if(facets*3>maxVertices)throw new Error('모델이 너무 큽니다. 정점 65,535개 이하로 내보내 주세요.');
   let offset=84;
   for(let i=0;i<facets;i++,offset+=50)for(let j=0;j<3;j++)pos.push(view.getFloat32(offset+12+j*12,true));
  }else{
   const text=new TextDecoder().decode(buffer);
   for(const match of text.matchAll(/\bvertex\s+([-+\deE.]+)\s+([-+\deE.]+)\s+([-+\deE.]+)/g))pos.push(Number(match[1]),Number(match[2]),Number(match[3]));
  }
  for(let i=0;i<pos.length/3;i++)idx.push(i);
  return trianglesToMesh(pos,null,idx);
 }
 async function load(file){
  const extension=file.name.split('.').pop().toLowerCase();
  if(extension==='glb')return glb(file);
  if(extension==='obj')return obj(file);
  if(extension==='stl')return stl(file);
  throw new Error('GLB, OBJ 또는 STL 모델만 지원합니다.');
 }
 return {load};
})();
