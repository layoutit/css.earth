import { runObjectPreparation } from '../../../../tools/object-preparation.mjs';

await runObjectPreparation(new URL('../object.json', import.meta.url));
