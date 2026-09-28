// Entry script: node site/build/prepare/prepare-provenance.mts [<object-id>...] [--objects-only]. The work is `recoverObjectProvenance`
// in @cssearth/bake/objects/provenance; the catalogue compilation it rebuilds is the application's facilities catalogue.
import { recoverObjectProvenance } from '@cssearth/bake/objects/provenance';
import { prepareFacilities } from './prepare-facilities.mts';

const args = process.argv.slice(2), ids = args.filter(arg => arg !== '--objects-only');
const results = await recoverObjectProvenance(ids.length ? ids : null, { catalogue: !args.includes('--objects-only'), compile: prepareFacilities });
if (args.includes('--objects-only')) console.log(JSON.stringify({ objects: results.length }));
else for (const result of results) console.log(JSON.stringify(result));
