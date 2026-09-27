// Entry script: node packages/bake/cli/publish-runtime-assets.mts [--object=<id> ...] [--since=<ref>] (`pnpm publish:runtime-assets`).
// The publication is in @cssearth/bake/asset-publication.
import { publishRuntimeAssets } from '@cssearth/bake/asset-publication';

const args = process.argv.slice(2), since = args.find(arg => arg.startsWith("--since="))?.slice("--since=".length);
await publishRuntimeAssets(args.filter(arg => !arg.startsWith("--since=")), since === undefined ? {} : { since });
