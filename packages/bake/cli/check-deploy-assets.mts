// Entry script: `pnpm check:deploy-assets`. The check is in @cssearth/bake/asset-publication.
import { checkDeployAssets } from '@cssearth/bake/asset-publication';

const result = await checkDeployAssets();
console.log(`Verified ${result.urls} emitted runtime asset URL(s) across ${result.files} deploy file(s).`);
