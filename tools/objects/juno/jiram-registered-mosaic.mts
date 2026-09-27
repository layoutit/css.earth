#!/usr/bin/env node
/** Published registered JIRAM frames -> the existing night-side radiance map.
 * node tools/objects/juno/jiram-registered-mosaic.mts <recipe.json> --inputs <directory> [--fetch]
 * --fetch restores only the FITS subsets (curl + 7z), plus PDS observation-time indexes.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { flagValue, positionalArguments, requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { sha256 } from '@cssearth/core/node';
import { apply, numbers, utcToEt } from '@cssearth/spice';
import { loadKernelSet } from '@cssearth/spice/node';
import { kernelBankPaths } from '@cssearth/bake/objects/cameras';
import { combine, projectFrame, writeMap } from './jiram-mosaic.mts';
import { fetchFits } from './perry-archive.mts';
import { IFOV, readPlane, registerFrame, type RegisteredPlanes } from './jiram-registered.mts';

export function parseRegisteredRecipe(value: unknown) {
  const r = requireRecord(value, 'registered JIRAM recipe');
  if (r.schema !== 'cssearth-jiram-registered-mosaic@1') throw new Error('Unsupported registered JIRAM recipe.');
  const text = (o: Record<string, unknown>, key: string) => requireString(o[key], key);
  const number = (o: Record<string, unknown>, key: string) => requireFiniteNumber(o[key], key);
  const archive = text(r, 'archive'), rawArchive = text(r, 'rawArchive');
  if (![archive, rawArchive].every(s => s.startsWith('https://'))) throw new Error('Expected HTTPS source archives.');
  const orbits = requireArray(r.orbits, 'orbits').map(v => requireFiniteNumber(v, 'orbit'));
  if (!orbits.length || new Set(orbits).size !== orbits.length || orbits.some(v => !Number.isInteger(v) || v < 5 || v > 55)) throw new Error('Invalid release orbit selection.');
  const kernels = requireArray(r.kernels, 'kernels').map(v => requireString(v, 'kernel'));
  const target = requireRecord(r.target, 'target'), output = requireRecord(r.output, 'output'), p = requireRecord(r.policy, 'policy');
  const policy = { minimumFramesPerVisit: number(p, 'minimumFramesPerVisit'), maximumEmissionDegrees: number(p, 'maximumEmissionDegrees'),
    terminatorFootprints: number(p, 'terminatorFootprints'), minimumBackgroundSamples: number(p, 'minimumBackgroundSamples'),
    maximumResidualPixels: number(p, 'maximumResidualPixels'), maximumRangeFraction: number(p, 'maximumRangeFraction'), visitGapMinutes: number(p, 'visitGapMinutes') };
  const ppd = number(output, 'pixelsPerDegree');
  if (!Number.isInteger(ppd) || ppd < 1 || ppd > 8 || !Number.isInteger(policy.minimumFramesPerVisit) || policy.minimumFramesPerVisit < 3 ||
      !Number.isInteger(policy.minimumBackgroundSamples) || policy.minimumBackgroundSamples < 1 || policy.minimumBackgroundSamples > 128 ||
      policy.maximumEmissionDegrees <= 0 || policy.maximumEmissionDegrees >= 90 || Object.values(policy).some(n => n <= 0)) throw new Error('Invalid registered-map policy.');
  const naifId = number(target, 'naifId'), referenceRadiusKm = number(target, 'referenceRadiusKm');
  if (!Number.isInteger(naifId) || referenceRadiusKm <= 0) throw new Error('Invalid target.');
  return { archive, rawArchive, orbits, kernelSet: text(r, 'kernelSet'), kernels, policy,
    target: { name: text(target, 'name'), naifId, bodyFrame: text(target, 'bodyFrame'), referenceRadiusKm },
    output: { image: text(output, 'image'), label: text(output, 'label'), receipt: text(output, 'receipt'), productId: text(output, 'productId'), pixelsPerDegree: ppd } };
}

/** PDS's nine-column JIRAM index states exact start/stop times in year/day-of-year UTC. */
export function observationTimes(index: string) {
  const times = new Map<string, { utc: string; exposureSeconds: number }>();
  const utc = (value: string) => {
    const m = /^(\d{4})-(\d{3})T(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$/u.exec(value);
    if (!m) throw new Error(`Invalid PDS observation time: ${value}`);
    return Date.UTC(Number(m[1]), 0, Number(m[2]), Number(m[3]), Number(m[4]), 0) + Number(m[5]) * 1000;
  };
  for (const line of index.trim().split(/\r?\n/u).slice(1)) {
    const row = line.split(',').map(v => v.trim().replace(/^"|"$/gu, '').trim());
    if (row.length !== 9) throw new Error('Unsupported JIRAM index layout.');
    if (row[1] !== 'IMAGE') continue;
    // PJ25's published RDR index also contains EDR entries from the next orbit.
    if (row[2] === 'JNO-J-JIRAM-2-EDR-V1.0' && /^JIR_IMG_EDR_/u.test(row[3])) continue;
    if (row[2] !== 'JNO-J-JIRAM-3-RDR-V1.0' || !/^JIR_IMG_RDR_\d{7}T\d{6}_V\d{2}$/u.test(row[3])) throw new Error('Unexpected JIRAM index product.');
    const start = utc(row[4]), stop = utc(row[5]);
    if (stop < start || stop - start > 10000 || times.has(row[3])) throw new Error('Invalid or duplicate JIRAM exposure.');
    times.set(row[3], { utc: new Date(start).toISOString(), exposureSeconds: (stop - start) / 1000 });
  }
  return times;
}

export async function registeredMosaic(recipeFile: string, directory: string, fetchMissing = false) {
  const recipeBytes = await readFile(recipeFile), recipe = parseRegisteredRecipe(JSON.parse(recipeBytes.toString('utf8')));
  const root = dirname(recipeFile), { policy } = recipe, ppd = recipe.output.pixelsPerDegree, width = 360 * ppd, height = 180 * ppd, cells = width * height;
  if (fetchMissing) await fetchFits(recipe.archive, recipe.orbits, directory);
  const paths = await kernelBankPaths(recipe.kernelSet, recipe.kernels), set = await loadKernelSet(paths);
  const radii = numbers(set.pool, `BODY${recipe.target.naifId}_RADII`), radius = (radii[0] * radii[1] * radii[2]) ** (1 / 3);
  if (radii.length !== 3 || radii.some(v => v <= 0)) throw new Error('Invalid kernel radii.');
  const map = new Float32Array(cells).fill(NaN), best = new Float32Array(cells).fill(Infinity), source = new Int16Array(cells).fill(-1);
  const frames: { productId: string; orbit: number; visit: string; utc: string; exposureSeconds: number; inputs: Record<string, string>;
    report: ReturnType<typeof registerFrame>['report']; rejected?: string }[] = [];
  const visits: { id: string; frames: string[]; qualifiedCells: number; winningCells: number }[] = [];
  const indexes: { orbit: number; sha256: string }[] = [];
  for (const orbit of recipe.orbits) {
    const orbitName = `PJ${String(orbit).padStart(2, '0')}`, folder = join(directory, orbitName), indexFile = join(directory, `${orbitName}-INDEX.TAB`);
    let index = await readFile(indexFile).catch(() => undefined);
    if (!index && fetchMissing) {
      index = execFileSync('curl', ['--fail', '--silent', '--show-error', '--location', '--retry', '2', '--max-time', '120',
        `${recipe.rawArchive}/jnojir_2${String(orbit).padStart(3, '0')}/INDEX/INDEX.TAB`], { maxBuffer: 20e6 });
      await writeFile(indexFile, index);
    }
    if (!index) throw new Error(`${indexFile} is missing; run with --fetch.`);
    indexes.push({ orbit, sha256: sha256(index) });
    const times = observationTimes(index.toString('utf8'));
    const files = (await readdir(folder, { recursive: true })).filter(p => /(?:^|\/)JIR_IMG_RDR_\d{7}T\d{6}_V\d{2}_M_band_radiance\.fits$/u.test(p) && !p.includes('__MACOSX')).sort();
    if (!files.length) throw new Error(`${folder}: no M-band products.`);
    const seen = new Set<string>();
    let last = -Infinity, visit = '', projections: ReturnType<typeof projectFrame>[] = [], accepted: string[] = [];
    const finish = async () => {
      if (!projections.length) return;
      const result = combine([{ id: visit, projections }], cells, policy.minimumFramesPerVisit);
      let count = 0;
      for (let i = 0; i < cells; i++) if (Number.isFinite(result.map[i])) {
        count++;
        if (result.footprint[i] < best[i]) { map[i] = result.map[i]; best[i] = result.footprint[i]; source[i] = visits.length; }
      }
      visits.push({ id: visit, frames: accepted, qualifiedCells: count, winningCells: 0 });
      console.error(`${visit}: ${accepted.length} accepted frames, ${count} qualified cells`);
      projections = []; accepted = [];
    };
    for (const file of files) {
      const productId = file.match(/JIR_IMG_RDR_\d{7}T\d{6}_V\d{2}/u)![0], time = times.get(productId);
      if (!time || seen.has(productId)) throw new Error(`Missing PDS time or duplicate FITS product: ${productId}`);
      seen.add(productId);
      const millis = Date.parse(time.utc);
      if (millis - last > policy.visitGapMinutes * 60000) { await finish(); visit = `${orbitName}-${time.utc}`; }
      last = millis;
      const prefix = join(folder, file.replace('band_radiance.fits', '')), inputs: Record<string, string> = {};
      const plane = async (suffix: string, mask = false) => {
        const bytes = await readFile(`${prefix}${suffix}.fits`);
        inputs[suffix] = sha256(bytes); return readPlane(bytes, mask);
      };
      const planes: RegisteredPlanes = { radiance: await plane('band_radiance'), latitude: await plane('latitude'), longitude: await plane('longitude'),
        emission: await plane('emission'), range: await plane('altitude'), saturation: await plane('saturation_mask_80', true).catch(async error => {
          if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
          return plane('saturation_mask', true);
        }) };
      // Producer uses start time, minus 0.62 s from PJ51, and light-time corrected
      // body geometry. The median archived surface range supplies that short delay.
      const ranges = Array.from(planes.range).filter(v => v > 0).sort((a, b) => a - b);
      const et = utcToEt(set.leapSeconds, time.utc) - (orbit >= 51 ? 0.62 : 0) - (ranges[ranges.length >> 1] ?? 0) / 299792.458;
      const sun = apply(set.rotation(recipe.target.bodyFrame, et), set.ephemeris.apparent(10, recipe.target.naifId, et).position);
      const result = registerFrame(planes, radii, sun.map(v => v / Math.hypot(...sun)), policy);
      frames.push({ productId, orbit, visit, ...time, inputs, report: result.report, ...(result.rejected ? { rejected: result.rejected } : {}) });
      if (!result.camera || !result.values) continue;
      projections.push(projectFrame({ camera: result.camera, values: result.values }, radii, ppd, 'night', policy, IFOV, radius));
      accepted.push(productId);
    }
    await finish();
  }
  for (const index of source) if (index >= 0) visits[index].winningCells++;
  let area = 0, totalArea = 0, count = 0;
  for (let y = 0; y < height; y++) {
    const weight = Math.cos((90 - (y + 0.5) / ppd) * Math.PI / 180);
    for (let x = 0; x < width; x++) { totalArea += weight; if (Number.isFinite(map[y * width + x])) { count++; area += weight; } }
  }
  await writeMap(root, { ...recipe, band: { name: 'M', unit: 'W/(m^2*sr)' }, side: 'night', visits,
    background: { method: 'night-column-median', minimumSamples: policy.minimumBackgroundSamples } }, map, 'tools/objects/juno/jiram-registered-mosaic.mts');
  const rejected = new Map<string, { orbit: number; reason: string; productIds: string[] }>();
  for (const frame of frames) if (frame.rejected) {
    const key = `${frame.orbit}:${frame.rejected}`, group = rejected.get(key) ?? { orbit: frame.orbit, reason: frame.rejected, productIds: [] };
    group.productIds.push(frame.productId); rejected.set(key, group);
  }
  const receipt = { schema: 'cssearth-jiram-registered-receipt@1', recipeSha256: sha256(recipeBytes), archive: recipe.archive,
    radiiKm: radii, ifovRadians: IFOV, kernels: Object.fromEntries(await Promise.all(paths.map(async (p, i) => [recipe.kernels[i], sha256(await readFile(p))]))),
    coverage: { cells, validCells: count, gridFraction: count / cells, sphericalAreaFraction: area / totalArea }, visits, indexes,
    screenedFrames: frames.length, frames: frames.filter(f => !f.rejected), rejected: [...rejected.values()],
    imageSha256: sha256(await readFile(resolve(root, recipe.output.image))) };
  await mkdir(dirname(resolve(root, recipe.output.receipt)), { recursive: true });
  await writeFile(resolve(root, recipe.output.receipt), `${JSON.stringify(receipt, null, 2)}\n`);
  // Audit rasters stay in the ignored input directory, outside delivery inventories.
  await writeFile(join(directory, 'winning-visit.i16'), Buffer.from(source.buffer));
  await writeFile(join(directory, 'footprint.f32'), Buffer.from(best.buffer));
  console.error(JSON.stringify(receipt.coverage));
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), recipe = positionalArguments(args, ['--inputs'])[0], inputs = flagValue(args, '--inputs');
  if (!recipe || !inputs) throw new Error('Usage: jiram-registered-mosaic.mts <recipe.json> --inputs <directory> [--fetch]');
  await registeredMosaic(resolve(recipe), resolve(inputs), args.includes('--fetch'));
}
