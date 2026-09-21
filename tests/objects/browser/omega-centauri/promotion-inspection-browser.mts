/** Inspect both Omega Centauri lenses in the shared application's native scene. */
import { resolve } from 'node:path';
import { inspectVolumeLensBank } from '../volume-lens-bank/promotion-inspection.mts';

await inspectVolumeLensBank('omega-centauri', process.argv[2] ?? 'http://127.0.0.1:4210',
  resolve(process.argv[3] ?? 'src/objects/omega-centauri/evidence/app-inspection'));
