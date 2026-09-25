/** Where the package finds the checkout it serves. The package root is found by the package's own name, so it is the same
 * whether this code runs from src/ (tests), from dist/, or through a caller anywhere in the workspace; a fixed offset
 * from this file would change once the file is built. */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const PACKAGE_ROOT = dirname(createRequire(import.meta.url).resolve('@cssearth/spice/package.json'));
/** The css.earth checkout the package lives in (`packages/spice`). */
const WORKSPACE = resolve(PACKAGE_ROOT, '../..');
/** The shared kernel banks, one directory per mission set: `src/spice/<set>/`. */
export const KERNEL_BANK_ROOT = resolve(WORKSPACE, 'src/spice');
