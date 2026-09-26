// Entry script: node tools/prepare/cli/prepare-object-json.mts [<object-id>...] [--keep-bindings]. The work is in ../prepare-object-json.mts.
import { prepareObjectJson } from '../prepare-object-json.mts';

// --keep-bindings: a default camera or world frame change, which needs no browser or image work.
const args = process.argv.slice(2), ids = args.filter(arg => arg !== '--keep-bindings');
for (const result of await prepareObjectJson(ids.length ? ids : null, { keepBindings: args.includes('--keep-bindings') })) console.log(JSON.stringify(result));
