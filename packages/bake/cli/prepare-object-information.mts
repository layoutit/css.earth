// Entry script: node packages/bake/cli/prepare-object-information.mts [--verify-local] [<id>...]. Refreshes the object-information
// snapshots of the checkout it runs in (`data/object-information/`); the work is `prepareObjectInformation` in @cssearth/bake/sources.
import { prepareObjectInformation } from '@cssearth/bake/sources';

await prepareObjectInformation();
