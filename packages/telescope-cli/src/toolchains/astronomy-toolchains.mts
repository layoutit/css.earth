#!/usr/bin/env node
/** Install or verify one of the pinned Python astronomy toolchains the telescope library runs.
 *
 *   node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts astroquery|pds|starry|spiderman|picaso install|verify
 *
 * The pins, their hash-locked requirements and the licences of what they install are in packages/telescope-core/toolchains/;
 * the installers and the checks are `@cssearth/telescope-core/node`. */
import { archiveInstallers } from './archive-installers.mts';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installAstroquery, installPdsToolchain, installPicaso, installSpiderman, installStarry, verifyAstroqueryToolchain, verifyPdsToolchain, verifyPicaso, verifySpiderman, verifyStarry } from '@cssearth/telescope-core/node';

const TOOLCHAINS: Readonly<Record<string, { readonly install: () => Promise<string>; readonly verify: () => Promise<string> }>> = {
  astroquery: { install: async () => `Astronomy packages are installed at ${await installAstroquery()}`, verify: verifyAstroqueryToolchain },
  pds: { install: async () => `PDS packages are installed at ${await installPdsToolchain()}`, verify: verifyPdsToolchain },
  starry: { install: async () => `starry is installed at ${await installStarry()}`, verify: async () => `starry ${verifyStarry()} ready` },
  spiderman: { install: async () => `SPIDERMAN is installed at ${await installSpiderman()}`, verify: async () => `SPIDERMAN and batman ${verifySpiderman()} ready` },
  picaso: { install: async () => `PICASO is installed at ${await installPicaso()}`, verify: async () => `PICASO ${verifyPicaso()} ready` },
};

export const verificationToolchainNames = Object.keys(TOOLCHAINS);
export const toolchainNames = [...verificationToolchainNames, ...Object.keys(archiveInstallers)];
export async function manageToolchain(name: string, mode: 'install' | 'verify'): Promise<string> {
  if (mode === 'install' && Object.hasOwn(archiveInstallers, name)) return `${name} is installed at ${await archiveInstallers[name]!()}`;
  const toolchain = Object.hasOwn(TOOLCHAINS, name) ? TOOLCHAINS[name] : undefined;
  if (!toolchain) throw new TypeError(`Unknown toolchain ${name}; choose ${toolchainNames.join(', ')}.`);
  return toolchain[mode]();
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [name, mode] = process.argv.slice(2);
  if (!name || (mode !== 'install' && mode !== 'verify')) throw new TypeError(`Usage: astronomy-toolchains <${toolchainNames.join('|')}> <install|verify>`);
  console.log(await manageToolchain(name, mode));
}
