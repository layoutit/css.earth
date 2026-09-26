// Entry script: node tools/prepare/cli/prepare-moon-labels.mts [--refresh]. The work is in ../prepare-moon-labels.mts.
import { prepareMoonLabels } from '../prepare-moon-labels.mts';

await prepareMoonLabels({ refresh: process.argv.includes('--refresh') });
