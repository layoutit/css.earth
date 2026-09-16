import { prepareOpticalComposite } from '../../server/workflows/compiler/optical-composite-preparation.ts';
const [recipe, flag, extra] = process.argv.slice(2);
if (!recipe || extra || flag && flag !== '--preview-only') throw new TypeError('Usage: prepare-optical-composite <recipe.json> [--preview-only]');
const result = await prepareOpticalComposite(process.cwd(), recipe, flag === '--preview-only', message => console.log(message));
console.log(JSON.stringify({ status: flag === '--preview-only' ? 'OPTICAL_COMPOSITE_PREVIEW_READY' : 'OPTICAL_COMPOSITE_READY', id: result.id, directory: result.directory, fit: result.fit }));
