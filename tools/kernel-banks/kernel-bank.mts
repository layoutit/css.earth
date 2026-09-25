/**
 * The shared SPICE kernel banks under `src/spice/<set>/`, bound to the application's source-manifest reader: a bank's
 * `manifest.json` is validated and verified like a body's source manifest, under the identity `spice-<set>`. The banks
 * themselves (restoring kernels from their NAIF origins, adding kernels) are `@cssearth/spice/node`.
 *
 *   node tools/kernel-banks/kernel-bank.mts acquire <set>        restore missing kernels, then verify every pin
 *   node tools/kernel-banks/kernel-bank.mts verify <set>         verify every pin
 *   node tools/kernel-banks/kernel-bank.mts add <set> <url>...   download, pin and append kernels
 *       [--credit <text>] [--license <text>] [--catalogue <id>]
 *
 * An added kernel inherits the credit, license and catalogue binding of the bank's first kernel unless the flags give
 * others. A recipe names the bank with `spice.kernelSet` and lists kernels by their paths inside it, in load order.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { kernelBanks } from '@cssearth/spice/node';
import { createSourceManifest } from '../../src/platform/source-manifest.mts';

export const { openKernelBank, kernelBankPaths, restoredBankFile, bankKernelPath, acquireKernelBank, addKernels } =
  kernelBanks({ openManifest: createSourceManifest, acquireCommand: 'node tools/kernel-banks/kernel-bank.mts' });

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
