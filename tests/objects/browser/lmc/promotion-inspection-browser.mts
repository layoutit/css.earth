/**
 * App acceptance inspection for the promoted LMC volume lens bank: Earth view, oblique view, both exact
 * 90-degree side views, every lens switch and stars on and off, reached by label fly-to like the SMC's.
 *
 * Usage: node tests/objects/browser/lmc/promotion-inspection-browser.mts [baseUrl] [outputDirectory]
 */
import { resolve } from 'node:path';
import { inspectVolumeLensBank } from '../volume-lens-bank/promotion-inspection.mts';

await inspectVolumeLensBank('lmc', process.argv[2] ?? 'http://127.0.0.1:4210', resolve(process.argv[3] ?? 'src/objects/lmc/evidence/promotion'));
