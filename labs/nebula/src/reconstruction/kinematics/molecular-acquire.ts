import { acquireMolecularSources } from './molecular-source.js';
const [recipePath, ...options] = process.argv.slice(2);
if (!recipePath || options.some(option => option !== '--paper')) throw new TypeError('Usage: molecular-acquire <model-kinematics.json> [--paper]');
console.log(JSON.stringify(await acquireMolecularSources(process.cwd(), recipePath, { includePaper: options.includes('--paper') })));
