/**
 * App acceptance inspection for the promoted SMC volume lens bank.
 *
 * It opens the native `/sun/?focus=smc` route, captures the Earth view, an oblique view, both exact
 * 90-degree side views, a lens switch and stars on and off, and writes them with a machine-readable
 * record. The shared helper owns the navigation and the capture set.
 *
 * Usage: node tests/objects/browser/smc/promotion-inspection-browser.mts [baseUrl] [outputDirectory]
 */
import { resolve } from 'node:path';
import { inspectVolumeLensBank } from '../volume-lens-bank/promotion-inspection.mts';

await inspectVolumeLensBank('smc', process.argv[2] ?? 'http://127.0.0.1:4210', resolve(process.argv[3] ?? 'src/objects/smc/evidence/promotion'));
