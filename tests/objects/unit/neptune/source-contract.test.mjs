import test from 'node:test';
import{assertAuthoredGiantSourceContract}from'../../../../tools/objects/giant-layers/source-contract.mjs';
test('Neptune has a pinned, restorable source-only object package',()=>assertAuthoredGiantSourceContract('neptune'));
