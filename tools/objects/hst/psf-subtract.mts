#!/usr/bin/env node
/** Subtract a reference star's coronagraphic PSF from a Hubble coronagraph observation: reference-star differential imaging for
 * ACS/HRC, the stage the archive does not run. A coronagraph blocks the star's core, but its diffracted and scattered light is
 * still far brighter than a debris disc; a star of similar colour observed behind the same occulter in the same orbit sequence
 * carries the same pattern, and scaled and shifted onto the science star it removes it.
 *
 *   node tools/objects/hst/psf-subtract.mts <subtraction id> <work directory> [--raw <dir>]...
 *
 * The subtraction is described by `programs/<id>.psf-subtraction.json`: the pinned HST program, and for each filter the science
 * observations at each telescope roll and the reference star's, each a long and a shorter association. Every association is
 * recalibrated from raw by calibrate.mts (calacs, with the coronagraphic spot flat CRDS selects) unless the work directory
 * already holds that run. Then, per filter and roll, on the pinned toolchain:
 *
 * 1. Each star's long and short CR-rejected frames are put in electrons per second and merged: a pixel the long frame flags as
 *    saturated (DQ 256 or 2048) is taken from the short frame.
 * 2. Each star is located as the centre about which its PSF is most nearly symmetric under a half turn, over an annulus with
 *    the disc's strip left out. The brightest pixel near the core is not the star: the long frames saturate and bleed there.
 * 3. The reference is divided by the two stars' flux ratio in the band, a published value the record cites (a paper's number
 *    outranks one fitted here), and shifted onto the science star (cubic spline); the shift is fitted by least squares over an
 *    annulus about the star with the disc's strip left out. The scale a free fit would choose there is reported beside it as
 *    a check, not used.
 * 4. The scaled, shifted reference is subtracted. The occulter and every flagged pixel are left blank.
 * 5. The result is written into a copy of the science frame and put on the sky: stwcs writes the distortion model into its
 *    WCS and AstroDrizzle resamples it, north up, at the scale and kernel of the archive's own drizzled product of that
 *    observation. The star's sky position is its centroid through the same distorted WCS.
 *
 * Beside each drizzled result the stage writes its product record: the calibrated frames at their digests, the fit (shift,
 * scale, the residual over the fit region before and after), the star's position, and the pinned toolchain. */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { totalmem } from 'node:os';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { freeMemoryPercent, toolchainPython } from '../jwst/mast.mts';
import { fileSize, writeProductRecord } from '@cssearth/telescope/node';
import { productRecordPath, type ProductInput, type ProductRun } from '@cssearth/telescope';
import { PROGRAMS } from './archive.mts';
import { hstSoftware, hstToolchainDigest, MEMORY_GUARD, readHstProgram, REFERENCE_FILES, runCalibration } from './calibrate.mts';
import { readHstFileHdus } from './product-file.mts';
import { hstToolchain } from './toolchain.mts';

