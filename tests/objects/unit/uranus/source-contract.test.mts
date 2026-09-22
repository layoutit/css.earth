import { sourceTest } from '../../source-test.mts';
const test = sourceTest('uranus');
import{assertAuthoredGiantSourceContract}from'../../../../tools/objects/giant-layers/source-contract.mts';
test('Uranus has a pinned, restorable source-only object package',async()=>{await assertAuthoredGiantSourceContract('uranus');});
