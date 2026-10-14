import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { displayPath, formatExploration, shellWord } from './cli-format.mts';
import { explorationSummary } from './cli-summary.mts';
import { archiveLabel } from './cli-archive.mts';
import type { ExplorationChoice } from './exploration.mts';
import type { ExplorationSession } from './session.mts';

const source: ExplorationChoice = {
  pick: 1, key: 'source', state: 'qualify', telescope: 'Source archive', mode: 'FITS/image', observation: 'matisse-2018-continuum', program: 'source',
  reference: { kind: 'indexed-observation', telescope: 'Source archive', mode: 'FITS/image', observation: 'matisse-2018-continuum', programme: 'source' },
  familyEvidence: { schema: 'cssearth-observation-family-evidence@1', families: ['F01'], status: 'mapped', sourceTerm: 'image', vocabulary: 'IVOA product-type', vocabularyVersion: '1.1', owner: { kind: 'source-product', id: 'source', evidence: 'fixture' } },
  display: { instrument: 'Source archive / FITS/image', observationTime: { startIso: null, endIso: null }, productKind: 'image', wavelengthsMicrometres: [], advertisedKilobytes: null, metadataBasis: 'indexed' },
  reason: 'Needs qualification.', limitations: ['Fixture limitation.'],
};
const choices: readonly ExplorationChoice[] = [source,
  { ...source, pick: 2, key: 'alma', telescope: 'JAO', archiveService: 'https://almascience.eso.org/tap', display: { ...source.display, instrument: 'ALMA', wavelengthsMicrometres: [2955.04768, 3010.65895] } },
  { ...source, pick: 3, key: 'eso', telescope: 'ESO-VLT-U2', archiveService: 'https://archive.eso.org/tap_obs', display: { ...source.display, instrument: 'unknown', productKind: null, wavelengthsMicrometres: [null, null] } },
  { ...source, pick: 4, key: 'hst', telescope: 'HST', archiveService: 'https://mast.stsci.edu/vo-tap/api/v0.1/caom/', state: 'ready', display: { ...source.display, instrument: 'HST camera' } },
  { ...source, pick: 5, key: 'jwst', telescope: 'JWST', archiveService: 'https://mast.stsci.edu/vo-tap/api/v0.1/caom/', display: { ...source.display, instrument: 'JWST camera' } },
];
const session: ExplorationSession & { readonly directory: string } = {
  schema: 'cssearth-telescope-exploration@1', createdAt: '2026-10-14T00:00:00Z', arguments: ['Betelgeuse'], target: 'betelgeuse', choices,
  directory: resolve(homedir(), 'Library/Caches/fixture/run'),
  answer: { schema: 'cssearth-telescope-exploration@1', target: 'betelgeuse', request: { target: 'betelgeuse' },
    targetResolution: { status: 'resolved', requested: 'Betelgeuse', canonical: { id: 'betelgeuse', name: 'Betelgeuse' }, matchedBy: 'name' },
    outcome: { selection: 'available', coverage: 'incomplete' }, choices, unsupported: [], unresolved: [], issues: [], services: [], coverage: [] },
};

test('human archive labels resolve service URLs, source rows show product identities and unknowns use em dashes', () => {
  const screen = formatExploration(session);
  assert.match(screen, /Source archive 1, ALMA 1, ESO 1, MAST\/HST 1, JWST 1/u);
  assert.doesNotMatch(screen, /https:|Source archive \/ FITS|unknown|qualify/u);
  assert.match(screen, /matisse-2018-continuum\s+—\s+image\s+—\s+needs check/u);
  assert.match(screen, /3\s+ESO\s+—\s+—\s+—\s+—\s+needs check/u);
  assert.match(screen, /2\.96–3\.01 mm/u);
  assert.match(screen, /4\s+MAST\/HST.*ready/u);
  assert.match(screen, /\n\n#  Archive/u);
  assert.match(screen, /needs check\n\nSearch coverage is incomplete; results may be incomplete\./u);
  assert.match(screen, /details: --verbose\nSaved: ~\/Library\/Caches\/fixture\/run\/explore\.json\nNext: telescope get ~\/Library\/Caches\/fixture\/run --pick N/u);
  assert.equal(screen.split('explore.json').length - 1, 1);
  assert.deepEqual(explorationSummary(session).choices.map(choice => choice.archive), choices.map(choice => choice.archiveService ?? choice.telescope));
  assert.deepEqual(explorationSummary(session).choices.map(choice => choice.state), choices.map(choice => choice.state));
  assert.equal(archiveLabel({ telescope: 'MAST', archiveService: choices[3]!.archiveService }), 'MAST');
});

test('bounded coverage has no warning and column widths follow displayed content with two-space separators', () => {
  const screen = formatExploration({ ...session, choices: [source], answer: { ...session.answer, outcome: { selection: 'available', coverage: 'bounded' } } });
  assert.doesNotMatch(screen, /Coverage:|archives did not answer|scientific acceptance/u);
  const lines = screen.split('\n'), heading = lines.find(line => line.startsWith('#'))!, first = lines.find(line => line.startsWith('1 '))!;
  assert.ok(heading.startsWith('#  Archive')); assert.ok(first.startsWith('1  Source archive'));
  assert.equal(heading.indexOf('Instrument'), first.indexOf('matisse'));
  const wider = formatExploration({ ...session, choices: [{ ...source, pick: 123, display: { ...source.display, instrument: 'long '.repeat(50) }, telescope: 'Fixture' }] });
  assert.ok(wider.split('\n').find(line => line.startsWith('#'))!.startsWith('#    Archive'));
  assert.ok(wider.split('\n').find(line => line.startsWith('123'))!.length <= 100);
  assert.match(wider, /…/u);
});

test('ALMA shows saved receiver or instrument names and a dash when only the archive is known', () => {
  const alma = choices[1]!;
  for (const [instrument, expected] of [['Band 3', 'Band 3'], ['Receiver 7', 'Receiver 7'], ['ALMA', '—'], ['', '—'], ['unknown', '—']]) {
    const selected = { ...alma, pick: 1, mode: 'ALMA', display: { ...alma.display, instrument } };
    const lines = formatExploration({ ...session, choices: [selected] }).split('\n');
    const heading = lines.find(line => line.startsWith('#'))!, entry = lines.find(line => line.startsWith('1 '))!;
    assert.equal(entry.slice(heading.indexOf('Instrument'), heading.indexOf('Date')).trim(), expected);
    assert.equal(selected.display.instrument, instrument, 'Saved evidence stays unchanged');
  }
});

test('human home paths abbreviate by directory boundary and suggested shell commands still expand them', () => {
  const path = resolve(homedir(), 'fixture with spaces/result.json');
  assert.equal(displayPath(path), '~/fixture with spaces/result.json');
  assert.ok(!displayPath(`${homedir()}-other/result.json`).startsWith('~'));
  const result = spawnSync('/bin/sh', ['-c', `set -- ${shellWord(displayPath(path))}; printf '%s' "$1"`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, path);
});
