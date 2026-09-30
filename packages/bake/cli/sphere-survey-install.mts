// Entry script: node packages/bake/cli/sphere-survey-install.mts <object-id> [--replace] [--leave-out=<frame-id>,…] [--leave-out-apparition=<first night>,…] [--because=<why>].
// Installs a set-up survey dataset into the body's package (`installSetup` in @cssearth/bake/objects/sphere-survey), in the checkout this command belongs to.
import { resolve } from 'node:path';
import { installSetup, leaveOutArguments } from '@cssearth/bake/objects/sphere-survey';

/** The checkout this command belongs to, whatever directory it is run from. */
const ROOT = resolve(import.meta.dirname, '../../..');

const [objectId, ...rest] = process.argv.slice(2), because = rest.find(arg => arg.startsWith('--because='))?.slice('--because='.length), replace = rest.includes('--replace');
const leaveOuts = leaveOutArguments(rest.filter(arg => !arg.startsWith('--because=') && arg !== '--replace'));
if (!objectId || leaveOuts === null) { console.error('usage: node packages/bake/cli/sphere-survey-install.mts <object-id> [--replace] [--leave-out=<frame-id>,…] [--leave-out-apparition=<first night>,…] [--because=<why>]'); process.exit(2); }
await installSetup(objectId, { ...leaveOuts, because, replace, root: ROOT });
