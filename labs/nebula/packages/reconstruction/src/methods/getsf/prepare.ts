/** Adapter for the author's locally installed getsf, with no replacement implementation or vendored code. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { digest, readBenchmarkImage } from './benchmark-products.ts';
import type {GetSfFitsTransport} from './transport.ts';

export interface GetSfInput {
  imagePath: string; imageSha256: string; width: number; height: number; workDirectory: string;
  pixelScaleArcsec: number; beamFwhmPx: number;
  sourceMaxFootprintRadiusPx: number; filamentMaxFootprintRadiusPx: number;
  wcs: { referencePixel: readonly [number, number]; referenceSkyDeg: readonly [number, number]; rotationDeg: number };
}

export async function prepareGetSfBenchmark(options: GetSfInput, transport:Pick<GetSfFitsTransport,'encodeFits'|'float32LittleEndian'>, originLabel:string) {
 const {encodeFits,float32LittleEndian}=transport;
  const image = await readBenchmarkImage(options.imagePath, options.imageSha256, options.width, options.height);
  for (const value of [options.pixelScaleArcsec, options.beamFwhmPx,
    options.sourceMaxFootprintRadiusPx, options.filamentMaxFootprintRadiusPx])
    if (!Number.isFinite(value) || value <= 0) throw new TypeError('getsf scales must be positive.');
  if (![...options.wcs.referencePixel, ...options.wcs.referenceSkyDeg, options.wcs.rotationDeg].every(Number.isFinite))
    throw new TypeError('Invalid image WCS.');
  const directory = resolve(options.workDirectory), input = resolve(directory, 'images'), runs = resolve(directory, 'runs');
  await Promise.all([mkdir(input, { recursive: true }), mkdir(runs, { recursive: true })]);
  const metadata = {
    BUNIT: 'MJy/sr', // Software accepts only this or H2/cm^2. Compatibility label, NOT a measured unit.
    OBJECT: 'DISPLAY IMAGE - NOT CALIBRATED', ORIGIN: originLabel,
    CTYPE1: 'RA---TAN', CTYPE2: 'DEC--TAN', EQUINOX: 2000,
    CUNIT1: 'deg', CUNIT2: 'deg', CDELT1: -options.pixelScaleArcsec / 3600, CDELT2: options.pixelScaleArcsec / 3600,
    CRPIX1: options.wcs.referencePixel[0], CRPIX2: options.wcs.referencePixel[1],
    CRVAL1: options.wcs.referenceSkyDeg[0], CRVAL2: options.wcs.referenceSkyDeg[1],
    RA: options.wcs.referenceSkyDeg[0], DEC: options.wcs.referenceSkyDeg[1], WAVE: 1,
    CROTA1: options.wcs.rotationDeg, CROTA2: options.wcs.rotationDeg,
  };
  const fits = encodeFits(image.luminance, image.width, image.height, metadata);
  const mask = encodeFits(new Float32Array(image.luminance.length).fill(1), image.width, image.height, metadata);
  const scale = options.pixelScaleArcsec;
  const config = `# getsf 260706 official defaults; one display-intensity image, not a photometric band.
benchmark 100 | prefix distance
1 | nwmax
1 1 | nwaves nw[i]
001 ${options.beamFwhmPx * scale} ${options.sourceMaxFootprintRadiusPx * scale} ${options.filamentMaxFootprintRadiusPx * scale} n gre | wave beam srcmaxsize filmaxsize apcorr color
../images ../001 | image monochromatic-directory
display | image
y y | sources filaments
y 1 1 50 | separate its1 itf1 niter
y 1 1 | flatten itsd1 itfd1
y | complete
y | combine
y 2 | detect skelsig
n 1 1 50 n | measure goodmin itn itx sproima
n | visualize
5 | nsigmacombos
2 | nsigmacombof
1 | nwavesdetect
0 n | savespace delete
0 | verbosity
#_______________________________________________________________________________
`;
  await Promise.all([
    writeFile(resolve(input, 'display.fits'), fits), writeFile(resolve(input, 'display.omask.fits'), mask),
    writeFile(resolve(directory, 'input.f32'), float32LittleEndian(image.luminance)),
    writeFile(resolve(runs, '+getsf.cfg'), config),
  ]);
  const receipt = { schema: 'cssearth-getsf-input@1', ...options,
    sourceSha256: digest(await readFile(options.imagePath)), inputFitsSha256: digest(fits),
    inputFloat32Sha256: digest(float32LittleEndian(image.luminance)), configurationSha256: digest(config),
    intensity: 'Float32 Rec.709 dot product of 8-bit sRGB /255, without linear-light conversion. Not calibrated radiance.',
    fitsUnitCaveat: 'BUNIT MJy/sr is a getsf-required compatibility placeholder. Wavelength 001 and distance100 are unused physical placeholders; no physical flux, mass, or membership is inferred.',
    rowOrder: 'FITS Y is reversed from DOM; exported maps reverse it back without reprojection.',
    scaleCaveat: 'Beam and largest footprints are benchmark morphology choices, not measured instrumental PSF.',
  };
  await writeFile(resolve(directory, 'input.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}
