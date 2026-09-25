#!/usr/bin/env node
/** Re-run standard data processing on a pinned Chandra observation, from its level-1 products.
 *
 *   node tools/objects/chandra/reprocess.mts <program id> <obsid> <work directory> [--raw <dir>]... [--max-rss-gib <n>]
 *
 * The pinned files are taken from a --raw directory that already holds them or downloaded from the Chandra Data Archive, each at
 * its pinned size and digest; a digest missing from the program is measured and written back. They keep the archive's own paths
 * under <work>/archive, because chandra_repro reads an observation as the directory the archive lays out: the level-1
 * event list, the aspect solution, the bad pixels, the mask, the mission timeline, the parameter block and the bias maps, each
 * where standard data processing put it. They are then copied into <work>/run, because chandra_repro expands a gzipped input
 * beside itself and so writes into the directory it is given; the pinned downloads stay as the archive sent them.
 *
 * chandra_repro is then the Chandra X-ray Center's own script, run from the pinned CIAO against the pinned CALDB. It runs the
 * instrument's event processing again (acis_process_events or hrc_process_events), makes a new bad-pixel list, applies the
 * grade, status and good-time filters and writes a new level-2 event list. The run's outputs go to <work>/repro.
 *
 * Beside that event list the run writes its product record: the pinned level-1 files it read, what chandra_repro was told, and
 * the CIAO and CALDB that ran it. Nothing later rewrites those facts, so a comparison on another machine, or years later, reports
 * the environment that made the event list rather than the one it is itself running in. A re-run is skipped only when that record
 * says this same run made the products and they are still the files it made (sameRun).
 *
 * Memory: chandra_repro spawns the CIAO tools as separate executables, so the ceiling is applied to the whole process group, not
 * to Python alone. The group is sampled every second and the run is stopped if it passes the ceiling (2 GiB by default). */
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { totalmem } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { freeMemoryPercent, toolchainPython } from '../jwst/mast.mts';
import { productRecordPath, type ProductRun } from '@cssearth/telescope';
import { readProductRecord, sameRun, writeProductRecord } from '@cssearth/telescope/node';
import { chandraFile, parseChandraProgram, PROGRAMS, type ChandraFile, type ChandraObservation, type ChandraProgram } from './archive.mts';
import { chandraToolchain, chandraVersions, CHANDRA_ROOT } from './toolchain.mts';

const REPROCESS = `
import json, os, subprocess, sys, threading, time
indir, outdir, ceiling, parameters = sys.argv[1], sys.argv[2], int(sys.argv[3]), json.loads(sys.argv[4])

# A CIAO tool prompts on the terminal for a parameter it was not given, so standard input is the null device: a run that would
# have waited for an answer ends instead of hanging.
os.dup2(os.open(os.devnull, os.O_RDONLY), 0)

# chandra_repro spawns the CIAO tools, so the ceiling covers this process and its children, not Python alone.
os.setpgrp()
group, mine, stop, peak, stopped = os.getpgrp(), os.getpid(), threading.Event(), 0, []
def sample():
    rows = subprocess.run(['ps', '-o', 'pid=,rss=', '-g', str(group)], capture_output=True, text=True).stdout.split()
    return [(int(rows[i]), int(rows[i + 1]) * 1024) for i in range(0, len(rows) - 1, 2)]
def watch():
    global peak
    while not stop.is_set():
        rows = sample()
        peak = max(peak, sum(rss for _, rss in rows))
        if ceiling and peak > ceiling and not stopped:
            stopped.append(peak)
            for pid, _ in rows:
                if pid != mine: os.kill(pid, 9)
        stop.wait(1)
threading.Thread(target=watch, daemon=True).start()

from ciao_contrib.runtool import chandra_repro

start = time.time()
# Every parameter comes from the caller, which records the same set in the run's product record: what ran and what the record
# says ran are one list, not two.
chandra_repro(indir=indir, outdir=outdir, **parameters)
stop.set()
if stopped: raise SystemExit('chandra_repro passed its memory ceiling at %d bytes and was stopped.' % stopped[0])
print(json.dumps({'seconds': round(time.time() - start, 1), 'peakRssBytes': peak, 'caldbPath': os.environ.get('CALDB', '')}))
`;

export async function readChandraProgram(id: string) {
  const path = resolve(PROGRAMS, `${id}.json`);
  return { path, program: parseChandraProgram(JSON.parse(await readFile(path, 'utf8'))) };
}

/** An observation's pinned files on disk at their pinned sizes and digests, laid out under the archive's own paths; digests
 * missing from the program are measured, written back, and carried by the observation this returns, which is what a run records
 * its inputs from. */
