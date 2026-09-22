import assert from 'node:assert/strict';
import { sourceTest } from './source-test.mts';
const test = sourceTest();
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {intersectViewRayWithEllipsoid,rotateSequence,convexHull2d,prepareProjectedEllipsoidSilhouetteCoverage,planetographicRowsToMeshLatitude} from '../../tools/objects/material-composition/ellipsoid.mts';
import {fitTextureGeometry,polarQuad} from '../../tools/objects/material-composition/texture-geometry.mts';
import {writeMaterialAtlasTile,sampleRgbaBilinear,sampleAlphaBilinear} from '../../tools/objects/material-composition/raster.mts';
import {validateMaterialRecipe,validateRelativePath} from '../../tools/objects/material-composition/recipe.mts';
import {prepareLayeredLeafLayouts} from '../../tools/objects/material-composition/leaf-layouts.mts';
import {prepareLayeredOblateObject,isLayeredOblateRecipe} from '../../tools/objects/material-composition/index.mts';
const objectDirectory=new URL('../../src/objects/saturn/',import.meta.url).pathname;

test('oblate ray arithmetic preserves facing and positive-root conventions without body dispatch',()=>{
 for(const arithmetic of ['division','reciprocal'] as const)for(const rootSelection of ['facing','positive'] as const){
  const options={equatorialRadius:3,polarRadius:2,arithmetic,rootSelection,includeDistance:true};
  assert.deepEqual(intersectViewRayWithEllipsoid([0,0,0],[0,0,1],options),{position:[0,0,2],normal:[0,0,1],distance:2,visibility:1});
  assert.equal(intersectViewRayWithEllipsoid([10,10,0],[0,0,1],options),null);
  assert.equal(intersectViewRayWithEllipsoid([0,0,0],[0,0,0],options),null);
 }
 assert.throws(()=>Reflect.apply(intersectViewRayWithEllipsoid,undefined,[[0,0,0],[0,0,1],{equatorialRadius:3,polarRadius:2,arithmetic:'body-name'}]),/Unknown/);
});

test('authored rotation order and pole winding remain explicit',()=>{
 const value=rotateSequence([1,0,0],[{axis:'z',degrees:90},{axis:'x',degrees:90}]);
 assert.ok(Math.abs(value[0])<1e-15&&Math.abs(value[1])<1e-15&&value[2]===1);
 assert.throws(()=>Reflect.apply(rotateSequence,undefined,[[0,0,1],[{axis:'w',degrees:0}]]),/Invalid/);
 const north=polarQuad({pole:'north',radius:2,z:3}),south=polarQuad({pole:'south',radius:2,z:-3});
 assert.deepEqual(north.vertices[0],[-2,-2,3]);assert.deepEqual(south.vertices[0],[-2,2,-3]);
 assert.deepEqual(north.uvs[0],[0,0]);assert.deepEqual(south.uvs[0],[0,1]);
});

test('texture fitting preserves projected extent and does not mutate input',()=>{
 const matrix='1,0,0,0,0,1,0,0,0,0,1,0,7,8,9,1';
 const input: Parameters<typeof fitTextureGeometry>[0]={matrix,leafWidth:128,leafHeight:32,backgroundPosition:[-4,-6],backgroundSize:[512,256]};
 const result=fitTextureGeometry(input,64,64);
 assert.equal(result.matrix,'2,0,0,0,0,0.5,0,0,0,0,1,0,7,8,9,1');
 assert.deepEqual(result.backgroundPosition,[-2,-12]);assert.deepEqual(result.backgroundSize,[256,512]);assert.equal(input.matrix,matrix);
 assert.throws(()=>fitTextureGeometry({...input,matrix:'NaN'},64,64),/invalid/);
});

test('material atlas gutters duplicate full RGBA edges and corners',()=>{
 const source=Buffer.from([1,2,3,4,11,12,13,14,21,22,23,24,31,32,33,34]);
 const output=Buffer.alloc(4*4*4);
 writeMaterialAtlasTile({output,outputWidth:4,source,sourceSize:2,frameX:1,frameY:1,gutter:1});
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){
  const input=(Math.min(1,Math.max(0,y-1))*2+Math.min(1,Math.max(0,x-1)))*4;
  assert.deepEqual(output.subarray((y*4+x)*4,(y*4+x+1)*4),source.subarray(input,input+4));
 }
 assert.deepEqual(sampleRgbaBilinear(source,2,.5,.5),[16,17,18,19]);
 assert.equal(sampleAlphaBilinear(source,2,.5,.5),19/255);
});

