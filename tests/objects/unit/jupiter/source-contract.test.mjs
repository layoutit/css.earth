import test from 'node:test';
import{assertAuthoredGiantSourceContract}from'../../../../tools/objects/giant-layers/source-contract.mjs';
test('Jupiter has a pinned, restorable source-only object package',()=>assertAuthoredGiantSourceContract('jupiter'));
