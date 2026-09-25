/** Every archive ledger's tracked output is what its own code writes: the guide page is the ledger rendered, and the JSON is
 * the ledger serialised at that archive's indent. A ledger is tracked provenance, so a change to how any archive parses,
 * renders or writes its ledger shows here as a byte difference in a file someone reads. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();

const repository = resolve(import.meta.dirname, '../../..');
interface Tracked { readonly archive: string; readonly ledger: string; readonly guide: string; readonly indent: number; readonly render: (value: unknown) => Promise<string> }
const TRACKED: readonly Tracked[] = [
  { archive: 'chandra', ledger: 'data/chandra/ledger.json', guide: 'docs/chandra-ledger.md', indent: 2,
    render: async value => { const m = await import('../chandra/archive-ledger.mts'); return m.ledgerGuide(m.parseLedger(value)); } },
  { archive: 'gemini', ledger: 'data/gemini/ledger.json', guide: 'docs/gemini-ledger.md', indent: 2,
    render: async value => { const m = await import('../gemini/archive-ledger.mts'); return `${m.ledgerMarkdown(value as Parameters<typeof m.ledgerMarkdown>[0])}\n`; } },
  { archive: 'hst', ledger: 'data/hst/ledger.json', guide: 'docs/hubble-ledger.md', indent: 2,
    render: async value => { const m = await import('../hst/archive-ledger.mts'); return m.ledgerGuide(m.parseLedger(value)); } },
  { archive: 'juno', ledger: 'data/juno/ledger.json', guide: 'docs/junocam-ledger.md', indent: 2,
    render: async value => { const m = await import('../juno/archive-ledger.mts'); return m.ledgerGuide(value as Parameters<typeof m.ledgerGuide>[0]); } },
  { archive: 'jwst', ledger: 'data/jwst/ledger.json', guide: 'docs/jwst-ledger.md', indent: 1,
    render: async value => { const m = await import('../jwst/archive-ledger.mts'); return m.ledgerGuide(m.parseLedger(value)); } },
  { archive: 'keck', ledger: 'data/keck/ledger.json', guide: 'docs/keck-ledger.md', indent: 2,
    render: async value => { const m = await import('../keck/archive-ledger.mts'); return m.ledgerGuide(value as Parameters<typeof m.ledgerGuide>[0]); } },
  { archive: 'naco', ledger: 'data/naco/ledger.json', guide: 'docs/naco-ledger.md', indent: 2,
    render: async value => { const m = await import('../naco/archive-ledger.mts'); return m.ledgerGuide(m.parseLedger(value)); } },
  { archive: 'spitzer', ledger: 'data/spitzer/ledger.json', guide: 'docs/spitzer-ledger.md', indent: 2,
    render: async value => { const m = await import('../spitzer/archive-ledger.mts'); return m.ledgerGuide(m.parseLedger(value)); } },
];

for (const tracked of TRACKED) test(`the ${tracked.archive} ledger's tracked guide and JSON are the bytes its code writes`, async () => {
  const text = await readFile(resolve(repository, tracked.ledger), 'utf8'), value: unknown = JSON.parse(text);
  assert.equal(`${JSON.stringify(value, null, tracked.indent)}\n`, text, `${tracked.ledger} is not serialised at indent ${tracked.indent}`);
  assert.equal(await tracked.render(value), await readFile(resolve(repository, tracked.guide), 'utf8'), `${tracked.guide} is not ${tracked.ledger} rendered`);
});
