/**
 * Cut this package's two ALMA inputs out of the archive's own products for member uid://A001/X360d/Xae. Nothing here is
 * science: both are boxes about the observation's phase centre, and the author finds the star in the continuum.
 *
 * The line cube is 72 GB, so the archive's SODA service cuts it on the server first; ALMA_SIO.cutout in author.mts is that
 * request, and it returns 522 MB. The continuum image, made with the same calibration, is downloaded whole (48 MB):
 *
 *   curl -o .local/alma-betelgeuse/sio-v0-5-4-cutout.fits \
 *     'https://almascience.eso.org/soda/sync?ID=member.uid___A001_X360d_Xae.Betelgeuse_sci.spw27.cube.regcal.I.pbcor.fits&CIRCLE=88.79312208+7.40713833+0.00025'
 *   curl -o .local/alma-betelgeuse/cont-regcal.fits \
 *     'https://almascience.eso.org/dataPortal/member.uid___A001_X360d_Xae.Betelgeuse_sci.spw25_27_29_31.cont.regcal.I.pbcor.fits'
 *
 * Then, from the repository root:
 *
 *   node tools/objects/source-authoring/betelgeuse-shell/reduce-alma-sio.mts
 *
 * writes both files under .local/betelgeuse-shell/observations/, beside the package's other downloads, and fails unless
 * each matches the pin the author reads. Pass --check to compare without writing.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fitsImageAccessor, readFitsHdu } from '../../../fits/fits.mts';
import { sha256 } from '@cssearth/core/node';
import { ALMA_SIO, DOWNLOADS_BASE } from './author.mts';

/** Where the two archive downloads are kept locally; like every download they stay out of git. */
export const ALMA_DOWNLOADS = Object.freeze({
  cube: '.local/alma-betelgeuse/sio-v0-5-4-cutout.fits',
  continuum: '.local/alma-betelgeuse/cont-regcal.fits',
});

const C_KMS = 299792.458;
type Hdu = ReturnType<typeof readFitsHdu>;

function numeric(hdu: Hdu, key: string) {
  const value = hdu.header[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`The ALMA product declares no numeric ${key}.`);
  return value;
}

const card = (key: string, value: string, comment = '') =>
  (key.padEnd(8) + '= ' + value.padStart(20) + (comment ? ' / ' + comment : '')).padEnd(80).slice(0, 80);
const text = (key: string, value: string, comment = '') =>
  (key.padEnd(8) + '= ' + `'${value}'`.padEnd(20) + (comment ? ' / ' + comment : '')).padEnd(80).slice(0, 80);

/** The kept box: ALMA_SIO.boxHalfMas either way of the reference pixel, which is the phase centre. */
function box(hdu: Hdu) {
  const [width, height] = hdu.dimensions;
  if (width === undefined || height === undefined) throw new Error('The ALMA product has no sky axes.');
  const cx = Math.round(numeric(hdu, 'CRPIX1') - 1), cy = Math.round(numeric(hdu, 'CRPIX2') - 1);
  const half = Math.round(ALMA_SIO.boxHalfMas / (Math.abs(numeric(hdu, 'CDELT1')) * 3.6e6)), size = 2 * half + 1;
  if (cx - half < 0 || cy - half < 0 || cx + half >= width || cy + half >= height) throw new Error('The ALMA product does not hold the kept box.');
  return { width, height, x0: cx - half, y0: cy - half, half, size };
}

/** The sky and beam cards both outputs keep, with the reference pixel moved into the box. */
function skyCards(hdu: Hdu, half: number) {
  return [
    text('CTYPE1', 'RA---SIN'), card('CRPIX1', String(half + 1)), card('CRVAL1', numeric(hdu, 'CRVAL1').toFixed(11)),
    card('CDELT1', numeric(hdu, 'CDELT1').toExponential(12)), text('CUNIT1', 'deg'),
    text('CTYPE2', 'DEC--SIN'), card('CRPIX2', String(half + 1)), card('CRVAL2', numeric(hdu, 'CRVAL2').toFixed(11)),
    card('CDELT2', numeric(hdu, 'CDELT2').toExponential(12)), text('CUNIT2', 'deg'),
  ];
}
function beamCards(hdu: Hdu) {
  return [card('BMAJ', numeric(hdu, 'BMAJ').toExponential(12)), card('BMIN', numeric(hdu, 'BMIN').toExponential(12)),
    card('BPA', numeric(hdu, 'BPA').toFixed(6))];
}
function fits(cards: string[], data: Buffer) {
  const head = [...cards, 'END'.padEnd(80)];
  while (head.length % 36 !== 0) head.push(' '.repeat(80));
  return Buffer.concat([Buffer.from(head.join(''), 'latin1'), data, Buffer.alloc((2880 - data.length % 2880) % 2880)]);
}
function requireSky(hdu: Hdu) {
  if (String(hdu.header.CTYPE1).trim() !== 'RA---SIN' || String(hdu.header.CTYPE2).trim() !== 'DEC--SIN')
    throw new Error('The ALMA product is not a SIN-projected RA/Dec image.');
}

/** The line cube: the channels within ALMA_SIO.windowKmS of ALMA_SIO.windowCentreKmS, less each pixel's residual
 * continuum. The archive's pipeline subtracts the continuum before it images a cube; what is left is removed here as the
 * median of the channels further than ALMA_SIO.lineFreeBeyondKmS from the line. */
