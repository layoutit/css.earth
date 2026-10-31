import assert from 'node:assert/strict';import test from 'node:test';import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {installPreparedBank} from './install-transaction.mts';
test('a missing staged record after the data swap restores the prior bank and both records',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pleiades-install-'));try{
  const paths={live:join(root,'prepared'),stage:join(root,'staged'),backup:join(root,'backup'),object:join(root,'object.json'),stagedObject:join(root,'missing.json'),inventory:join(root,'inventory.json'),stagedInventory:join(root,'new-inventory.json')};
  await mkdir(paths.live);await mkdir(paths.stage);await writeFile(join(paths.live,'bank'),'previous');await writeFile(join(paths.stage,'bank'),'current');await writeFile(paths.object,'previous-object');await writeFile(paths.inventory,'previous-inventory');await writeFile(paths.stagedInventory,'current-inventory');
  await assert.rejects(installPreparedBank(paths),{code:'ENOENT'});assert.equal(await readFile(join(paths.live,'bank'),'utf8'),'previous');assert.equal(await readFile(paths.object,'utf8'),'previous-object');assert.equal(await readFile(paths.inventory,'utf8'),'previous-inventory');
 }finally{await rm(root,{recursive:true,force:true});}
});
