import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {skyProjection} from '@cssearth/fits';
import {binNative,binnedHeader,COUNTS_TO_FLUX,RAYLEIGH_ARCSEC2,surfaceBrightness,reducedComplete} from './native.mts';
import {makeRaster} from '../inputs.mts';
import {bodyToIcrs} from '../geometry.mts';
import {blendSurvey,skyAreaJacobian} from './survey.mts';
import {feather,sourceOffset,coverageDistance} from './mosaic.mts';
import {surveyAgreement,matchedMeans} from './quality.mts';
import {solveOffsets} from './offsets.mts';
import {areaMean} from './area.mts';
import {siaRows} from './service.mts';
test('area binning preserves surface brightness and missing exposure separately from measured zero',()=>{const a=Float32Array.from([2,2,0,0,2,2,0,0,0,4,NaN,NaN,4,4,NaN,NaN]),b=binNative(a,4,4,2);assert.equal(b.values[0],2);assert.ok(Number.isNaN(b.values[1]));assert.equal(b.values[2],3);assert.ok(Number.isNaN(b.values[3]));assert.equal(b.covered,2);assert.ok(COUNTS_TO_FLUX/.27**2/RAYLEIGH_ARCSEC2>5);});
test('binning moves reference pixels so the reduced centre remains at the native area centre',()=>{const h={CTYPE1:'RA---TAN',CTYPE2:'DEC--TAN',CRVAL1:80,CRVAL2:-69,CRPIX1:50.3,CRPIX2:47.8,CD1_1:-.27/3600,CD1_2:0,CD2_1:0,CD2_2:.27/3600,CDELT1:1};const {CDELT1:redundant,...linear}=h;assert.equal(redundant,1);const a=skyProjection(linear),b=skyProjection(binnedHeader(h,11));const x=a.skyOf(27,38),y=b.skyOf(2,3);assert.ok(Math.abs(x[0]-y[0])<1e-10&&Math.abs(x[1]-y[1])<1e-10);assert.equal(h.CDELT1,1);});
test('gaps use fallback and the boundary blend is continuous without interpreting NaN as black',()=>{assert.equal(blendSurvey(NaN,12,1),12);assert.equal(blendSurvey(30,10,0),10);assert.equal(blendSurvey(30,10,.5),20);assert.equal(blendSurvey(30,10,1),30);assert.equal(feather(0,40,100,100),0);assert.equal(feather(20,40,100,100),1);const a=new Float32Array(100*100).fill(1);a[50*100+50]=NaN;const d=coverageDistance(a,100,100);assert.equal(d[50*100+50],0);assert.equal(d[50*100+51],1);assert.equal(d[30*100+30],20);});
test('the additive sky anchor is robust and cannot rescale a bright filament',()=>{assert.equal(sourceOffset([...Array<number>(100).fill(3),10000]),3);assert.equal(sourceOffset([99]),0);const filament=1000,offset=sourceOffset(Array<number>(100).fill(3));assert.equal((filament+3)-offset,filament);});
test('SIA errors and malformed rows are refused while access identities survive XML decoding',()=>{assert.throws(()=>siaRows('<VOTABLE><INFO value="ERROR"/></VOTABLE>'));assert.deepEqual(siaRows('<VOTABLE><FIELD name="access_url"/><TR><TD>https://example/a?x=1&amp;y=2</TD></TR></VOTABLE>'),[{access_url:'https://example/a?x=1&y=2'}]);assert.throws(()=>siaRows('<VOTABLE><FIELD name="a"/><TR></TR></VOTABLE>'));});

test('the released DN scale is applied once and signed surface brightness survives binning',()=>{const a=surfaceBrightness(Float32Array.from([1,-2,NaN]),.27**2);assert.ok(Math.abs(a[0]-2.4e-18/.27**2/5.661e-18)<1e-6);assert.equal(a[1],-2*a[0]);assert.ok(Number.isNaN(a[2]));});
test('area integration includes a narrow filament missed by a sparse centre grid',()=>{const n=30,a=new Float32Array(n*n),coverage=new Float32Array(a.length).fill(1);for(let y=0;y<n;y++)a[y*n+7]=30;const v=areaMean(a,coverage,n,n,[[-.5,-.5],[29.5,-.5],[29.5,29.5],[-.5,29.5]]);assert.equal(v.mean,1);assert.equal(v.coverage,1);for(let i=0;i<coverage.length;i++)if(i%n<15)coverage[i]=0;assert.equal(areaMean(a,coverage,n,n,[[-.5,-.5],[29.5,-.5],[29.5,29.5],[-.5,29.5]]).coverage,.5);});
test('contiguous zero-filled gap edges do not dilute the valid area mean',()=>{const a=Float32Array.from([3,4,0,0,5,4,0,0,4,3,0,0,5,4,0,0]);const b=binNative(a,4,4,4);assert.equal(b.values[0],4);});

test('sky-to-plane transport includes the squared observer distance on both near and far sides',()=>{const warp=makeRaster(32,10),a=bodyToIcrs([0,0,0]),b=bodyToIcrs([0,0,1]),normal=b.map((v,i)=>v-a[i]);for(const x of [-4,0,4]){const p=bodyToIcrs([x,2,0]),distance=Math.hypot(...p),expected=Math.abs(normal.reduce((s,v,i)=>s+v*p[i]/distance,0))*(180/Math.PI)**2;assert.ok(Math.abs(skyAreaJacobian(warp,x,2)/expected-1)<.001);}});

test('overlap differences recover relative sky zeros without changing local contrast',()=>{const r=solveOffsets(4,[{a:0,b:1,difference:-3,samples:100,scatter:1},{a:1,b:2,difference:5,samples:100,scatter:1},{a:0,b:2,difference:2,samples:100,scatter:1}]);assert.ok(Math.abs(r.offsets[1]-3)<1e-6);assert.ok(Math.abs(r.offsets[2]+2)<1e-6);assert.equal(r.anchors.length,2);assert.equal((100-r.offsets[1])-(20-r.offsets[1]),80);});

test('resume rejects interrupted reduced data or metadata and accepts only complete dimensions',async()=>{const dir=await mkdtemp(join(tmpdir(),'lmc-native-')),p=join(dir,'tile');try{await writeFile(p+'.json','{');assert.equal(await reducedComplete(p),false);await writeFile(p+'.json',JSON.stringify({width:2,height:2,maskVersion:3}));await writeFile(p+'.f32le',Buffer.alloc(4));assert.equal(await reducedComplete(p),false);await writeFile(p+'.f32le',Buffer.alloc(16));assert.equal(await reducedComplete(p),true);}finally{await rm(dir,{recursive:true,force:true});}});

test('continuum subtraction can shift synthetic no-exposure padding away from zero',()=>{const a=Float32Array.from([3,5,343,343,4,8,343,343,2,9,343,343,7,6,343,343]),b=binNative(a,4,4,4);assert.equal(b.covered,1);assert.equal(b.values[0],5.5);});

test('independent-survey quality rejects a false pedestal and retains consistent faint or bright emission',()=>{assert.equal(surveyAgreement(300,5),0);assert.equal(surveyAgreement(6,5),1);assert.equal(surveyAgreement(350,300),1);assert.equal(surveyAgreement(NaN,5),0);const a=Float32Array.from([2,100,2,2]),b=Float32Array.from([2,10000,2,2]),w=Float32Array.from([1,0,1,1]),v=matchedMeans(a,b,w,2);assert.equal(v.first[0],2);assert.equal(v.second[0],2);});
