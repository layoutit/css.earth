/** Where the telescope library finds its own files and the workspace it serves. The package root is found by the package's
 * own name, so it is the same whether this code runs from src/, from dist/, or bundled into another module (the telescope
 * sphere lane compiles its owners into a temporary module under the workspace and runs that). */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

export const PACKAGE_ROOT = dirname(createRequire(import.meta.url).resolve('@cssearth/telescope/package.json'));
/** The pinned Python toolchains: descriptors, hash-locked requirements, and the licences and notices of what they install. */
export const TOOLCHAINS = resolve(PACKAGE_ROOT, 'toolchains');
/** The css.earth checkout the package lives in (`packages/telescope`), where installed toolchains and archive caches go. */
export const WORKSPACE = resolve(PACKAGE_ROOT, '../..');
