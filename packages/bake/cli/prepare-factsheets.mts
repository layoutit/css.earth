// Entry script: node packages/bake/cli/prepare-factsheets.mts [--check] [--quiet] [<object-id>...]. Re-publishes the authored facts
// of the checkout it runs in; the work is `prepareFactsheets` in @cssearth/bake/contract.
import { prepareFactsheets } from '@cssearth/bake/contract';

const check = process.argv.includes('--check'), quiet = process.argv.includes('--quiet');
const ids = process.argv.slice(2).filter(id => !['--', '--check', '--quiet'].includes(id));
const results = await prepareFactsheets({ ids, check });
console.log(JSON.stringify({ check, objects: results.length, facts: results.reduce((sum, body) => sum + body.count, 0), ...(quiet ? {} : { results }) }));
