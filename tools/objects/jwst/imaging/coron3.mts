#!/usr/bin/env node
/** Re-run the JWST pipeline's level-3 coronagraphy stage (calwebb_coron3) for one coronagraph band of a pinned imaging program.
 *
 *   node tools/objects/jwst/imaging/coron3.mts <program id> <band> <work directory> [--raw <dir>]... [--max-rss-gib <n>]
 *
 * The members are the target's per-integration _calints exposures at each telescope roll and the PSF reference star's, as MAST's
 * own coron3 association names them (archive.mts); target acquisition exposures are left out, as the stage does not read them.
 * The stage stacks the references, aligns them to each science integration, subtracts the PSF by KLIP, flags outliers and
 * resamples the rolls into one mosaic, on the pinned toolchain (toolchain.json: jwst 2.0.1) with the program's CRDS context and
 * the parameter reference files it selects: the settings MAST ran. The mosaic is the pipeline's own grid, the reproduction of
 * MAST's level-3 product (compare.mts checks it). The run is stopped if its resident memory passes the ceiling (default 2 GiB;
 * nine NIRCam SUB320 references and two rolls peak at 0.66 GiB).
 *
 * The run fails if any reference slice's alignment fit stops at its evaluation limit instead of converging. The mosaic would
 * then depend on where the search stopped, which differs between machines, so it reproduces neither MAST nor itself elsewhere.
 * MIRI's four-quadrant phase masks do this on every slice (docs/jwst-imaging.md).
 *
 * Beside the mosaic the run writes its product record (image3.mts builds it): the rolls and the PSF references at their pinned
 * digests, the CRDS context and the pinned pipeline. compare.mts adds its agreement with MAST to that record, and a mosaic is
 * reused only when the record says this same run made it. */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { totalmem } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireRecord } from '../../../sources/source-values.mts';
import { productRecordPath, readProductRecord, sameRun, writeProductRecord } from '../../product-record.mts';
import { eurekaToolchain } from '../toolchain.mts';
import { freeMemoryPercent, toolchainPython } from '../mast.mts';
import { eurekaPins, imagingMembers, imagingProductRun, level3ProductFacts } from './image3.mts';

const CORON3 = `
import json, sys, time, types
from jwst.coron import imageregistration
from jwst.pipeline import Coron3Pipeline
asn, output_dir = sys.argv[1], sys.argv[2]
# align_refs fits each reference slice with scipy's leastsq at xtol = ftol = 1e-15. The pipeline swallows scipy's warning, so
# each fit's status is read from leastsq itself, whose result is passed through unchanged: 1-4 converged, 5 hit maxfev.
fit, statuses = imageregistration.optimize.leastsq, []
def counted(*args, **kwargs):
    result = fit(*args, **kwargs)
    statuses.append(result[-1])
    return result
imageregistration.optimize = types.SimpleNamespace(leastsq=counted)
start = time.time()
Coron3Pipeline.call(asn, output_dir=output_dir, save_results=True)
print(json.dumps({'seconds': round(time.time() - start, 1), 'alignments': len(statuses), 'unconvergedAlignments': sum(s not in (1, 2, 3, 4) for s in statuses)}))
`;

export async function runCoron3(id: string, band: string, work: string, options: { sources?: readonly string[]; maxRssBytes?: number } = {}) {
  const { program, entry, files, references } = await imagingMembers(id, band, resolve(work, 'members'), options.sources);
  if (entry.stage !== 'coron3') throw new Error(`${id} ${band} is not a coronagraph band.`);
  const ceiling = options.maxRssBytes ?? 2 * 2 ** 30, free = freeMemoryPercent() / 100 * totalmem();
  if (!(free >= 2 * ceiling)) throw new Error(`Only ${(free / 2 ** 30).toFixed(1)} GiB of memory is free; the coron3 stage needs twice its ${(ceiling / 2 ** 30).toFixed(1)} GiB ceiling.`);
  const product = entry.observation, output = resolve(work, 'coron3');
  await mkdir(output, { recursive: true });
  const mosaic = resolve(output, `${product}_i2d.fits`), recordPath = productRecordPath(mosaic);
  const run = imagingProductRun(program, entry, 'coron3', { psfReferences: references.length }, await eurekaPins());
  // The references, the rolls, the CRDS context and the pinned pipeline are what the mosaic is; it is reused only when the
  // record beside it says that same run made it and the file is still the one that run wrote.
  if (await sameRun(await readProductRecord(recordPath), run, name => resolve(dirname(mosaic), name))) return { mosaic, reused: true, peakRssBytes: 0, seconds: 0, members: files.length, references: references.length };
  await rm(recordPath, { force: true });
  const asn = resolve(work, `${product}_asn.json`);
  await writeFile(asn, `${JSON.stringify({ asn_type: 'coron3', asn_rule: 'candidate_Asn_Lv3Coron', program: program.programme.padStart(5, '0'),
    asn_id: 'c001', target: 't001', asn_pool: 'cssearth', products: [{ name: product, members: [
      ...references.map(expname => ({ expname, exptype: 'psf' })), ...files.map(expname => ({ expname, exptype: 'science' }))] }] }, null, 2)}\n`);
  const toolchain = await eurekaToolchain(program.crdsContext);
  const result = await toolchainPython(toolchain, work, CORON3, [asn, output], resolve(work, `${product}.log`), { maxRssBytes: ceiling });
  const summary = requireRecord(JSON.parse(result.lastLine), 'coron3 result'), seconds = summary.seconds;
  if (typeof summary.alignments !== 'number' || summary.alignments < 1) throw new Error(`${id} ${band}: no PSF alignment fit was seen.`);
  if (summary.unconvergedAlignments !== 0) throw new Error(`${id} ${band}: ${String(summary.unconvergedAlignments)} PSF alignment fits stopped without converging; the mosaic would depend on the machine.`);
  await writeProductRecord(recordPath, run, [{ path: basename(mosaic), file: mosaic, ...(await level3ProductFacts(mosaic)) }]);
  return { mosaic, reused: false, peakRssBytes: result.peakRssBytes, seconds, members: files.length, references: references.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id, band, work] = args;
  const option = (name: string) => args.flatMap((arg, i) => arg === name ? [args[i + 1]!] : []);
  if (!id || !band || !work) throw new TypeError('Usage: coron3 <program id> <band> <work> [--raw <dir>]... [--max-rss-gib <n>]');
  const ceiling = option('--max-rss-gib')[0];
  const result = await runCoron3(id, band, resolve(work), { sources: option('--raw').map(dir => resolve(dir)), ...(ceiling ? { maxRssBytes: Number(ceiling) * 2 ** 30 } : {}) });
  console.log(`CORON3 ${JSON.stringify({ ...result, peakRssGiB: +(result.peakRssBytes / 2 ** 30).toFixed(2) })}`);
}
