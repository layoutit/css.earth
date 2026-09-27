import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {decodeFrame, detectorMask, parseRecipe, readArchivedFrame, subtractColumnBackground} from './jiram-mosaic.mts';

const recipe = parseRecipe(JSON.parse(await readFile(new URL('../../../src/objects/io/source/science/jiram/recipe.json',import.meta.url),'utf8')));
const frame = {productId:'JIR_IMG_RDR_2023212T042659_V01',volume:'jnojir_2053'};
const label = `PDS_VERSION_ID = PDS3
PRODUCT_ID = ${frame.productId}
DATA_SET_ID = "JNO-J-JIRAM-3-RDR-V1.0"
TARGET_NAME = "N/A"
INSTRUMENT_MODE_ID = "SCI_I1_S1"
LINES = 256
LINE_SAMPLES = 432
UNIT = "W/(m^2*sr)"
END
`;
const image = Buffer.alloc(432*256*4);
image.writeFloatLE(0.0125,432*128*4);
image.writeFloatLE(9,0);

test('column subtraction preserves hot-spot excess, excludes daylight and withholds unsupported columns',()=>{
  const values=new Float32Array(432*128).fill(NaN), night=new Uint8Array(values.length);
  for(let y=0;y<128;y++) for(let x=0;x<2;x++) {
    const i=y*432+x; values[i]=y<64 ? .02+x*.03 : 5; night[i]=y<64 ? 1 : 0;
  }
  values[20*432]=.22; values[21*432]=.12; // Local hot spot above a .02 reflection.
  values[30*432]=.01; // Negative residuals must survive.
  values[2]=.9; night[2]=1; // No supported background for this column.
  const result=subtractColumnBackground(values,night,32);
  assert.ok(Math.abs(result.values[20*432]-.2)<1e-7);
  assert.ok(Math.abs(result.values[21*432]-.1)<1e-7);
  assert.ok(Math.abs(result.values[30*432]+.01)<1e-7);
  assert.equal(result.values[10*432+1],0);
  assert.ok(Number.isNaN(result.values[2]));
  assert.equal(values[20*432],Math.fround(.22));
  assert.throws(()=>subtractColumnBackground(values,night,0),/inputs/u);
});

test('a column background cannot be applied to a day-side mosaic',()=>{
  assert.throws(()=>parseRecipe({...recipe,side:'day',background:{method:'night-column-median',minimumSamples:32}}),/night map/u);
});

test('native product labels restore hashless recipes and keep the M-band half',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'jiram-product-'));
  try{
    const requests:string[]=[];
    const fetcher:typeof fetch=async input=>{requests.push(String(input));return new Response(String(input).endsWith('.LBL')?label:new Uint8Array(image));};
    const [bytes,nativeLabel]=await readArchivedFrame(recipe,frame,directory,true,fetcher);
    assert.equal(requests.length,2);
    assert.deepEqual(requests.sort(),['IMG','LBL'].map(ext=>`${recipe.archive}/${frame.volume}/DATA/${frame.productId}.${ext}`));
    assert.equal(decodeFrame(bytes,nativeLabel.toString(),recipe).values[0],Math.fround(.0125));
    const [cached]=await readArchivedFrame(recipe,frame,directory,false,async()=>{throw new Error('must use cache')});
    assert.deepEqual(cached,bytes);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('wrong archive identities and truncated images never enter the cache',async()=>{
  for(const [nativeLabel,bytes] of [[label.replace(frame.productId,'WRONG_PRODUCT'),image],[label.replace('JNO-J-JIRAM-3-RDR-V1.0','WRONG_DATASET'),image],[label,image.subarray(0,image.length-4)]] as const){
    const directory=await mkdtemp(join(tmpdir(),'jiram-rejected-'));
    try{
      const fetcher:typeof fetch=async input=>new Response(String(input).endsWith('.LBL')?nativeLabel:new Uint8Array(bytes));
      await assert.rejects(readArchivedFrame(recipe,frame,directory,true,fetcher),/identity|layout/u);
      assert.deepEqual(await readdir(directory),[]);
    }finally{await rm(directory,{recursive:true,force:true});}
  }
});

test('the raw detector mask excludes the non-linear boundary only in the selected band',()=>{
  const exposure='START_TIME = 2023-07-31T04:26:57.421\nSTOP_TIME = 2023-07-31T04:26:57.423\nEXPOSURE_DURATION = 0.002 <second>\n';
  const rawId=frame.productId.replace('_RDR_','_EDR_');
  const rdr=label.replace('END\n',exposure+`SOURCE_PRODUCT_ID = "${rawId}.IMG"\nEND\n`);
  const rawLabel=label.replace(frame.productId,rawId).replace('JNO-J-JIRAM-3-RDR-V1.0','JNO-J-JIRAM-2-EDR-V1.0').replace('END\n',exposure+'SAMPLE_TYPE = LSB_INTEGER\nSAMPLE_BITS = 16\nDATA_QUALITY_ID = "1"\nEND\n');
  const raw=Buffer.alloc(432*256*2);
  raw.writeInt16LE(15000,0); // L band must not censor M.
  raw.writeInt16LE(9999,432*128*2);
  raw.writeInt16LE(10000,(432*128+1)*2);
  raw.writeInt16LE(15000,(432*128+2)*2);
  const mask=detectorMask(raw,rawLabel,rdr,recipe,10000);
  assert.deepEqual(Array.from(mask.slice(0,4)),[0,1,1,0]);
  assert.equal(mask.reduce((n,v)=>n+v,0),2);
  assert.throws(()=>detectorMask(raw,rawLabel.replace('0.002 <second>','0.004 <second>'),rdr,recipe,10000),/exposure/u);
  assert.throws(()=>detectorMask(raw,rawLabel.replace(rawId,'WRONG_PRODUCT'),rdr,recipe,10000),/identity/u);
});
