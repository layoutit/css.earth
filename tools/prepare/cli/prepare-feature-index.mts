// Entry script: node tools/prepare/cli/prepare-feature-index.mts. The work is in ../prepare-feature-index.mts.
import { prepareFeatureIndex } from '../prepare-feature-index.mts';

console.log(JSON.stringify(await prepareFeatureIndex()));
