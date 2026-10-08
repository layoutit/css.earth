// Entry script: node packages/bake/cli/prepare-object.mts <object-id>... [--from <step>] [--to <step>] [--reuse-images | --add-datasets].
// The work is in @cssearth/bake/prepare-object. Its own first step rebuilds every stale build (check-stale-builds.mts), so,
// like that check, this loads from source rather than the built entry: it has to run before the bake itself is built.
import { PREPARATION_STEPS, prepareObjects } from '../src/prepare-object/index.ts';

const args = process.argv.slice(2), option = (name: string) => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined; };
const from = option('--from'), to = option('--to'), reuseImages = args.includes('--reuse-images'), addDatasets = args.includes('--add-datasets');
const ids = args.filter((argument, at) => !argument.startsWith('--') && args[at - 1] !== '--from' && args[at - 1] !== '--to');
if (!ids.length) throw new TypeError(`Usage: prepare-object <object-id>... [--from <step>] [--to <step>] [--reuse-images | --add-datasets]; steps: ${PREPARATION_STEPS.map(step => step.name).join(', ')}.`);
if (!await prepareObjects(ids, { ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }), reuseImages, addDatasets })) process.exitCode = 1;
