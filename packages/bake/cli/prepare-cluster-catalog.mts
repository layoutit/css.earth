// Entry script: `node packages/bake/cli/prepare-cluster-catalog.mts <object-directory>`. Prepares the galaxy-cluster
// catalogue object; the work is in @cssearth/bake/cluster-catalog.
import { prepareClusterCatalogObject } from '@cssearth/bake/cluster-catalog';

if (!process.argv[2] || process.argv[3]) throw new TypeError('Usage: prepare-cluster-catalog <object-directory>');
await prepareClusterCatalogObject({ objectDirectory: process.argv[2] });
