// Entry script: node tools/prepare/cli/prepare-object-information.mts [--verify-local] [<id>...]. The work is in ../prepare-object-information.mts.
import { prepareObjectInformation } from '../prepare-object-information.mts';

await prepareObjectInformation();
