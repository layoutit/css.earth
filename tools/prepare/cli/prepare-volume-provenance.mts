// Entry script: node tools/prepare/cli/prepare-volume-provenance.mts [--object=<id>]. The work is in ../prepare-volume-provenance.mts.
import { writeVolumeProvenance } from '../prepare-volume-provenance.mts';
import { RUNTIME_ASSET_ORIGIN } from '../../assets/source-mirror.mts';

const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => !/^--object=[a-z][a-z0-9-]*$/.test(arg)))
  throw new TypeError('Usage: prepare-volume-provenance [--object=<id>].');
// The real CLI entry point: opts into the mirror explicitly (the library defaults it off).
const results = await writeVolumeProvenance({ mirrorOrigin: RUNTIME_ASSET_ORIGIN,
  ...(args[0] === undefined ? {} : { objectId: args[0].slice(9) }) });
console.log(`Prepared volume presentation and provenance: ${results.length} objects, ${results.reduce((sum, result) => sum + result.controls.length, 0)} lenses.`);
