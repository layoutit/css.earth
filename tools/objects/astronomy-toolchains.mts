#!/usr/bin/env node
/** Install or verify one of the pinned Python astronomy toolchains the telescope library runs.
 *
 *   node tools/objects/astronomy-toolchains.mts astroquery|pds|starry|spiderman install|verify
 *
 * The pins, their hash-locked requirements and the licences of what they install are in packages/telescope/toolchains/;
 * the installers and the checks are `@cssearth/telescope/node`. */
import { installAstroquery, installPdsToolchain, installSpiderman, installStarry, verifyAstroqueryToolchain, verifyPdsToolchain, verifySpiderman, verifyStarry } from '@cssearth/telescope/node';

const TOOLCHAINS: Readonly<Record<string, { readonly install: () => Promise<string>; readonly verify: () => Promise<string> }>> = {
  astroquery: { install: async () => `Astronomy packages are installed at ${await installAstroquery()}`, verify: verifyAstroqueryToolchain },
  pds: { install: async () => `PDS packages are installed at ${await installPdsToolchain()}`, verify: verifyPdsToolchain },
  starry: { install: async () => `starry is installed at ${await installStarry()}`, verify: async () => `starry ${verifyStarry()} ready` },
  spiderman: { install: async () => `SPIDERMAN is installed at ${await installSpiderman()}`, verify: async () => `SPIDERMAN and batman ${verifySpiderman()} ready` },
};

const [name, mode] = process.argv.slice(2), toolchain = name === undefined ? undefined : TOOLCHAINS[name];
if (!toolchain || (mode !== 'install' && mode !== 'verify')) throw new TypeError(`Usage: astronomy-toolchains <${Object.keys(TOOLCHAINS).join('|')}> <install|verify>`);
console.log(await toolchain[mode]());
