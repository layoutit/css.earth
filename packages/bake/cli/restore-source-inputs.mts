// Entry script: node packages/bake/cli/restore-source-inputs.mts [--object=<id>…] | --repository-volumes. Restores and verifies
// the declared source inputs of the checkout it runs in; the work is `restoreSourceInputs` in @cssearth/bake/asset-publication.
import { restoreSourceInputs } from '@cssearth/bake/asset-publication';

await restoreSourceInputs(process.argv.slice(2));
