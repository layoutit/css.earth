/**
 * Shared SPICE kernel banks: one pinned set of a mission's kernels under the checkout's
 * `src/spice/<set>/`, used by every body that mission observed. A bank's
 * `manifest.json` has the shape of a body's source manifest and is verified
 * the same way, under the identity `spice-<set>`. Only the manifest is committed:
 * every kernel is restored from its NAIF origin, and `kernelBankPaths` restores
 * the kernels a caller asks for before returning their paths.
 *
 * The source-manifest format and its validation belong to the application, so a
 * caller binds the banks to its manifest reader with `kernelBanks`. The command
 * line (acquire, verify, add) is `tools/kernel-banks/kernel-bank.mts`.
 *
 * An added kernel inherits the credit, license and catalogue binding of the
 * bank's first kernel unless the options give others. A recipe names the bank with
 * `spice.kernelSet` and lists kernels by their paths inside it, in load order.
 */
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { KERNEL_BANK_ROOT } from './paths.js';

export { KERNEL_BANK_ROOT };
const SET_ID = /^[a-z][a-z0-9-]*$/u;
const KINDS: Record<string, string> = { tls: 'lsk', tsc: 'sclk', tf: 'fk', ti: 'ik', tpc: 'pck', bpc: 'pck', bsp: 'spk', bc: 'ck', tm: 'mk' };

export function kernelBankRoot(set: string) {
  if (!SET_ID.test(set)) throw new TypeError(`Invalid kernel bank id: ${set}`);
  return resolve(KERNEL_BANK_ROOT, set);
}

/** Where a bank's manifest is and what it is called: a body's source-manifest location. */
export interface KernelBankManifestLocation { readonly objectId: string; readonly objectName: string; readonly sourceRoot: string }
/** What the banks need of an opened manifest: the declared inputs and their origins, a check that one declared file is
 * present, and a check that the directory holds exactly the declared files. */
export interface KernelBankManifest {
  readonly manifest: { readonly inputs: readonly { readonly path: string; readonly origin: string }[] };
  validatePath(path: string): Promise<unknown>;
  verify(): Promise<unknown>;
}
export interface KernelBankOptions {
  /** Reads and validates `manifest.json` at a location: the application's source-manifest reader. */
  readonly openManifest: (location: KernelBankManifestLocation) => Promise<KernelBankManifest>;
  /** The command an added kernel's acquisition note names, such as `node tools/kernel-banks/kernel-bank.mts`. */
  readonly acquireCommand: string;
}

/** A file an evidence record pins by origin and SHA-256: read it, restoring it from the origin first when it is missing. */
export async function readPinnedFile(path: string, origin: string, sha256: string) {
  try { return await readFile(path); } catch { /* missing: restore below */ }
  const bytes = await download(origin), actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== sha256) throw new Error(`${origin} has SHA-256 ${actual}; ${path} pins ${sha256}.`);
  await publish(path, bytes);
  return Buffer.from(bytes);
}

/** The banks bound to a manifest reader. */
export function kernelBanks({ openManifest, acquireCommand }: KernelBankOptions) {
  /** A bank's manifest, validated and verifiable like a body's source manifest. */
  const openKernelBank = (set: string) =>
    openManifest({ objectId: `spice-${set}`, objectName: `${set} SPICE kernel bank`, sourceRoot: kernelBankRoot(set) });

  /** The local paths of a bank's kernels, restoring any that are missing from their declared origins first. */
  async function kernelBankPaths(set: string, kernels: readonly string[]) {
    const root = kernelBankRoot(set), bank = await openKernelBank(set);
    const origins = new Map(bank.manifest.inputs.map(entry => [entry.path, entry.origin]));
    for (const kernel of kernels) {
      const origin = origins.get(kernel);
      if (origin === undefined) throw new Error(`Kernel bank ${set} does not declare ${kernel} (src/spice/${set}/manifest.json).`);
      try { await lstat(resolve(root, kernel)); } catch { await publish(resolve(root, kernel), await download(origin)); }
      await bank.validatePath(kernel);
    }
    return kernels.map(kernel => resolve(root, kernel));
  }

  /** A path: when it names a kernel inside a bank, that kernel is restored first. Other paths pass through unchanged. */
  async function restoredBankFile(path: string) {
    const absolute = resolve(path);
    if (!absolute.startsWith(KERNEL_BANK_ROOT + '/')) return path;
    const [set, ...rest] = absolute.slice(KERNEL_BANK_ROOT.length + 1).split('/');
    return (await kernelBankPaths(set!, [rest.join('/')]))[0]!;
  }

  /** One bank kernel's local path, restored first when missing. */
  const bankKernelPath = async (set: string, kernel: string) => (await kernelBankPaths(set, [kernel]))[0]!;

  async function acquireKernelBank(set: string) {
    const root = kernelBankRoot(set), bank = await openKernelBank(set), restored: string[] = [];
    for (const entry of bank.manifest.inputs) {
      try { await lstat(resolve(root, entry.path)); continue; } catch { /* missing: restore below */ }
      await publish(resolve(root, entry.path), await download(entry.origin)); restored.push(entry.path);
    }
    await bank.verify();
    return { set, restored, kernels: bank.manifest.inputs.length };
  }

  async function addKernels(set: string, urls: readonly string[], options: { credit?: string; license?: string; catalogue?: string } = {}) {
    const root = kernelBankRoot(set), manifestPath = resolve(root, 'manifest.json');
    const manifest = await readFile(manifestPath, 'utf8').then(text => requireRecord(JSON.parse(text), 'kernel bank manifest'),
      () => ({ schema: `cssearth-authoritative-sources@2`, inputs: [], generatedIntermediates: [], documents: [] }) as Record<string, unknown>);
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
        acquisition: `Restore the unmodified kernel with ${acquireCommand} acquire ${set}.`,
        redistribution: 'Public NAIF SPICE kernel; retain the credit.', consumers: ['spice'],
        sourceBinding: binding });
      added.push(path);
    }
    await mkdir(root, { recursive: true });
    await writeFile(manifestPath, JSON.stringify({ ...manifest, inputs }, null, 2) + '\n');
    return { set, added };
  }

  return { openKernelBank, kernelBankPaths, restoredBankFile, bankKernelPath, acquireKernelBank, addKernels };
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
