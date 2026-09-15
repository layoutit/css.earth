import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageFromRow } from '../../src/observations/archives.ts';
import { imageRank, rankImages } from '../../src/observations/image-ranking.ts';
import { footprintCoverage } from '../../src/observations/footprint.ts';

const m31 = { id:'m31',messier:31,name:'Andromeda',aliases:[],type:'galaxy',raDegrees:10.6847083,decDegrees:41.26875,majorArcmin:199.53,minorArcmin:null,sourceIds:[] };
// Actual SPS_17782 metadata: overlap query returned this field, but M31's center is outside it.
const frame = imageFromRow('irsa', { obs_id:'SPS_17782',calib_level:2,s_ra:6.73951903,s_dec:39.96373146,s_fov:3.485,s_resolution:3.075,s_xel1:2040,s_xel2:2040,
  s_region:'POLYGON ICRS 9.670072737764135 39.13007738287743 5.681430184265877 37.6102134051373 3.718584145050802 40.74528598583915 7.88603769835424 42.34852532769826 9.670072737764135 39.13007738287743' }, 'https://irsa.ipac.caltech.edu/');
test('a marginal archive overlap cannot be promoted as a wide-field M31 image', () => {
  assert.equal(footprintCoverage(frame,m31,11971.8).center,false);
  assert.equal(imageRank(frame,m31).outside,true);
  assert.ok(!imageRank(frame,m31).reasons.some(reason => /Wide field|More detail/.test(reason)));
  const centered = {...frame,id:'centered',raDegrees:m31.raDegrees,decDegrees:m31.decDegrees,footprint:null,resolutionArcsec:10};
  assert.equal(rankImages([frame,centered],m31,'best')[0]!.id,'centered');
});
test('rotated and RA-wrapped footprints retain partial versus complete reference extent', () => {
  const object = {...m31,raDegrees:0,decDegrees:0};
  const image = {...frame,footprint:'POLYGON J2000 359 0 0 -1 1 0 0 1'};
  assert.deepEqual(footprintCoverage(image,object,600),{center:true,referenceExtent:true});
  assert.deepEqual(footprintCoverage(image,object,7200),{center:true,referenceExtent:false});
  assert.deepEqual(footprintCoverage({...image,footprint:'POLYGON GALACTIC 359 0 0 -1 1 0 0 1'},object,600),{center:null,referenceExtent:null});
});
test('the reported ESO e0941 field also misses M24 despite its large FOV', () => {
  const m24 = {...m31,id:'m24',messier:24,raDegrees:274.2,decDegrees:-18.55,majorArcmin:120};
  const eso = {...frame,provider:'eso' as const,raDegrees:275.5888,decDegrees:-19.6443,fieldDegrees:1.91,
    footprint:'POLYGON J2000 274.651018 -20.01601 275.389173 -18.704587 276.523467 -19.267138 275.792038 -20.58318'};
  assert.equal(footprintCoverage(eso,m24,7200).center,false);
  assert.equal(imageRank(eso,m24).outside,true);
});
