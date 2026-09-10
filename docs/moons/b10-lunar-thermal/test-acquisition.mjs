// Use the repository preparation-test bundling policy for the changed entries.
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const require=createRequire(resolve('packages/engine/package.json'));
const {build}=createRequire(require.resolve('tsup'))('esbuild');
const out=resolve('.local/b10-acquisition-tests');await mkdir(out,{recursive:true});
const files=[];
for(const [index,entry] of ['tools/objects/operations-acquisition.test.ts','tests/objects/operations.test.ts'].entries()){
 const outfile=resolve(out,index+'.test.mjs');
 await build({entryPoints:[resolve(entry)],outfile,bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',plugins:[{name:'retain-native-modules',setup(builder){builder.onResolve({filter:/\.mjs$/},args=>({path:resolve(args.resolveDir,args.path),external:true}));}}]});files.push(outfile);
}
const r=spawnSync(process.execPath,['--test','--test-concurrency=1',...files],{stdio:'inherit'});if(r.error)throw r.error;process.exitCode=r.status??1;
