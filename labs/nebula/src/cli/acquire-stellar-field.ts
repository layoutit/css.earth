import { acquireFieldCatalogue } from '../stars/acquire-field-catalogue';
const [evidencePath, extra] = process.argv.slice(2);
if (!evidencePath || extra) throw new TypeError('Usage: acquire-stellar-field <stellar-sources.json>');
console.log(JSON.stringify({ status: 'STELLAR_CATALOGUE_READY', ...await acquireFieldCatalogue(process.cwd(), evidencePath) }));
