/**
 * App acceptance inspection for the promoted SMC volume lens bank.
 *
 * The shared nebula delivery run (`site/test/nebula-world-browser.mts`) reaches its
 * objects through the sidebar search. This inspection reaches the SMC the way the
 * shared run reaches a label fly-to, because two shell defects block the search
 * path here: `/sun/?focus=<id>` fails for any catalogue object whose host is a
 * positioned object ("Unknown physical host: lmc", also reproduced on the untouched
 * `carina_2` and `reticulum_2`), and the sidebar search returns no result rows in
 * this checkout. Both are recorded in the object's investigation ledger.
 *
 * It captures the Earth view, an oblique view, both exact 90-degree side views, a
 * lens switch and stars on and off, and writes them with a machine-readable record.
 *
 * Usage: node tests/objects/browser/smc/promotion-inspection-browser.mts [baseUrl] [outputDirectory]
 */
import { resolve } from 'node:path';
import { inspectVolumeLensBank } from '../volume-lens-bank/promotion-inspection.mts';

await inspectVolumeLensBank('smc', process.argv[2] ?? 'http://127.0.0.1:4210', resolve(process.argv[3] ?? 'src/objects/smc/evidence/promotion'));
