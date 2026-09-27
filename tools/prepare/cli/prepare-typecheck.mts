// Entry script: `pnpm prepare:typecheck` (after pnpm build:tools). The work is in ../prepare-typecheck.mts.
import { prepareTypecheck } from '../prepare-typecheck.mts';

if (process.argv.length !== 2) throw new TypeError('Usage: node tools/prepare/cli/prepare-typecheck.mts (after pnpm build:tools)');
await prepareTypecheck();
