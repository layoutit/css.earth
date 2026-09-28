#!/usr/bin/env node
// Entry script: node packages/bake/cli/prepare-scientific-charts.mts [--planet=<id>]. The work is in @cssearth/bake/site-assets.
import { prepareScientificCharts } from '@cssearth/bake/site-assets';

const planetArgument = process.argv.find((argument) =>
  argument.startsWith("--planet="));
const planetIds = planetArgument ? [planetArgument.slice("--planet=".length)] : undefined;
const outputs = await prepareScientificCharts({ planetIds });
console.log(`Prepared ${outputs.length} source-backed scientific charts.`);
