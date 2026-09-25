#!/usr/bin/env node
/** Re-run an HST instrument's own pipeline from the raw exposure of a pinned observation.
 *
 *   node tools/objects/hst/calibrate.mts <program id> <observation> <work directory> [--raw <dir>]... [--max-rss-gib <n>]
 *
 * The pinned inputs are taken from a --raw directory that already holds them or downloaded from MAST, each at its pinned size
 * and digest; a digest missing from the program is measured and written back. They are copied into <work>/run, because the
 * next step rewrites their headers and the pipeline writes its products beside them.
 *
 * CRDS then selects the reference files for that exposure at the program's pinned context and downloads the ones the cache
 * does not hold, into output/toolchains/hst/crds. `crds bestrefs` writes their names into the raw header, exactly as the
 * archive's own run had them, and the instrument's reference-path variable (oref, iref, jref) points at the cache.
 *
 * The pipeline is then STScI's own executable through STScI's own wrapper: calstis (cs0.e) through stistools for STIS,
 * calwf3.e through wfc3tools for WFC3, calacs.e through acstools for ACS.
 *
 * What it is given is the association table when the archive stores a raw file for each exposure, and the one raw file
 * otherwise. That is the distinction the combining stages need, and it follows from what is pinned rather than from the
 * instrument. ACS keeps each repeated SBC exposure in its own raw file, so calacs is given the table and adds them into `_sfl`.
 * STIS keeps a CR-SPLIT pair as imsets of the association's own raw file, so calstis is given that file and rejects cosmic rays
 * across the imsets into `_crj`, then rectifies and extracts from it. Given an association table whose members it cannot find
 * as files, calstis stops at "Required keyword missing".
 *
 * Memory: the pipeline is a separate executable, so the ceiling is applied to the whole process group, not to Python alone.
 * The group is sampled every second and the pipeline is stopped if it passes the ceiling (2 GiB by default).
 *
 * Beside every product it writes, the run writes its own record (`<product>.product.json`, packages/telescope/src/product-record.ts):
 * the observation's pinned inputs at their sizes and digests, the CRDS context and the reference files that chose the
 * calibration, the pipeline and CRDS versions the run reported and the digest of the toolchain pins they were installed from.
 * Its evidence list is empty. What a product was checked against is added by the stage that checked it: compare.mts adds the
 * agreement with the archive's own product. */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { totalmem } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256File } from '@cssearth/core/node';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { mastFile, type MastFile } from '@cssearth/telescope/node';
import { freeMemoryPercent, toolchainPython } from '../jwst/mast.mts';
import { productRecordPath, type ProductRun, type ProductSoftware } from '@cssearth/telescope';
import { writeProductRecord } from '@cssearth/telescope/node';
import { parseHstProgram, PROGRAMS, suffixOf, type HstObservation, type HstProgram } from './archive.mts';
import { readHstFileHdus } from './product-file.mts';
import { HST_ROOT, hstToolchain } from './toolchain.mts';

/** Which wrapper runs which detector's pipeline, and where that instrument's calibration files are looked up. */
export const PIPELINES: Readonly<Record<string, { readonly pipeline: string; readonly referenceVariable: string }>> = {
  STIS: { pipeline: 'calstis', referenceVariable: 'oref' },
  WFC3: { pipeline: 'calwf3', referenceVariable: 'iref' },
  ACS: { pipeline: 'calacs', referenceVariable: 'jref' },
};

/** Python that keeps this process and everything it starts under `ceiling` bytes of resident memory, sampling every second and
 * killing the children that pass it. A pipeline is a separate executable, so a ceiling on Python alone would not hold it. */
export const MEMORY_GUARD = `
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
`;

/** Python that asks CRDS for the reference files `files` need at `context`, downloads the ones the cache lacks, and links every
 * one their headers name into a directory named for the instrument's own variable, which it then sets. A program looks its
 * references up as `oref$name`, and the CRDS cache's own layout is CRDS's to change. */
export const REFERENCE_FILES = `
import crds, crds.data_file
crds.assign_bestrefs(files, context=context, sync_references=True)
references, links = {}, set()
for path in files:
    for key, value in crds.data_file.get_header(path).items():
        if isinstance(value, str) and value.lower().startswith(variable + '$'):
            references.setdefault(os.path.basename(path), {})[key] = value
            links.add(value.split('$', 1)[1])
directory = os.path.abspath(variable)
os.makedirs(directory, exist_ok=True)
for name in links:
    if not os.path.exists(os.path.join(directory, name)): os.symlink(crds.locate_file(name, 'hst'), os.path.join(directory, name))
os.environ[variable] = directory + '/'
`;

