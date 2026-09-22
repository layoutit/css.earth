import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {array,boolean,nullable,number,shape,text} from './source-records.mts';
import {decodeHriiSolarTable,fitHriiSpectrum} from './hrii-spectra.mts';
const parse=shape({method:text,cases:array(shape({body:text,path:text,detectorRow:number,incidenceCosine:number,heliocentricDistanceAu:number,
 reference:shape({temperatureKelvin:number,slopePercentPer100Nm:number}),samples:array(shape({wavelengthMicrons:number,radiance:nullable(number),valid:boolean}))}))});
const fixture=parse(JSON.parse(readFileSync(new URL('../../../tests/objects/fixtures/comets/hrii-native-reference.json',import.meta.url),'utf8')));
for(const c of fixture.cases)test(`${c.body} native ${c.path.split('/').at(-1)} row ${c.detectorRow}: independent Astropy/SciPy fit`,()=>{
 assert.ok(['comet-9p','comet-103p'].includes(c.body));
 const solar=decodeHriiSolarTable(readFileSync(new URL(`../../../src/objects/${c.body}/source/science/hrii/hriir_020601_2_0.tab`,import.meta.url),'utf8'));
 const result=fitHriiSpectrum(c.samples.map(s=>({...s,radiance:s.radiance??0})),solar,{incidenceCosine:c.incidenceCosine,heliocentricDistanceAu:c.heliocentricDistanceAu});
 assert.ok(result);assert.ok(Math.abs(result.thermal.colorTemperatureKelvin-c.reference.temperatureKelvin)<.05);
 assert.ok(Math.abs(result.continuum.slopePercentPer100Nm-c.reference.slopePercentPer100Nm)<.01);
});

for(const c of fixture.cases)test(`${c.body} row ${c.detectorRow}: native FITS channels and masks match the Astropy extract`,async()=>{
 const {createHash}=await import('node:crypto'),{decodeHriiSpectra}=await import('./hrii-spectra.mts');
 assert.ok(['comet-9p','comet-103p'].includes(c.body)&&/^science\/hrii\/hi[0-9_]+_r{1,2}\.fit$/.test(c.path));
 const bytes=readFileSync(new URL(`../../../src/objects/${c.body}/source/${c.path}`,import.meta.url));
 const spectrum=decodeHriiSpectra(bytes),actual=[];
 for(let k=0;k<spectrum.width;k++){
  const i=c.detectorRow*spectrum.width+k,wavelengthMicrons=spectrum.wavelength[i];
  if(!Number.isFinite(wavelengthMicrons)||wavelengthMicrons<1.5||wavelengthMicrons>4.4)continue;
  actual.push({wavelengthMicrons,radiance:Number.isFinite(spectrum.values[i])?spectrum.values[i]:null,valid:!spectrum.reject(i)});
 }
 assert.deepEqual(actual,c.samples);
});
