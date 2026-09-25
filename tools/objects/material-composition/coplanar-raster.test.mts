import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {prepareCoplanarColorRaster, coplanarTileLayout} from './coplanar-raster.mts';
type Point3 = [number, number, number];
type Rgba = [number, number, number, number];

const face = (x: number, color: Rgba, z = 3): {vertices: Point3[]; color: Rgba} => ({
  vertices: [[x, 0, z], [x + 2, 0, z], [x + 2, 2, z], [x, 2, z]], color,
});
test('coplanar preparation preserves holes, source alpha, paint order and affine world coordinates',async()=>{
 const result=await prepareCoplanarColorRaster({faces:[face(0,[120,60,30,128]),face(4,[30,60,120,255])],pixelsPerUnit:4,tilePixels:8});
 assert.equal(result.sourceFaceCount,2);
 const {data}=await sharp(result.bytes).raw().toBuffer({resolveWithObject:true});
 const at = (x: number, y: number): number[] => [...data.subarray((y * result.width + x) * 4, (y * result.width + x) * 4 + 4)];
 assert.deepEqual(at(3,3),[120,60,30,128]);assert.deepEqual(at(12,3),[0,0,0,0]);assert.deepEqual(at(19,3),[30,60,120,255]);
 for(const tile of result.tiles){assert.deepEqual([tile.matrix[3],tile.matrix[7],tile.matrix[11],tile.matrix[15]],[0,0,0,1]);assert.equal(tile.matrix[12],(tile.x-1)/4);assert.equal(tile.matrix[13],(tile.y-1)/4);assert.equal(tile.matrix[14],3);}
 const overlap=await prepareCoplanarColorRaster({faces:[face(0,[255,0,0,255]),face(0,[0,0,255,128])],pixelsPerUnit:4});
 const pixels=await sharp(overlap.bytes).raw().toBuffer();assert.deepEqual([...pixels.subarray((3*overlap.width+3)*4,(3*overlap.width+3)*4+4)],[127,0,128,255]);
});
test('a group cannot merge different planes or exceed its raster budget',async()=>{
 await assert.rejects(prepareCoplanarColorRaster({faces:[face(0,[0,0,0,255]),face(3,[0,0,0,255],4)],pixelsPerUnit:4}),/share one plane/);
 await assert.rejects(prepareCoplanarColorRaster({faces:[face(0,[0,0,0,255])],pixelsPerUnit:100000}),/budget/);
});
test('a tile shows its image at two texels per CSS pixel and still covers its plane rectangle',async()=>{
 const raster=await prepareCoplanarColorRaster({faces:[face(0,[120,60,30,255]),face(4,[30,60,120,255])],pixelsPerUnit:4,tilePixels:8});
 const project=(m:readonly number[],x:number,y:number)=>[0,1,2].map(i=>(m[i]*x+m[4+i]*y+m[12+i])/(m[3]*x+m[7]*y+m[15]));
 const px=(value:string)=>value.split(' ').map(Number.parseFloat);
 for(const tile of raster.tiles){
  const layout=coplanarTileLayout(tile,raster,raster.width);
  const [width,height]=[layout.width,layout.height].map(Number.parseFloat),position=px(layout.backgroundPosition),size=px(layout.backgroundSize);
  assert.deepEqual([width,height,...position,...size],[tile.width/2,tile.height/2,-tile.x/2,-tile.y/2,raster.width/2,raster.height/2].map(value=>value+0));
  // Corners and an interior texel land on the same plane points as the one-texel-per-pixel tile.
  for(const [u,v] of [[0,0],[1,0],[1,1],[0,1],[.37,.61]]){
   const before=project(tile.matrix,u*tile.width,v*tile.height),after=project(layout.matrix,u*width,v*height);
   for(const axis of [0,1,2])assert.ok(Math.abs(before[axis]-after[axis])<1e-12,`tile ${tile.x},${tile.y} corner ${u},${v}`);
   const texel=[(u*width-position[0])*raster.width/size[0],(v*height-position[1])*raster.height/size[1]];
   assert.ok(Math.abs(texel[0]-(tile.x+u*tile.width))<1e-12&&Math.abs(texel[1]-(tile.y+v*tile.height))<1e-12,`tile ${tile.x},${tile.y} texel ${u},${v}`);
  }
 }
 // An image already at two texels per CSS pixel keeps its box: the scale never grows a leaf.
 const tile=raster.tiles[0]!,dense=coplanarTileLayout(tile,raster,4*raster.width);
 assert.deepEqual([dense.width,dense.matrix],[`${tile.width}px`,tile.matrix]);
 assert.throws(()=>coplanarTileLayout(tile,raster,0),/positive image width/);
});
