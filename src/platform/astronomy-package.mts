// Prepare-time access to the astronomy package (packages/astronomy).
//
// The package is consumed through its own build: `pnpm build:astronomy` runs
// its tsup config and writes packages/astronomy/dist, which the workspace
// link resolves as `@cssearth/astronomy` from Node and from Vite alike. The
// TypeScript source imports `./x.js` for `./x.ts` files, which Node does not
// resolve, so consumers read the build rather than the source. Runtime code never imports this module: the astronomy package is a
// preparation dependency only, and its results are checked in.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const ASTRONOMY_PACKAGE = "@cssearth/astronomy";
export const ASTRONOMY_BUILD_COMMAND = "pnpm build:astronomy";
export const ASTRONOMY_BUILD_ENTRY = resolve(
  import.meta.dirname,
  "../../packages/astronomy/dist/index.js",
);

export async function loadAstronomyPackage(
  specifier = process.env.CSSEARTH_ASTRONOMY_URL ?? ASTRONOMY_PACKAGE,
): Promise<typeof import("@cssearth/astronomy")> {
  try {
    return await import(specifier);
  } catch (cause) {
    const hint = specifier === ASTRONOMY_PACKAGE && !existsSync(ASTRONOMY_BUILD_ENTRY)
      ? `The package build is missing at ${ASTRONOMY_BUILD_ENTRY}; run ` +
        `\`${ASTRONOMY_BUILD_COMMAND}\` (pnpm install runs it as well).`
      : `Set CSSEARTH_ASTRONOMY_URL to override the module specifier.`;
    throw new Error(
      `Preparation needs the vendored astronomy package (${specifier}). ${hint}`,
      { cause },
    );
  }
}
