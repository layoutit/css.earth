import test from 'node:test';
import{assertAuthoredGiantSourceContract}from'../../../../tools/objects/giant-layers/source-contract.mts';
test('Jupiter has a pinned, restorable source-only object package',async()=>{await assertAuthoredGiantSourceContract('jupiter');});
