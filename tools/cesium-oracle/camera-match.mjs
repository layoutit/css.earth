// Test-only geographic registration. The prepared CSS faces remain the source
// of their own geographic positions. No sphere is substituted into cssEarth.
export function inverse3(m) {
  const [a,b,c,d,e,f,g,h,i]=m, adj=[e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d];
  const det=a*adj[0]+b*adj[3]+c*adj[6];
  if(!Number.isFinite(det)||Math.abs(det)<1e-20)throw new Error('Singular oracle registration');
  return adj.map(v=>v/det);
}
export function point3(m,x,y) {
  const w=m[6]*x+m[7]*y+m[8];return [(m[0]*x+m[1]*y+m[2])/w,(m[3]*x+m[4]*y+m[5])/w];
}
function sourceEye(m) {
  const inverse=inverse3([m[0],m[4],m[8],m[1],m[5],m[9],m[2],m[6],m[10]]);
  return [0,1,2].map(row=>-[0,1,2].reduce((sum,col)=>sum+inverse[row*3+col]*m[12+col],0));
}
export function referenceCameraFrame(snapshot, definition, depth) {
  const {projection:m,scale}=snapshot;
  const rows=[0,1,2].map(row=>[m[row],m[row+4],m[row+8]]),lengths=rows.map(row=>Math.hypot(...row));
  const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
  if(!lengths.every(n=>Number.isFinite(n)&&n>0)||!(definition.bodyRadius>0))throw new Error('Invalid oracle source camera');
  const axes=rows.map((row,i)=>definition.ecefToBody.map(axis=>dot(row,axis)/lengths[i]));
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=a=>a.map(v=>v/Math.hypot(...a));
  const direction=unit(axes[2].map(v=>-v)),right=unit(cross(direction,axes[1].map(v=>-v))),up=cross(right,direction);
  const physical=snapshot.viewport?.projection;
  if(physical){
    const eye=sourceEye(m);
    return {right,up,direction,positionBodyRadii:definition.ecefToBody.map(axis=>dot(eye,axis)/definition.bodyRadius),
      distanceBodyRadii:-depth/lengths[2]/definition.bodyRadius,
      focalPixels:physical.focalPixels*Math.sqrt(lengths[0]*lengths[1])/lengths[2]};
  }
  // CSS projects x/y after its camera rotation, with positive z towards the
  // observer. Cesium uses y-up and looks along negative view z. Strip only
  // those published row scales; do not fit an orientation to imagery texels.
  return {right,up,direction,
    distanceBodyRadii:(definition.perspective-depth)/lengths[2]/definition.bodyRadius,
    focalPixels:definition.perspective*scale*Math.sqrt(lengths[0]*lengths[1])/lengths[2]};
}
export function geographicFrame(snapshot,faces,definition) {
  const {projection:m,scale,viewport:input}=snapshot,physical=input.projection;
  const v={...input,originX:input.originX+(physical?.principalOffsetPixels[0]??0),originY:input.originY+(physical?.principalOffsetPixels[1]??0)};
  if(!(definition?.perspective>0))throw new Error('Oracle registration requires the prepared source camera');
  const eye=physical?sourceEye(m):null;
  const projected=faces.filter(face=>{
    if(!eye)return m[2]*face.normal[0]+m[6]*face.normal[1]+m[10]*face.normal[2]>0;
    const point=[0,1,2,3].map(row=>face.world[row*3]*.5+face.world[row*3+1]*.5+face.world[row*3+2]);
    return face.normal.reduce((sum,n,i)=>sum+n*(eye[i]-point[i]/point[3]),0)>0;
  }).map(face=>{
    const q=Array.from({length:12},(_,i)=>[0,1,2,3].reduce((sum,k)=>sum+m[k*4+Math.floor(i/3)]*face.world[k*3+i%3],0));
    const denominator=[0,1,2].map(i=>physical?-q[6+i]:q[9+i]-q[6+i]/definition.perspective);
    const focal=physical?physical.focalPixels:scale;
    const h=[...[0,1,2].map(i=>q[i]*focal+v.originX*denominator[i]),...[0,1,2].map(i=>q[3+i]*focal+v.originY*denominator[i]),...denominator];
    return {...face,h,inverse:inverse3(h)};
  });
  function locate(x,y) {
    const candidates=projected.map(face=>({face,uv:point3(face.inverse,x,y)})).filter(({uv})=>uv.every(t=>t>=0&&t<=1));
    candidates.sort((a,b)=>Math.hypot(a.uv[0]-.5,a.uv[1]-.5)-Math.hypot(b.uv[0]-.5,b.uv[1]-.5));
    if(!candidates.length)return null;
    const {face,uv}=candidates[0],geo=point3(face.geographic,...uv);
    const world=[0,1,2,3].map(row=>face.world[row*3]*uv[0]+face.world[row*3+1]*uv[1]+face.world[row*3+2]);
    const xyz=world.slice(0,3).map(n=>n/world[3]);
    const depth=m[2]*xyz[0]+m[6]*xyz[1]+m[10]*xyz[2]+m[14];
    return {longitude:((geo[0]+180)%360+360)%360-180,latitude:geo[1],face:face.key,screen:[x,y],depth};
  }
  const center=locate(v.originX,v.originY);
  if(!center)throw new Error('Oracle camera center outside prepared regular geographic faces');
  const corners=projected.flatMap(face=>[[0,0],[1,0],[0,1],[1,1]].map(uv=>point3(face.h,...uv)));
  const span=Math.min(v.width,v.height,Math.max(...corners.map(p=>p[0]))-Math.min(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[1]))-Math.min(...corners.map(p=>p[1])));
  const anchors=[[-.3,-.3],[0,-.3],[.3,-.3],[-.3,0],[0,0],[.3,0],[-.3,.3],[0,.3],[.3,.3]].map(([x,y])=>locate(v.originX+x*span,v.originY+y*span)).filter(Boolean);
  return {center,anchors,viewport:v,camera:referenceCameraFrame(snapshot,definition,center.depth)};
}

