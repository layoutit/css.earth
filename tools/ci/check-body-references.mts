#!/usr/bin/env node
/** Keep every body rebuildable from its sources, and keep papers and shared reference copies out of it.
 *
 * A body is prepared again from what its source manifest declares: a fresh checkout restores each missing file with
 * the acquisition step for that exact path (tools/objects/operations-acquisition.ts `restoreMissingSources`), or the
 * source mirror's copy of a generated intermediate. This check fails a change that would leave a body unrestorable:
 *
 * - a declared file that is not committed, has no acquisition step for its path and is not a generated intermediate;
 * - an acquisition step for a path the manifest does not declare;
 * - a pinned paper, catalogue ReadMe or bundle description (cite it by URL: docs/provenance/CONTRACT.md,
 *   "References and retained files"), or a byte copy of a file that `src/references` or `src/spice` holds.
 *
 *   node tools/ci/check-body-references.mts
 */
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Documents a body cites instead of keeping. */
export const CITED_DOCUMENT = /(?:\.pdf|(?:^|\/)ReadMe\.AcuA\.txt|(?:^|\/)bundle_description\.txt)$/iu;

/** Files that match a cited-document name but are data, each with the reason it stays. Keys are `<object>/<path in source>`. */
export const DATA_DOCUMENTS: Readonly<Record<string, string>> = Object.freeze({
  'local-group/mcconnachie/table1_OCT2019.pdf': "McConnachie's October 2019 Table 1 is the author's data table the Local Group catalogue is built from.",
});

/** Body copies of bank kernels that a body's own recipe still reads, each with the reason. New copies fail. */
export const CONSUMED_KERNEL_COPIES: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries([
  ...['spice/fk/didymos_system_007.tf', 'spice/lsk/naif0012.tls', 'spice/pck/didymos_system_15.tpc', 'spice/pck/pck00010.tpc']
    .map(path => [`dimorphos/${path}`, "An input of Dimorphos's DRACO SPICE step, which loads the body's own kernels."]),
  ...['donaldjohanson', 'lutetia', 'steins'].map(id => [`${id}/reference/naif0012.tls`, "Listed in the body's camera recipe, which loads body-local kernels."]),
  ...['naif0012.tls', 'vg200051.tsc', 'vg2_v02.tf'].map(name => [`proteus/geometry/${name}`, "Read by Proteus's Voyager colour registration script."]),
  ['proteus/shape/pck00011.tpc', "Read by Proteus's Voyager colour registration script, which requires its kernels in the package manifest."],
]));

export interface Finding { readonly file: string; readonly problem: string }

const LISTS = ['inputs', 'documents', 'generatedIntermediates'] as const;
type Json = Record<string, unknown>;
const record = (value: unknown): Json => (value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Json : {});
const entries = (manifest: unknown, list: typeof LISTS[number]) => (Array.isArray(record(manifest)[list]) ? record(manifest)[list] as unknown[] : []).map(record);
const text = (value: unknown) => (typeof value === 'string' ? value : undefined);

/** One body's findings, from its manifest and acquisition plan as parsed JSON and the paths committed in its source folder. */
export function bodySourceFindings(objectId: string, manifest: unknown, acquisition: unknown, committed: ReadonlySet<string>): Finding[] {
  const findings: Finding[] = [], manifestFile = `src/objects/${objectId}/source/manifest.json`;
  const acquisitionFile = `src/objects/${objectId}/source/preparation/acquisition.json`;
  const relative = (path: string) => path.replace(new RegExp(`^src/objects/${objectId}/source/`, 'u'), '');
  const allowedDocument = (path: string) => Object.hasOwn(DATA_DOCUMENTS, `${objectId}/${relative(path)}`);
  const operations = (Array.isArray(record(acquisition).operations) ? record(acquisition).operations as unknown[] : []).map(record);
  const restored = new Set(operations.map(operation => text(operation.path)).filter((path): path is string => path !== undefined));
  const declared = new Set<string>();
  for (const list of LISTS) for (const entry of entries(manifest, list)) {
    const path = text(entry.path);
    if (!path) continue;
    declared.add(path);
    if (CITED_DOCUMENT.test(path) && !allowedDocument(path))
      findings.push({ file: manifestFile, problem: `${list} pins ${path}; cite it by URL in the source record instead.` });
    else if (list !== 'generatedIntermediates' && !committed.has(relative(path)) && !restored.has(path))
      findings.push({ file: manifestFile, problem: `${list} declares ${path}, which is not committed and has no acquisition step; a fresh checkout cannot restore it.` });
  }
  for (const operation of operations) {
    const path = text(operation.path);
    if (!path) continue;
    if (CITED_DOCUMENT.test(path) && !allowedDocument(path))
      findings.push({ file: acquisitionFile, problem: `downloads ${path}; a cited document is not restored into a body.` });
    else if (!declared.has(path))
      findings.push({ file: acquisitionFile, problem: `restores ${path}, which the manifest does not declare.` });
  }
  return findings;
}

