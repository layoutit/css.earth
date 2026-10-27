import {writeFile,mkdir} from 'node:fs/promises';
import {loadCube} from './load-cube.mts';
import {loadInputs} from '../physics/config.mts';
import {fitColumn,columnFitPrototypePilot} from './fit.mts';
const root='src/objects/milky-way-pleiades-dust/source/inputs/column';await mkdir(root,{recursive:true});
const inputs=await loadInputs(),pilot=await columnFitPrototypePilot(inputs),fit=await fitColumn(await loadCube(root),inputs);
await writeFile(`${root}/column-NH.f32`,Buffer.from(fit.NH.buffer));await writeFile(`${root}/column-validity.u8`,fit.validity);
await writeFile(`${root}/column-fit.json`,JSON.stringify({success:true,metadata:fit.metadata,pilot},null,2)+'\n');
console.log('PLEIADES_COLUMN_READY');
