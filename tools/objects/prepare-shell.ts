/** Self-contained preparation CLI for pinned transparent surface objects. */
import { prepareSurfaceShellObject } from '../../src/preparation/shell/prepare.js';
import { inventoryPreparedAssets } from '../../src/platform/runtime-asset-closure.mts';

const directory = process.argv[2];
if (!directory || process.argv[3]) throw new TypeError('Usage: prepare-shell <object-directory>');
await prepareSurfaceShellObject({ objectDirectory: directory, inventory: inventoryPreparedAssets });
