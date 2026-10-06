import assert from 'node:assert/strict';
import test from 'node:test';
import { csv } from './companions.mts';

test('a quoted cell keeps its commas and doubled quotes; plain and empty cells are read as they are', () => {
  assert.deepEqual(csv('id,otype\n"** STF 1888AB,C","**"\n"NAME ""Barnard\'s"" Star",PM*\n,\n'),
    [{ id: '** STF 1888AB,C', otype: '**' }, { id: 'NAME "Barnard\'s" Star', otype: 'PM*' }, { id: '', otype: '' }]);
  assert.deepEqual(csv('rvz_radvel,rvz_err,rvz_bibcode\n-12.3,0.4,2020AJ....160..120J\n'), [{ rvz_radvel: '-12.3', rvz_err: '0.4', rvz_bibcode: '2020AJ....160..120J' }]);
  assert.deepEqual(csv('main_id\n'), []);
});
