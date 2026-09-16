/** Repository entrypoint for the private lab command package. */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runLabCommand } from '@cssearth/nebula-lab/cli';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
process.exitCode = await runLabCommand(root, process.argv.slice(2));
