// Entry script: node packages/bake/cli/prepare-objects.mts [--concurrency=<n>] [--object=<id>...]. The work is in
// @cssearth/bake/prepare-objects.
import { prepareObjects } from '@cssearth/bake/prepare-objects';

const options: { concurrency?: number; objectIds?: string[] } = {};
for (const argument of process.argv.slice(2)) {
  if (argument === "--") continue;
  if (argument.startsWith("--concurrency=")) options.concurrency = Number(argument.slice("--concurrency=".length));
  else if (argument.startsWith("--object=")) (options.objectIds ??= []).push(argument.slice("--object=".length));
  else throw new Error(`Unknown preparation argument: ${argument}`);
}
await prepareObjects(options);
