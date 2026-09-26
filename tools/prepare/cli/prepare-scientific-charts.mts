#!/usr/bin/env node
// Entry script: node tools/prepare/cli/prepare-scientific-charts.mts [--planet=<id>]. The work is in ../prepare-scientific-charts.mts.
import { prepareScientificCharts } from '../prepare-scientific-charts.mts';

const planetArgument = process.argv.find((argument) =>
  argument.startsWith("--planet="));
const planetIds = planetArgument ? [planetArgument.slice("--planet=".length)] : undefined;
const outputs = await prepareScientificCharts({ planetIds });
console.log(`Prepared ${outputs.length} source-backed scientific charts.`);
