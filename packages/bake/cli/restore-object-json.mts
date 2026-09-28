// Entry script: node packages/bake/cli/restore-object-json.mts [<object-id>…] [--restored-only]. Writes each scene body's
// pinned `prepared/object.json` and `prepared/page.json` from its restored runtime, in the checkout it runs in; the work is
// `restoreObjectJson` in @cssearth/bake/asset-publication.
import { restoreObjectJson } from '@cssearth/bake/asset-publication';

const args = process.argv.slice(2);
const restoredOnly = args.includes('--restored-only');
const ids = args.filter(arg => arg !== '--restored-only');
console.log(JSON.stringify(await restoreObjectJson(ids.length ? ids : undefined, undefined, { restoredOnly })));
