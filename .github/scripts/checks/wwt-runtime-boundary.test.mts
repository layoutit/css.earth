import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectObjectRuntimeModule } from './check-object-runtime-ownership.mts';

test('the CSS runtime refuses WWT engine imports, including lazy imports', () => {
  const inspected = inspectObjectRuntimeModule(
    "import '@wwtelescope/engine'; void import('@wwtelescope/engine-helpers');",
    'site/wwt-boundary-example.mts', { shared: true },
  );
  assert.equal(inspected.violations.filter(violation => violation.reason.includes('WWT WebGL engine')).length, 2);
});
