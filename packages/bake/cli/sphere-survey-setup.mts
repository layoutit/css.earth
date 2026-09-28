// Entry script: node packages/bake/cli/sphere-survey-setup.mts <object-id> [--leave-out=<frame-id>,…] [--leave-out-apparition=<first night>,…].
// Sets up a VLT/SPHERE survey body's photograph lens in output/sphere-survey/<id> and measures it against the survey figure
// (`buildSetup` in @cssearth/bake/objects/sphere-survey), in the checkout it runs in.
import { buildSetup, leaveOutArguments, surveySetupSummary } from '@cssearth/bake/objects/sphere-survey';

const [objectId, ...rest] = process.argv.slice(2), leaveOuts = leaveOutArguments(rest);
if (!objectId || leaveOuts === null) { console.error('usage: node packages/bake/cli/sphere-survey-setup.mts <object-id> [--leave-out=<frame-id>,…] [--leave-out-apparition=<first night>,…]'); process.exit(2); }
console.log(surveySetupSummary(await buildSetup(objectId, leaveOuts)));
