import test from 'node:test';
import{assertAuthoredGiantSourceContract}from'../../../../tools/objects/giant-layers/source-contract.mjs';
test('Uranus has a pinned, restorable source-only object package',()=>assertAuthoredGiantSourceContract('uranus'));
