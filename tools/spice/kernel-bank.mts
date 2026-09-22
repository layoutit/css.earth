/**
 * Shared SPICE kernel banks: one pinned set of a mission's kernels under
 * `src/spice/<set>/`, used by every body that mission observed. A bank's
 * `manifest.json` has the shape of a body's source manifest and is verified
 * the same way, under the identity `spice-<set>`. Text kernels are committed;
 * binary SPK and CK kernels are restored from their pinned origins.
 *
 *   node tools/spice/kernel-bank.mts acquire <set>        restore missing kernels, then verify every pin
 *   node tools/spice/kernel-bank.mts verify <set>         verify every pin
 *   node tools/spice/kernel-bank.mts add <set> <url>...   download, pin and append kernels
 *       [--credit <text>] [--license <text>] [--catalogue <id>]
 *
 * An added kernel inherits the credit, license and catalogue binding of the
 * bank's first kernel unless the flags give others. A recipe names the bank with
 * `spice.kernelSet` and lists kernels by their paths inside it, in load order.
 */
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createSourceManifest } from '../../src/platform/source-manifest.mts';
import { requireArray, requireRecord, requireString } from '../sources/source-values.mts';

export const KERNEL_BANK_ROOT = resolve(import.meta.dirname, '../../src/spice');
const SET_ID = /^[a-z][a-z0-9-]*$/u;
const KINDS: Record<string, string> = { tls: 'lsk', tsc: 'sclk', tf: 'fk', ti: 'ik', tpc: 'pck', bpc: 'pck', bsp: 'spk', bc: 'ck', tm: 'mk' };

export function kernelBankRoot(set: string) {
  if (!SET_ID.test(set)) throw new TypeError(`Invalid kernel bank id: ${set}`);
  return resolve(KERNEL_BANK_ROOT, set);
}

/** A bank's manifest, validated and verifiable like a body's source manifest. */
export const openKernelBank = (set: string) =>
  createSourceManifest({ planetId: `spice-${set}`, planetName: `${set} SPICE kernel bank`, sourceRoot: kernelBankRoot(set) });

/** Check that each kernel is a pinned bank input with matching bytes, and return absolute paths in load order. */
export async function kernelBankPaths(set: string, kernels: readonly string[]) {
  const bank = await openKernelBank(set);
  for (const kernel of kernels) {
    try { await bank.validatePath(kernel); }
    catch (error) { throw new Error(`${(error as Error).message} Restore the bank with: node tools/spice/kernel-bank.mts acquire ${set}`); }
  }
  return kernels.map(kernel => resolve(kernelBankRoot(set), kernel));
}

async function download(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Kernel download failed with ${response.status}: ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function publish(path: string, bytes: Uint8Array) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.partial`;
  await writeFile(temporary, bytes); await rename(temporary, path);
}

export async function acquireKernelBank(set: string) {
  const root = kernelBankRoot(set), bank = await openKernelBank(set), restored: string[] = [];
  for (const entry of bank.manifest.inputs) {
    try { await lstat(resolve(root, entry.path)); continue; } catch { /* missing: restore below */ }
    await publish(resolve(root, entry.path), await download(entry.origin)); restored.push(entry.path);
  }
  await bank.verify();
  return { set, restored, kernels: bank.manifest.inputs.length };
}

export async function addKernels(set: string, urls: readonly string[], options: { credit?: string; license?: string; catalogue?: string } = {}) {
  const root = kernelBankRoot(set), manifestPath = resolve(root, 'manifest.json');
  const manifest = await readFile(manifestPath, 'utf8').then(text => requireRecord(JSON.parse(text), 'kernel bank manifest'),
    () => ({ schema: `cssspice-${set}-authoritative-sources@2`, inputs: [], generatedIntermediates: [], documents: [] }) as Record<string, unknown>);
  const inputs = requireArray(manifest.inputs, 'kernel bank inputs').map(entry => requireRecord(entry, 'kernel bank input'));
  const first = inputs[0];
  const credit = options.credit ?? (first ? requireString(first.credit, 'credit') : undefined);
  const license = options.license ?? (first ? requireString(first.license, 'license') : undefined);
  const binding = options.catalogue
    ? { kind: 'catalogued', references: [{ catalogueId: options.catalogue, role: 'material', evidence: `NAIF kernel pinned in src/spice/${set}/manifest.json by URL, size and SHA-256.` }] }
    : first?.sourceBinding;
  if (!credit || !license || !binding) throw new TypeError('The first kernel of a bank needs --credit, --license and --catalogue.');
  const added: string[] = [];
  for (const url of urls) {
    const name = basename(new URL(url).pathname), kind = KINDS[name.split('.').pop()?.toLowerCase() ?? ''];
    if (!kind) throw new TypeError(`Unknown kernel type: ${name}`);
    const path = `${kind}/${name}`;
    if (inputs.some(entry => entry.path === path)) continue;
    const bytes = await download(url);
    await publish(resolve(root, path), bytes);
    inputs.push({ id: `${set}-${name.toLowerCase().replace(/[^a-z0-9]+/gu, '-')}`, path, origin: url, credit, license,
      acquisition: `Restore the unmodified kernel with node tools/spice/kernel-bank.mts acquire ${set}.`,
      redistribution: 'Public NAIF SPICE kernel; retain the credit.', consumers: ['spice'],
      sourceBinding: binding });
    added.push(path);
  }
  await mkdir(root, { recursive: true });
  await writeFile(manifestPath, JSON.stringify({ ...manifest, inputs }, null, 2) + '\n');
  return { set, added };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, set, ...rest] = process.argv.slice(2);
  const flag = (name: string) => { const index = rest.indexOf(`--${name}`); return index >= 0 ? rest[index + 1] : undefined; };
  const urls = rest.filter((value, index) => !value.startsWith('--') && !rest[index - 1]?.startsWith('--'));
  if (!set) throw new TypeError('Usage: kernel-bank.mts <acquire|verify|add> <set> [url...]');
  const result = command === 'acquire' ? await acquireKernelBank(set)
    : command === 'verify' ? (await (await openKernelBank(set)).verify(), { set, verified: true })
    : command === 'add' ? await addKernels(set, urls, { credit: flag('credit'), license: flag('license'), catalogue: flag('catalogue') })
    : (() => { throw new TypeError(`Unknown command: ${command}`); })();
  console.log(JSON.stringify(result));
}
