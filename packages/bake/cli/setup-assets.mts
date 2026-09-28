// Entry script: node packages/bake/cli/setup-assets.mts [--object=<id>…] [--location=public|prepared] [--metadata] [--allow-missing]
// (`pnpm setup:assets`). Restores the inventoried prepared files of the checkout it runs in from the asset host; the work is
// `setupAssets` in @cssearth/bake/asset-publication.
import { setupAssets } from '@cssearth/bake/asset-publication';

await setupAssets(process.argv.slice(2));
