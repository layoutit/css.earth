import { sourceTest } from '../../source-test.mts';
const test = sourceTest('jupiter');
import{assertAuthoredGiantSourceContract}from'../../../../tools/objects/giant-layers/source-contract.mts';
test('Jupiter has a pinned, restorable source-only object package',async()=>{await assertAuthoredGiantSourceContract('jupiter');});
