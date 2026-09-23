import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { searchChandraLeads, searchSpitzerLeads } from './other-leads.mts';

const jupiter = { id: 'jupiter', name: 'Jupiter', aliases: [] };

test('Chandra uses the existing moving-target mapping and preserves exact ObsIDs', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'chandra-leads-'));
  try {
    const result = await searchChandraLeads(root, jupiter, undefined, async adql => {
      assert.match(adql, /target_name='JUPITER'/u);
      return [{ obsid: '18676', target_name: 'JUPITER', instrument: 'HRC-I', grating: 'NONE', exposure_time: '12', start_date: '2017-01-01' }];
    });
    assert.equal(result.state, 'sampled');
    const source = result.sources?.[0]; assert.ok(source && 'obsid' in source);
    assert.equal(source.obsid, 18676);
    const failed = await searchChandraLeads(root, jupiter, undefined, async () => { throw new Error('CDA timeout'); });
    assert.equal(failed.state, 'unavailable');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Spitzer uses the shipped NAIF identity and preserves exact AORKEYs', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'spitzer-leads-'));
  try {
    const result = await searchSpitzerLeads(root, jupiter, undefined, async request => {
      assert.deepEqual(request, { id: 'aorByNaifID', naifID: '599' });
      return [{ reqkey: '21415424', targetname: 'Jupiter', progid: '123', modedisplayname: 'IRAC Map',
        reqtitle: 'Jupiter test', reqbegintime: '2005-01-01 00:00:00', reqendtime: '2005-01-01 01:00:00' }];
    });
    assert.equal(result.state, 'sampled');
    const source = result.sources?.[0]; assert.ok(source && 'aorKey' in source);
    assert.equal(source.aorKey, 21415424);
  } finally { await rm(root, { recursive: true, force: true }); }
});
