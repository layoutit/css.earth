/** Restore the pinned local NOX prerequisites without acquiring or processing an object. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareEnvironment } from '../../server/workflows/density/removal.ts';
import { readProcessingEnvironmentRecipe } from '../../server/workflows/density/processing-environment.ts';

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log('Usage: prepare-processing-environment [--python=<existing-venv-executable>]');
  console.log('Uses the canonical bake recipe package/model pins. Requires Python 3.9–3.12 with venv/pip on PATH.');
  console.log('Creates or verifies .local/open-star-removal; --python verifies an existing environment without installing packages.');
} else {
  if (args.length > 1 || args.some(arg => !arg.startsWith('--python=') || !arg.slice('--python='.length)))
    throw new TypeError('Usage: prepare-processing-environment [--python=<existing-venv-executable>]');
  const recipePath = 'labs/nebula/models/lmc/bake.json';
  const recipe = readProcessingEnvironmentRecipe(JSON.parse(await readFile(resolve(process.cwd(), recipePath), 'utf8')));
  const python = await prepareEnvironment(process.cwd(), recipe, args[0]?.slice('--python='.length));
  console.log(`NOX_MODEL_VERIFIED ${recipe.removal.model.path}`);
  console.log(`PROCESSING_PYTHON ${python}`);
}
