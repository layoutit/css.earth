/** Every archive ledger's tracked output is what its own code writes: the guide page is the ledger rendered, and the JSON is
 * the ledger serialised at that archive's indent. A ledger is tracked provenance, so a change to how any archive parses,
 * renders or writes its ledger shows here as a byte difference in a file someone reads. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { ledgerJson, type ArchiveLedger } from './ledger.mts';
const test = sourceTest();

const repository = resolve(import.meta.dirname, '../../..');
interface Tracked { readonly archive: string; readonly ledger: string; readonly guide: string; readonly indent: number; readonly rendersParsed?: false; readonly load: () => Promise<ArchiveLedger<unknown>> }
/** The tracked paths and indents are written out here rather than read from the definitions, so moving a ledger or changing
 * its indent fails this test instead of silently agreeing with itself. */
const TRACKED: readonly Tracked[] = [
  { archive: 'chandra', ledger: 'data/chandra/ledger.json', guide: 'docs/chandra-ledger.md', indent: 2, load: async () => (await import('../chandra/archive-ledger.mts')).CHANDRA_LEDGER as ArchiveLedger<unknown> },
  { archive: 'gemini', ledger: 'data/gemini/ledger.json', guide: 'docs/gemini-ledger.md', indent: 2, load: async () => (await import('../gemini/archive-ledger.mts')).GEMINI_LEDGER as ArchiveLedger<unknown> },
  { archive: 'hst', ledger: 'data/hst/ledger.json', guide: 'docs/hubble-ledger.md', indent: 2, load: async () => (await import('../hst/archive-ledger.mts')).HST_LEDGER as ArchiveLedger<unknown> },
  { archive: 'juno', ledger: 'data/juno/ledger.json', guide: 'docs/junocam-ledger.md', indent: 2, rendersParsed: false, load: async () => (await import('../juno/archive-ledger.mts')).JUNO_LEDGER as ArchiveLedger<unknown> },
  { archive: 'jwst', ledger: 'data/jwst/ledger.json', guide: 'docs/jwst-ledger.md', indent: 1, load: async () => (await import('../jwst/archive-ledger.mts')).JWST_LEDGER as ArchiveLedger<unknown> },
  { archive: 'keck', ledger: 'data/keck/ledger.json', guide: 'docs/keck-ledger.md', indent: 2, load: async () => (await import('../keck/archive-ledger.mts')).KECK_LEDGER as ArchiveLedger<unknown> },
  { archive: 'naco', ledger: 'data/naco/ledger.json', guide: 'docs/naco-ledger.md', indent: 2, load: async () => (await import('../naco/archive-ledger.mts')).NACO_LEDGER as ArchiveLedger<unknown> },
  { archive: 'spitzer', ledger: 'data/spitzer/ledger.json', guide: 'docs/spitzer-ledger.md', indent: 2, load: async () => (await import('../spitzer/archive-ledger.mts')).SPITZER_LEDGER as ArchiveLedger<unknown> },
];

for (const tracked of TRACKED) test(`the ${tracked.archive} ledger's tracked guide and JSON are the bytes its code writes`, async () => {
  const archive = await tracked.load(), text = await readFile(resolve(repository, tracked.ledger), 'utf8'), value: unknown = JSON.parse(text);
  assert.deepEqual([archive.files.ledger, archive.files.guide, archive.indent], [resolve(repository, tracked.ledger), resolve(repository, tracked.guide), tracked.indent]);
  assert.equal((value as { schema?: unknown }).schema, archive.schema, `${tracked.ledger} states another schema`);
  assert.equal(ledgerJson(archive, value), text, `${tracked.ledger} is not serialised at indent ${tracked.indent}`);
  // A ledger with a local pass is read back through its own parser, as --local reads it; the others are rendered as stored.
  // JunoCam's parser leaves out the object states and receipt problems its local pass recomputes, so it renders as stored.
  const ledger = archive.local && tracked.rendersParsed !== false ? archive.local.parse(value) : value;
  assert.equal(archive.guide(ledger), await readFile(resolve(repository, tracked.guide), 'utf8'), `${tracked.guide} is not ${tracked.ledger} rendered`);
});

test('a ledger pass writes under its archive policy, --local retakes only repository state, and receipt problems fail the run', async () => {
  const { mkdtemp, rm, writeFile } = await import('node:fs/promises'), { tmpdir } = await import('node:os');
  const { buildLedger, refreshLocalLedger, runArchiveLedger } = await import('./ledger.mts');
  const directory = await mkdtemp(resolve(tmpdir(), 'archive-ledger-'));
  const log = console.log, error = console.error, printed: string[] = [];
  console.log = (line: string) => { printed.push(line); }; console.error = (line: string) => { printed.push(`! ${line}`); };
  try {
    interface Fixture { schema: string; archive: number; state: string; problems: string[] }
    const archive: ArchiveLedger<Fixture> = {
      schema: 'fixture@1', files: { ledger: resolve(directory, 'data/ledger.json'), guide: resolve(directory, 'guide.md') }, indent: 1,
      guide: ledger => `archive ${ledger.archive}, state ${ledger.state}\n`, writes: 'with --write',
      survey: async args => ({ schema: 'fixture@1', archive: 7, state: args.join(' '), problems: [] }),
      local: { parse: value => value as Fixture, writes: 'always', refresh: async previous => ({ ...previous, state: 'retaken', problems: ['x.json: wrong'] }) },
      receiptProblems: ledger => ledger.problems, summary: (ledger, run) => [`${ledger.state} ${JSON.stringify(run)}`],
    };
    await runArchiveLedger(archive, ['dry']);
    await assert.rejects(readFile(archive.files.ledger, 'utf8'), /ENOENT/u);
    await runArchiveLedger(archive, ['--write']);
    assert.equal(await readFile(archive.files.ledger, 'utf8'), '{\n "schema": "fixture@1",\n "archive": 7,\n "state": "--write",\n "problems": []\n}\n');
    await writeFile(archive.files.ledger, JSON.stringify({ schema: 'fixture@1', archive: 9, state: 'old', problems: [] }));
    assert.deepEqual(await buildLedger(archive, ['--local']), { ledger: { schema: 'fixture@1', archive: 9, state: 'retaken', problems: ['x.json: wrong'] }, local: true });
    await runArchiveLedger(archive, ['--local']);
    assert.equal(await readFile(archive.files.guide, 'utf8'), 'archive 9, state retaken\n');
    assert.equal(process.exitCode, 1);
    assert.deepEqual(printed, ['dry {"local":false,"write":false}', '--write {"local":false,"write":true}', 'retaken {"local":true,"write":false}', '! RECEIPT x.json: wrong']);
    await refreshLocalLedger(archive);
  } finally { console.log = log; console.error = error; process.exitCode = 0; await rm(directory, { recursive: true, force: true }); }
});
