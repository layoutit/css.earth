/** Removal checks for the adopted widths and the default l10 sampler. */
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LOCAL,need} from './inputs.mts';
const base=fileURLToPath(new URL('.',import.meta.url)),path=base+'depth-model.mts',changes=[['youngSigmaKpc:.15','youngSigmaKpc:1.7'],['gasSigmaKpc:.15','gasSigmaKpc:.1'],['dustSigmaKpc:.25','dustSigmaKpc:.205'],['fields.metadata.version===10?ADOPTED_LAYERS:L9_LAYERS','L9_LAYERS']],results=[];
for(const [from,to]of changes){const original=await readFile(path,'utf8');need(original.includes(from),'Missing adopted-width target');try{await writeFile(path,original.replace(from,to));const r=spawnSync(process.execPath,['--test',base+'adopted.test.mts'],{encoding:'utf8',timeout:30000});need(r.status!==null&&r.status>0&&/not ok/u.test(r.stdout),'A removed adopted width escaped the tests');results.push({change:from,caught:true});}finally{await writeFile(path,original);}}
await writeFile(`${LOCAL}versions/l10/mutations.json`,JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({sentinel:'L10_ADOPTED_WIDTH_REMOVALS_CAUGHT',results}));
