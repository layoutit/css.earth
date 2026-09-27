/** Restore only the oracle's selected body inputs through existing acquisition
 * plans. Never acquire a whole body's maps or overwrite changed source bytes. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { acquisitionOperations, readOracleFixture, readOracleInput, ORACLE_ROOT } from '../fixture.mts';

export async function restoreInputs() {
  const fixture=await readOracleFixture('sbmt/projection.json');
  for(const input of fixture.inputs){
    try{await readOracleInput(input);continue;}
    catch(error){
      if(!(error instanceof Error)||!(error.cause instanceof Error)||!('code' in error.cause)||error.cause.code!=='ENOENT')throw error;
    }
    const match=/^src\/objects\/([a-z0-9-]+)\/source\/(.+)$/.exec(input.path);
    if(!match)throw new Error(`Missing checked-in oracle fixture ${input.path}`);
    const sourceRoot=resolve(ORACLE_ROOT,'src/objects',match[1],'source');
    const {parseSourceManifest,parseAcquisitionPlan,executeAcquisition}=await acquisitionOperations();
    const manifest=parseSourceManifest(JSON.parse(await readFile(resolve(sourceRoot,'manifest.json'),'utf8')),match[1]);
    const plan=parseAcquisitionPlan(JSON.parse(await readFile(resolve(sourceRoot,'preparation/acquisition.json'),'utf8')));
    const operations=plan.operations.filter(step=>'path' in step&&step.path===match[2]);
    if(operations.length!==1||operations[0].kind!=='download')throw new Error(`SBMT oracle requires one bounded download for ${input.path}`);
    console.log(`Restore ${input.path} (${input.bytes} bytes)`);
    await executeAcquisition({sourceRoot,manifest,plan:{...plan,operations:operations.map(step=>({...step,groups:['sbmt-oracle']}))},group:'sbmt-oracle',
      transport:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(120_000)})}});
    await readOracleInput(input);
  }
}
