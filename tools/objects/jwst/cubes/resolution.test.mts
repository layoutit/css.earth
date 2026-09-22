import assert from 'node:assert/strict';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { EUREKA_ROOT } from '../toolchain.mts';
import { RESOLUTION_PYTHON } from './resolution.mts';
import { requireArray, requireRecord, requireFiniteNumber } from '../../../sources/source-values.mts';

const python = resolve(EUREKA_ROOT, 'env/bin/python');
test('Astropy measures both axes at every wavelength and refuses unsuitable profiles', { skip: !existsSync(python) && 'Install the pinned JWST toolchain to run numerical fits.' }, () => {
  const fixture = String.raw`
import tempfile, os
with tempfile.TemporaryDirectory() as folder:
    y,x=np.indices((25,25))
    # Analytic sampled Gaussian truth, including rotation, unequal axes and background.
    theta=.4; u=(x-12.2)*np.cos(theta)+(y-11.8)*np.sin(theta); v=-(x-12.2)*np.sin(theta)+(y-11.8)*np.cos(theta)
    truth=[1.0,1.2,1.5]; rng=np.random.default_rng(17)
    science=np.array([100*np.exp(-.5*((u/s)**2+(v/.8)**2))+5+rng.normal(0,.1,x.shape) for s in truth])
    error=np.ones_like(science)*.1
    def run(name,data=science,err=error,kind='POINT',bad=False):
        p=fits.PrimaryHDU();p.header.update({'SRCTYAPT':kind,'TARG_RA':0.,'TARG_DEC':0.})
        s=fits.ImageHDU(data,name='SCI');s.header.update({'SRCTYPE':kind,'CRPIX1':13,'CRPIX2':13,'CRPIX3':1,'CRVAL3':2.2,'CDELT3':.1})
        s.header.update({'CTYPE1':'RA---TAN','CTYPE2':'DEC--TAN','CTYPE3':'WAVE','CRVAL1':0.,'CRVAL2':0.,'CDELT1':-0.1/3600,'CDELT2':.1/3600,'CUNIT3':'um'})
        quality=np.zeros_like(data,dtype=np.uint32)
        if bad: quality[1,12,12]=1
        file=os.path.join(folder,name+'.fits');fits.HDUList([p,s,fits.ImageHDU(err,name='ERR'),fits.ImageHDU(quality,name='DQ')]).writeto(file)
        return measure(file)
    good=run('good');extended=run('extended',kind='EXTENDED')
    missing=science.copy();missing[1]=np.nan
    missing=run('missing',data=missing)
    faint=run('faint',data=np.ones_like(science)*5)
    clipped=run('clipped',data=np.roll(science,-10,axis=2))
    blended=run('blended',data=np.roll(science,-2,axis=2)+np.roll(science,2,axis=2))
    bad=run('bad-quality',bad=True)
    print(json.dumps([good,extended,missing,faint,clipped,blended,bad],allow_nan=False))
`;
  const script = RESOLUTION_PYTHON.replace('print(json.dumps(measure(sys.argv[1]), allow_nan=False))', fixture);
  const values = requireArray(JSON.parse(execFileSync(python, ['-c', script], { encoding: 'utf8' }))).map(value => requireRecord(value));
  assert.equal(values[0]!.status, 'bounded');
  const planes = requireArray(values[0]!.planes).map(value => requireRecord(value));
  assert.equal(planes.length, 3);
  for (const [i, sigma] of [1, 1.2, 1.5].entries()) {
    assert.ok(Math.abs(requireFiniteNumber(planes[i]!.majorPixels) - sigma * Math.sqrt(8 * Math.log(2))) < .03);
    assert.ok(Math.abs(requireFiniteNumber(planes[i]!.minorPixels) - .8 * Math.sqrt(8 * Math.log(2))) < .03);
  }
  assert.equal(values[0]!.boundPixels, Math.max(...planes.map(p => requireFiniteNumber(p.boundPixels))));
  assert.ok(requireFiniteNumber(values[0]!.boundPixels) > 1.5 * Math.sqrt(8 * Math.log(2)) + 1);
  for (const result of values.slice(1)) assert.equal(result.status, 'unknown');
});
