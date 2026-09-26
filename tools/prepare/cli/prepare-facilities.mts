// Entry script: node tools/prepare/cli/prepare-facilities.mts [--catalog-only] [--restored-only]. The work is in ../prepare-facilities.mts.
import { prepareFacilities } from '../prepare-facilities.mts';
import { RUNTIME_ASSET_ORIGIN } from '../../assets/source-mirror.mts';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--catalog-only' && arg !== '--restored-only'))
  throw new TypeError('Usage: node tools/prepare/cli/prepare-facilities.mts [--catalog-only] [--restored-only]');
// The real CLI entry point: opts into the mirror explicitly (the library defaults it off).
const { prepared, factsheets } = await prepareFacilities({ mirrorOrigin: RUNTIME_ASSET_ORIGIN,
  publish: args.includes('--catalog-only') ? 'catalogues' : true, restoredOnly: args.includes('--restored-only') });
console.log(`Prepared ${prepared.catalog.missions.length} missions, ${prepared.catalog.facilities.length} facilities and ${prepared.graph.datasets.length} dataset destinations.`);
console.log(`Factsheets: ${factsheets.facts} facts, each with its own citation.`);