export interface PsfSubtraction {
  readonly schema: 'cssearth-hst-psf-subtraction@1'; readonly id: string; readonly program: string; readonly target: string; readonly reference: string;
  readonly bands: readonly { readonly band: string; readonly science: readonly { readonly roll: string; readonly long: string; readonly short: string }[]; readonly reference: { readonly long: string; readonly short: string };
    /** The reference star's flux over the science star's in this band, from `fluxRatioSource`, and its relative uncertainty. */
    readonly fluxRatio: { readonly referenceOverScience: number; readonly relativeUncertainty: number } }[];
  readonly fluxRatioSource: string;
  readonly fit: { readonly annulusArcsec: readonly [number, number]; readonly excludeStrip: { readonly positionAngleDeg: number; readonly halfWidthArcsec: number }; readonly occulterArcsec: number; readonly shiftSearchPixels: number;
    /** Where each star's centre of symmetry is measured: nearer the star than the scale fit, with a narrower strip left out. */
    readonly centre: { readonly annulusArcsec: readonly [number, number]; readonly excludeHalfWidthArcsec: number } };
  readonly source: string;
}
export function parsePsfSubtraction(value: unknown): PsfSubtraction {
  const row = requireRecord(value, 'PSF subtraction');
  if (row.schema !== 'cssearth-hst-psf-subtraction@1') throw new TypeError('Unsupported PSF subtraction record.');
  const pair = (v: unknown) => { const r = requireRecord(v, 'association pair'); return { long: requireString(r.long), short: requireString(r.short) }; };
  const fit = requireRecord(row.fit, 'fit'), annulus = requireArray(fit.annulusArcsec).map(v => requireFiniteNumber(v)), strip = requireRecord(fit.excludeStrip, 'excluded strip');
  if (annulus.length !== 2 || !(annulus[0]! > 0 && annulus[1]! > annulus[0]!)) throw new TypeError('The fit annulus runs from a positive inner to a larger outer radius.');
  return { schema: row.schema, id: requireString(row.id), program: requireString(row.program), target: requireString(row.target), reference: requireString(row.reference),
    bands: requireArray(row.bands).map(v => { const b = requireRecord(v, 'band'); return { band: requireString(b.band),
      science: requireArray(b.science).map(s => { const r = requireRecord(s, 'roll'); return { roll: requireString(r.roll), ...pair(r) }; }), reference: pair(b.reference),
      fluxRatio: (() => { const f = requireRecord(b.fluxRatio, 'flux ratio'), ratio = requireFiniteNumber(f.referenceOverScience), u = requireFiniteNumber(f.relativeUncertainty);
        if (!(ratio > 0) || !(u >= 0 && u < 1)) throw new TypeError('A flux ratio is positive and its relative uncertainty between 0 and 1.');
        return { referenceOverScience: ratio, relativeUncertainty: u }; })() }; }),
    fluxRatioSource: requireString(row.fluxRatioSource),
    fit: { annulusArcsec: [annulus[0]!, annulus[1]!], excludeStrip: { positionAngleDeg: requireFiniteNumber(strip.positionAngleDeg), halfWidthArcsec: requireFiniteNumber(strip.halfWidthArcsec) },
      occulterArcsec: requireFiniteNumber(fit.occulterArcsec), shiftSearchPixels: requireFiniteNumber(fit.shiftSearchPixels),
      centre: (() => { const c = requireRecord(fit.centre, 'centre'), a = requireArray(c.annulusArcsec).map(v => requireFiniteNumber(v));
        if (a.length !== 2 || !(a[0]! > 0 && a[1]! > a[0]!)) throw new TypeError('The centre annulus runs from a positive inner to a larger outer radius.');
        return { annulusArcsec: [a[0]!, a[1]!] as const, excludeHalfWidthArcsec: requireFiniteNumber(c.excludeHalfWidthArcsec) }; })() }, source: requireString(row.source) };
}
export const psfSubtractionPath = (id: string) => resolve(PROGRAMS, `${id}.psf-subtraction.json`);

