// Entry script: node packages/bake/cli/sphere-survey-install.mts <object-id> [--replace] [--leave-out=<frame-id>,…] [--leave-out-apparition=<first night>,…] [--because=<why>].
// Installs a set-up survey lens into the body's package (`installSetup` in @cssearth/bake/objects/sphere-survey), in the checkout it runs in.
import { installSetup, leaveOutArguments } from '@cssearth/bake/objects/sphere-survey';

const [objectId, ...rest] = process.argv.slice(2), because = rest.find(arg => arg.startsWith('--because='))?.slice('--because='.length), replace = rest.includes('--replace');
const leaveOuts = leaveOutArguments(rest.filter(arg => !arg.startsWith('--because=') && arg !== '--replace'));
if (!objectId || leaveOuts === null) { console.error('usage: node packages/bake/cli/sphere-survey-install.mts <object-id> [--replace] [--leave-out=<frame-id>,…] [--leave-out-apparition=<first night>,…] [--because=<why>]'); process.exit(2); }
await installSetup(objectId, { ...leaveOuts, because, replace });
