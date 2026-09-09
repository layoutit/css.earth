// Compile only the observation owners and reproduce their small chart outputs.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(resolve('package.json'));
const {build}=require('./node_modules/.pnpm/node_modules/esbuild');
const entries={'tools/objects/content/prepare.ts':'prepare-content','tools/objects/operations.ts':'operations','tools/objects/content/charts.ts':'prepare-charts','tools/objects/content/observations.test.ts':'observations.test','tools/objects/content/charts.test.ts':'charts.test'};
for(const [entry,name]of Object.entries(entries))await build({entryPoints:[entry],outfile:`output/b4-tests/${name}.mjs`,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'warning'});
const {prepareChartAssets}=await import('../../../output/b4-tests/prepare-charts.mjs');
const plan=JSON.parse(await readFile('docs/moons/b4-observations/preparation.json','utf8'));
const bodies=[];
for(const b of plan.results){
 const d=`src/planets/${b.body}/source`,out=`output/b4-tests/reproduced/${b.body}`;await mkdir(out,{recursive:true});
 const config=JSON.parse(await readFile(`${d}/content/charts.json`,'utf8'));
 await prepareChartAssets({sourceDirectory:d,publicDirectory:out,config});
 for(const a of b.outputs){const bytes=await readFile(`${out}/${a.url.split('/').at(-1)}`);assert.equal(bytes.length,a.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256,'Reproduced chart must match reviewed bytes');}
 bodies.push({id:b.body,outputsVerified:b.outputs.length});
}
await writeFile('docs/moons/b4-observations/reproduction.json',JSON.stringify({status:'PASS',environment:{platform:process.platform,architecture:process.arch,node:process.version},scope:'36 PNG/CSV outputs reproduced from retained inputs and recipes in the current preparation environment. Cross-platform font/raster byte identity is not claimed.',bodies,maxRssKiB:process.resourceUsage().maxRSS},null,2)+'\n');
console.log('Reproduced all 36 chart outputs from retained sources.');
