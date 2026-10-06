import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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

test('Chandra pushes an instrument and UTC date window into the bounded query', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'chandra-filtered-'));
  try {
    const result = await searchChandraLeads(root, jupiter, undefined, async adql => {
      assert.match(adql, /instrument='HRC-I'/u);
      assert.match(adql, /start_date >= '2017-01-01' AND start_date < '2017-02-01'/u);
      return [{ obsid: '18676', target_name: 'JUPITER', instrument: 'HRC-I', grating: 'NONE', exposure_time: '12', start_date: '2017-01-15' }];
    }, { instrument: 'HRC-I', time: { fromIso: '2017-01-01T00:00:00Z', toIso: '2017-01-31T23:59:59Z' } });
    assert.equal(result.sources?.length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Spitzer filters all returned AORs before taking the first hundred', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'spitzer-filtered-'));
  try {
    const old = Array.from({ length: 100 }, (_, index) => ({ reqkey: String(index + 1), targetname: 'Jupiter', progid: '123',
      modedisplayname: 'IRAC Map', reqtitle: 'Old', reqbegintime: '2005-01-01 00:00:00', reqendtime: '2005-01-01 01:00:00' }));
    const wanted = { reqkey: '21415424', targetname: 'Jupiter', progid: '123', modedisplayname: 'MIPS Map',
      reqtitle: 'Wanted', reqbegintime: '2017-01-15 00:00:00', reqendtime: '2017-01-15 01:00:00' };
    const result = await searchSpitzerLeads(root, jupiter, undefined, async () => [...old, wanted], {
      instrument: 'MIPS', time: { fromIso: '2017-01-01T00:00:00Z', toIso: '2017-01-31T23:59:59Z' } });
    assert.equal(result.state, 'sampled');
    const source = result.sources?.[0]; assert.ok(source && 'aorKey' in source);
    assert.equal(source.aorKey, 21415424);
    const evidence = JSON.parse(await readFile(resolve(root, 'output/telescopes/archive-leads', `${source.evidence}.json`), 'utf8'));
    assert.deepEqual(evidence.rows, [wanted]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
