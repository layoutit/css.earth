import assert from 'node:assert/strict';
import test from 'node:test';
import {APPROVED_MODEL,APPROVED_COMMIT,approvedTag,requireApprovedCommit,referenceSize,downsampleLinear,requireNativeAgreement} from './reference.mts';
import {loadObservation} from '../observation.mts';
test('delivery keeps the immutable owner-approved l36 tag',()=>{assert.equal(APPROVED_MODEL,36);approvedTag();requireApprovedCommit(APPROVED_COMMIT);assert.throws(()=>requireApprovedCommit('unapproved'));});
test('native reference enables 1024 px without changing the sky, exposure or registered rays',async()=>{
 const a=await loadObservation(8),d={sky:a.metadata.sky.rgbLinearDisplay,commonFactor:a.metadata.normalization.commonFactor},b=await loadObservation(16,undefined,d);
 assert.equal(b.width,1024);assert.equal(b.height,768);assert.deepEqual(b.metadata.sky.rgbLinearDisplay,d.sky);assert.equal(b.metadata.normalization.commonFactor,d.commonFactor);
 assert.deepEqual(b.rayAt(330,246),a.rayAt(165,123));assert.equal(referenceSize(1024),1024);assert.throws(()=>referenceSize(2048));
});
test('native comparisons average linear light instead of encoded bytes',()=>{
 const rgb=Float64Array.from([0,0,0,1,1,1,.25,.25,.25,.75,.75,.75]);assert.deepEqual([...downsampleLinear(rgb,2,2,2)],[.5,.5,.5]);assert.throws(()=>downsampleLinear(rgb,2,2,3));
});
test('native fidelity rejects a changed pin rather than buying detail with altered photometry',()=>{
 requireNativeAgreement(.0066,.0066);assert.throws(()=>requireNativeAgreement(.021,.006));assert.throws(()=>requireNativeAgreement(.006,.021));assert.throws(()=>requireNativeAgreement(NaN,0));
});
