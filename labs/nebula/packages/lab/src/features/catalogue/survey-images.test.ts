import assert from 'node:assert/strict';
import { test } from 'node:test';
import { surveyImages, surveyImageUrl, surveyFieldDegrees } from './survey-images';
import type { MessierObject } from './types';

test('every survey uses the object center, same north-up scale and rendered JPEG, without archive-product substitution', () => {
  const object: MessierObject = {id:'m31',messier:31,name:'M31',aliases:[],type:'galaxy',raDegrees:10.6847,decDegrees:41.2687,majorArcmin:199.53,minorArcmin:null,sourceIds:[]};
  const field = surveyFieldDegrees(11971.8);
  assert.equal(field,11971.8/3600*1.25);
  for (const survey of surveyImages) for (const pixels of [512,2048] as const) {
    const url = new URL(surveyImageUrl(survey,object,field,pixels));
    assert.equal(url.searchParams.get('ra'),String(object.raDegrees));
    assert.equal(url.searchParams.get('dec'),String(object.decDegrees));
    assert.equal(url.searchParams.get('fov'),String(field));
    assert.equal(url.searchParams.get('rotation_angle'),'0');
    assert.equal(url.searchParams.get('coordsys'),'icrs');
    assert.equal(url.searchParams.get('format'),'jpg');
    assert.equal(url.searchParams.get('width'),String(pixels));
    assert.equal(url.searchParams.get('hips'),survey.hips);
  }
  assert.equal(surveyFieldDegrees(null),1);
});
