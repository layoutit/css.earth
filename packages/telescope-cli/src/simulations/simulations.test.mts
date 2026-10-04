/** The simulation survey (simulations.mts), offline. The fixture is six of the fourteen dataset records Zenodo returned for
 * TRAPPIST-1e on 2026-10-03, as served: descriptions cut at 700 characters and file lists at five, nothing reworded. Three
 * are climate-model outputs, one is the data of an observation, one is under a no-derivatives license and one names
 * the planet's star in passing. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { WORKSPACE } from '@cssearth/telescope/node';
import { parseCli } from '../cli-arguments.mts';
import { formatSimulations, nameForms, namesObject, parseZenodoRecord, parseZenodoSearch, reuseLicense, searchSimulations, sizeText, speaksOfSimulation, zenodoQuery } from './simulations.mts';

const served = async (): Promise<unknown> => JSON.parse(await readFile(resolve(import.meta.dirname, '../fixtures/telescope-simulations/zenodo-trappist-1e.json'), 'utf8'));
const answering = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch;

test('a Zenodo record is validated and reduced to what the report says of it', async () => {
  const records = parseZenodoSearch(await served()), exocam = records[0]!;
  assert.equal(records.length, 6);
  assert.deepEqual([exocam.id, exocam.doi, exocam.url, exocam.year, exocam.license], ['5532765', '10.5281/zenodo.5532765', 'https://zenodo.org/records/5532765', 2021, 'cc-by-4.0']);
  assert.deepEqual([exocam.creators, exocam.moreCreators], [['Wolf, Eric, T.', 'Kopparapu, Ravi', 'Haqq-Misra, Jacob'], true]);
  assert.deepEqual(exocam.files[0], { name: 'ExoCAM_thai_hab1_L51_n68equiv.cam.h0.avg.nc', bytes: 53362040,
    url: 'https://zenodo.org/records/5532765/files/ExoCAM_thai_hab1_L51_n68equiv.cam.h0.avg.nc?download=1' });
  assert.match(exocam.description, /^This repository contains 3D GCM model output data from the paper, "ExoCAM: A 3D Climate Model/u, 'markup and entities are removed');
  assert.throws(() => parseZenodoRecord({ id: 'x', metadata: { title: 'T' } }), /id must be a record number/u);
  assert.throws(() => parseZenodoRecord({ id: 1, metadata: { title: 'T' }, files: [{ key: 'a.nc', size: '9' }] }), /files\[0\]\.size must be a whole number of bytes/u);
  assert.throws(() => parseZenodoSearch({ hits: [] }), /hits/u);
});

test('a planet is matched with and without the space before its letter, as a phrase and never inside another word', () => {
  assert.deepEqual(nameForms(['TRAPPIST-1e', 'TRAPPIST-1 e', 'Proxima Centauri']), ['TRAPPIST-1e', 'TRAPPIST-1 e', 'Proxima Centauri']);
  assert.deepEqual(nameForms(['HD 189733 b']), ['HD 189733b', 'HD 189733 b']);
  // A star's own name does not end in a planet letter after a digit: "Proxima b" is left as written.
  assert.deepEqual(nameForms(['Proxima b', ' ']), ['Proxima b']);
  assert.equal(namesObject({ title: 'Simulations of TRAPPIST-1 e', description: '' }, ['TRAPPIST-1e']), true);
  assert.equal(namesObject({ title: 'The TRAPPIST-1 system', description: 'Planets b to h.' }, ['TRAPPIST-1e']), false);
  assert.equal(namesObject({ title: 'Wasps of the genus S2X', description: '' }, ['S2']), false);
  assert.equal(speaksOfSimulation({ title: 'Transmission spectroscopy with NIRSpec', description: 'Software and data to reproduce figures.' }), false);
  assert.equal(speaksOfSimulation({ title: 'GCM output', description: '' }), true);
  assert.match(zenodoQuery(['TRAPPIST-1e']), /^https:\/\/zenodo\.org\/api\/records\?q=%22TRAPPIST-1e%22\+OR\+%22TRAPPIST-1\+e%22&type=dataset&size=25&sort=bestmatch$/u);
});

test('only a license known to allow a derived picture counts as reuse', () => {
  assert.deepEqual(reuseLicense('cc-by-4.0'), { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' });
  assert.equal(reuseLicense('CC-BY-NC-4.0')?.name, 'CC BY-NC 4.0');
  assert.equal(reuseLicense('cc-by-nc-nd-4.0'), null, 'no derivatives');
  assert.equal(reuseLicense('other-open'), null);
  assert.equal(reuseLicense(null), null);
});

test('the survey lists the records that name the object and speak of a model, saves its report and downloads nothing', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'simulations-')), asked: string[] = [];
  try {
    const body = await served();
    const result = await searchSimulations(WORKSPACE, { target: 'trappist-1e', directory, fetcher: (async (url: string | URL | Request) => { asked.push(String(url)); return answering(body)(url); }) as typeof fetch });
    assert.deepEqual(result.target, { id: 'trappist-1e', name: 'TRAPPIST-1e' });
    assert.equal(asked.length, 1, 'one search request, no file request');
    assert.equal(result.naming, 4);
    assert.deepEqual(result.records.map(record => record.id), ['5532765', '7752337', '10209661']);
    assert.ok(result.records.every(record => record.reuse?.name === 'CC BY 4.0'));
    assert.deepEqual(JSON.parse(await readFile(resolve(directory, 'simulations.json'), 'utf8')), JSON.parse(JSON.stringify(result)));
    const text = formatSimulations(result, directory);
    assert.match(text, /^TRAPPIST-1e · 3 simulation records among 4 Zenodo datasets that name it\n/u);
    assert.match(text, /DOI: 10\.5281\/zenodo\.7752337 · license: CC BY 4\.0, reuse allowed\n   5 files, 37\.3 GB: drytrap\.nc \(4\.1 GB\), warmprox\.nc \(10\.1 GB\), controlprox\.nc \(10\.1 GB\) and 2 more/u);
    assert.match(text, /A listed record is a lead, not a dataset/u);
    // A license that forbids derivatives, and a record that states none, are said so.
    const records = parseZenodoSearch(body), nd = { ...records[4]!, reuse: reuseLicense(records[4]!.license) }, bare = { ...records[0]!, license: null, reuse: null };
    assert.match(formatSimulations({ ...result, records: [nd, bare] }), /license: cc-by-nc-nd-4\.0, not one this tool knows allows reuse[\s\S]*license: none stated/u);
    const none = await searchSimulations(WORKSPACE, { target: 'An Unpackaged Star', fetcher: answering({ hits: { hits: [] } }) });
    assert.match(formatSimulations(none), /No Zenodo dataset names this object and speaks of a simulation or a model\./u);
    await assert.rejects(searchSimulations(WORKSPACE, { target: 'trappist-1e', fetcher: answering({}, 429) }), /Zenodo returned HTTP 429 for https:\/\/zenodo\.org\/api\/records\?q=/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('the command takes one object and an optional directory', () => {
  assert.deepEqual(parseCli(['simulations', 'TRAPPIST-1e', '--json']), { command: 'simulations', target: 'TRAPPIST-1e', json: true, verbose: false });
  assert.throws(() => parseCli(['simulations']), { message: 'Use telescope simulations OBJECT [--json] [--out DIRECTORY].' });
  assert.throws(() => parseCli(['simulations', 'a', '--host', 'b']), /Unknown or repeated simulations option --host/u);
  assert.equal(sizeText(53362040), '53.4 MB');
  assert.equal(sizeText(999), '999 bytes');
});
