import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import {readFile} from 'node:fs/promises';
import {decodeHriiSolarTable,fitHriiContinuum,fitHriiThermal,fitHriiSpectrum,planckRadiance,solarIrradiance} from './hrii-spectra.mts';
import {array,number,shape,text} from './source-records.mts';

const parse=shape({reference:text,temperatureKelvin:number,amplitude:number,slopePercentPer100Nm:number,incidenceCosine:number,heliocentricDistanceAu:number,samples:array(array(number)),planckAnchors:array(array(number))});
const reference=parse(JSON.parse(await readFile(new URL('../../../tests/objects/fixtures/comets/hrii-spectral-reference.json',import.meta.url),'utf8')));
const solar={wavelengthMicrons:reference.samples.map(x=>x[0]),irradiance:reference.samples.map(x=>x[1])};
const samples=reference.samples.map(x=>({wavelengthMicrons:x[0],radiance:x[2],valid:true}));
const illumination={incidenceCosine:reference.incidenceCosine,heliocentricDistanceAu:reference.heliocentricDistanceAu};

test('Planck radiance agrees with independently evaluated Astropy anchors',()=>{
  for(const [wavelength,temperature,radiance] of reference.planckAnchors)assert.ok(Math.abs(planckRadiance(wavelength,temperature)/radiance-1)<1e-12);
  assert.throws(()=>planckRadiance(0,350));assert.throws(()=>planckRadiance(4,NaN));
});

test('continuum and thermal fit recover a spectrum with free amplitude and wavelength-dependent emissivity',()=>{
  const result=fitHriiSpectrum(samples,solar,illumination);assert.ok(result);
  const {continuum,thermal}=result;
  assert.ok(Math.abs(continuum.slopePercentPer100Nm-reference.slopePercentPer100Nm)<.001);
  assert.ok(Math.abs(thermal.colorTemperatureKelvin-reference.temperatureKelvin)<.02);
  assert.ok(Math.abs(thermal.anisothermalAmplitude-reference.amplitude)<.001);
  assert.ok(thermal.relativeAbsoluteResidual<.0001);
});

test('detector-invalid values and sparse emission lines do not determine color temperature',()=>{
  const damaged=samples.map((x,i)=>({...x,radiance:i%19===0?1e9:x.radiance+(i%23===0&&x.wavelengthMicrons>3.1?.05:0),valid:i%19!==0}));
  const result=fitHriiSpectrum(damaged,solar,illumination);assert.ok(result);
  const {continuum,thermal}=result;
  assert.ok(Math.abs(thermal.colorTemperatureKelvin-reference.temperatureKelvin)<.15);
  const missing=samples.map(x=>({...x,valid:x.wavelengthMicrons<3.8}));
  assert.equal(fitHriiThermal(missing,solar,continuum,illumination),null);
  assert.equal(fitHriiContinuum(samples.map(x=>({...x,valid:x.wavelengthMicrons>1.9})),solar),null);
});

test('solar interpolation rejects incomplete, unordered and out-of-domain inputs',()=>{
  const parsed=decodeHriiSolarTable('1.0 100\n2.0 50\n5.0 10\n');
  assert.equal(solarIrradiance(parsed,1.5),75);
  assert.throws(()=>decodeHriiSolarTable('1 10\n1 20'));
  assert.throws(()=>decodeHriiSolarTable('1 10\n2 20'));
  assert.throws(()=>solarIrradiance(parsed,.9));
});
