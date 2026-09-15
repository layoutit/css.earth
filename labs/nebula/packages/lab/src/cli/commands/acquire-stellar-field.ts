import { acquireFieldCatalogue } from '../../server/workflows/stars/acquire-field-catalogue.ts';
const [evidencePath, extra] = process.argv.slice(2);
if (!evidencePath || extra) throw new TypeError('Usage: acquire-stellar-field <stellar-sources.json>');
console.log(JSON.stringify({ status: 'STELLAR_CATALOGUE_READY', ...await acquireFieldCatalogue(process.cwd(), evidencePath) }));
