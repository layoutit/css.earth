import assert from 'node:assert/strict';
import test from 'node:test';
import { capturePointer } from './camera-input.js';

test('a pointer that is gone before its handler runs is not captured, and nothing fails', () => {
  const captured: number[] = [];
  capturePointer({ setPointerCapture: id => { captured.push(id); } }, 3);
  assert.deepEqual(captured, [3]);
  capturePointer({ setPointerCapture: () => { throw new DOMException('No active pointer with the given id is found.', 'NotFoundError'); } }, 4);
  assert.throws(() => capturePointer({ setPointerCapture: () => { throw new TypeError('other'); } }, 5), TypeError);
});
