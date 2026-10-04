/** Report investigation decisions and missing ledgers from the same descriptors that generate OBJECTS, or with --facilities from
 * the facilities catalogue's ground telescopes and their ledgers under src/facilities.
 * Usage: node packages/bake/cli/report-investigations.mts [--facilities] [--classification=asteroid] [--status=deferred,unresolved] [--search=registration] [--summary] [--json]
 *        node packages/bake/cli/report-investigations.mts --index [--write]
 *
 * `--index` renders the open-work index: every unresolved or deferred decision grouped by what is being waited on, so the
 * next piece of work is chosen from the record instead of memory. `--write` refreshes the committed copy.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  INVESTIGATION_INDEX_FILE, formatInvestigationIndex, formatInvestigationReport, groundFacilities,
  investigationOptions, investigationReport, readFacilityLedgers, readInvestigationLedgers,
} from '@cssearth/bake/sources';
import { INVESTIGATION_STATUSES } from '@cssearth/objects';
import { readCatalog } from '@cssearth/objects/node';
import { prepareSceneDistance } from '@cssearth/bake/navigation';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = checkoutProjectRoot(import.meta.url), options = investigationOptions(process.argv.slice(2));
  if (options.facilities) {
    const [facilities, ledgers] = await Promise.all([groundFacilities(root), readFacilityLedgers(root)]);
    const report = investigationReport(facilities, ledgers.map(ledger => ({ schema: ledger.schema, objectId: ledger.facilityId, entries: ledger.entries })), options);
    console.log(options.json ? JSON.stringify(report, null, 2)
      : formatInvestigationReport(report, options.summary).replace(/catalogued objects have ledgers/u, 'ground facilities have ledgers').trimEnd());
    process.exit(0);
  }
  const [objects, ledgers] = await Promise.all([readCatalog(resolve(root, 'src/objects'), prepareSceneDistance), readInvestigationLedgers(root)]);
  // The index covers every recorded decision, so its status filter is not the report's.
  const report = investigationReport(objects, ledgers, options.index ? { ...options, statuses: [...INVESTIGATION_STATUSES] } : options);
  if (options.index) {
    const text = formatInvestigationIndex(report);
    if (!options.write) { console.log(text.trimEnd()); }
    else {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(resolve(root, INVESTIGATION_INDEX_FILE), text);
      console.log(`${INVESTIGATION_INDEX_FILE}: ${report.counts.unresolved + report.counts.deferred} open decisions`);
    }
  } else console.log(options.json ? JSON.stringify(report, null, 2) : formatInvestigationReport(report, options.summary).trimEnd());
}
