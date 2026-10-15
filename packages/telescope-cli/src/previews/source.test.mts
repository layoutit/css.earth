import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { previewSource, type PreviewChoice } from './source.mts';
import { previewVotable } from './votable.mts';
import { readFile } from 'node:fs/promises';

const session = { answer: { request: {} } };
function choice(identity: Record<string, string>, snapshot = '/absent-preview-snapshot.xml', telescope = 'JAO', kind = 'cube'): PreviewChoice {
  const observation = JSON.stringify({ identityColumns: Object.keys(identity), identity: Object.values(identity) });
  return { pick: 9, observation, telescope, reference: { kind: 'vo-acquisition', observation, acquisitionKey: 'preview-test', snapshot },
    display: { instrument: telescope === 'JAO' ? 'ALMA' : telescope === 'HST' ? 'STIS/NUV-MAMA' : 'UVES', productKind: kind,
      advertisedKilobytes: 1474, metadataBasis: 'advertised', observationTime: { startIso: null, endIso: null }, wavelengthsMicrometres: [null, null] } };
}
const almaIdentity = { obs_publisher_did: 'ADS/JAO.ALMA#2015.1.00206.S', obs_id: 'uid://A001/X14f8/X53.source.Betelgeuse.spw.16' };

test('saved identities resolve HST/ESO without downloading a search product', async () => {
  assert.equal((await previewSource(choice({ obs_id: 'o4de03010' }, undefined, 'HST', 'spectrum'), session)).kind, 'hst');
  const eso = choice({ obs_publisher_did: 'ivo://eso.org/ID?ADP.2021-08-29T14:38:00.222', obs_id: '118735' }, undefined, 'ESO-VLT-U2', 'spectrum');
  const source = await previewSource(eso, session);
  assert.equal(source.kind, 'eso');
  if (source.kind === 'eso') { assert.equal(source.product, 'spectrum'); assert.equal(decodeURIComponent(source.url), 'https://dataportal.eso.org/dataPortal/file/ADP.2021-08-29T14:38:00.222'); }
  for (const size of [null, -1, NaN, 15 * 1024 + 1]) assert.equal((await previewSource({ ...eso, display: { ...eso.display, advertisedKilobytes: size } }, session)).kind, 'none');
  assert.equal((await previewSource({ ...eso, display: { ...eso.display, advertisedKilobytes: 15 * 1024, productKind: 'image' } }, session)).kind, 'eso');
});

test('ALMA matches the complete saved identity to its own snapshot row and extracts target/window/position', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'preview-source-'));
  try {
    const path = resolve(directory, 'snapshot.xml');
    await writeFile(path, `<VOTABLE><RESOURCE><TABLE>${['obs_publisher_did', 'obs_id', 's_ra', 's_dec'].map(name => `<FIELD name="${name}"/>`).join('')}<DATA><TABLEDATA>
      <TR><TD>other</TD><TD>uid://other</TD><TD>1</TD><TD>2</TD></TR>
      <TR><TD>${almaIdentity.obs_publisher_did}</TD><TD>${almaIdentity.obs_id}</TD><TD>88.79310412228</TD><TD>7.407131912347</TD></TR>
      </TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>`);
    const picked = choice(almaIdentity, path), source = await previewSource(picked, session);
    assert.deepEqual(source, { pick: 9, observation: picked.observation, kind: 'alma', member: 'uid://A001/X14f8/X53', target: 'Betelgeuse', spw: 16, ra: 88.79310412228, dec: 7.407131912347 });
    await writeFile(path, JSON.stringify({ response: { rows: [{ ...almaIdentity, s_ra: 88, s_dec: 7 }] } }));
    const json = await previewSource(picked, session); assert.equal(json.kind, 'alma');
    if (json.kind === 'alma') assert.equal(json.ra, 88);
    await writeFile(path, JSON.stringify({ response: { rows: [{ ...almaIdentity, s_ra: 88, s_dec: 7 }, { ...almaIdentity, s_ra: 88, s_dec: 7 }] } }));
    await assert.rejects(previewSource(picked, session), /uniquely/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('unsupported archives and missing ALMA coordinates give explicit no-preview data', async () => {
  assert.deepEqual(await previewSource(choice({ obs_id: 'unrelated' }, undefined, 'Gemini', 'image'), session),
    { pick: 9, observation: choice({ obs_id: 'unrelated' }, undefined, 'Gemini', 'image').observation, kind: 'none', reason: 'the archive has no preview for this one' });
  const source = await previewSource(choice(almaIdentity), session);
  assert.equal(source.kind, 'none');
  if (source.kind === 'none') assert.match(source.reason, /position/u);
  await assert.rejects(previewSource({ ...choice(almaIdentity), observation: '{"identityColumns":["obs_id"],"identity":[4]}' }, session), /identity/u);
});

test('recorded ALMA snippets retain tar links, SODA ids and a separate calibrator', async () => {
  const member = previewVotable(await readFile(new URL('./fixtures/alma-member.xml', import.meta.url), 'utf8'));
  const products = previewVotable(await readFile(new URL('./fixtures/alma-products.xml', import.meta.url), 'utf8'));
  assert.ok(member.rows.some(row => row.access_url?.endsWith('.tar')));
  assert.ok(member.services.some(service => service.standard.includes('DataLink')));
  assert.ok(products.services.some(service => service.url.includes('Betelgeuse_sci')));
  assert.ok(products.services.some(service => service.url.includes('J0510p1800_bp')));
  assert.throws(() => previewVotable('<VOTABLE><RESOURCE><TABLE><FIELD name="x"/><DATA><BINARY/></DATA></TABLE></RESOURCE></VOTABLE>'), /TABLEDATA/u);
  assert.throws(() => previewVotable('<!DOCTYPE VOTABLE><VOTABLE/>'), /declaration/u);
});
