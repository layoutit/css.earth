import assert from 'node:assert/strict';
import test from 'node:test';
import { readOracleInput } from '@cssearth/core/oracle';
import { MissingSourceInputError } from '@cssearth/core';
import { setupTelescopeOracleInputs } from './oracle-inputs.mts';
setupTelescopeOracleInputs();
test('telescope setup is idempotent and owns its fixture inputs', async () => {
  assert.doesNotThrow(setupTelescopeOracleInputs);
  await assert.rejects(readOracleInput({ path: 'packages/telescope-cli/src/fixtures/not-restored.fits' }), MissingSourceInputError);
});