export async function chandraFiles(id: string, obsid: number, directory: string, sources: readonly string[] = [], kinds: 'inputs' | 'products' | 'all' = 'all') {
  const { path, program } = await readChandraProgram(id), entry = program.observations.find(other => other.obsid === obsid);
  if (!entry) throw new Error(`${id} has no observation ${obsid}.`);
  const fetchAll = async (pinned: readonly ChandraFile[]) => {
    const files: string[] = [], digested: ChandraFile[] = [];
    for (const member of pinned) {
      files.push(await chandraFile(member, directory, sources));
      digested.push({ ...member, bytes: (await stat(resolve(directory, member.path))).size });
    }
    return { files, digested, changed: digested.some((member, index) => member.bytes !== pinned[index]!.bytes) };
  };
  const inputs = kinds === 'products' ? { files: [], digested: [...entry.inputs], changed: false } : await fetchAll(entry.inputs);
  const products = kinds === 'inputs' ? { files: [], digested: [...entry.products], changed: false } : await fetchAll(entry.products);
  if (inputs.changed || products.changed) {
    const updated: ChandraProgram = { ...program, observations: program.observations.map(other =>
      other.obsid === obsid ? { ...other, inputs: inputs.digested, products: products.digested } : other) };
    await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`);
  }
  return { program, entry: { ...entry, inputs: inputs.digested, products: products.digested }, inputs: inputs.files, products: products.files };
}

/** What a pinned level-1 file is, from the kind its archive name states (`acisf02798_002N004_evt1.fits.gz`). A kind this route
 * has not met is recorded under the archive's own path rather than guessed at. */
const INPUT_KINDS: Readonly<Record<string, string>> = { evt: 'level-1 event list', asol: 'aspect solution', aqual: 'aspect quality',
  bpix: 'bad pixels', msk: 'mask', mtl: 'mission timeline', flt: 'good-time filter', stat: 'status filter', pbk: 'parameter block',
  bias: 'bias map', eph: 'ephemeris', dtf: 'dead-time factors', soff: 'aspect offsets', fov: 'field of view' };
export const inputRole = (path: string): string => INPUT_KINDS[/_([a-z]+)\d+\.fits(?:\.gz)?$/u.exec(path)?.[1] ?? ''] ?? path;

/** What chandra_repro is told, and what else bounded the run. Only the chandra_repro entries reach it; the memory ceiling is
 * recorded beside them because a run that passes it is stopped rather than finished. */
export function reprocessParameters(grating: string, maxRssBytes: number) {
  // A grating observation needs the zero-order position. The default takes it from the archive's own level-2 product, which would
  // make the re-run depend on what it is being compared against; 'detect' finds it in the re-run's own data instead.
  const dispersed = !['NONE', ''].includes(grating.trim().toUpperCase());
  const chandraRepro: Readonly<Record<string, string | number>> = { clobber: 'yes', cleanup: 'no', set_ardlib: 'no', check_vf_pha: 'no',
    verbose: 1, ...(dispersed ? { tg_zo_position: 'detect' } : {}) };
  return { chandraRepro, parameters: { ...chandraRepro, maxRssBytes } };
}

/** What identifies one reprocessing run: the observation's pinned level-1 files, what chandra_repro was told, and the CIAO and
 * CALDB that ran it. The record written from this is the only place a later reader takes that environment from. */
export function reprocessRun(entry: ChandraObservation, options: { parameters: Readonly<Record<string, unknown>>; versions: { ciao: string; caldb: string }; toolchainDigest: string }): ProductRun {
  const inputs = entry.inputs.map(file => {
    return { role: inputRole(file.path), identity: file.url, bytes: file.bytes };
  });
  return { telescope: 'Chandra', stage: `reprocess/${entry.obsid}-${entry.instrument}`, inputs, parameters: options.parameters,
    software: [{ name: 'ciao', version: options.versions.ciao }, { name: 'caldb', version: options.versions.caldb }],
    toolchainDigest: options.toolchainDigest };
}

/** What the level-2 event list is, in the terms its own header states. It carries no one unit: it is a table of events. */
const EVENT_LIST_CONVENTIONS: Readonly<Record<string, string>> = {
  rows: 'one row per event standard data processing kept',
  time: 'mission elapsed seconds, the scale the header TSTART and TSTOP are on',
  columns: 'each column on the grid and in the units its own header cards give (TCTYP, TCRVL, TCDLT, TUNIT)',
};

/** The record of a reprocessing run, beside the level-2 event list it made: every product the run wrote, pinned as it is on disk
 * now, and no evidence. What a later check establishes is added to this record by that check (compare.mts), not claimed here. */
export async function writeReprocessRecord(directory: string, level2: string, products: readonly string[], run: ProductRun): Promise<string> {
  const path = productRecordPath(resolve(directory, level2));
  await writeProductRecord(path, run, products.map(name => ({ path: name, file: resolve(directory, name), ...(name === level2 ? { conventions: EVENT_LIST_CONVENTIONS } : {}) })));
  return path;
}

/** The digest of the pins the installed environment was built from. `chandraToolchain` has already refused an environment built
 * from any other, so this is the descriptor and lock the run's software came from. */
export const chandraToolchainDigest = async (): Promise<string> => requireString(requireRecord(JSON.parse(await readFile(resolve(CHANDRA_ROOT, 'installed.json'), 'utf8')) as unknown, 'installed.json').pinsSha256, 'pinsSha256');

export interface ReprocessResult {
  readonly run: string; readonly obsid: number; readonly instrument: string; readonly dataMode: string;
  readonly level2: string; readonly products: readonly string[];
  /** Where the run's own account of itself was written, and whether this invocation found it already made. */
  readonly record: string; readonly reused: boolean;
  /** What the run took, or null when its record and every product it names were already on disk. */
  readonly seconds: number | null; readonly peakRssBytes: number | null;
  readonly ciao: string; readonly caldb: string;
}

export async function runReprocess(id: string, obsid: number, work: string, options: { sources?: readonly string[]; maxRssBytes?: number } = {}): Promise<ReprocessResult> {
  const archive = resolve(work, 'archive');
  const { entry } = await chandraFiles(id, obsid, archive, options.sources, 'inputs');
  const ceiling = options.maxRssBytes ?? 2 * 2 ** 30;
  const toolchain = await chandraToolchain(), versions = await chandraVersions();
  const { chandraRepro, parameters } = reprocessParameters(entry.grating, ceiling);
  const identity = reprocessRun(entry, { parameters, versions, toolchainDigest: await chandraToolchainDigest() });
  const input = resolve(work, 'run'), run = resolve(work, 'repro');
  // A re-run is skipped only when the record beside the level-2 event list says this same run wrote it and every product it names
  // is still the file it wrote. Other pins, other parameters, another CIAO or CALDB, a changed output: the run happens again.
  const made = (await readdir(run).catch(() => [] as string[])).filter(name => /_evt2\.fits$/u.test(name));
  const kept = made.length === 1 ? made[0]! : null;
  const keptRecord = kept ? await readProductRecord(productRecordPath(resolve(run, kept))) : null;
  if (kept && keptRecord && await sameRun(keptRecord, identity, name => resolve(run, name)))
    return { run, obsid, instrument: entry.instrument, dataMode: entry.dataMode, level2: kept, products: keptRecord.outputs.map(output => output.path),
      record: productRecordPath(resolve(run, kept)), reused: true, seconds: null, peakRssBytes: null, ciao: versions.ciao, caldb: versions.caldb };
  // The run needs its ceiling free twice over, so it does not start by taking the machine's last free half.
  const free = freeMemoryPercent() / 100 * totalmem();
  if (!(free >= 2 * ceiling)) throw new Error(`Only ${(free / 2 ** 30).toFixed(1)} GiB of memory is free; the reprocessing needs twice its ${(ceiling / 2 ** 30).toFixed(1)} GiB ceiling.`);
  for (const directory of ['param', 'work', 'ipython']) await mkdir(resolve(CHANDRA_ROOT, directory), { recursive: true });
  // chandra_repro expands a gzipped input beside itself, so it is given copies and the pinned downloads stay untouched. A stale
  // copy from an earlier run is removed first: a run stopped part way leaves a half-expanded file that the next one would read.
  await rm(input, { recursive: true, force: true });
  await rm(run, { recursive: true, force: true });
  await cp(archive, input, { recursive: true, dereference: true });
  await mkdir(run, { recursive: true });
  const result = await toolchainPython(toolchain, work, REPROCESS, [input, run, String(ceiling), JSON.stringify(chandraRepro)], resolve(work, `${obsid}.log`), { maxRssBytes: ceiling });
  const reported = requireRecord(JSON.parse(result.lastLine), 'reprocess result');
  const written = (await readdir(run)).filter(name => /\.fits(?:\.gz)?$/u.test(name)).sort();
  const level2 = written.find(name => /_evt2\.fits$/u.test(name));
  if (!level2) throw new Error(`${obsid}: chandra_repro wrote no level-2 event list; see ${resolve(work, `${obsid}.log`)}.`);
  return { run, obsid, instrument: entry.instrument, dataMode: entry.dataMode, level2, products: written,
    record: await writeReprocessRecord(run, level2, written, identity), reused: false,
    seconds: requireFiniteNumber(reported.seconds, 'seconds'),
    peakRssBytes: Math.max(requireFiniteNumber(reported.peakRssBytes, 'peak RSS'), result.peakRssBytes),
    ciao: versions.ciao, caldb: versions.caldb };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id, obsid, work] = args;
  if (!id || !obsid || !/^\d+$/u.test(obsid) || !work) throw new TypeError('Usage: reprocess <program id> <obsid> <work> [--raw <dir>]... [--max-rss-gib <n>]');
  const option = (name: string) => args.flatMap((arg, index) => arg === name ? [args[index + 1]!] : []);
  const ceiling = option('--max-rss-gib')[0];
  const result = await runReprocess(id, Number(obsid), resolve(work), { sources: option('--raw').map(directory => resolve(directory)), ...(ceiling ? { maxRssBytes: Number(ceiling) * 2 ** 30 } : {}) });
  console.log(`REPROCESS ${JSON.stringify({ ...result, ...(result.peakRssBytes === null ? {} : { peakRssGiB: +(result.peakRssBytes / 2 ** 30).toFixed(2) }) })}`);
}
