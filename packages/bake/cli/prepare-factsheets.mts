// Entry script: node packages/bake/cli/prepare-factsheets.mts [--check] [--quiet] [<object-id>...]. Re-publishes the authored facts
// of the checkout it runs in; the work is `prepareFactsheets` in @cssearth/bake/contract.
import { resolve } from 'node:path';
import { prepareFactsheets } from '@cssearth/bake/contract';

// The checkout this file lives in, not the caller's working directory.
const root = resolve(import.meta.dirname, '../../..');

const check = process.argv.includes('--check'), quiet = process.argv.includes('--quiet');
const ids = process.argv.slice(2).filter(id => !['--', '--check', '--quiet'].includes(id));
const results = await prepareFactsheets({ ids, check, root });
console.log(JSON.stringify({ check, objects: results.length, facts: results.reduce((sum, body) => sum + body.count, 0), ...(quiet ? {} : { results }) }));