test('silhouette coverage follows retained topology and bounded fractional edges',()=>{
 assert.deepEqual(convexHull2d([{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1},{x:.5,y:.5}]),[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]);
 const coverage=prepareProjectedEllipsoidSilhouetteCoverage({equatorialRadius:1,polarRadius:.75,latitudeSegments:8,longitudeSegments:16,right:[1,0,0],down:[0,0,1],scaledRadiusX:1.1,scaledRadiusY:1.1,outputSize:32,supersampling:4});
 assert.equal(coverage[0],0);assert.equal(coverage[16*32+16],255);assert.ok(coverage.some(value=>value>0&&value<255));
});

test('material paths and parameters fail before source work',()=>{
 const base={schema:'test@1',namespace:'synthetic-body',publicPrefix:'/scenes/synthetic-body/',files:{surface:'map.webp'},parameters:{width:16},sourcePins:[{}]};
 assert.equal(validateMaterialRecipe(base,'test@1'),base);
 for(const path of ['../map.webp','/map.webp','a\\b.webp','a/../b.webp'])assert.throws(()=>validateRelativePath(path),/Unsafe/);
 assert.throws(()=>validateMaterialRecipe({...base,parameters:{width:Infinity}},'test@1'),/finite/);
 assert.throws(()=>validateMaterialRecipe({...base,namespace:'../body'},'test@1'),/namespace/);
});

test('projective leaf layout is derived from pinned scoped CSS',()=>{
 const stylesheet='.scope .polycss-scene s{width:var(--polycss-atlas-width, 64px);height:var(--polycss-atlas-height, 64px)}.scope .shell > s:not(.demo-interior-pole){background-size:1024px 512px}';
 const config={namespace:'demo',stylesheet:{path:'scoped.css',scope:'.scope ',bytes:Buffer.byteLength(stylesheet),sha256:createHash('sha256').update(stylesheet).digest('hex')}};
 const result=prepareLayeredLeafLayouts({scene:{interior:{shells:[{className:'shell'}]}},stylesheet,config});
 assert.deepEqual(result.classes.shell,{width:'64px',height:'64px',backgroundSize:'1024px 512px'});
 assert.throws(()=>Reflect.apply(prepareLayeredLeafLayouts,undefined,[{scene:{},stylesheet:stylesheet+' ',config}]),/pin changed/);
});

test('full entry rejects canonical comparison output before any raster writes',async()=>{
 const geometry=JSON.parse(await readFile(new URL('../../src/objects/saturn/source/preparation/geometry.json',import.meta.url),'utf8'));
 assert.equal(isLayeredOblateRecipe(geometry),true);assert.equal(isLayeredOblateRecipe({schema:'unknown'}),false);
 await assert.rejects(prepareLayeredOblateObject({objectDirectory,publicDirectory:new URL('../../public/scenes/saturn/',import.meta.url).pathname,outputDirectory:'/unused',prepareContent:async()=>{throw Error('must not execute');}}),/canonical public/);
});

test('planetographic map rows move to the parametric latitude of the mesh',()=>{
 const height=180,axisRatio=60268/54364,rows=Uint8Array.from({length:height},(_,y)=>y);
 const mesh=planetographicRowsToMeshLatitude(rows,1,height,1,axisRatio);
 // Mesh row 45 sits at parametric latitude 44.5 deg; its planetographic latitude is atan(a/b tan 44.5) = 47.4 deg, source row 42.1.
 const beta=44.5*Math.PI/180,expected=90-Math.atan(axisRatio*Math.tan(beta))*180/Math.PI-0.5;
 assert.equal(mesh[45],Math.round(expected));
 assert.equal(mesh[89],89);assert.equal(mesh[90],90);assert.ok(mesh[0]===0&&mesh[179]===179);
 assert.deepEqual([...planetographicRowsToMeshLatitude(rows,1,height,1,1)],[...rows]);
 assert.throws(()=>planetographicRowsToMeshLatitude(rows,1,height,1,0.9),/axis ratio/);
});
