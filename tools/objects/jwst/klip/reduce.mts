#!/usr/bin/env node
/** Subtract a star's light from pinned JWST NIRCam coronagraph exposures with spaceKLIP, the way a paper's authors did.
 *
 *   node tools/objects/jwst/klip/reduce.mts <program id> <band> <work directory> --raw <dir> [--max-rss-gib <n>]
 *
 * The program (klip/programs/<id>.json) pins the raw _uncal exposures by MAST URI and byte count, which observations are the
 * target and which the PSF reference star, and every setting of the published reduction with the page it is read from. The chain
 * is the one the authors ran (Balmer et al. 2025 for HR 8799, their public AF Lep b script for its shape): the jwst stage 1
 * and 2 pipelines through spaceKLIP, median and bad-pixel cleaning, NaN replacement, a Nyquist blur, padding, centring on a
 * webbpsf model of the coronagraphic PSF, alignment of every frame to the first science frame, cropping, and KLIP against the
 * reference library. The run happens on the klip toolchain (toolchain.json), whose pins are the paper's pipeline version and CRDS
 * context. The result is spaceKLIP's own KLIP product, one image per KL mode count, north up. The run is stopped if its resident
 * memory passes the ceiling (default 6 GiB). */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { availableParallelism, totalmem } from 'node:os';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { freeMemoryPercent, toolchainPython } from '../mast.mts';
import { jwstToolchain } from '../toolchain.mts';

const PROGRAMS = resolve(import.meta.dirname, 'programs');

export interface KlipBand { readonly band: string; readonly science: readonly string[]; readonly references: readonly string[] }
export interface KlipProgram { readonly id: string; readonly crdsContext: string; readonly settings: Record<string, unknown>; readonly bands: readonly KlipBand[]; readonly files: ReadonlyMap<string, { readonly uri: string; readonly bytes: number }> }

export async function readKlipProgram(id: string): Promise<KlipProgram> {
  const path = resolve(PROGRAMS, `${id}.json`), entry = requireRecord(JSON.parse(await readFile(path, 'utf8')) as unknown, path);
  if (entry.schema !== 'cssearth-jwst-klip-program@1') throw new Error(`${path}: schema is ${String(entry.schema)}, not cssearth-jwst-klip-program@1.`);
  const files = new Map(requireArray(entry.files, `${path} files`).map(record => {
    const file = requireRecord(record, `${path} file`);
    return [requireString(file.name, `${path} file name`), { uri: requireString(file.uri, `${path} file uri`), bytes: requireFiniteNumber(file.bytes, `${path} file bytes`) }] as const;
  }));
  const bands = requireArray(entry.bands, `${path} bands`).map(record => {
    const band = requireRecord(record, `${path} band`), name = requireString(band.band, `${path} band name`);
    const list = (key: string) => requireArray(band[key], `${path} ${name} ${key}`).map(value => {
      const file = requireString(value, `${path} ${name} ${key}`);
      if (!files.has(file)) throw new Error(`${path}: band ${name} names ${file} in ${key}, which the program does not pin.`);
      return file;
    });
    return { band: name, science: list('science'), references: list('references') };
  });
  return { id, crdsContext: requireString(entry.crdsContext, `${path} crdsContext`), settings: requireRecord(entry.settings, `${path} settings`), bands, files };
}

/** The Python run: spaceKLIP's database over the band's exposures, then the published chain with the program's settings. */
const REDUCE = `
import json, sys, time
from spaceKLIP import database, coron1pipeline, coron2pipeline, imagetools, pyklippipeline
files, output_dir, settings = json.loads(sys.argv[1]), sys.argv[2], json.loads(sys.argv[3])
if settings.get('firstAnnulusOuterArcsec') is not None:
    # pyKLIP spaces its annuli evenly from IWA to OWA; spaceKLIP sets OWA to the image's half-widths summed. A paper that states where
    # its first annulus ends fixes OWA: IWA + (OWA - IWA) / annuli is that edge.
    from pyklip.instruments import JWST
    original = JWST.JWSTData.readdata
    def readdata(self, filepaths, *args, **kwargs):
        original(self, filepaths, *args, **kwargs)
        # The pixel scale pyKLIP itself uses: the square root of the first science file's PIXAR_A2.
        from astropy.io import fits
        edge = settings['firstAnnulusOuterArcsec'] / fits.getheader(filepaths[0], 'SCI')['PIXAR_A2'] ** 0.5
        annuli = settings['klip']['annuli'][0]
        self._OWA = self._IWA + annuli * (edge - self._IWA)
        print(json.dumps({'IWA': float(self._IWA), 'OWA': float(self._OWA)}), file=sys.stderr)
    JWST.JWSTData.readdata = readdata
start = time.time()
db = database.Database(output_dir=output_dir)
db.read_jwst_s012_data(datapaths=files, psflibpaths=None, bgpaths=None, cr_from_siaf=settings['crFromSiaf'])
if len(db.obs) != 1: raise SystemExit(f'expected one concatenation, found {sorted(db.obs)}')
coron1pipeline.run_obs(database=db, steps=settings['stage1'], subdir='stage1')
coron2pipeline.run_obs(database=db, steps=settings['stage2'], subdir='stage2')
tools = imagetools.ImageTools(db)
tools.update_nircam_centers()
tools.subtract_median(types=['SCI', 'SCI_TA', 'SCI_BG', 'REF', 'REF_TA', 'REF_BG'], subdir='medsub')
tools.fix_bad_pixels(**settings['badPixels'], subdir='bpcleaned')
tools.replace_nans(cval=0., types=['SCI', 'SCI_BG', 'REF', 'REF_BG'], subdir='nanreplaced')
tools.blur_frames(fact='auto', subdir='blurred')
tools.pad_frames(npix=settings['padPixels'], cval=0., types=['SCI', 'SCI_BG', 'REF', 'REF_BG'], subdir='padded')
tools.recenter_frames(spectral_type=settings['spectralType'], subdir='recentered')
tools.align_frames(**settings['align'], subdir='aligned')
tools.crop_frames(npix=settings['cropPixels'], types=['SCI', 'SCI_BG', 'REF', 'REF_BG'], subdir='cropped')
pyklippipeline.run_obs(database=db, kwargs={**settings['klip'], 'numthreads': settings['workers']}, subdir='klipsub')
key = next(iter(db.red))
products = [row['FITSFILE'] for row in db.red[key]]
print(json.dumps({'seconds': round(time.time() - start, 1), 'concatenation': key, 'products': products}))
`;

