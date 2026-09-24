#!/usr/bin/env node
/** Keep papers and shared reference files out of body packages.
 *
 * A body cites a paper, catalogue ReadMe or archive bundle description by URL in its source record; it does not pin
 * the document as a manifest entry or download it (docs/provenance/CONTRACT.md, "References and retained files").
 * A standard table every body reads lives once in `src/references/<set>/` or a SPICE bank in `src/spice/<set>/`,
 * never as a copy inside a body. Two cleanups removed hundreds of such copies; this check keeps them from returning.
 *
 *   node tools/ci/check-body-references.mts
 */
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

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
]));

export interface Finding { readonly file: string; readonly problem: string }

const MANIFEST_LISTS = ['inputs', 'documents', 'generatedIntermediates'] as const;

/** Findings in one body's manifest and acquisition plan, given as parsed JSON. */
export function bodySourceFindings(objectId: string, manifest: unknown, acquisition: unknown): Finding[] {
  const findings: Finding[] = [];
  const allowed = (path: string) => Object.hasOwn(DATA_DOCUMENTS, `${objectId}/${path.replace(new RegExp(`^src/objects/${objectId}/source/`, 'u'), '')}`);
  const record = (value: unknown) => (value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
  for (const list of MANIFEST_LISTS) {
    const entries = record(manifest)[list];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const path = record(entry).path;
      if (typeof path === 'string' && CITED_DOCUMENT.test(path) && !allowed(path))
        findings.push({ file: `src/objects/${objectId}/source/manifest.json`, problem: `${list} pins ${path}; cite it by URL in the source record instead.` });
    }
  }
  const operations = record(acquisition).operations;
  for (const operation of Array.isArray(operations) ? operations : []) {
    const path = record(operation).path;
    if (typeof path === 'string' && CITED_DOCUMENT.test(path) && !allowed(path))
      findings.push({ file: `src/objects/${objectId}/source/preparation/acquisition.json`, problem: `downloads ${path}; a cited document is not restored into a body.` });
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

export async function checkBodyReferences(root = process.cwd()): Promise<Finding[]> {
  const run = promisify(execFile);
  const { stdout } = await run('git', ['ls-files', '-s', '--', 'src/objects', 'src/references', 'src/spice'], { cwd: root, maxBuffer: 256 * 1024 * 1024 });
  const lines = stdout.split('\n').filter(Boolean);
  const findings = sharedCopyFindings(lines);
  const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(resolve(root, path), 'utf8'));
  for (const line of lines) {
    const path = line.slice(line.indexOf('\t') + 1), match = path.match(/^src\/objects\/([^/]+)\/source\/manifest\.json$/u);
    if (!match) continue;
    const objectId = match[1]!, acquisitionPath = `src/objects/${objectId}/source/preparation/acquisition.json`;
    const acquisition = lines.some(entry => entry.endsWith(`\t${acquisitionPath}`)) ? await json(acquisitionPath) : null;
    findings.push(...bodySourceFindings(objectId, await json(path), acquisition));
  }
  for (const line of lines) {
    const path = line.slice(line.indexOf('\t') + 1), match = path.match(/^src\/objects\/([^/]+)\/source\/(.+)$/u);
    if (match && CITED_DOCUMENT.test(path) && !Object.hasOwn(DATA_DOCUMENTS, `${match[1]}/${match[2]}`))
      findings.push({ file: path, problem: 'is a committed paper or archive document; cite it by URL instead.' });
  }
  return findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const findings = await checkBodyReferences();
  for (const finding of findings) console.error(`${finding.file}: ${finding.problem}`);
  if (findings.length) {
    console.error(`\n${findings.length} pinned paper or shared-reference cop${findings.length === 1 ? 'y' : 'ies'} in body packages. Cite papers by URL; read shared tables from src/references or src/spice.`);
    process.exitCode = 1;
  } else console.log('No pinned papers or shared-reference copies in body packages.');
}
