/** The shared SPICE kernel banks under `src/spice/<set>/`, bound to the application's source-manifest reader: a bank's
 * `manifest.json` is validated and verified like a body's source manifest, under the identity `spice-<set>`. The banks
 * themselves are `@cssearth/spice/node`; `packages/bake/cli/kernel-bank.mts` is their command line. */
import { kernelBanks } from '@cssearth/spice/node';
import { createSourceManifest } from '@cssearth/objects/node';

export const { openKernelBank, kernelBankPaths, restoredBankFile, bankKernelPath, acquireKernelBank, addKernels } =
  kernelBanks({ openManifest: createSourceManifest, acquireCommand: 'node packages/bake/cli/kernel-bank.mts' });
