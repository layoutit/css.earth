// Entry script: `pnpm prepare:lens-billboards`. The work is in ../prepare-lens-billboards.mts.
import { prepareLensBillboards } from '../prepare-lens-billboards.mts';

console.log(await prepareLensBillboards());
