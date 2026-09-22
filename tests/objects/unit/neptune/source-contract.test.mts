import { sourceTest } from '../../source-test.mts';
const test = sourceTest('neptune');
import{assertAuthoredGiantSourceContract}from'../../../../tools/objects/giant-layers/source-contract.mts';
test('Neptune has a pinned, restorable source-only object package',async()=>{await assertAuthoredGiantSourceContract('neptune');});
