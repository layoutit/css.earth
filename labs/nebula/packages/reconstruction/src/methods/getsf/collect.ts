/** Import real getsf observed-intensity components; never substitute its detection/flattened maps. */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
import { digest } from './benchmark-products.ts';
import type {GetSfFitsTransport} from './transport.ts';

function statistics(values: Float32Array) {
  let min = Infinity, max = -Infinity, sum = 0, negativeCount = 0, negativeSum = 0;
  for (const value of values) {
    min = Math.min(min, value); max = Math.max(max, value); sum += value;
    if (value < 0) { negativeCount++; negativeSum += value; }
  }
  return { min, max, sum, negativeCount, negativeSum };
}

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(entry => entry.isDirectory() ? filesBelow(resolve(directory, entry.name)) :
    entry.isFile() ? [resolve(directory, entry.name)] : []));
  return groups.flat().sort();
}

export async function collectGetSfBenchmark(options: {
  workDirectory: string; outputDirectory: string; importPath: string; installationReceiptPath: string;
  negativePolicy?: 'reject' | 'positive-parts-with-signed-residual';
}, transport:Pick<GetSfFitsTransport,'decodeFits'|'float32LittleEndian'>, root:string) {
 const {decodeFits,float32LittleEndian}=transport;
  const work = resolve(options.workDirectory), output = resolve(options.outputDirectory);
  const input = JSON.parse(await readFile(resolve(work, 'input.json'), 'utf8'));
  const execution = await readFile(resolve(work, 'execution.log'), 'utf8');
  if (!/GETSF: DONE IN [\d.]+ MINUTES/.test(execution) || /ERROR in GETSF: Aborted/.test(execution))
    throw new Error('getsf has no successful completion receipt.');
  const config = await readFile(resolve(work, 'runs/+getsf.cfg'));
  if (digest(config) !== input.configurationSha256) throw new Error('getsf input configuration pin differs.');
  const imagePath = resolve(input.imagePath);
  if (digest(await readFile(imagePath)) !== input.sourceSha256) throw new Error('getsf source image pin differs.');
  const installed = JSON.parse(await readFile(options.installationReceiptPath, 'utf8'));
  const rawDirectory = resolve(work, 'export');
  await Promise.all([mkdir(rawDirectory, { recursive: true }), mkdir(output, { recursive: true })]);
  const filenames = { diffuse: 'benchmark.001.obs.fbackground.fits', compact: 'benchmark.001.obs.sources.fits',
    elongated: 'benchmark.001.obs.filaments.fits' };
  const maps: Record<string, string> = {}, rawOfficialMaps: Record<string, unknown> = {};
  let hasNegative = false;
  for (const [name, filename] of Object.entries(filenames)) {
    const path = resolve(work, '001', filename), original = await readFile(path), decoded = decodeFits(original);
    if (decoded.width !== input.width || decoded.height !== input.height) throw new Error('getsf output dimensions differ.');
    const stats = statistics(decoded.values), raw = float32LittleEndian(decoded.values);
    const rawPath = resolve(rawDirectory, `${name}-official.f32`);
    await writeFile(rawPath, raw);
    rawOfficialMaps[name] = { originalFitsPath: relative(root, path), fitsSha256: digest(original),
      path: relative(root, rawPath), sha256: digest(raw), bytes: raw.length, statistics: stats };
    hasNegative ||= stats.negativeCount > 0;
    if (options.negativePolicy === 'positive-parts-with-signed-residual') {
      for (let p = 0; p < decoded.values.length; p++) decoded.values[p] = Math.max(0, decoded.values[p]!);
    }
    const importPath = resolve(rawDirectory, `${name}.f32`);
    await writeFile(importPath, float32LittleEndian(decoded.values));
    maps[name] = relative(root, importPath);
  }
  const catalogs = (await filesBelow(resolve(work, 'runs'))).filter(path =>
    path.endsWith('.cat') && (path.includes('det.cat') || path.includes('skeletons')));
  const catalogReceipts = [];
  for (const path of catalogs) {
    const bytes = await readFile(path), name = basename(path);
    await writeFile(resolve(output, name), bytes);
    catalogReceipts.push({ name, originalPath: relative(root, path), sha256: digest(bytes), bytes: bytes.length,
      rows: bytes.toString('utf8').split('\n').filter(line => line.trim() && !line.trim().startsWith('#')).length });
  }
  const note = 'Actual getsf260706 separation and detection of one display-luminance image. ' +
    'Compact peaks and filament morphology are not membership or gas classifications. ' +
    'Physical flux/mass measurements and optional visualization were disabled. ' +
    (hasNegative ? options.negativePolicy === 'positive-parts-with-signed-residual' ?
      'Official signed maps are retained; preview components use explicitly recorded positive parts, with all removed negative signal carried in the signed residual.' :
      'Official maps contain signed samples; no preview import is admitted without an explicit policy.' :
      'Official observed-intensity components are nonnegative and imported unchanged.');
  const receipt = { schema: 'cssearth-getsf-result@1', input, installation: installed,
    methodUrl: 'https://irfu.cea.fr/Pisp/alexander.menshchikov/',
    paperUrl: 'https://www.aanda.org/articles/aa/full_html/2021/05/aa39913-20/aa39913-20.html',
    sourceEquation: 'sources=I−B_source; filaments=B_source−B_filament; diffuse=B_filament',
    rawOfficialMaps, catalogs: catalogReceipts, negativePolicy: options.negativePolicy ?? 'reject',
    executionSha256: digest(execution), note };
  const receiptPath = resolve(output, 'provenance.json');
  await Promise.all([writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`),
    writeFile(resolve(output, 'getsf.cfg'), config), writeFile(resolve(output, 'execution.log'), execution)]);
  if (hasNegative && options.negativePolicy !== 'positive-parts-with-signed-residual')
    throw new Error('Official getsf maps contain signed pixels; receipt preserved. Choose an explicit display policy before import.');
  const manifest = { sourceSha256: input.sourceSha256, width: input.width, height: input.height, maps, note,
    provenance: relative(root, receiptPath), metrics: { software: 'getsf260706',
      pixelScaleArcsec: input.pixelScaleArcsec, beamFwhmPx: input.beamFwhmPx,
      sourceMaxFootprintRadiusPx: input.sourceMaxFootprintRadiusPx, filamentMaxFootprintRadiusPx: input.filamentMaxFootprintRadiusPx,
      catalogFiles: catalogReceipts.length, negativePolicy: options.negativePolicy ?? 'reject' } };
  await writeFile(resolve(options.importPath), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
