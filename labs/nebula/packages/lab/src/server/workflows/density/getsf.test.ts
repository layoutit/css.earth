import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { prepareGetSfBenchmark } from './getsf.ts';
import { collectGetSfBenchmark } from './getsf-collect.ts';
import { decodeFits } from '@cssearth/fits';
import { encodeFits } from '@cssearth/fits/node';
import { digest } from '@cssearth/nebula-reconstruction/methods/getsf/benchmark-products';

test('getsf input uses shared luminance, native pixel scale and complete official header/config contract', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'getsf-input-'));
  try {
    const imagePath = resolve(directory, 'source.png');
    await sharp(Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]),
      { raw: { width: 2, height: 2, channels: 3 } }).png().toFile(imagePath);
    const receipt = await prepareGetSfBenchmark({ imagePath, imageSha256: digest(await readFile(imagePath)),
      width: 2, height: 2, workDirectory: directory, pixelScaleArcsec: 5, beamFwhmPx: 2,
      sourceMaxFootprintRadiusPx: 8, filamentMaxFootprintRadiusPx: 32,
      wcs: { referencePixel: [12, -3], referenceSkyDeg: [78, -69], rotationDeg: -16 } });
    const fits = decodeFits(await readFile(resolve(directory, 'images/display.fits')));
    assert.deepEqual(fits.values, new Float32Array([.2126, .7152, .0722, 1]));
    assert.equal(fits.header.CDELT2, 5 / 3600);
    assert.equal(fits.header.RA, fits.header.CRVAL1);
    assert.equal(fits.header.DEC, fits.header.CRVAL2);
    const config = await readFile(resolve(directory, 'runs/+getsf.cfg'), 'utf8');
    assert.match(config, /#_{10,}\n$/);
    assert.match(config, /n 1 1 50 n \| measure/);
    assert.match(config, /n \| visualize/);
    assert.equal(receipt.configurationSha256, digest(config));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('signed official getsf maps reject default import and remain unchanged with explicit preview policy', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'getsf-collect-'));
  try {
    const source = resolve(directory, 'source.png'), install = resolve(directory, 'install.json');
    await writeFile(source, 'fixture'); await writeFile(install, '{}');
    await Promise.all(['runs', '001'].map(name => mkdir(resolve(directory, name))));
    const config = '#fixture\n';
    await writeFile(resolve(directory, 'runs/+getsf.cfg'), config);
    await writeFile(resolve(directory, 'execution.log'), 'GETSF: DONE IN 1.000 MINUTES');
    await writeFile(resolve(directory, 'input.json'), JSON.stringify({ imagePath: source,
      sourceSha256: digest('fixture'), configurationSha256: digest(config), width: 2, height: 1 }));
    for (const name of ['fbackground', 'sources', 'filaments']) await writeFile(
      resolve(directory, `001/benchmark.001.obs.${name}.fits`),
      encodeFits(new Float32Array(name === 'sources' ? [-.125, .5] : [.1, .2]), 2, 1, {}));
    const options = { workDirectory: directory, outputDirectory: resolve(directory, 'out'),
      importPath: resolve(directory, 'import.json'), installationReceiptPath: install };
    await assert.rejects(collectGetSfBenchmark(options), /contain signed pixels/);
    await assert.rejects(readFile(options.importPath), /ENOENT/);
    await collectGetSfBenchmark({ ...options, negativePolicy: 'positive-parts-with-signed-residual' });
    const original = await readFile(resolve(directory, 'export/compact-official.f32'));
    const preview = await readFile(resolve(directory, 'export/compact.f32'));
    assert.equal(original.readFloatLE(0), -.125);
    assert.equal(preview.readFloatLE(0), 0);
    const receipt = JSON.parse(await readFile(resolve(directory, 'out/provenance.json'), 'utf8'));
    assert.equal(receipt.rawOfficialMaps.compact.statistics.negativeCount, 1);
    await writeFile(resolve(directory, 'execution.log'), 'started');
    await assert.rejects(collectGetSfBenchmark(options), /no successful completion/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
