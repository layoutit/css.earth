import '../test-user-root.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { astroqueryToolchain, fileSize, sciencePackage, telescopePythonEnvironment, writeProductRecord } from '@cssearth/telescope-core/node';
import { main } from '../cli.mts';
import { requireArray, requireRecord } from '@cssearth/core';
import sharp from 'sharp';

test('science owns detector aliases without changing SI case or admitting unknown units', async () => {
  const result = await sciencePackage({ operation: 'units', units: ['ADU', 'adu', 'AdU', 'COUNTS', 'counts', 'DN', 'dn', 'ELECTRONS', 'ADU/s', 'm', 'MJy', 'unknown-detector-unit'] });
  assert.deepEqual(result.units, ['adu', 'adu', 'adu', 'ct', 'ct', 'adu', 'adu', 'electron', 'adu / s', 'm', 'MJy', null]);
});

test('unsupported beam table units stay a limitation during native image export', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'beam-units-')), tc = await astroqueryToolchain();
  try {
    const file = resolve(root, 'beam.fits');
    execFileSync(tc.python, ['-c', String.raw`
import sys,numpy as np
from astropy.io import fits
h=fits.PrimaryHDU(np.ones((2,3,4)));h.header['BUNIT']='Jy/beam'
for k,v in {'CTYPE3':'WAVE','CUNIT3':'um','CRPIX3':1,'CRVAL3':1.,'CDELT3':1.}.items():h.header[k]=v
beams=fits.BinTableHDU.from_columns([fits.Column(name='BMAJ',format='D',unit='unknown-angle',array=[1.,1.]),fits.Column(name='BMIN',format='D',unit='arcsec',array=[1.,1.]),fits.Column(name='CHAN',format='J',array=[0,1]),fits.Column(name='POL',format='J',array=[0,0])],name='BEAMS')
fits.HDUList([h,beams]).writeto(sys.argv[1])`, file], { env: telescopePythonEnvironment(tc.env) });
    const result = await sciencePackage({ operation: 'extract', path: file, kind: 'image', hdu: 0, plane: 0 });
    const row = requireRecord(requireArray(result.structures)[0]);
    assert.match(JSON.stringify(row.limitations), /unsupported angular beam table units: unknown-angle/u);
    assert.equal(row.angularResolutionArcsec, undefined);
    assert.deepEqual(requireRecord(row.extraction).values, Array.from({ length: 3 }, () => [1, 1, 1, 1]));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('CLI image and direct HTML exports accept ADU FITS and report unknown BUNIT', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'archive-units-'));
  const tc = await astroqueryToolchain();
  try {
    for (const unit of ['ADU', 'COUNTS', 'DN', 'ELECTRONS', 'unknown-detector-unit']) {
      const file = resolve(root, `${unit}.fits`), record = resolve(root, `${unit}.product.json`), result = resolve(root, `${unit}.json`);
      execFileSync(tc.python, ['-c', String.raw`
import sys, numpy as np
from astropy.io import fits
h=fits.PrimaryHDU(np.arange(12,dtype=float).reshape(3,4));h.header['BUNIT']=sys.argv[2]
err=fits.ImageHDU(np.ones((3,4)),name='ERR');err.header['BUNIT']=sys.argv[2]
hdus=[h,err]
fits.HDUList(hdus).writeto(sys.argv[1])`, file, unit], { env: telescopePythonEnvironment(tc.env) });
      await writeProductRecord(record, { telescope: 'Fixture', stage: 'fixture', inputs: [], parameters: {}, software: [] }, [{ path: `${unit}.fits`, file }]);
      await writeFile(result, JSON.stringify({ schema: 'cssearth-telescope-delivery@3', product: `${unit}.fits`, record: `${unit}.product.json`, receipt: `${unit}.product.json`, facts: { target: 'fixture', verified: true }, context: { kind: 'exploration', target: 'fixture', discovery: { schema: 'cssearth-telescope-exploration@1', observation: 'detector-image' }, assessment: { status: 'not-requested' } }, files: [{ path: `${unit}.fits`, ...await fileSize(file) }, { path: `${unit}.product.json`, ...await fileSize(record) }] }));
      for (const kind of ['image', 'html']) {
        const directory = resolve(root, `${unit}-${kind}`);
        let stdout = '';
        const code = await main(['export', result, '--output', kind, ...(kind === 'image' ? ['--hdu', '0'] : []), '--out', directory, '--json'], undefined, text => { stdout += text; });
        assert.equal(code, 0, stdout);
        assert.equal((await sharp(resolve(directory, 'figure.png')).metadata()).format, 'png');
        const receipt = requireRecord(JSON.parse(await readFile(resolve(directory, 'output.product.json'), 'utf8')));
        const parameters = requireRecord(receipt.parameters), metadata = requireRecord(parameters.metadata);
        if (unit === 'unknown-detector-unit') {
          assert.equal(metadata.units, undefined);
          assert.match(JSON.stringify(metadata.limitations), /unsupported science unit: unknown-detector-unit/u);
          assert.match(JSON.stringify(requireRecord(requireRecord(parameters.software).presentation).warnings), /unsupported science unit: unknown-detector-unit/u);
        } else {
          assert.equal(requireRecord(metadata.units).value, unit);
          if (unit === 'ELECTRONS') assert.match(JSON.stringify(requireRecord(requireRecord(parameters.software).presentation).warnings), /not representable in standard FITS syntax/u);
        }
        execFileSync(tc.python, ['-c', String.raw`
import sys,numpy as np
from astropy.io import fits
with fits.open(sys.argv[1]) as f:
 assert f[0].header['BUNIT']==sys.argv[2],f[0].header['BUNIT']
 np.testing.assert_equal(f[0].data,np.arange(12).reshape(3,4))
 if sys.argv[2]!='unknown-detector-unit': np.testing.assert_equal(f['ERR'].data,1)
 else: assert 'ERR' not in f
`, resolve(directory, 'image.fits'), unit === 'COUNTS' ? 'count' : unit === 'ELECTRONS' ? 'electron' : unit === 'unknown-detector-unit' ? unit : 'adu'], { env: telescopePythonEnvironment(tc.env) });
        if (kind === 'html') {
          const html = await readFile(resolve(directory, 'viewer.html'), 'utf8');
          assert.match(html, /data:image\/png;base64,/u);
          assert.match(html, new RegExp(unit, 'u'));
          assert.equal(requireRecord(JSON.parse(await readFile(resolve(directory, 'html.product.json'), 'utf8'))).stage, 'telescope-html');
        }
      }
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
