import test from 'node:test';
import assert from 'node:assert/strict';
import {youngPhase,projectedMotion,isYoungMember,parseStars,query,type GaiaStar,type Membership} from './gaia-young.mts';
import {densityFromMembers} from './gaia-density.mts';
import {loadFrozenL12} from './frozen-l12.mts';
import {makeRaster,json,rec,array,LOCAL,loadSources,at,type Sources} from './inputs.mts';
import {gaiaWarpLocator} from './gaia-plane.mts';
import {balanceGaiaGrade} from './gaia-balance.mts';
import {gradedPrediction,type Grade} from './grade.mts';
import {bodyToIcrs,skyOf} from './geometry.mts';
const member:GaiaStar={id:'1234567890123456789',ra:81.28,dec:-69.78,g:17,bp:17.1,rp:17,parallax:0,parallaxError:.05,pmra:1.8,pmdec:.3,pmraError:.1,pmdecError:.1,parallaxPmraCorr:0,parallaxPmdecCorr:0};
const membership:Membership={mean:[1.8,.3],covariance:[.09,0,.09],parallaxMedian:0,calibrationRows:1000,retainedCalibration:990};
test('Luri Young 1 and Young 2 polygons exclude red and faint populations',()=>{
 assert.equal(youngPhase(15,0),1);assert.equal(youngPhase(17,.2),2);assert.equal(youngPhase(17,.4),0);assert.equal(youngPhase(19,.1),0);assert.equal(youngPhase(9,-.5),0);assert.equal(youngPhase(17,-1.2),0);
});
test('membership rejects foreground and SMC-like proper motions without rejecting plausible negative parallaxes',()=>{
 assert.ok(isYoungMember(member,membership));assert.ok(!isYoungMember({...member,parallax:1},membership));assert.ok(!isYoungMember({...member,pmra:.8,pmdec:-1.2},membership));assert.ok(!isYoungMember({...member,pmra:8},membership));assert.ok(isYoungMember({...member,parallax:-.05},membership));assert.ok(!isYoungMember({...member,bp:18},membership));
});
test('conditional proper motion uses the parallax correlations in the paper',()=>{
 const p=projectedMotion({...member,parallax:.1,parallaxPmraCorr:.5,parallaxPmdecCorr:-.5},0);assert.ok(Math.abs(p[0]-1.7)<1e-12);assert.ok(Math.abs(p[1]-.4)<1e-12);
});
test('complete Gaia query contains the CMD, astrometric and spatial bounds',()=>{
 const q=query('young');assert.match(q,/gaiadr3\.gaia_source/u);assert.match(q,/81\.28,-69\.78,20/u);assert.match(q,/parallax\/parallax_error<5/u);assert.match(q,/phot_g_mean_mag<18/u);assert.match(q,/0\.08\*phot_g_mean_mag-1\.10/u);assert.throws(()=>parseStars([{source_id:1234567890123456789}]),/identity|Missing/u);
});
function emptySources():Sources{const make=()=>{const z=makeRaster(4,20);z.mask.fill(1);return z;};return{warp:make(),dust:make(),young:[make(),make(),make()],youngCoverage:make(),youngFraction:0,oldColor:[1,1,1],gas:make(),metadata:{}};}
test('Gaia density has no analytic outer-light tail and cannot be altered by SMASH stellar fields',()=>{
 const sources=emptySources(),stars=Array.from({length:60},(_,i)=>{const angle=i/60*Math.PI,[ra,dec]=skyOf(bodyToIcrs([2*Math.cos(angle),2*Math.sin(angle),0]));return{ra,dec};}),map=densityFromMembers(stars,sources,128,10),cell=20/128;assert.ok(Math.abs(map.values.reduce((a,b)=>a+b,0)*cell*cell-1)<1e-6);assert.equal(map.values[64*128+115],0);
 sources.young[0].values.fill(10000);sources.youngFraction=999;assert.deepEqual(map,densityFromMembers(stars,sources,128,10));
});
test('the l13 baseline loader retains every saved l12 primitive and dust cloud',async()=>{
 const saved=rec(await json(LOCAL+'versions/l12/structure.json')),scene=await loadFrozenL12();assert.equal(scene.objects.length,array(saved.objects).length);assert.deepEqual(scene.objects,saved.objects);assert.deepEqual(scene.dust,saved.dust);assert.deepEqual(scene.owners,saved.owners);
});
test('Gaia placement handles steep warp cells and reports discontinuous support without changing the warp',async()=>{
 const sources=await loadSources(512,20,false),before=sources.warp.values.slice(),stats={bracketed:0,multipleIntersections:0,maximumResidualKpc:0,finiteLayerAnchors:0,maximumFiniteLayerOffsetKpc:0},locate=gaiaWarpLocator(sources,stats);
 for(const [ra,dec] of [[54.09415058406421,-74.03827224720902],[60.35468537549784,-74.58864545843296],[62.91740120949708,-68.08370458555669]]){const p=locate(ra,dec);assert.ok(Math.abs(p[2]-at(sources.warp,p[0],p[1]))<1e-6);}
 for(const [ra,dec] of [[55.032801718099336,-75.61261121202567],[62.11982186173046,-67.39093644047728]]){const p=locate(ra,dec);assert.ok(Math.abs(p[2]-at(sources.warp,p[0],p[1]))<.4);}
 assert.ok(stats.bracketed>0);assert.equal(stats.finiteLayerAnchors,2);assert.ok(stats.maximumFiniteLayerOffsetKpc>.1);assert.deepEqual(sources.warp.values,before);
});
test('global balance corrects faint outer light without changing component shapes or RGB tint ratios',()=>{
 const basis={width:8,height:8,dustGain:1,planes:Array.from({length:5},()=>new Float64Array(64*3))},groups=Uint8Array.from({length:64},(_,i)=>Math.floor(i%8/2));
 for(let p=0;p<64;p++)for(let c=0;c<3;c++){basis.planes[0][p*3+c]=.1/(1+groups[p])*(1+.1*c);basis.planes[1][p*3+c]=groups[p]===0?.2:0;basis.planes[3][p*3+c]=groups[p]===2?.05*(1+.5*c):0;}
 const truth:Grade={coefficients:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]],stretch:2,saturation:1,dustStrength:1,dustTint:[1,1,1],score:1},initial=structuredClone(truth);initial.coefficients[0]=[.45,.45,.45];const data=gradedPrediction(basis,truth),target={data,train:new Uint8Array(64).fill(1),holdout:new Uint8Array(64)},before=structuredClone(basis),result=balanceGaiaGrade(basis,initial,target,groups);
 let observed=0,predicted=0;for(let p=0;p<64;p++)if(groups[p]===3)for(let c=0;c<3;c++){observed+=data[p*3+c];predicted+=result.prediction[p*3+c];}assert.ok(Math.abs(predicted/observed-1)<.05);assert.ok(result.diagnostics.after<result.diagnostics.before);assert.deepEqual(basis,before);assert.deepEqual(result.grade.coefficients[0],[result.grade.coefficients[0][0],result.grade.coefficients[0][0],result.grade.coefficients[0][0]]);
});