const SUBTRACT = `
import json, os, shutil, subprocess, sys, threading, time
import numpy as np
from astropy.io import fits
from scipy import ndimage, optimize
job, variable, context, ceiling = json.loads(sys.argv[1]), sys.argv[2], sys.argv[3], int(sys.argv[4])
files = [job['science']['long']]
${MEMORY_GUARD}
${REFERENCE_FILES}
start = time.time()
SATURATED = 256 | 2048
def merged(pair):
    """Electrons per second from the long frame, the short frame where the long one saturates; bad pixels NaN."""
    out = {}
    for key in ('long', 'short'):
        with fits.open(pair[key]) as f:
            sci, dq, t = f['SCI'].data.astype(np.float64), f['DQ'].data.astype(np.int64), float(f[0].header['EXPTIME'])
            out[key] = (sci / t, dq, f['SCI'].header.copy(), f[0].header.copy())
    rate, dq, header, primary = out['long']
    short_rate, short_dq = out['short'][0], out['short'][1]
    saturated = (dq & SATURATED) != 0
    use_short = saturated & ((short_dq & SATURATED) == 0)
    rate = np.where(use_short, short_rate, rate)
    bad = (saturated & ~use_short) | ((np.where(use_short, short_dq, dq) & ~SATURATED & (4 | 16 | 64 | 128)) != 0)
    rate[bad] = np.nan
    return rate, header, primary, int(use_short.sum()), int(bad.sum())
def symmetric_centre(rate, header, direction, scale, fit):
    """The point about which the PSF is most nearly symmetric under a half turn: the star behind the occulter. Minimises the
    squared difference between the image and its point reflection over an annulus about the aperture reference point with
    the disc's strip left out, where the saturated core and its bleeding columns do not reach."""
    cx, cy = header['CRPIX1'] - 1, header['CRPIX2'] - 1
    inner, outer = fit['centre']['annulusArcsec']
    half = int(outer / scale) + 4
    y0, x0 = int(cy) - half, int(cx) - half
    patch = rate[y0:y0 + 2 * half + 1, x0:x0 + 2 * half + 1]
    finite = np.isfinite(patch); values = np.nan_to_num(patch, nan=0.0)
    yy, xx = np.mgrid[0:patch.shape[0], 0:patch.shape[1]]
    def cost(c):
        x, y = c[0] - x0, c[1] - y0
        dx, dy = xx - x, yy - y
        r = np.hypot(dx, dy) * scale
        across = np.abs(dx * direction[1] - dy * direction[0]) * scale
        use = finite & (r >= inner) & (r <= outer) & (across > fit['centre']['excludeHalfWidthArcsec'])
        # The point reflection about (x, y) of every used pixel, by bilinear interpolation.
        mirror = ndimage.map_coordinates(values, [2 * y - yy[use], 2 * x - xx[use]], order=1, mode='constant', cval=np.nan)
        mirror_ok = ndimage.map_coordinates(finite.astype(float), [2 * y - yy[use], 2 * x - xx[use]], order=1, mode='constant', cval=0.0) > 0.999
        a = values[use][mirror_ok]; b = mirror[mirror_ok]
        return float(((a - b) ** 2).mean() / (a * a).mean())
    best = min(((cost((cx + ox, cy + oy)), (cx + ox, cy + oy)) for ox in np.arange(-6, 6.01, 0.5) for oy in np.arange(-6, 6.01, 0.5)), key=lambda t: t[0])
    refined = optimize.minimize(cost, best[1], method='Nelder-Mead', options={'xatol': 0.005, 'fatol': 1e-12, 'maxiter': 300})
    return float(refined.x[0]), float(refined.x[1]), float(refined.fun)
sci, sci_header, sci_primary, sci_short, sci_bad = merged(job['science'])
ref, ref_header, ref_primary, ref_short, ref_bad = merged(job['reference'])
# Pixel scale and the disc's direction on each detector, from the frame's own linear WCS (CD matrix, degrees per pixel).
def detector_geometry(header):
    cd = np.array([[header['CD1_1'], header['CD1_2']], [header['CD2_1'], header['CD2_2']]])
    pa = np.radians(job['fit']['excludeStrip']['positionAngleDeg'])
    # A step on the sky toward the position angle: east lowers RA, so the RA component is -sin(pa); the CD inverse carries it.
    direction = np.linalg.solve(cd, np.array([-np.sin(pa), np.cos(pa)]) / 3600.0)
    return cd, float(np.sqrt(abs(np.linalg.det(cd))) * 3600), direction / np.hypot(*direction)
cd, scale, direction = detector_geometry(sci_header)
_, _, ref_direction = detector_geometry(ref_header)
sx, sy, sci_asymmetry = symmetric_centre(sci, sci_header, direction, scale, job['fit'])
rx, ry, ref_asymmetry = symmetric_centre(ref, ref_header, ref_direction, scale, job['fit'])
yy, xx = np.mgrid[0:sci.shape[0], 0:sci.shape[1]]
dx, dy = xx - sx, yy - sy
radius = np.hypot(dx, dy) * scale
across = np.abs(dx * direction[1] - dy * direction[0]) * scale
inner, outer = job['fit']['annulusArcsec']
region = (radius >= inner) & (radius <= outer) & (across > job['fit']['excludeStrip']['halfWidthArcsec']) & np.isfinite(sci)
reference = np.nan_to_num(ref, nan=0.0); reference_valid = np.isfinite(ref).astype(np.float64)
def shifted(shift):
    moved = ndimage.shift(reference, (shift[1], shift[0]), order=3, mode='constant', cval=0.0)
    valid = ndimage.shift(reference_valid, (shift[1], shift[0]), order=1, mode='constant', cval=0.0) > 0.999
    return moved, valid
# The published flux ratio sets the scale; only the shift is fitted. The free least-squares scale is kept as a check.
s = 1.0 / job['fluxRatio']['referenceOverScience']
def cost(shift, scale=None):
    moved, valid = shifted(shift)
    m = region & valid
    a, b = moved[m], sci[m]
    k = float((a * b).sum() / (a * a).sum()) if scale is None else scale
    return float(((b - k * a) ** 2).mean()), k
first = (sx - rx, sy - ry)
search = job['fit']['shiftSearchPixels']
fitted = optimize.minimize(lambda p: cost(p, s)[0], first, method='Nelder-Mead', options={'xatol': 0.002, 'fatol': 1e-12, 'maxiter': 400})
shift = (float(fitted.x[0]), float(fitted.x[1]))
if abs(shift[0] - first[0]) > search or abs(shift[1] - first[1]) > search: raise SystemExit('The fitted shift %s left the %s-pixel box around the centroid offset %s (science star %s, reference %s, CRPIX %s).' % (shift, search, first, (sx, sy), (rx, ry), (sci_header['CRPIX1'], sci_header['CRPIX2'])))
residual_ms, _ = cost(shift, s)
free_ms, free_scale = cost(shift)
moved, valid = shifted(shift)
subtracted = sci - s * moved
subtracted[~valid | (radius < job['fit']['occulterArcsec']) | ~np.isfinite(sci)] = np.nan
before = float(np.sqrt((sci[region] ** 2).mean())); after = float(np.sqrt(np.nanmean(subtracted[region] ** 2)))
# Into a copy of the science frame, in electrons over the long exposure, blanks flagged, then on the sky.
out_dir = job['output']; os.makedirs(out_dir, exist_ok=True)
name = job['name']; image = os.path.join(out_dir, name + '_flt.fits')
shutil.copyfile(job['science']['long'], image)
with fits.open(image, mode='update') as f:
    t = float(f[0].header['EXPTIME'])
    blank = ~np.isfinite(subtracted)
    f['SCI'].data = np.where(blank, 0.0, subtracted * t).astype(np.float32)
    f['DQ'].data = np.where(blank, f['DQ'].data | 1, f['DQ'].data & ~SATURATED).astype(np.int16)
    f[0].header['PSFSUB'] = ('cssearth psf-subtract.mts', 'reference-star PSF subtracted')
from stwcs import updatewcs, wcsutil
updatewcs.updatewcs(image)
star_sky = wcsutil.HSTWCS(image, ext=('SCI', 1)).all_pix2world([[sx, sy]], 0)[0]
from drizzlepac import astrodrizzle
settings = job['drizzle']
astrodrizzle.AstroDrizzle(image, output=name, build=True, in_memory=False, clean=True, runfile='', context=False,
                          driz_separate=False, median=False, blot=False, driz_cr=False, skysub=False, final_wcs=True, final_rot=0.0,
                          final_kernel=settings['kernel'], final_pixfrac=settings['pixfrac'], final_scale=settings['scale'], final_fillval='NaN', final_units='cps')
stop.set()
if stopped: raise SystemExit('The subtraction passed its memory ceiling at %d bytes and was stopped.' % stopped[0])
import stwcs, drizzlepac, scipy, astropy
software = [{'name': 'stwcs', 'version': stwcs.__version__}, {'name': 'drizzlepac', 'version': drizzlepac.__version__},
            {'name': 'scipy', 'version': scipy.__version__}, {'name': 'astropy', 'version': astropy.__version__}, {'name': 'numpy', 'version': np.__version__}]
print(json.dumps({'seconds': round(time.time() - start, 1), 'peakRssBytes': peak, 'software': software, 'drizzled': os.path.join(out_dir, name + '_drz.fits'),
  'fit': {'shiftPixels': shift, 'centroidOffsetPixels': first, 'scale': s, 'freeScaleCheck': {'scale': free_scale, 'rmsAfterCps': float(np.sqrt(free_ms))}, 'fitPixels': int(region.sum()), 'rmsBeforeCps': before, 'rmsAfterCps': after,
          'scienceStarPixel': [sx, sy], 'referenceStarPixel': [rx, ry], 'asymmetry': {'science': sci_asymmetry, 'reference': ref_asymmetry}, 'shortFramePixels': {'science': sci_short, 'reference': ref_short}, 'blankPixels': {'science': sci_bad, 'reference': ref_bad},
          'pixelScaleArcsec': scale}, 'starRaDecDeg': [float(star_sky[0]), float(star_sky[1])]}))
`;

