/** Independent byte check for the compact display maps. The detached PDS3 label
 * supplies native offsets and coordinates; the production TIFF reader is not used.
 * Usage: node tests/oracles/geotiff-image.mts <body-source-root> <name> <native.tif> <report.json> */
import {open, readFile, writeFile} from 'node:fs/promises';
import sharp from 'sharp';
const [root,id,native,output]=process.argv.slice(2);
if(!root||!id||!native||!output)throw new Error('Expected source root, image id, native TIFF and report path.');
const label=await readFile(`${root}/maps/native/${id}.lbl`,'utf8');
const number=(key:string)=>{const m=new RegExp(`^\\s*${key}\\s*=\\s*([0-9.+-]+)`,'m').exec(label);if(!m)throw new Error(`Missing ${key}.`);return Number(m[1]);};
if(!/BAND_STORAGE_TYPE\s*=\s*BAND_SEQUENTIAL/.test(label)||!/SAMPLE_TYPE\s*=\s*LSB_UNSIGNED_INTEGER/.test(label)||number('SAMPLE_BITS')!==8||
  !/POSITIVE_LONGITUDE_DIRECTION\s*=\s*EAST/.test(label)||!/PROJECTION_LATITUDE_TYPE\s*=\s*PLANETOCENTRIC/.test(label)||
  number('CENTER_LONGITUDE')!==0||number('WESTERNMOST_LONGITUDE')!==-180||number('EASTERNMOST_LONGITUDE')!==180||
  number('MAXIMUM_LATITUDE')!==90||number('MINIMUM_LATITUDE')!==-90)throw new Error('Unsupported native label frame.');
const first=Number(/\^IMAGE\s*=\s*\("[^"\n]+",\s*(\d+)\s*<BYTES>\)/.exec(label)?.[1])-1;
if(!Number.isSafeInteger(first)||first<0)throw new Error('Missing PDS image byte offset.');
const columns=number('LINE_SAMPLES'),rows=number('LINES'),bands=number('BANDS');
const bytes=await readFile(`${root}/maps/native/${id}.png`);
const {data,info}=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
const targets=[[0,0],[.25,0],[.5,0],[.75,0],[1,0],[0,.25],[.25,.25],[.5,.25],[.75,.25],[1,.25],
  [0,.5],[.25,.5],[.5,.5],[.75,.5],[1,.5],[0,.75],[.25,.75],[.5,.75],[.75,.75],[1,.75],
  [0,1],[.25,1],[.5,1],[.75,1],[1,1]];
const file=await open(native,'r');const checks=[];
try {
  for(const [u,v] of targets){
    const x=Math.round(u!*(info.width-1)),y=Math.round(v!*(info.height-1));
    // These are native pixel-edge coordinates, derived from the labelled full-globe extents.
    const west=x*columns/info.width,east=(x+1)*columns/info.width,north=y*rows/info.height,south=(y+1)*rows/info.height;
    const left=Math.floor(west),right=Math.ceil(east),top=Math.floor(north),bottom=Math.ceil(south);
    const channels=[];
    for(let b=0;b<bands;b++){
      const block=Buffer.alloc((bottom-top)*columns);
      const result=await file.read(block,0,block.length,first+b*columns*rows+top*columns);
      if(result.bytesRead!==block.length)throw new Error('Truncated native image rows.');channels.push(block);
    }
    const sums=Array(bands).fill(0) as number[];let area=0;
    for(let sy=top;sy<bottom;sy++)for(let sx=left;sx<right;sx++){
      const pos=(sy-top)*columns+sx;
      if(channels.every(c=>c[pos]===0))continue;
      const weight=(Math.min(east,sx+1)-Math.max(west,sx))*(Math.min(south,sy+1)-Math.max(north,sy));
      area+=weight;for(let b=0;b<bands;b++)sums[b]!+=weight*channels[b]![pos]!;
    }
    const actual=Array.from(data.subarray((y*info.width+x)*3,(y*info.width+x)*3+3));
    const expected=area?Array.from({length:3},(_,c)=>Math.round(sums[bands===1?0:c]!/area)):null;
    // Missing pixels have no scientific color to compare. Verify a neutral gray pattern, not synthesized hue.
    const pass=expected?expected.every((n,c)=>n===actual[c]):Math.max(...actual)-Math.min(...actual)<=4&&actual.every(n=>n>=82&&n<=115);
    checks.push({x,y,longitude:-180+(x+.5)*360/info.width,latitude:90-(y+.5)*180/info.height,expected,actual,observedFraction:area/((east-west)*(south-north)),pass});
  }
}finally{await file.close();}
const report={passed:checks.every(c=>c.pass),method:'Independent PDS3-labelled band-sequential byte offsets and explicit source-cell overlap sums; no production GeoTIFF reader or reduction helper. Checks representative footprints, poles, both sides of the seam and the equator; does not establish instrument accuracy.',
  native,checks};
await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(`${id}: ${checks.filter(c=>c.pass).length}/${checks.length} independent footprints agree`);if(!report.passed)process.exitCode=1;
