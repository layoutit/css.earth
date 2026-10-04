import assert from 'node:assert/strict';
import test from 'node:test';
import { MissingSourceInputError } from '@cssearth/core';
import { readOracleInput, registerOracleInputResolvers } from '@cssearth/core/oracle';
import { missingFitsInputs } from './fits-inputs.mts';

test('FITS restoration lists a real missing oracle input by code', async () => {
  const absent = { path: '.local/fits-reference/p9-deliberately-absent.fits' };
  registerOracleInputResolvers([{ id: 'p9-absent-input', accepts: path => path === absent.path, verify: async () => {} }]);
  assert.deepEqual(await missingFitsInputs([absent], readOracleInput), [absent]);
});

test('FITS absence follows the code and leaves corruption as failure', async () => {
  assert.deepEqual(await missingFitsInputs(['present', 'absent'], async input => {
    if (input === 'absent') throw new MissingSourceInputError('changed wording');
  }), ['absent']);
  for (const message of ['Missing FITS oracle input x', 'Missing oracle input x', 'Wrong byte count']) {
    const error = new Error(message);
    await assert.rejects(missingFitsInputs(['x'], async () => { throw error; }), reason => reason === error);
  }
});