/** The CR-rejected frame an association's calibration writes (`<association>` with its last character 1, `_crj`). */
async function calibratedFrame(id: string, observation: string, work: string, sources: readonly string[]) {
  const run = resolve(work, observation, 'run');
  const find = async () => (await readdir(run).catch(() => [] as string[])).find(name => name.endsWith('_crj.fits'));
  if (!(await find())) await runCalibration(id, observation, resolve(work, observation), { sources });
  const name = await find();
  if (!name) throw new Error(`${observation}: its calibration wrote no CR-rejected frame.`);
  return resolve(run, name);
}

export async function runPsfSubtraction(id: string, work: string, options: { sources?: readonly string[]; maxRssBytes?: number } = {}) {
  const record = parsePsfSubtraction(JSON.parse(await readFile(psfSubtractionPath(id), 'utf8')));
  const { program } = await readHstProgram(record.program), sources = options.sources ?? [];
  const ceiling = options.maxRssBytes ?? 3 * 2 ** 30, free = freeMemoryPercent() / 100 * totalmem();
  if (!(free >= 2 * ceiling)) throw new Error(`Only ${(free / 2 ** 30).toFixed(1)} GiB of memory is free; the subtraction needs twice its ${(ceiling / 2 ** 30).toFixed(1)} GiB ceiling.`);
  const toolchain = await hstToolchain(program.crdsContext), output = resolve(work, 'psf-subtracted'), results = [];
  await mkdir(output, { recursive: true });
  for (const band of record.bands) {
    const reference = { long: await calibratedFrame(record.program, band.reference.long, work, sources), short: await calibratedFrame(record.program, band.reference.short, work, sources) };
    for (const roll of band.science) {
      const science = { long: await calibratedFrame(record.program, roll.long, work, sources), short: await calibratedFrame(record.program, roll.short, work, sources) };
      // The archive's own drizzled product of the long association says the scale and kernel its drizzle used.
      const entry = program.observations.find(other => other.observation === roll.long)!;
      const drz = entry.products.find(product => product.name.endsWith('_drz.fits'));
      if (!drz) throw new Error(`${roll.long}: the archive made no drizzled product to take settings from.`);
      const { mastFile } = await import('../astronomy-packages/mast.mts');
      const theirs = (await readHstFileHdus(await mastFile(drz, resolve(work, 'mast'))))[0]!.header;
      const drizzle = { kernel: requireString(theirs.D001KERN, 'D001KERN'), pixfrac: requireFiniteNumber(theirs.D001PIXF, 'D001PIXF'), scale: requireFiniteNumber(theirs.D001SCAL, 'D001SCAL') };
      const name = `${record.id}-${band.band.toLowerCase()}-roll${roll.roll}`;
      const result = await toolchainPython(toolchain, output, SUBTRACT, [JSON.stringify({ science, reference, fit: record.fit, fluxRatio: band.fluxRatio, drizzle, output, name }), 'jref', program.crdsContext, String(ceiling)],
        resolve(work, `${name}.log`), { maxRssBytes: ceiling });
      const reported = requireRecord(JSON.parse(result.lastLine), 'subtraction result'), drizzled = requireString(reported.drizzled);
      const inputs: ProductInput[] = [
        { role: `science, long frame of ${roll.long}, recalibrated here`, identity: basename(science.long), ...await fileSize(science.long) },
        { role: `science, short frame of ${roll.short}, recalibrated here`, identity: basename(science.short), ...await fileSize(science.short) },
        { role: `reference star, long frame of ${band.reference.long}, recalibrated here`, identity: basename(reference.long), ...await fileSize(reference.long) },
        { role: `reference star, short frame of ${band.reference.short}, recalibrated here`, identity: basename(reference.short), ...await fileSize(reference.short) },
      ];
      const run: ProductRun = { telescope: 'HST', stage: 'psf-subtract', inputs,
        parameters: { instrument: 'ACS/HRC', program: program.programme, subtraction: record.id, band: band.band, roll: roll.roll, fit: record.fit, fluxRatio: { ...band.fluxRatio, source: record.fluxRatioSource }, drizzle, crdsContext: program.crdsContext },
        software: hstSoftware(reported.software), toolchainDigest: await hstToolchainDigest() };
      await writeProductRecord(productRecordPath(drizzled), run, [{ path: basename(drizzled), file: drizzled, units: 'electrons per second per drizzled pixel',
        conventions: { grid: 'north up, the archive drizzle\'s scale and kernel', star: `RA, Dec ${JSON.stringify(reported.starRaDecDeg)} at the PSF's centre of symmetry`, fit: JSON.stringify(reported.fit) } }]);
      results.push({ band: band.band, roll: roll.roll, drizzled, fit: requireRecord(reported.fit), starRaDecDeg: reported.starRaDecDeg, seconds: reported.seconds });
      console.log(`${name}: shift ${JSON.stringify(requireRecord(reported.fit).shiftPixels)}, scale ${String(requireRecord(reported.fit).scale)} (a free fit: ${JSON.stringify(requireRecord(reported.fit).freeScaleCheck)}), rms ${String(requireRecord(reported.fit).rmsBeforeCps)} -> ${String(requireRecord(reported.fit).rmsAfterCps)}`);
    }
  }
  await writeFile(resolve(output, `${record.id}.json`), `${JSON.stringify({ schema: 'cssearth-hst-psf-subtraction-result@1', id: record.id, results }, null, 2)}\n`);
  return { output, results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id, work] = args;
  if (!id || !work) throw new TypeError('Usage: psf-subtract <subtraction id> <work> [--raw <dir>]...');
  const sources = args.flatMap((arg, i) => arg === '--raw' ? [resolve(args[i + 1]!)] : []);
  const { output, results } = await runPsfSubtraction(id, resolve(work), { sources });
  console.log(`PSF_SUBTRACTED ${output} ${results.length} products`);
}
