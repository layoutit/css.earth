// Entry script: node packages/bake/cli/prepare-object.mts <object-id>... [--from <step>] [--to <step>] [--reuse-images].
// The work is in @cssearth/bake/prepare-object.
import { PREPARATION_STEPS, prepareObjects } from '@cssearth/bake/prepare-object';

const args = process.argv.slice(2), option = (name: string) => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined; };
const from = option('--from'), to = option('--to'), reuseImages = args.includes('--reuse-images');
const ids = args.filter((argument, at) => !argument.startsWith('--') && args[at - 1] !== '--from' && args[at - 1] !== '--to');
if (!ids.length) throw new TypeError(`Usage: prepare-object <object-id>... [--from <step>] [--to <step>] [--reuse-images]; steps: ${PREPARATION_STEPS.map(step => step.name).join(', ')}.`);
if (!await prepareObjects(ids, { ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }), reuseImages })) process.exitCode = 1;
