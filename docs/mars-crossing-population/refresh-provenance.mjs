import {readFile,writeFile} from 'node:fs/promises';
import {recoverObjectProvenance} from '../../tools/prepare-provenance.mjs';
const base='docs/mars-crossing-population';
const ids=['aethra','lyyli','hela','kemi','taurinensis'];
const added=await recoverObjectProvenance(ids,{verify:true});
const contexts=await recoverObjectProvenance(['sun'],{verify:false});
await writeFile(`${base}/final-provenance.json`,JSON.stringify({scope:'New body source and output bytes verified; changed Sun context record recovered from existing manifest pins. Other baseline provenance is retained unchanged.',added,contexts},null,2)+'\n');
console.log('Provenance:',added.length,'verified additions;',contexts.length,'changed context record recovered');
