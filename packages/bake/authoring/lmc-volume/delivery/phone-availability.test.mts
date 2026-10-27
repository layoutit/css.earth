import test from 'node:test';
import assert from 'node:assert/strict';
import { adbStates } from './phone-availability.mts';

test('an empty ADB list is distinct from a connected or unavailable phone', () => {
  assert.deepEqual(adbStates('List of devices attached\n\n'), []);
  assert.deepEqual(adbStates('List of devices attached\nfixture-device device product:test model:SM_S911B\n'), ['device']);
  assert.deepEqual(adbStates('List of devices attached\nfixture-device unauthorized\nfixture-offline offline\n'), ['unauthorized', 'offline']);
  assert.throws(() => adbStates('ADB transport failed'), /device list/u);
  assert.throws(() => adbStates('List of devices attached\nmalformed\n'), /Unrecognized/u);
});
