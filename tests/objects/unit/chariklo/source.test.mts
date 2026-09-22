import { sourceTest } from '../../source-test.mts';
const test = sourceTest('chariklo');
import { checkShape } from '../centaur-shape-contract.mts';
test('Chariklo prepared triangles and rings preserve independent occultation constraints', async () => {await checkShape('chariklo');});
