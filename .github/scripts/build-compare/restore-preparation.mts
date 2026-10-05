/** Restore prepared packages and only the selected preparation/prerender public inputs. */
import {resolve,join} from 'node:path';
import {copyFile,rename,stat,readdir} from 'node:fs/promises';
import {setupAssets,installRuntimeAssets} from '@cssearth/bake/asset-publication';
import {inventoryAssets} from '@cssearth/bake/delivery';
import {preparationUrls} from './preparation-inputs.mts';
import {args,isMain} from './records.mts';
export async function isolatePreparedWrites(root: string): Promise<void> {
  // The recipe republishes facts with writeFile. Detach those two files before it
  // runs: all other restored files remain hardlinked, and base output cannot change.
  for (const entry of await readdir(join(root, 'src/objects'), {withFileTypes:true})) {
    if (!entry.isDirectory()) continue;
    for (const name of ['content.json','panel.json']) {
      const file=join(root,'src/objects',entry.name,'prepared',name);
      const info=await stat(file).catch(()=>undefined);
      if (!info || info.nlink < 2) continue;
      const temporary=file+'.build-comparison-copy';
      await copyFile(file,temporary); await rename(temporary,file);
    }
  }
}
export async function restorePreparation(root: string): Promise<void> {
  await setupAssets(['--location=prepared'], root);
  await isolatePreparedWrites(root);
  const urls = await preparationUrls(root), requested = new Set(urls);
  const ids = [...new Set(urls.map(url => url.split('/')[2]!))];
  const assets = (await inventoryAssets(root, ids, {location:'public'})).filter(asset => requested.has(`/scenes/${asset.id}/${asset.filename}`));
  if (assets.length !== requested.size) throw new Error('Preparation inputs must all be published in their object inventory');
  const result = await installRuntimeAssets(assets, {allowMissing:false});
  console.log(`PREPARATION INPUTS PASS: ${assets.length} public source files (${assets.reduce((n,asset)=>n+asset.bytes,0)} bytes), ${result.reused} reused, ${result.installed} restored; no full scenes restore`);
}
if (isMain(import.meta.url)) {
  const flags = args(['--checkout']), root = flags.get('--checkout');
  if (!root) throw new Error('Usage: restore-preparation.mts --checkout <checkout>');
  await restorePreparation(resolve(root));
}
