/** Runs the ledger command of every archive in the archive list, one after another, with the same arguments:
 *
 *   node packages/telescope-cli/src/archives/ledgers.mts --local            every ledger with the repository's own state retaken
 *   node packages/telescope-cli/src/archives/ledgers.mts [--write]          every archive surveyed again
 *   node packages/telescope-cli/src/archives/ledgers.mts keck espadons ...  only the ones named
 *
 * A star added after a ledger was built is "not-searched" in it until that ledger is built again; this builds them all. An
 * archive that fails does not stop the others, and the command exits 1 when any failed. The IHW and PDS ledgers take
 * arguments of their own, so they are named and not run.
 *
 * Read the diff before committing it. A `--local` pass takes the repository's state from this checkout, receipts under ignored
 * `output/` included: in a checkout without them Keck's ledger fell to "0 of 14 instruments reduced" (2026-10-06, where its
 * local pass took 235 s). */
import { spawnSync } from 'node:child_process';
import { WORKSPACE } from '@cssearth/telescope/node';
import { ARCHIVES } from './archives.mts';

const args = process.argv.slice(2), flags = args.filter(arg => arg.startsWith('--')), named = args.filter(arg => !arg.startsWith('--'));
const withLedger = ARCHIVES.filter(archive => archive.ledgerCommand), unknown = named.filter(id => !withLedger.some(archive => archive.id === id));
if (unknown.length || flags.some(flag => flag !== '--write' && flag !== '--local'))
  throw new TypeError(`Usage: ledgers.mts [${withLedger.filter(archive => archive.sharedLedgerCommand).map(archive => archive.id).join('|')} ...] [--write] [--local]`);
const failed: string[] = [];
for (const archive of withLedger.filter(archive => !named.length || named.includes(archive.id))) {
  if (!archive.sharedLedgerCommand) { console.log(`${archive.id}: run by hand, node ${archive.ledgerCommand}`); continue; }
  const started = Date.now();
  console.log(`${archive.id}: node ${archive.ledgerCommand} ${flags.join(' ')}`);
  const run = spawnSync(process.execPath, [archive.ledgerCommand!, ...flags], { cwd: WORKSPACE, stdio: 'inherit' });
  console.log(`${archive.id}: ${run.status === 0 ? 'done' : `failed (status ${run.status})`} in ${Math.round((Date.now() - started) / 1000)} s`);
  if (run.status !== 0) failed.push(archive.id);
}
if (failed.length) { console.error(`Failed: ${failed.join(', ')}.`); process.exitCode = 1; }
