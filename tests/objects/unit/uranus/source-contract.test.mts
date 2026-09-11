import test from 'node:test';
import{assertAuthoredGiantSourceContract}from'../../../../tools/objects/giant-layers/source-contract.mts';
test('Uranus has a pinned, restorable source-only object package',async()=>{await assertAuthoredGiantSourceContract('uranus');});
