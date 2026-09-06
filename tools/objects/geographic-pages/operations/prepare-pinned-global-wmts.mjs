import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {preparePinnedGlobalWmts as prepareHierarchy} from '../pinned-hierarchy.mjs';
import {createOperationContext,commandContext,projectDirectory} from './context.mjs';

/** Operational JSON publication around the shared source-verified hierarchy capability. */
export async function preparePinnedGlobalWmts({objectId,projectRoot=projectDirectory,scene,pages,
  writeOutput=true,verifyOnly=false,onProgress=()=>{}}={}) {
  const context=createOperationContext({objectId,projectRoot});
  pages??=(await context.readSource('preparation/paged-ellipsoid.json')).geographic.pages;
  const result=await prepareHierarchy({sourceRoot:context.sourceRoot,packDirectory:context.projectPath('.local/wmts-global'),pages,
    scene:scene??await context.readPrepared('scene'),namespace:objectId,displayName:objectId,assetPath:context.assetPath,verifyOnly,onProgress});
  if(verifyOnly)return result;
  const jsonSource=JSON.stringify(result.plan)+'\n';
  if(writeOutput)await context.writePrepared('pages',result.plan);
  return {...result,jsonSource,report:{...result.report,jsonSha256:createHash('sha256').update(jsonSource).digest('hex')}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const context=commandContext();if(context.args.some(arg=>arg!=='--verify-only'))throw new Error('Use --object=<id> [--verify-only].');
  const result=await preparePinnedGlobalWmts({objectId:context.objectId,verifyOnly:context.args.includes('--verify-only'),onProgress:progress=>console.log(JSON.stringify(progress))});
  console.log(JSON.stringify(result.report));
}
