import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadPdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';

test('Thebe keeps the published west-positive radius samples in metres', async () => {
  const source = resolve(import.meta.dirname, '../../../../src/objects/thebe/source');
  const config = JSON.parse((await readFile(resolve(source, 'preparation/terrestrial.json'))).toString('utf8'));
  const profile = config.geometry.radialTerrain;
  const mesh = await loadPdsRadiusTable(resolve(source, profile.path), profile.grid);
  // Independent reference: the six corresponding cardinal rows of the PDS table.
  // East 90 maps to the released west 270 row, not west 90.
  for (const [longitude, latitude, metres] of [[0, 0, 51735.5], [90, 0, 46170.3], [180, 0, 51379.6], [270, 0, 43197.3], [0, 90, 42000], [0, -90, 35164.6]] as const) {
    assert.ok(Math.abs(required(mesh.sample(longitude, latitude)) - metres) < 0.001);
  }
});

// The Jan 2000 image is independently described as north-down in Denk et al.
test('Thebe original Galileo raster orientation follows SSI azimuth convention', async () => {
  const source = resolve(import.meta.dirname, '../../../../src/objects/thebe/source');
  const config = JSON.parse((await readFile(resolve(source, 'preparation/terrestrial.json'))).toString('utf8'));
  const frame = config.raster.surfaceObservations.find((lens: { id: string; }) => lens.id === 'normal').frames.find((frame: { id: string; }) => frame.id === 'c0532888400');
  const label = await readFile(resolve(source, frame.labelPath), 'utf8');
  const azimuth = Number(required(label.match(/\nNORTH_AZIMUTH\s*=\s*([\d.]+)/))[1]);
  assert.equal(frame.northAzimuthDegrees, (azimuth + 90) % 360);
  assert.ok(frame.northAzimuthDegrees > 180 && frame.northAzimuthDegrees < 190);
});

test('Thebe source Sun/observer vectors reproduce archived phase angles', async () => {
  const source = resolve(import.meta.dirname, '../../../../src/objects/thebe/source');
  const config = JSON.parse((await readFile(resolve(source, 'preparation/terrestrial.json'))).toString('utf8'));
  const vector = (lat: number, west: number) => { const a=lat*Math.PI/180,l=-west*Math.PI/180; return [Math.cos(a)*Math.cos(l),Math.cos(a)*Math.sin(l),Math.sin(a)]; };
  for (const frame of config.raster.surfaceObservations.find((lens: { id: string; }) => lens.id === 'normal').frames) {
    const meta = JSON.parse((await readFile(resolve(source, `geometry/${frame.id}-opus.json`))).toString('utf8'));
    const expected = Number(meta['Thebe Surface Geometry Constraints'].SURFACEGEOthebe_centerphaseangle1);
    const observer=vector(frame.observerLatitude,frame.observerWestLongitude), sun=vector(frame.sunLatitude,frame.sunWestLongitude);
    const phase=Math.acos(observer.reduce((sum,v,i)=>sum+v*sun[i],0))*180/Math.PI;
    assert.ok(Math.abs(phase-expected)<0.01, `${frame.id}: phase ${phase} vs ${expected}`);
  }
});
