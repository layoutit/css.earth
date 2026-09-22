import { required } from '../../contract/test-values.mts';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { readEncounterHdus, decodeEncounterFits } from './encounter-fits.mts';
import { encounterCamera, validateBodyFrame } from './encounter-camera.mts';
const card = (key: string, value: string | number | boolean) => `${key.padEnd(8)}= ${typeof value === 'string' ? `'${value.replaceAll("'", "''")}'` : typeof value === 'boolean' ? value ? 'T' : 'F' : value}`.padEnd(80);
function hdu(name: string, bitpix: number, data: readonly number[], extra: Record<string, string | number | boolean> = {}, width = 2, height = 2) {
  const header = Buffer.from([name === 'PRIMARY' ? card('SIMPLE', true) : card('XTENSION', 'IMAGE'), card('BITPIX', bitpix),
    card('NAXIS', 2), card('NAXIS1', width), card('NAXIS2', height), ...(name === 'PRIMARY' ? [] : [card('PCOUNT', 0),card('GCOUNT', 1),card('EXTNAME',name)]),
    ...Object.entries(extra).map(([k,v])=>card(k,v)), 'END'.padEnd(80)].join('').padEnd(2880));
  const bytes = Buffer.alloc(2880);
  data.forEach((n,i)=>bitpix===8?bytes[i]=n:bytes.writeFloatBE(n,i*4));
  return Buffer.concat([header,bytes]);
}
function navcam() { return Buffer.concat([
  hdu('PRIMARY',-32,[0,-.2,.8,1.1],{INSTRUME:'NAVCAM',BUNIT:'W/(cm^2*nm*sr)',OBSDATE:'2004-01-02T19:21:28.437',FILTNAME:'OPNAV',OBJECT:'Wild 2'}),
  hdu('QUALITY_MAP',8,[0,0,1,8]),hdu('UNCERTAINTY_MAP',-32,[.1,.1,.1,.1]),hdu('SNR_MAP',-32,[0,-2,8,11])]); }
const policy={instrument:'stardust-navcam',width:2,height:2,startTime:'2004-01-02T19:21:28.437',filter:'OPNAV',target:'Wild 2'};
test('calibrated zero and negative radiance survive; missing and saturated pixels do not',()=>{
  const f=decodeEncounterFits(navcam(),policy);
  assert.equal(f.reason(0),null); assert.equal(f.reason(1),null);
  assert.equal(f.reason(2),'detector-quality'); assert.equal(f.reason(3),'detector-quality');
  assert.equal(f.units,'W/(cm^2*nm*sr)'); assert.equal(f.values[0],0); assert.ok(f.values[1]<0);
});
test('FITS records, axis layouts and product identity are checked',()=>{
  assert.throws(()=>readEncounterHdus(navcam().subarray(0,-1)),/Truncated/);
  assert.throws(()=>decodeEncounterFits(navcam(),{...policy,target:'Tempel 1'}),/metadata/);
  assert.throws(()=>decodeEncounterFits(navcam(),{...policy,width:4}),/layout/);
  const b=navcam(); b.write(card('NAXIS1',4),80*3,'ascii');
  assert.throws(()=>decodeEncounterFits(b,policy),/layout/);
});
test('HRI quality uses the positive mask; residuals remain convergence diagnostics',()=>{
  const b=Buffer.concat([hdu('PRIMARY',-32,[0,1,2,3],{INSTRUME:'HRIVIS',BUNIT:'W/(m^2*sr*um)',OBSDATE:'t',FILTER:'CLEAR1',OBJECT:'Hartley 2'}),
    hdu('RESIDUAL',-32,[0,0,5,-2]),hdu('MASK',8,[1,0,1,1])]);
  const f=decodeEncounterFits(b,{instrument:'epoxi-hri-deconvolved',width:2,height:2,startTime:'t',filter:'CLEAR1',target:'Hartley 2',residualPolicy:'record-only'});
  assert.equal(f.reason(0),null); assert.equal(f.reason(1),'detector-quality');
  assert.equal(f.reason(2),null); assert.equal(required(f.report.residualStatistics).maximumAbsolute,5); assert.equal(f.reason(3),null);
});
test('source TAN projection preserves sky handedness and the zero-based detector center',()=>{
  const degreesPerPixel=180/Math.PI/100;
  const h={WCS_STAT:'OK',DNAXIS1:'+X, RIGHT',DNAXIS2:'+Y, UP',CTYPE1:'RA---TAN',CTYPE2:'DEC--TAN',CUNIT1:'deg',CUNIT2:'deg',
    SCTARGRX:10,SCTARGRY:0,SCTARGRZ:0,SCSUNRX:110,SCSUNRY:0,SCSUNRZ:0,
    CRVAL1:0,CRVAL2:0,CDELT1:-1,CDELT2:1,PC1_1:degreesPerPixel,PC1_2:0,PC2_1:0,PC2_2:degreesPerPixel,CRPIX1:3.5,CRPIX2:3.5};
  const c=encounterCamera(h,{bodyToJ2000:[[1,0,0],[0,1,0],[0,0,1]],offsetPixels:[2,-3],maximumOffsetPixels:4});
  const near=(actual: readonly number[] | null,expected: readonly number[])=>required(actual).forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<1e-9));
  near(c.positionMeters,[-10000,0,0]);near(c.project([0,0,0]),[4.5,-.5,10000]);
  near(c.project([0,1000,1000]),[-5.5,9.5,10000]);near(c.ray(4.5,-.5),[1,0,0]);
  assert.equal(c.project([-11000,0,0]),null);
});
test('reflection, shear and unbounded pointing corrections are rejected',()=>{
  assert.throws(()=>validateBodyFrame([[1,0,0],[0,1,0],[0,0,-1]]),/handedness/);
  assert.throws(()=>validateBodyFrame([[1,0,0],[0,1,.1],[0,0,1]]),/orthonormal/);
  assert.throws(()=>encounterCamera({}, {bodyToJ2000:[[1,0,0],[0,1,0],[0,0,1]],offsetPixels:[3,4],maximumOffsetPixels:4}),/budget/);
});
test('finite overclock values are excluded even when the quality byte says good',()=>{
 const width=8,height=8,primary=Array(64).fill(.1);primary[0]=3e38;
 const b=Buffer.concat([
  hdu('PRIMARY',-32,primary,{INSTRUME:'MRIVIS',BUNIT:'W/(m^2*sr*um)',OBSDATE:'t',FILTER:'CLEAR1',OBJECT:'Tempel 1'},width,height),
  hdu('FLAGS',8,Array(64).fill(0),{},width,height),hdu('SNR',-32,Array(64).fill(1),{},width,height),hdu('DESTRIPE',-32,Array(16).fill(0),{},2,height)]);
 const f=decodeEncounterFits(b,{instrument:'deep-impact-mri',width,height,startTime:'t',filter:'CLEAR1',target:'Tempel 1',detectorBorderPixels:1});
 assert.equal(f.quality[0],0);assert.equal(f.reason(0),'detector-overclock');assert.equal(f.reason(9),null);assert.equal(f.reason(15),'detector-overclock');
});
