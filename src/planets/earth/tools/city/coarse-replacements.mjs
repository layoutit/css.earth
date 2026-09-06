import { prepareCityPageGeometry, createCityGeographicSampler } from './page-geometry.mjs';
import { wmtsRow } from './wmts-page-geometry.mjs';

// Preparation only. A regular face has one nonsingular projective geographic
// map. Corner bounds enclose the page, including its apron; pinned pixel alpha
// can narrow that enclosure to actual image support. Require every source cell
// in the support, not merely a tile that overlaps it. Prepared paths let the
// runtime find selected ancestors without deriving geographic tile addresses.
// The accepted cap has a different mapping and intentionally has no certificate.
export function prepareCoarseReplacements(address, scene, roots, image) {
  const page = prepareCityPageGeometry(address, scene);
  if(image){
    if(!Number.isSafeInteger(image.width)||image.width<1||!Number.isSafeInteger(image.height)||image.height<1||image.rgba.length!==image.width*image.height*4)throw new Error('Invalid prepared backing pixels.');
    if(!image.rgba.some((value,index)=>index%4===3&&value))return {empty:true,branches:[]};
  }
  if (page.bounds.projection === 'polar') return undefined;
  const level = 7, side = 2 ** level, available = new Set(roots.map(root => root.key));
  const required = new Map();
  function include({ west, east, south, north }) {
    const y0 = Math.floor(wmtsRow(north, level)), y1 = Math.ceil(wmtsRow(south, level));
    const x0 = Math.floor((west + 180) / 360 * side), x1 = Math.ceil((east + 180) / 360 * side);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const column = ((x % side) + side) % side;
      const branch = [5,6,7].map(z => `wmts-tile-${z}-${Math.floor(column / 2 ** (level-z))}-${Math.floor(y / 2 ** (level-z))}`);
      required.set(branch.at(-1), branch);
    }
  }
  if (!image) include(page.sourceBounds);
  else {
    const {rgba,width,height}=image;
    if (!Number.isSafeInteger(width)||width<1||!Number.isSafeInteger(height)||height<1||rgba.length!==width*height*4) throw new Error('Invalid prepared backing pixels.');
    const sample=createCityGeographicSampler(page);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      if(!rgba[(y*width+x)*4+3])continue;
      // Encoded rows grow northward, like the retained face. Include a whole
      // neighbouring texel for bilinear support, clamped to the image's edge.
      const u0=Math.max(0,x-1)/width,u1=Math.min(width,x+2)/width;
      const v0=Math.max(0,y-1)/height,v1=Math.min(height,y+2)/height;
      const corners=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(uv=>sample(...uv));
      include({west:Math.min(...corners.map(p=>p[0])),east:Math.max(...corners.map(p=>p[0])),south:Math.min(...corners.map(p=>p[1])),north:Math.max(...corners.map(p=>p[1]))});
    }
  }
  const branches=[...required].sort(([a],[b])=>a.localeCompare(b)).map(([,branch])=>branch);
  if(branches.some(branch=>!available.has(branch[0])))return undefined;
  return branches.length?{branches}:{empty:true,branches:[]};
}