export function reduceAlmaSio(bytes: Buffer): Buffer {
  const hdu = readFitsHdu(bytes), at = fitsImageAccessor(bytes, hdu);
  requireSky(hdu);
  const channels = hdu.dimensions[2];
  if (channels === undefined || hdu.dimensions.slice(3).some(n => n !== 1)) throw new Error('The SiO cutout is not one Stokes plane of a spectral cube.');
  if (hdu.header.CTYPE3 !== 'FREQ' || hdu.header.SPECSYS !== 'LSRK') throw new Error('The SiO cutout has no LSRK frequency axis.');
  const rest = numeric(hdu, 'RESTFRQ'), crval3 = numeric(hdu, 'CRVAL3'), cdelt3 = numeric(hdu, 'CDELT3'), crpix3 = numeric(hdu, 'CRPIX3');
  const velocity = (c: number) => C_KMS * (rest - (crval3 + (c + 1 - crpix3) * cdelt3)) / rest;
  const { width, height, x0, y0, half, size } = box(hdu);
  const keep: number[] = [], free: number[] = [];
  for (let c = 0; c < channels; c++) {
    const offset = Math.abs(velocity(c) - ALMA_SIO.windowCentreKmS);
    if (offset <= ALMA_SIO.windowKmS) keep.push(c);
    if (offset > ALMA_SIO.lineFreeBeyondKmS) free.push(c);
  }
  if (!keep.length || free.length < 100) throw new Error('The SiO cutout does not cover the line and its continuum.');
  const plane = width * height, data = Buffer.alloc(size * size * keep.length * 4);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const pixel = (y0 + j) * width + (x0 + i);
    const residual = free.map(c => at(c * plane + pixel)).filter(Number.isFinite).sort((a, b) => a - b);
    const median = residual.length ? residual[Math.floor(residual.length / 2)]! : 0;
    for (const [k, c] of keep.entries()) {
      const value = at(c * plane + pixel);
      data.writeFloatBE(Number.isFinite(value) ? value - median : 0, ((k * size + j) * size + i) * 4);
    }
  }
  return fits([
    card('SIMPLE', 'T'), card('BITPIX', '-32'), card('NAXIS', '3'),
    card('NAXIS1', String(size)), card('NAXIS2', String(size)), card('NAXIS3', String(keep.length)),
    text('BUNIT', 'Jy/beam', 'continuum subtracted'), text('OBJECT', 'Betelgeuse'),
    ...skyCards(hdu, half),
    text('CTYPE3', 'FREQ'), card('CRPIX3', '1'), card('CRVAL3', (crval3 + (keep[0]! + 1 - crpix3) * cdelt3).toFixed(1)),
    card('CDELT3', cdelt3.toFixed(4)), text('CUNIT3', 'Hz'),
    card('RESTFRQ', rest.toFixed(1), 'SiO v=0 J=5-4'), text('SPECSYS', 'LSRK'),
    card('CONTCHAN', String(free.length), 'line-free channels in the residual subtracted'),
    ...beamCards(hdu),
    text('TELESCOP', 'ALMA'), text('PROPOSAL', ALMA_SIO.proposal), text('MEMBER', ALMA_SIO.member),
    text('PRODUCT', ALMA_SIO.product.split('.').slice(2, -1).join('.')),
    text('ORIGIN', 'ALMA SODA cutout, windowed by cssEarth'),
  ], data);
}

/** The continuum: the same box of the member's continuum image, unchanged. It is where the star is. */
export function reduceAlmaContinuum(bytes: Buffer): Buffer {
  const hdu = readFitsHdu(bytes), at = fitsImageAccessor(bytes, hdu);
  requireSky(hdu);
  if (hdu.dimensions.slice(2).some(n => n !== 1)) throw new Error('The continuum image is not one plane.');
  const { width, x0, y0, half, size } = box(hdu), data = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const value = at((y0 + j) * width + (x0 + i));
    data.writeFloatBE(Number.isFinite(value) ? value : 0, (j * size + i) * 4);
  }
  return fits([
    card('SIMPLE', 'T'), card('BITPIX', '-32'), card('NAXIS', '2'),
    card('NAXIS1', String(size)), card('NAXIS2', String(size)),
    text('BUNIT', 'Jy/beam', 'continuum'), text('OBJECT', 'Betelgeuse'),
    ...skyCards(hdu, half), ...beamCards(hdu),
    text('TELESCOP', 'ALMA'), text('PROPOSAL', ALMA_SIO.proposal), text('MEMBER', ALMA_SIO.member),
    text('PRODUCT', ALMA_SIO.continuum.product.split('.').slice(2, -1).join('.')),
    text('ORIGIN', 'ALMA archive image, boxed by cssEarth'),
  ], data);
}

const direct = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) {
  const check = process.argv.includes('--check');
  const target = resolve(import.meta.dirname, '../../../..', DOWNLOADS_BASE);
  const jobs = [
    { download: ALMA_DOWNLOADS.cube, url: ALMA_SIO.cutout, reduce: reduceAlmaSio, pin: ALMA_SIO },
    { download: ALMA_DOWNLOADS.continuum, url: ALMA_SIO.continuum.url, reduce: reduceAlmaContinuum, pin: ALMA_SIO.continuum },
  ];
  for (const job of jobs) {
    const path = resolve(job.download);
    const bytes = await readFile(path).catch(() => { throw new Error(`No ALMA download at ${path}. Fetch it from ${job.url}`); });
    const reduced = job.reduce(bytes), digest = sha256(reduced);
    if (digest !== job.pin.sha256 || reduced.length !== job.pin.bytes)
      throw new Error(`${job.pin.path} reduces to ${reduced.length} bytes, sha256 ${digest}; the author pins ${job.pin.bytes} bytes, ${job.pin.sha256}.`);
    if (!check) await writeFile(resolve(target, job.pin.path), reduced);
    console.log(`${check ? 'CHECKED' : 'WROTE'} ${job.pin.path}: ${reduced.length} bytes, sha256 ${digest}`);
  }
}