export function matchCesiumCamera(C,viewer,registration) {
  const {center,viewport:v,camera:source}=registration,ellipsoid=viewer.scene.globe.ellipsoid;
  if(!source)throw new Error('Oracle camera requires the prepared body basis and actual source transform');
  const origin=C.Cartesian3.fromDegrees(center.longitude,center.latitude,0,ellipsoid);
  const cameraUp=C.Cartesian3.unpack(source.up),direction=C.Cartesian3.unpack(source.direction);
  // Fit the viewport to the application's scene center. Cesium's per-depth
  // frustum splitting does not preserve a raw near-plane xOffset consistently.
  const left=Math.max(0,2*v.originX-v.width),top=Math.max(0,2*v.originY-v.height);
  const width=2*(v.width-v.originX),height=2*(v.height-v.originY);
  Object.assign(viewer.container.style,{position:'absolute',left:left+'px',top:top+'px',width:width+'px',height:height+'px'});viewer.resize();
  const distance=source.distanceBodyRadii*ellipsoid.maximumRadius,focal=source.focalPixels,pixelScale=distance/focal;
  // Write the documented world camera vectors directly. Converting this far
  // narrow view through geodetic heading/pitch/roll loses the target direction.
  // Register the prepared face's geographic center onto the reference
  // ellipsoid. Copying the source eye alone aims at a different location:
  // prepared planar faces and Cesium's smooth ellipsoid have different depth.
  // Retain that translation as a measurement, rather than fitting other anchors.
  viewer.camera.position=C.Cartesian3.subtract(origin,C.Cartesian3.multiplyByScalar(direction,distance,new C.Cartesian3()),new C.Cartesian3());
  const sourceEye=source.positionBodyRadii?C.Cartesian3.multiplyByScalar(C.Cartesian3.unpack(source.positionBodyRadii),ellipsoid.maximumRadius,new C.Cartesian3()):null;
  viewer.camera.direction=direction;viewer.camera.up=cameraUp;
  viewer.camera.right=C.Cartesian3.normalize(C.Cartesian3.cross(direction,cameraUp,new C.Cartesian3()),new C.Cartesian3());
  const near=Math.max(1,distance/10000),far=distance+ellipsoid.maximumRadius*3;
  const aspectRatio=width/height;
  viewer.camera.frustum=new C.PerspectiveFrustum({fov:2*Math.atan(Math.max(width,height)/(2*focal)),aspectRatio,near,far});
  return {distance,pixelScale,focalPixels:focal,canvas:{left,top,width,height},
    sourceEyeTranslationMeters:sourceEye?C.Cartesian3.distance(sourceEye,viewer.camera.position):null,
    center,qualification:'Orientation, lens and center depth from the actual CSS camera transform; camera translated to register the prepared geographic center on the reference ellipsoid. Other anchor differences are measured, not fitted.'};
}
