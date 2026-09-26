// Entry script: node tools/prepare/cli/prepare-provenance.mts [<object-id>...] [--objects-only]. The work is in ../prepare-provenance.mts.
import { recoverObjectProvenance } from '../prepare-provenance.mts';

const args = process.argv.slice(2), ids = args.filter(arg => arg !== '--objects-only');
const results = await recoverObjectProvenance(ids.length ? ids : null, { catalogue: !args.includes('--objects-only') });
if (args.includes('--objects-only')) console.log(JSON.stringify({ objects: results.length }));
else for (const result of results) console.log(JSON.stringify(result));
