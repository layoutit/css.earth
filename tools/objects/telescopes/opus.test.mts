import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { bodyMeanRadiusKm, fetchOpus, searchOpus, type OpusFetch } from './opus.mts';

const fixture = async (name: string) => readFile(new URL(`../../../tests/fixtures/telescope-opus/${name}`, import.meta.url), 'utf8');
const json = async (name: string): Promise<unknown> => JSON.parse(await fixture(name));
/** Recorded OPUS answers keyed by the request that produced them; any other request fails the test. */
const recorded = (answers: Readonly<Record<string, string>>): OpusFetch => async (path, parameters) => {
  const key = `${path} ${new URLSearchParams(parameters).toString()}`.trim(), name = answers[key];
  if (!name) throw new Error(`Unrecorded OPUS request ${key}`);
  return json(name);
};
const himalia = { id: 'himalia', name: 'Himalia', aliases: ['Jupiter VI'] };

test('a known target reports its image count and the sharpest image per instrument with pixels across', async () => {
  assert.equal(bodyMeanRadiusKm('himalia'), 85); assert.equal(bodyMeanRadiusKm('not-a-body'), null);
  const answer = await searchOpus(himalia, bodyMeanRadiusKm('himalia'), recorded({
    'meta/mults/surfacegeometrytargetname.json': 'targets.json',
    'meta/mults/instrument.json surfacegeometrytargetname=Himalia': 'himalia-instruments.json',
    'data.json surfacegeometrytargetname=Himalia&instrument=Cassini+ISS&order=SURFACEGEOhimalia_centerresolution1&limit=1&cols=opusid%2Cinstrument%2Ctime1%2CSURFACEGEOhimalia_centerresolution1': 'himalia-cassini-iss.json',
    'data.json surfacegeometrytargetname=Himalia&instrument=New+Horizons+LORRI&order=SURFACEGEOhimalia_centerresolution1&limit=1&cols=opusid%2Cinstrument%2Ctime1%2CSURFACEGEOhimalia_centerresolution1': 'himalia-new-horizons-lorri.json',
  }));
  assert.equal(answer.state, 'sampled'); assert.equal(answer.opusTarget, 'Himalia'); assert.equal(answer.images, 105);
  assert.deepEqual(answer.sharpest, [
    { instrument: 'Cassini ISS', instrumentImages: 93, opusId: 'co-iss-n1355869401', startTime: '2000-12-18T22:11:42.360', centreResolutionKmPerPixel: 26.60356, pixelsAcross: 6.4 },
    { instrument: 'New Horizons LORRI', instrumentImages: 12, opusId: 'nh-lorri-lor_0035531520', startTime: '2007-03-07T00:00:02.330', centreResolutionKmPerPixel: 27.07914, pixelsAcross: 6.3 },
  ]);
});

test('a target OPUS does not index is reported as unknown to OPUS, not as having no images', async () => {
  const answer = await searchOpus({ id: 'eris', name: 'Eris', aliases: ['136199 Eris'] }, 1163, recorded({ 'meta/mults/surfacegeometrytargetname.json': 'targets.json' }));
  assert.equal(answer.state, 'unknown-target'); assert.equal(answer.images, undefined);
  assert.match(answer.reason, /no surface-geometry target named Eris or 136199 Eris among its 101 targets/u);
  assert.match(answer.reason, /says nothing about whether images exist/u);
});

test('a known target with no counted images is empty in scope', async () => {
  const answer = await searchOpus({ id: 'despina', name: 'Despina', aliases: [] }, 74, recorded({
    'meta/mults/surfacegeometrytargetname.json': 'targets.json',
    'meta/mults/instrument.json surfacegeometrytargetname=Despina': 'despina-instruments-after-2030.json',
  }));
  assert.equal(answer.state, 'empty-in-scope'); assert.equal(answer.images, 0); assert.equal(answer.sharpest, undefined);
});

test('an OPUS HTML 404 page is an unavailable service, never an empty result', async (context) => {
  const html = await fixture('unknown-slug-404.html');
  context.mock.method(globalThis, 'fetch', async () => new Response(html, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } }));
  await assert.rejects(fetchOpus('data.json', { surfacegeometrytargetname: 'blorp' }), /HTTP 404 text\/html; charset=utf-8: Search parameters invalid for \/api\/data.json/u);
  const answer = await searchOpus(himalia, 69.8);
  assert.equal(answer.state, 'unavailable'); assert.match(answer.reason, /HTTP 404/u); assert.equal(answer.sharpest, undefined);
});
