/** Self-contained preparation CLI for pinned transparent surface objects. */
import { prepareSurfaceShellObject } from '../../src/preparation/shell/prepare.js';

const directory = process.argv[2];
if (!directory || process.argv[3]) throw new TypeError('Usage: prepare-shell <object-directory>');
await prepareSurfaceShellObject({ objectDirectory: directory });
