import assert from 'node:assert/strict';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bandDepth, openSpectralCube, windowMean } from './spectral-cube.mts';

const card = (key: string, value: string | number | boolean) => `${key.padEnd(8)}= ${typeof value === 'string' ? `'${value.padEnd(8)}'`.padEnd(20) : String(value === true ? 'T' : value).padStart(20)}`.padEnd(80);
const block = (cards: string[]) => Buffer.from([...cards, 'END'.padEnd(80)].join('').padEnd(Math.ceil((cards.length + 1) / 36) * 2880));
const image = (name: string, [nx, ny, nw]: [number, number, number], value: (x: number, y: number, k: number) => number, extra: string[] = []) => {
  const data = Buffer.alloc(Math.ceil(nx * ny * nw * 4 / 2880) * 2880);
  for (let k = 0; k < nw; k++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) data.writeFloatBE(value(x, y, k), ((k * ny + y) * nx + x) * 4);
  return Buffer.concat([block([card('XTENSION', 'IMAGE'), card('BITPIX', -32), card('NAXIS', 3), card('NAXIS1', nx), card('NAXIS2', ny), card('NAXIS3', nw), card('PCOUNT', 0), card('GCOUNT', 1), card('EXTNAME', name), ...extra]), data]);
};
const WCS = [card('CTYPE1', 'RA---TAN'), card('CTYPE2', 'DEC--TAN'), card('CTYPE3', 'WAVE'), card('CUNIT3', 'um'), card('BUNIT', 'MJy/sr'), card('PC1_1', -1), card('PC1_2', 0), card('PC2_1', 0), card('PC2_2', 1),
  card('CDELT1', 1 / 36000), card('CDELT2', 1 / 36000), card('CRVAL3', 4), card('CDELT3', 0.01), card('CRPIX3', 1)];
/** 4.00 to 4.60 µm in 61 planes. The continuum rises 100 -> 160 along wavelength; a band at 4.24-4.28 µm is 30% deep in pixel
 * (1, 0) and absent elsewhere. Pixel (0, 1) has no coverage. */
const cube = async (dimensions: [number, number, number] = [2, 2, 61], wcs = WCS, missing: (x: number, y: number, k: number) => boolean = () => false) => {
  const directory = await mkdtemp(join(tmpdir(), 'cube-')), path = join(directory, 'cube_s3d.fits');
  const level = (k: number) => 100 + k, inBand = (k: number) => k >= 24 && k <= 28;
  await writeFile(path, Buffer.concat([block([card('SIMPLE', true), card('BITPIX', 8), card('NAXIS', 0), card('EXTEND', true)]),
    image('SCI', dimensions, (x, y, k) => missing(x, y, k) ? NaN : x === 0 && y === 1 ? NaN : level(k) * (x === 1 && y === 0 && inBand(k) ? 0.7 : 1), wcs), image('ERR', dimensions, (_x, _y, k) => level(k) / 100)]));
  return { path, directory };
};

test('a band depth is read against a sloped continuum, with its error, and a pixel without coverage is NaN', async () => {
  const { path, directory } = await cube();
  try {
    const opened = await openSpectralCube(path);
    assert.equal(opened.planes, 61); assert.ok(Math.abs(opened.wavelength(26) - 4.26) < 1e-9); assert.ok(Math.abs(opened.arcsecPerPixel - 0.1) < 1e-9);
    const map = await bandDepth(opened, { band: [4.24, 4.28], continuum: [[4.10, 4.20], [4.32, 4.42]] });
    assert.ok(Math.abs(map.depth[1]! - 0.3) < 1e-6, `deep pixel ${map.depth[1]}`);
    assert.ok(Math.abs(map.depth[0]!) < 1e-6 && Math.abs(map.depth[3]!) < 1e-6, 'a sloped continuum alone has no depth');
    assert.ok(Number.isNaN(map.depth[2]!));
    assert.ok(Math.abs(map.continuum[0]! - 126) < 1e-4);
    // Five band planes at 1% each, against two windows of eleven: about half a percent of the ratio.
    assert.ok(map.error[0]! > 0.004 && map.error[0]! < 0.006, `error ${map.error[0]}`);
    assert.ok(Math.abs((await windowMean(opened, [4.0, 4.1])).mean[0]! - 105) < 1e-4);
  } finally { await rm(directory, { recursive: true }); }
});

test('samples missing from one side of a window do not invent a band on a sloping spectrum', async () => {
  // Pixel (0, 0) loses the four reddest planes of the left window and the two bluest of the band. Each surviving mean sits
  // at the mean of its own wavelengths; placed at the windows' nominal middles they would read a false band of several percent.
  const { path, directory } = await cube([2, 2, 61], WCS, (x, y, k) => x === 0 && y === 0 && ((k >= 17 && k <= 20) || (k >= 24 && k <= 25)));
  try {
    const opened = await openSpectralCube(path), recipe = { band: [4.24, 4.28], continuum: [[4.10, 4.20], [4.32, 4.42]] } as const;
    const map = await bandDepth(opened, recipe), left = await windowMean(opened, recipe.continuum[0]);
    assert.ok(Math.abs(left.wavelength[0]! - 4.13) < 1e-9 && Math.abs(left.wavelength[3]! - 4.15) < 1e-9, 'a window mean carries the wavelength of the samples it kept');
    assert.ok(Math.abs(map.depth[0]!) < 1e-9, `a straight spectrum with gaps has no depth, not ${map.depth[0]}`);
    assert.ok(Math.abs(map.depth[1]! - 0.3) < 1e-6, 'and a real band keeps its depth');
  } finally { await rm(directory, { recursive: true }); }
});

test('a cube that is not north up, or a window off the cube, is refused', async () => {
  const turned = await cube([2, 2, 61], WCS.map(line => line.startsWith('PC1_2') ? card('PC1_2', 0.5) : line));
  try { await assert.rejects(openSpectralCube(turned.path), /north up/u); } finally { await rm(turned.directory, { recursive: true }); }
  const { path, directory } = await cube();
  try {
    const opened = await openSpectralCube(path);
    await assert.rejects(windowMean(opened, [5, 5.1]), /planes between/u);
    await assert.rejects(bandDepth(opened, { band: [4.24, 4.28], continuum: [[4.10, 4.26], [4.32, 4.42]] }), /either side/u);
  } finally { await rm(directory, { recursive: true }); }
});

test('valid zero band samples and a zero mean retain absorption and finite propagated uncertainty', async () => {
 const directory=await mkdtemp(join(tmpdir(),'zero-band-'));
 try {
  for(const values of [[0,1],[-1,1]]){
   const path=join(directory,'zero.fits');
   await writeFile(path,Buffer.concat([block([card('SIMPLE',true),card('BITPIX',8),card('NAXIS',0),card('EXTEND',true)]),
    image('SCI',[1,1,8],(_x,_y,k)=>k===3?values[0]!:k===4?values[1]!:1,WCS),image('ERR',[1,1,8],()=>.1)]));
   const opened=await openSpectralCube(path),result=await bandDepth(opened,{band:[4.03,4.04],continuum:[[4,4.02],[4.05,4.07]]});
   assert.ok(Math.abs(result.depth[0]!-(values[0]===0?.5:1))<1e-6);assert.ok(Number.isFinite(result.error[0]!));
   await assert.rejects(bandDepth(opened,{band:[4.03,4.04],continuum:[[3.98,4.02],[4.05,4.07]]}),/both continuum/);
  }
 } finally {await rm(directory,{recursive:true,force:true});}
});