/** Body files byte-identical to a file of a shared bank, from `git ls-files -s` lines (`<mode> <blob> <stage>\t<path>`). */
export function sharedCopyFindings(stagedLines: readonly string[]): Finding[] {
  const blobs = new Map<string, string>(), bodies: [string, string][] = [];
  for (const line of stagedLines) {
    const match = line.match(/^\d+ ([0-9a-f]+) \d+\t(.+)$/u);
    if (!match) continue;
    const [, blob, path] = match as unknown as [string, string, string];
    if (/^src\/(?:references|spice)\//u.test(path) && !path.endsWith('/manifest.json')) blobs.set(blob, path);
    else if (path.startsWith('src/objects/')) bodies.push([blob, path]);
  }
  return bodies.filter(([blob, path]) => blobs.has(blob) && !Object.hasOwn(CONSUMED_KERNEL_COPIES, path.replace(/^src\/objects\/([^/]+)\/source\//u, '$1/')))
    .map(([blob, path]) => ({ file: path, problem: `is a copy of ${blobs.get(blob)}; read the shared bank instead.` }));
}

async function git(root: string, args: string[]) {
  return (await run('git', args, { cwd: root, maxBuffer: 512 * 1024 * 1024 })).stdout;
}

export async function checkBodyReferences(root = process.cwd()): Promise<Finding[]> {
  const lines = (await git(root, ['ls-files', '-s', '--', 'src/objects', 'src/references', 'src/spice'])).split('\n').filter(Boolean);
  const paths = lines.map(line => line.slice(line.indexOf('\t') + 1));
  const findings = sharedCopyFindings(lines);
  const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(resolve(root, path), 'utf8'));
  const committed = new Map<string, Set<string>>();
  for (const path of paths) {
    const match = path.match(/^src\/objects\/([^/]+)\/source\/(.+)$/u);
    if (!match) continue;
    (committed.get(match[1]!) ?? committed.set(match[1]!, new Set()).get(match[1]!)!).add(match[2]!);
    if (CITED_DOCUMENT.test(path) && !Object.hasOwn(DATA_DOCUMENTS, `${match[1]}/${match[2]}`))
      findings.push({ file: path, problem: 'is a committed paper or archive document; cite it by URL instead.' });
  }
  for (const [objectId, files] of committed) {
    if (!files.has('manifest.json')) continue;
    const manifest = await json(`src/objects/${objectId}/source/manifest.json`);
    // A volume package restores through its own repository-relative manifest (tools/assets/restore-source-inputs.mts).
    if (record(manifest).schema !== 'cssearth-authoritative-sources@2') continue;
    const acquisition = files.has('preparation/acquisition.json') ? await json(`src/objects/${objectId}/source/preparation/acquisition.json`) : null;
    findings.push(...bodySourceFindings(objectId, manifest, acquisition, files));
  }
  return findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const findings = await checkBodyReferences();
  for (const finding of findings) console.error(`${finding.file}: ${finding.problem}`);
  if (findings.length) {
    console.error(`\n${findings.length} finding${findings.length === 1 ? '' : 's'}: a body must stay restorable from its declared sources, cite papers by URL, and read shared tables from src/references or src/spice.`);
    process.exitCode = 1;
  } else console.log('Every body is restorable from its declared sources; no pinned papers or shared-reference copies.');
}
