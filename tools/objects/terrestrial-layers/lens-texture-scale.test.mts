import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { lensTextureGrid } from './raster-grid.mts';
import { createProjectiveSurfaceRasterLayout } from '../../../src/platform/projective-surface-raster.mts';
const test = sourceTest();

test('reduced science textures preserve every normalized band and gutter address',()=>{
  for(const raster of [{width:4096,height:2048,gutter:32,poleSize:512,bandCount:16},{width:12800,height:6400,gutter:64,poleSize:1024,bandCount:16}]){
    const full=createProjectiveSurfaceRasterLayout(raster);
    for(const scale of [.5,.25]){
      const grid=lensTextureGrid({textureScale:scale},raster), small=createProjectiveSurfaceRasterLayout({...grid,bandCount:raster.bandCount});
      assert.equal(small.packedWidth/full.packedWidth,scale);assert.equal(small.packedHeight/full.packedHeight,scale);
      assert.equal(grid.poleSize/raster.poleSize,scale);
      for(let i=0;i<full.bands.length;i++) for(const key of ['y','height','packedY'] as const) assert.equal(small.bands[i][key]/small.packedHeight,full.bands[i][key]/full.packedHeight);
    }
    assert.deepEqual(lensTextureGrid({},raster),Object.fromEntries((['width','height','gutter','poleSize'] as const).map(k=>[k,raster[k]])));
    for(const lens of [{textureScale:.3},{textureScale:2},{textureScale:.5,monochromeBase:'normal'},{textureScale:.5,previewGrid:{width:32,height:16}}])assert.throws(()=>lensTextureGrid(lens,raster));
  }
});
