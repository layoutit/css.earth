import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { astroqueryToolchain } from '../../astronomy-packages/toolchain.mts';
import { pinFile, readProductRecord } from '../../product-record.mts';
import { executeFamilyOperation } from '../family-operation.mts';
import { executableFamilyOperations } from '../family-operation.mts';
import { member } from './common.mts';
import { describePhysicalSphericalGrid, inspectPhysicalSphericalGrid, type SphericalGridContext } from './f16-spherical-grid.mts';
import { STEREO_COR1_F16_PROFILE } from '../observation-families.mts';

const context: SphericalGridContext = { profileId: STEREO_COR1_F16_PROFILE, frame: 'sun-carrington-cr2053', frameBasis: 'fixture Carrington axes', sourceUrl: 'https://example.test/cor1.fits', citation: 'fixture', license: 'fixture', quantity: 'electron number density', unit: 'cm^-3', hdu: 0 };

test('archive spherical density runs through the standard volume preparer and a real two-entry receipt', async () => {
  const work = await mkdtemp(resolve(tmpdir(), 'f16-spherical-'));
  try {
    const file = resolve(work, 'corona.fits'), toolchain = await astroqueryToolchain(), made = spawnSync(toolchain.python, ['-c', String.raw`import sys,numpy as np
from astropy.io import fits
r=np.linspace(1.5,4,51)[:,None,None];lat=np.radians(np.arange(-90,91))[None,:,None];lon=np.radians(np.arange(361))[None,None,:]
a=(1e6/r**2)*(1+.2*np.cos(2*lon)*np.cos(lat)**2);a[:,:,360]=a[:,:,0]
h=fits.Header();h['CTYPE1']='CRLN';h['CRPIX1']=1.;h['CRVAL1']=0.;h['CDELT1']=1.;h['CUNIT1']='deg';h['CTYPE2']='CRLT';h['CRPIX2']=91.;h['CRVAL2']=0.;h['CDELT2']=1.;h['CUNIT2']='deg';h['CTYPE3']='HECR';h['CRPIX3']=1.;h['CRVAL3']=1.5;h['CDELT3']=.05;h['CUNIT3']='solRad';h['BUNIT']='cm^-3';h['INSTRUME']='SECCHI';h['DATE-AVG']='2007-02-11T14:13:00.012';fits.PrimaryHDU(a.astype('>f4'),header=h).writeto(sys.argv[1])`, file], { env: { ...process.env, ...toolchain.env }, encoding: 'utf8' });
    assert.equal(made.status, 0, made.stderr);
    const bytes = await readFile(file), pin = { path: file, ...await pinFile(file) }, inspection = await inspectPhysicalSphericalGrid(pin, context);
    assert.deepEqual(inspection.shape, [51, 181, 361]); assert.equal(inspection.seamMaximumDifference, 0); assert.ok(inspection.epochJdTt > 2454000);
    const descriptor = describePhysicalSphericalGrid({ id: 'cor1-fixture', target: 'sun', member: member('electron-density-fits', 'corona.fits', 'science', bytes, 'application/fits'), context, inspection, producingRecord: 'qualification.product.json' }), descriptorPath = resolve(work, 'descriptor.json'); await writeFile(descriptorPath, JSON.stringify(descriptor));
    assert.deepEqual(executableFamilyOperations(descriptor).map(operation => operation.id), ['spherical-grid-inspect', 'spherical-grid-prepare-volume']);
    const inspected = await executeFamilyOperation(descriptorPath, { operationId: 'spherical-grid-inspect' }, resolve(work, 'inspection')); assert.equal(JSON.parse(await readFile(inspected.product, 'utf8')).validSamples, 3332391);
    const prepared = await executeFamilyOperation(descriptorPath, { operationId: 'spherical-grid-prepare-volume', size: 32, transfer: { kind: 'sqrt', range: [0, 500000], color: [1, .7, .35], strength: 1, clipping: 'clamp', invalid: 'transparent' } }, resolve(work, 'prepared')), record = await readProductRecord(prepared.record), wrapper = JSON.parse(await readFile(prepared.product, 'utf8'));
    assert.equal(wrapper.schema, 'cssearth-physical-grid-volume@1'); assert.equal(wrapper.resampling.method, 'trilinear'); assert.ok(record?.software.some(item => item.name.includes('f16-spherical-grid'))); assert.ok(await readFile(resolve(prepared.directory, wrapper.prepared)));
  } finally { await rm(work, { recursive: true, force: true }); }
});