async function sha256(path: string) { return createHash('sha256').update(await readFile(path)).digest('hex'); }

/** Copy each exposure of the band into the work directory from the first raw directory holding it at the pinned size. */
async function stageExposures(program: KlipProgram, band: KlipBand, raw: readonly string[], directory: string) {
  await mkdir(directory, { recursive: true });
  const staged: string[] = [];
  for (const name of [...band.science, ...band.references]) {
    const pin = program.files.get(name)!, target = resolve(directory, name);
    const size = await stat(target).then(s => s.size, () => -1);
    if (size !== pin.bytes) {
      let found = '';
      for (const dir of raw) if (await stat(resolve(dir, name)).then(s => s.size === pin.bytes, () => false)) { found = resolve(dir, name); break; }
      if (!found) throw new Error(`${program.id} ${band.band}: ${name} (${pin.uri}, ${pin.bytes} bytes) is in none of ${raw.join(', ') || 'no raw directory'}.`);
      await copyFile(found, target);
    }
    staged.push(target);
  }
  return staged;
}

export async function reduceKlip(id: string, bandName: string, work: string, options: { raw: readonly string[]; maxRssBytes?: number }) {
  const program = await readKlipProgram(id), band = program.bands.find(entry => entry.band === bandName);
  if (!band) throw new Error(`${id} has no band ${bandName}; it has ${program.bands.map(entry => entry.band).join(', ')}.`);
  const ceiling = options.maxRssBytes ?? 6 * 2 ** 30, free = freeMemoryPercent() / 100 * totalmem();
  if (!(free >= ceiling)) throw new Error(`Only ${(free / 2 ** 30).toFixed(1)} GiB of memory is free; the spaceKLIP run needs its ${(ceiling / 2 ** 30).toFixed(1)} GiB ceiling.`);
  const files = await stageExposures(program, band, options.raw, resolve(work, 'uncal'));
  const output = resolve(work, 'spaceklip');
  await mkdir(output, { recursive: true });
  // pyKLIP runs one worker per core by default and each worker's linear algebra starts its own threads, so a 32-zone subtraction
  // asked a 14-core machine for hundreds of threads (load average 366). Half the cores, one thread each, keeps the machine usable.
  const workers = Math.max(1, Math.floor(availableParallelism() / 2)), single = Object.fromEntries(['OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'VECLIB_MAXIMUM_THREADS', 'NUMEXPR_NUM_THREADS'].map(name => [name, '1']));
  const base = await jwstToolchain('klip', program.crdsContext), toolchain = { ...base, env: { ...base.env, ...single } };
  const result = await toolchainPython(toolchain, work, REDUCE, [JSON.stringify(files), output, JSON.stringify({ ...program.settings, workers })], resolve(work, 'reduce.log'),
    { maxRssBytes: ceiling, progressLabel: `${id} ${bandName}` });
  const summary = requireRecord(JSON.parse(result.lastLine) as unknown, 'spaceKLIP result');
  const products = requireArray(summary.products, 'spaceKLIP products').map(value => requireString(value, 'spaceKLIP product'));
  const record = { schema: 'cssearth-jwst-klip-run@1', program: id, band: bandName, crdsContext: program.crdsContext, toolchain: 'tools/objects/jwst/klip/toolchain.json',
    inputs: await Promise.all(files.map(async file => ({ name: basename(file), sha256: await sha256(file) }))),
    products: await Promise.all(products.map(async file => ({ path: file.startsWith(output) ? file.slice(output.length + 1) : file, sha256: await sha256(file) }))),
    workers, seconds: summary.seconds, peakRssGiB: +(result.peakRssBytes / 2 ** 30).toFixed(2) };
  await writeFile(resolve(work, 'run.json'), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id, band, work] = args;
  const option = (name: string) => args.flatMap((arg, i) => arg === name ? [args[i + 1]!] : []);
  if (!id || !band || !work) throw new TypeError('Usage: reduce <program id> <band> <work> --raw <dir> [--max-rss-gib <n>]');
  const ceiling = option('--max-rss-gib')[0];
  const record = await reduceKlip(id, band, resolve(work), { raw: option('--raw').map(dir => resolve(dir)), ...(ceiling ? { maxRssBytes: Number(ceiling) * 2 ** 30 } : {}) });
  console.log(`KLIP ${JSON.stringify({ band: record.band, products: record.products.length, seconds: record.seconds, peakRssGiB: record.peakRssGiB })}`);
}
