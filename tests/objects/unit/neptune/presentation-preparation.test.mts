import test from 'node:test';
import {assertLayeredPresentationParity}from'../../../../tools/objects/giant-layers/presentation-parity.mts';
test('source-configured retained presentation equals the complete accepted runtime',()=>assertLayeredPresentationParity('neptune'));
