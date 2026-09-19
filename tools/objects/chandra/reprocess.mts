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
 * Memory: chandra_repro spawns the CIAO tools as separate executables, so the ceiling is applied to the whole process group, not
 * to Python alone. The group is sampled every second and the run is stopped if it passes the ceiling (2 GiB by default). */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { totalmem } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256File } from '../../../src/platform/sha256.mts';
import { requireFiniteNumber, requireRecord } from '../../source-values.mts';
import { freeMemoryPercent, toolchainPython } from '../jwst/mast.mts';
import { chandraFile, parseChandraProgram, PROGRAMS, type ChandraFile, type ChandraProgram } from './archive.mts';
import { chandraToolchain, chandraVersions, CHANDRA_ROOT } from './toolchain.mts';

const REPROCESS = `
import json, os, subprocess, sys, threading, time
indir, outdir, ceiling, grating = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]

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
# A grating observation needs the zero-order position. The default takes it from the archive's own level-2 product, which would
# make the re-run depend on what it is being compared against; 'detect' finds it in the re-run's own data instead.
extra = {'tg_zo_position': 'detect'} if grating not in ('NONE', '') else {}
chandra_repro(indir=indir, outdir=outdir, clobber='yes', cleanup='no', set_ardlib='no', check_vf_pha='no', verbose=1, **extra)
stop.set()
if stopped: raise SystemExit('chandra_repro passed its memory ceiling at %d bytes and was stopped.' % stopped[0])
print(json.dumps({'seconds': round(time.time() - start, 1), 'peakRssBytes': peak, 'caldbPath': os.environ.get('CALDB', '')}))
`;

export async function readChandraProgram(id: string) {
  const path = resolve(PROGRAMS, `${id}.json`);
  return { path, program: parseChandraProgram(JSON.parse(await readFile(path, 'utf8'))) };
}

/** An observation's pinned files on disk at their pinned sizes and digests, laid out under the archive's own paths; digests
 * missing from the program are measured and written back. */
export async function chandraFiles(id: string, obsid: number, directory: string, sources: readonly string[] = [], kinds: 'inputs' | 'products' | 'all' = 'all') {
  const { path, program } = await readChandraProgram(id), entry = program.observations.find(other => other.obsid === obsid);
  if (!entry) throw new Error(`${id} has no observation ${obsid}.`);
  const fetchAll = async (pinned: readonly ChandraFile[]) => {
    const files: string[] = [], digested: ChandraFile[] = [];
    for (const member of pinned) {
      files.push(await chandraFile(member, directory, sources));
      digested.push(member.sha256 === undefined ? { ...member, sha256: (await sha256File(resolve(directory, member.path))).sha256 } : member);
    }
    return { files, digested, changed: digested.some((member, index) => member.sha256 !== pinned[index]!.sha256) };
  };
  const inputs = kinds === 'products' ? { files: [], digested: [...entry.inputs], changed: false } : await fetchAll(entry.inputs);
  const products = kinds === 'inputs' ? { files: [], digested: [...entry.products], changed: false } : await fetchAll(entry.products);
  if (inputs.changed || products.changed) {
    const updated: ChandraProgram = { ...program, observations: program.observations.map(other =>
      other.obsid === obsid ? { ...other, inputs: inputs.digested, products: products.digested } : other) };
    await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`);
  }
  return { program, entry, inputs: inputs.files, products: products.files };
}

export async function runReprocess(id: string, obsid: number, work: string, options: { sources?: readonly string[]; maxRssBytes?: number } = {}) {
  const archive = resolve(work, 'archive');
  const { entry } = await chandraFiles(id, obsid, archive, options.sources, 'inputs');
  // The run needs its ceiling free twice over, so it does not start by taking the machine's last free half.
  const ceiling = options.maxRssBytes ?? 2 * 2 ** 30, free = freeMemoryPercent() / 100 * totalmem();
  if (!(free >= 2 * ceiling)) throw new Error(`Only ${(free / 2 ** 30).toFixed(1)} GiB of memory is free; the reprocessing needs twice its ${(ceiling / 2 ** 30).toFixed(1)} GiB ceiling.`);
  const toolchain = await chandraToolchain(), versions = await chandraVersions();
  for (const directory of ['param', 'work', 'ipython']) await mkdir(resolve(CHANDRA_ROOT, directory), { recursive: true });
  // chandra_repro expands a gzipped input beside itself, so it is given copies and the pinned downloads stay untouched. A stale
  // copy from an earlier run is removed first: a run stopped part way leaves a half-expanded file that the next one would read.
  const input = resolve(work, 'run'), run = resolve(work, 'repro');
  await rm(input, { recursive: true, force: true });
  await rm(run, { recursive: true, force: true });
  await cp(archive, input, { recursive: true, dereference: true });
  await mkdir(run, { recursive: true });
  const result = await toolchainPython(toolchain, work, REPROCESS, [input, run, String(ceiling), entry.grating.trim().toUpperCase()], resolve(work, `${obsid}.log`), { maxRssBytes: ceiling });
  const reported = requireRecord(JSON.parse(result.lastLine), 'reprocess result');
  const written = (await readdir(run)).filter(name => /\.fits(?:\.gz)?$/u.test(name)).sort();
  const level2 = written.find(name => /_evt2\.fits$/u.test(name));
  if (!level2) throw new Error(`${obsid}: chandra_repro wrote no level-2 event list; see ${resolve(work, `${obsid}.log`)}.`);
  return { run, obsid, instrument: entry.instrument, dataMode: entry.dataMode, level2, products: written,
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
  console.log(`REPROCESS ${JSON.stringify({ ...result, peakRssGiB: +(result.peakRssBytes / 2 ** 30).toFixed(2) })}`);
}
