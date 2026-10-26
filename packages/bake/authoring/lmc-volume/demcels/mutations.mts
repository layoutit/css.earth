/** Delete each new numerical property and require its behavioral test to fail. */
import {readFile,writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import {need} from '../inputs.mts';
const tests=[fileURLToPath(new URL('./demcels.test.mts',import.meta.url)),fileURLToPath(new URL('../ionized/ionized.test.mts',import.meta.url))],mutations=[
 {file:'native.mts',before:'v*factor:NaN',after:'v:NaN',claim:'Removing the physical DN conversion fails.'},
 {file:'native.mts',before:'(num(h[k])+(block-1)/2)/block',after:'num(h[k])/block',claim:'Removing pixel-centre registration fails.'},
 {file:'area.mts',before:'x++',after:'x+=3',claim:'Replacing full-footprint integration with sparse sampling fails.'},
 {file:'survey.mts',before:'/.0001*d2',after:'/.0001',claim:'Removing the squared-distance transport factor fails.'},
 {file:'survey.mts',before:'Number.isFinite(sharp)?',after:'true?',claim:'Treating no-data as measured emission fails.'},
 {file:'mosaic.mts',before:'Number.isFinite(values[i])?20:0',after:'20',claim:'Removing the no-exposure boundary taper fails.'},
 {file:'offsets.mts',before:'delta:-e.difference',after:'delta:e.difference',claim:'Removing the signed overlap zero correction fails.'},
 {file:'../ionized/build.mts',before:'compactGain:totalBudget*(1-fraction)/compact',after:'compactGain:1',claim:'Adding diffuse light without redistributing the old gas budget fails.'},
 {file:'../ionized/build.mts',before:'return b/a;',after:'return 1;',claim:'Removing the conditional-depth inverse-square compensation fails.'},
 {file:'native.mts',before:'blank=constantPadding',after:'blank=v===0&&constantPadding',claim:'Ignoring nonzero synthetic padding fails.'},
 {file:'quality.mts',before:'return 1-x*x*(3-2*x);',after:'return 1;',claim:'Removing independent-survey rejection of false backgrounds fails.'}
],results=[];
for(const m of mutations){const path=fileURLToPath(new URL('./'+m.file,import.meta.url)),source=await readFile(path,'utf8');need(source.includes(m.before),'Removal target missing');try{await writeFile(path,source.replace(m.before,m.after));const r=spawnSync(process.execPath,['--test',...tests],{encoding:'utf8',timeout:10000});need(r.status!==0&&r.stdout.includes('not ok'),'Removed property did not fail');results.push({claim:m.claim,failedAsExpected:true});}finally{await writeFile(path,source);}}
console.log(JSON.stringify({sentinel:'DEM CELS REMOVAL CHECKS PASSED',results}));
