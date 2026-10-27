import {readFile,rename,rm,writeFile} from 'node:fs/promises';
/** Install a fully staged bank and its records, restoring the prior state on a failed write. */
export async function installPreparedBank(paths:{live:string;stage:string;backup:string;object:string;stagedObject:string;inventory:string;stagedInventory:string}){
 const oldObject=await readFile(paths.object),oldInventory=await readFile(paths.inventory);let moved=false,installed=false;
 await rm(paths.backup,{recursive:true,force:true});
 try{
  await rename(paths.live,paths.backup);moved=true;await rename(paths.stage,paths.live);installed=true;
  await rename(paths.stagedObject,paths.object);await rename(paths.stagedInventory,paths.inventory);
 }catch(error){
  if(installed)await rm(paths.live,{recursive:true,force:true});if(moved)await rename(paths.backup,paths.live);
  await writeFile(paths.object,oldObject);await writeFile(paths.inventory,oldInventory);throw error;
 }
}
