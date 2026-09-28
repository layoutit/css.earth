// Entry script: node packages/bake/cli/object-operations.mts <acquire|verify|manifest|assemble> <id> [arguments]
// Runs one authored body's source acquisition or verification, its runtime manifest, or the production assembly of its
// runtime assets (`runOperations` in `@cssearth/bake/objects/acquisition`), from the checkout the command runs in.
import { runOperations } from '@cssearth/bake/objects/acquisition';

const [mode, id, ...args] = process.argv.slice(2);
if (!mode || !id) throw new TypeError('Usage: object-operations.mts <acquire|verify|manifest|assemble> <id>');
console.log(JSON.stringify(await runOperations(mode, id, args)));
