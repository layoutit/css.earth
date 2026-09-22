import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {prepareCoplanarColorRaster} from './coplanar-raster.mts';
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
