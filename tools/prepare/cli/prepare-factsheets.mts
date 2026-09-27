// Entry script: node tools/prepare/cli/prepare-factsheets.mts [--check] [--quiet] [<object-id>...]. The work is in ../prepare-factsheets.mts.
import { prepareFactsheets } from '../prepare-factsheets.mts';

const check = process.argv.includes('--check'), quiet = process.argv.includes('--quiet');
const ids = process.argv.slice(2).filter(id => !['--', '--check', '--quiet'].includes(id));
const results = await prepareFactsheets({ ids, check });
console.log(JSON.stringify({ check, objects: results.length, facts: results.reduce((sum, body) => sum + body.count, 0), ...(quiet ? {} : { results }) }));
