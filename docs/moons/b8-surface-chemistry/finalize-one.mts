// Run after prepare-selected.mjs, in a fresh process to bound peak memory.
import {readFile} from 'node:fs/promises';
import {writeObjectJson} from '../../../tools/prepare-object-json.mts';
const id=process.argv[2];
if(!['io','ganymede','enceladus'].includes(id))throw new Error('Select one B8 body.');
const definition: unknown=JSON.parse(await readFile(`src/planets/${id}/prepared/runtime.json`,'utf8'));
console.log(JSON.stringify(await writeObjectJson(id,definition)));
