import assert from 'node:assert/strict';
import test from 'node:test';
import { ADAPTERS } from './query-modes.mts';

test('the ESPaDOnS ledger gives a star its polarised spectra as one mode, with the state the map route reached', () => {
  const star = (id: string, state: string, extra: object = {}) => ({ id, spectra: 52, typedNames: ['HD 189733'], firstYear: 2006, lastYear: 2023, axis: 'measured', state, programs: [], maps: [], reasons: [], ...extra });
  const ledger = { schema: 'cssearth-espadons-ledger@1', surveyed: '2026-10-06', archive: { targetNames: 3005, spectra: 22652 }, shippedStars: 3108, stars: [
    star('hd-189733', 'mapped', { programs: ['hd-189733-2007-06', 'hd-189733-2013-09'], maps: [{ program: 'hd-189733-2007-06', middleUtc: '2007-06-29T00:59:25', meanGauss: 23.5 }] }),
    star('polaris', 'held'), star('dx-cnc', 'reduced, no map', { programs: ['dx-cnc-2009-01'], reasons: ['dx-cnc-2009-01: not detected'] })] };
  const modes = (id: string) => ADAPTERS.espadons!.modes(ledger, id, []);
  assert.deepEqual(modes('hd-189733'), [{ telescope: 'CFHT', mode: 'ESPaDOnS polarimetry', archiveDate: '2026-10-06', observations: { count: 52, scope: 'this-mode' }, programmes: [], dates: [],
    toolkit: { routeState: 'mapped', tool: 'packages/telescope-cli/src/archives/espadons/reduce.mts', programs: ['hd-189733-2007-06', 'hd-189733-2013-09'], checked: ['hd-189733-2007-06'], receipts: [] } }]);
  assert.equal(modes('polaris')[0]!.toolkit.routeState, 'held');
  assert.deepEqual([modes('dx-cnc')[0]!.toolkit.routeState, modes('dx-cnc')[0]!.toolkit.refusedBecause], ['refused', 'dx-cnc-2009-01: not detected']);
  assert.deepEqual(modes('vega'), []);
  assert.throws(() => ADAPTERS.espadons!.modes({ ...ledger, schema: 'other' }, 'polaris', []), /Unsupported ESPaDOnS ledger schema/u);
});
