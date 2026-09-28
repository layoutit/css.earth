/** A generated package's investigation ledger: every source the generator chose, as an included decision with the links it read.
 * An entry is written only when it has a link; a package whose choices name none keeps the scaffold's empty ledger, which the
 * ledger check refuses until a person records what was examined. */
import { INVESTIGATION_LEDGER_SCHEMA } from '@cssearth/bake/sources';
import { CHECKED } from './color.mts';
import { json, type PackageFiles } from './lens.mts';

export interface Decision { readonly id: string; readonly subject: string; readonly finding: string; readonly evidence?: readonly string[] }

const ADS = /\(((?:19|20)\d\d[A-Za-z&.]{2,}[0-9A-Za-z.]*[A-Z])\)/gu;

/** The links a sentence cites: its https addresses and the ADS pages of its bibcodes. */
export function citedLinks(text: string) {
  return [...text.matchAll(/https:\/\/[^\s)"'<>]+/gu)].map(match => match[0].replace(/[.,;]+$/u, ''))
    .concat([...text.matchAll(ADS)].map(match => `https://ui.adsabs.harvard.edu/abs/${match[1]}/abstract`));
}

/** Write the ledger of the decisions that have links. */
export function writeLedger(files: PackageFiles, id: string, decisions: readonly Decision[]) {
  const entries = decisions.flatMap(decision => {
    const evidence = [...new Set([...decision.evidence ?? [], ...citedLinks(decision.finding)])];
    return evidence.length ? [{ id: decision.id, subject: decision.subject, status: 'included', finding: decision.finding.replace(/\s+/gu, ' ').trim(), evidence, checked: [{ date: CHECKED }] }] : [];
  });
  if (entries.length) files.set(`src/objects/${id}/investigations.json`, json({ schema: INVESTIGATION_LEDGER_SCHEMA, objectId: id, entries }));
}
