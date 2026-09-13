/** List open investigation entries across objects: what was deferred, left unresolved or excluded, and what would reopen each.
 * Usage: node tools/report-investigations.mts [--status=deferred,unresolved] */
import { fileURLToPath } from 'node:url';
import { INVESTIGATION_STATUSES, readInvestigationLedgers } from './investigation-ledger.mts';

const root = fileURLToPath(new URL('../', import.meta.url));
const option = process.argv.slice(2).find(argument => argument.startsWith('--status='));
const requested = option === undefined ? ['deferred', 'unresolved', 'excluded'] : option.slice('--status='.length).split(',');
// Keep the requested order: by default the decisions most likely to reopen come first.
const statuses = [...new Set(requested)].map(name => INVESTIGATION_STATUSES.find(status => status === name));
if (statuses.some(status => status === undefined)) throw new TypeError(`Choose statuses from ${INVESTIGATION_STATUSES.join(', ')}.`);
const ledgers = await readInvestigationLedgers(root);
for (const status of statuses) {
  const rows = ledgers.flatMap(ledger => ledger.entries.filter(entry => entry.status === status).map(entry => ({ objectId: ledger.objectId, entry })));
  console.log(`${status} (${rows.length})`);
  for (const { objectId, entry } of rows) {
    const last = entry.checked[entry.checked.length - 1];
    console.log(`- ${objectId}: ${entry.subject} [${entry.id}; checked ${last.date}${last.pr === undefined ? '' : `, #${last.pr}`}]`);
    if (entry.revisitWhen !== undefined) console.log(`  revisit when: ${entry.revisitWhen}`);
  }
}
