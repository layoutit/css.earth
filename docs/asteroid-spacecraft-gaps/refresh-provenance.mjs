import {readFile,writeFile} from 'node:fs/promises';
import {OBJECTS} from '../../site/objects.mjs';
import {recoverObjectProvenance} from '../../tools/prepare-provenance.mjs';
const base='docs/asteroid-spacecraft-gaps';
const ids=['annefrank','braille'];
const added=await recoverObjectProvenance(ids,{verify:true});
const baseline=await recoverObjectProvenance(OBJECTS.map(body=>body.id).filter(id=>!ids.includes(id)),{verify:false});
await writeFile(`${base}/final-provenance.json`,JSON.stringify({scope:'New body source and output bytes verified; baseline records recovered from existing manifest pins.',added,baseline},null,2)+'\n');
console.log('Provenance:',added.length,'verified additions;',baseline.length,'baseline records recovered');