const CALIBRATE = `
import json, os, subprocess, sys, threading, time
import importlib.metadata as metadata
given, wavecal, instrument, variable, context, ceiling, raws, executable = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], int(sys.argv[6]), json.loads(sys.argv[7]), sys.argv[8]
files = raws + ([wavecal] if wavecal else [])
${MEMORY_GUARD}
${REFERENCE_FILES}
start = time.time()
if instrument == 'STIS':
    import stistools
    wrapper = 'stistools'
    status = stistools.calstis.calstis(given, wavecal=wavecal, verbose=True, timestamps=True)
elif instrument == 'WFC3':
    import wfc3tools
    wrapper = 'wfc3tools'
    status = wfc3tools.calwf3(given, verbose=True) or 0
elif instrument == 'ACS':
    import acstools
    wrapper = 'acstools'
    status = acstools.calacs.calacs(given, verbose=True) or 0
else:
    raise SystemExit(instrument + ' has no pipeline here.')
stop.set()
if stopped: raise SystemExit('The pipeline passed its memory ceiling at %d bytes and was stopped.' % stopped[0])
if status: raise SystemExit('%s returned %s.' % (instrument, status))
# What ran, for the product's own record: the wrapper and CRDS as installed, and the pipeline executable's own version.
software = [{'name': wrapper, 'version': metadata.version(wrapper)}, {'name': 'crds', 'version': metadata.version('crds')},
            {'name': os.path.basename(executable), 'version': subprocess.run([executable, '--version'], capture_output=True, text=True).stdout.strip()}]
print(json.dumps({'seconds': round(time.time() - start, 1), 'peakRssBytes': peak, 'references': references, 'software': software}))
`;

export async function readHstProgram(id: string) {
  const path = resolve(PROGRAMS, `${id}.json`);
  return { path, program: parseHstProgram(JSON.parse(await readFile(path, 'utf8'))) };
}

/** A pinned file as a product record states an input: named by the MAST product it is, at the size and digest the run read. */
export type PinnedFile = MastFile & { readonly sha256: string };

/** An observation's pinned files on disk at their pinned sizes and digests; digests missing from the program are measured and
 * written back. */
