// Entry script: node tools/prepare/cli/prepare-context-availability.mts [--strict]. The work is in ../prepare-context-availability.mts.
import { prepareContextAvailability } from '../prepare-context-availability.mts';

if (process.argv.slice(2).some(arg => arg !== '--strict')) throw new TypeError('Usage: prepare-context-availability [--strict]');
const { failures } = await prepareContextAvailability({ strict: process.argv.includes('--strict') });
console.log(failures.length ? failures.join('\n') : 'All prepared context packages are available.');
