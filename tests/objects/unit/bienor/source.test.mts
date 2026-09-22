import { sourceTest } from '../../source-test.mts';
const test = sourceTest('bienor');
import { checkShape } from '../centaur-shape-contract.mts';
test('Bienor prepared triangles preserve the independent occultation ellipsoid', async () => {await checkShape('bienor');});