export async function hstFiles(id: string, observation: string, directory: string, sources: readonly string[] = []) {
  const { path, program } = await readHstProgram(id), entry = program.observations.find(other => other.observation === observation);
  if (!entry) throw new Error(`${id} has no observation ${observation}.`);
  const fetchAll = async (pinned: readonly MastFile[]) => {
    const files: string[] = [], digested: PinnedFile[] = [];
    for (const member of pinned) {
      const local = await mastFile(member, directory, sources);
      files.push(local);
      digested.push({ ...member, sha256: member.sha256 ?? (await sha256File(local)).sha256 });
    }
    return { files, digested, changed: digested.some((member, i) => member.sha256 !== pinned[i]!.sha256) };
  };
  const inputs = await fetchAll(entry.inputs);
  if (inputs.changed) {
    const updated: HstProgram = { ...program, observations: program.observations.map(other => other.observation === observation ? { ...other, inputs: inputs.digested } : other) };
    await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`);
  }
  return { program, entry, files: inputs.files, inputs: inputs.digested };
}

/** The digest of the pins the installed HST environment was built from. `hstToolchain` has already refused an environment
 * built from any other, so the marker it checked is what the run's software came from. */
export async function hstToolchainDigest(): Promise<string> {
  const marker = requireRecord(JSON.parse(await readFile(resolve(HST_ROOT, 'installed.json'), 'utf8')) as unknown, 'the HST toolchain marker');
  return requireString(marker.pinsSha256, 'the HST toolchain pins digest');
}

/** The versions a run reported of what it ran, as a record states software. */
export const hstSoftware = (value: unknown): ProductSoftware[] => requireArray(value, 'software').map(entry => {
  const row = requireRecord(entry, 'software entry');
  return { name: requireString(row.name, 'software name'), version: requireString(row.version, 'software version') };
});

/** What a written product states about its own samples, for its record: the units its extensions carry and where they sit.
 * Only header blocks are read. */
export async function productUnits(file: string) {
  const hdus = await readHstFileHdus(file);
  const units = [...new Set(hdus.flatMap(hdu => typeof hdu.header.BUNIT === 'string' ? [hdu.header.BUNIT.trim()] : []).filter(Boolean))];
  const extensions = hdus.slice(1).map(hdu => `${String(hdu.header.EXTNAME ?? 'EXT')},${String(hdu.header.EXTVER ?? 1)}`);
  return { ...(units.length ? { units: units.join(', ') } : {}),
    conventions: { grid: 'the detector samples the pipeline wrote, as the product\'s own header states them', extensions: extensions.join(' ') } };
}

/** What identifies one calibration: the observation's pinned files, the settings that chose its reference files, and the
 * software that ran. The same files calibrated at the same context by the same installed pipeline are the same run. */
export function calibrationRun(program: HstProgram, entry: HstObservation, inputs: readonly PinnedFile[],
  settings: { readonly given: string; readonly wavecal: string; readonly references: Readonly<Record<string, Record<string, string>>> },
  software: readonly ProductSoftware[], toolchainDigest: string): ProductRun {
  return {
    telescope: 'HST', stage: 'calibrate',
    inputs: inputs.map(input => ({ role: suffixOf(input.name).toLowerCase(), identity: input.uri, bytes: input.bytes, sha256: input.sha256 })),
    parameters: { instrument: entry.instrument, detector: entry.detector, opticalElement: entry.opticalElement, aperture: entry.aperture,
      pipeline: PIPELINES[entry.instrument]?.pipeline ?? entry.instrument, given: settings.given, ...(settings.wavecal ? { wavecal: settings.wavecal } : {}),
      crdsContext: program.crdsContext, calibrationSwitches: entry.calibrationSwitches, references: settings.references },
    software, toolchainDigest,
  };
}

export async function runCalibration(id: string, observation: string, work: string, options: { sources?: readonly string[]; maxRssBytes?: number } = {}) {
  const { program, entry, inputs } = await hstFiles(id, observation, resolve(work, 'inputs'), options.sources);
  const pipeline = PIPELINES[entry.instrument];
  if (!pipeline) throw new Error(`${entry.instrument} has no pipeline here: ${Object.keys(PIPELINES).join(', ')}.`);
  // The run needs its ceiling free twice over, so it does not start by taking the machine's last free half.
  const ceiling = options.maxRssBytes ?? 2 * 2 ** 30, free = freeMemoryPercent() / 100 * totalmem();
  if (!(free >= 2 * ceiling)) throw new Error(`Only ${(free / 2 ** 30).toFixed(1)} GiB of memory is free; the calibration needs twice its ${(ceiling / 2 ** 30).toFixed(1)} GiB ceiling.`);
  // The pipeline rewrites headers and writes beside its input, so it runs on copies and the pinned downloads stay as MAST sent
  // them. The directory is emptied first: a pipeline refuses to overwrite a product an earlier run left there (calacs stops
  // with "Output file already exists"), so a re-run into the same work directory would fail on its own leavings.
  const run = resolve(work, 'run');
  await rm(run, { recursive: true, force: true });
  await mkdir(run, { recursive: true });
  // The association's own product rootname belongs to what the run makes, not to what it reads: calacs writes the product's
  // support file itself and stops if one is already there. Only the observation's and its members' files are copied in.
  const inputRootnames = new Set([observation, ...entry.association?.members.map(member => member.rootname) ?? []]);
  const copied = entry.inputs.filter(input => inputRootnames.has(input.name.slice(0, input.name.lastIndexOf('_'))));
  for (const input of copied) await cp(resolve(work, 'inputs', input.name), resolve(run, input.name), { dereference: true, force: true });
  const raws = entry.inputs.filter(input => suffixOf(input.name) === 'RAW');
  const asn = entry.inputs.find(input => suffixOf(input.name) === 'ASN');
  const given = asn && raws.length > 1 ? asn.name : raws[0]!.name;
  const wavecal = entry.inputs.find(input => suffixOf(input.name) === 'WAV')?.name ?? '';
  const toolchain = await hstToolchain(program.crdsContext);
  const result = await toolchainPython(toolchain, run, CALIBRATE, [given, wavecal, entry.instrument, pipeline.referenceVariable, program.crdsContext, String(ceiling),
    JSON.stringify(raws.map(raw => raw.name)), toolchain.binaries[pipeline.pipeline]!], resolve(work, `${observation}.log`), { maxRssBytes: ceiling });
  const reported = requireRecord(JSON.parse(result.lastLine), 'calibration result');
  const rootnames = new Set([observation, ...entry.association ? [entry.association.product, ...entry.association.members.map(member => member.rootname)] : []]);
  const written = (await readdir(run)).filter(name => name.endsWith('.fits') && rootnames.has(name.slice(0, name.lastIndexOf('_'))) &&
    !copied.some(input => input.name === name)).sort();
  const references = requireRecord(reported.references, 'references') as Record<string, Record<string, string>>;
  // The record of this run, beside each product it made, with nothing checked yet: compare.mts adds what it establishes.
  const made = calibrationRun(program, entry, inputs, { given, wavecal, references }, hstSoftware(reported.software), await hstToolchainDigest());
  for (const name of written) await writeProductRecord(productRecordPath(resolve(run, name)), made, [{ path: name, file: resolve(run, name), ...await productUnits(resolve(run, name)) }]);
  return { run, pipeline: pipeline.pipeline, given, products: written, records: written.map(name => productRecordPath(name)),
    seconds: requireFiniteNumber(reported.seconds, 'seconds'),
    peakRssBytes: Math.max(requireFiniteNumber(reported.peakRssBytes, 'peak RSS'), result.peakRssBytes), references };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id, observation, work] = args;
  if (!id || !observation || !work) throw new TypeError('Usage: calibrate <program id> <observation> <work> [--raw <dir>]... [--max-rss-gib <n>]');
  const option = (name: string) => args.flatMap((arg, i) => arg === name ? [args[i + 1]!] : []);
  const ceiling = option('--max-rss-gib')[0];
  const result = await runCalibration(id, observation, resolve(work), { sources: option('--raw').map(dir => resolve(dir)), ...(ceiling ? { maxRssBytes: Number(ceiling) * 2 ** 30 } : {}) });
  console.log(`CALIBRATE ${JSON.stringify({ ...result, peakRssGiB: +(result.peakRssBytes / 2 ** 30).toFixed(2), references: new Set(Object.values(result.references).flatMap(entry => Object.values(entry))).size })}`);
}
