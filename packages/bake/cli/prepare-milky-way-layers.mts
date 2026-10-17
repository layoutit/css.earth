import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Authoring is an executable leaf, never an imported production dependency.
const result=spawnSync(process.execPath,[fileURLToPath(new URL('../authoring/milky-way-dust/prepare-layers.mts',import.meta.url)),...process.argv.slice(2)],{stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
