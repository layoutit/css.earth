/**
 * The LMC bake, from the restored model and its records to `prepared/`. Run from the repository root:
 *
 *   node packages/bake/cli/restore-source-inputs.mts --object=lmc-volume
 *   node packages/bake/authoring/lmc-volume/bake.mts all
 *
 * `all` runs the stages below in order; each resumes from what it already wrote in `output/lmc-bake/`. A pilot runs one
 * stage on a small slice: `slabs <arm> --planes=22`, `far-worker 0 --tiles=0,1`. About 20 minutes of slabs and 80 of far
 * pictures on 6 workers of an M5 Pro.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { parseDensityVolumeFrame } from '@cssearth/objects';
import { DATASET_ARMS, type DatasetArm } from './datasets/arms.mts';
import { bakeDots } from './datasets/gas-dots.mts';
import { FAR_DIR, bakeFarPictures, farWorker } from './delivery/far-pictures.mts';
import { prepareFarBank } from './delivery/far-bank.mts';
import { gradeFar } from './datasets/grade-far.mts';
import { install } from './datasets/install.mts';
import { bakeSlabPlane, bakeSlabs } from './datasets/slabs.mts';
import { need } from './inputs.mts';

const entry = fileURLToPath(import.meta.url),
  listed = (name: string) => {
    const value = process.argv.find(a => a.startsWith(name + '='))?.slice(name.length + 1);
    return value === undefined ? undefined : value.split(',').map(Number);
  },
  armOf = (value: string | undefined): DatasetArm => {
    need(value === 'horalek' || value === 'decam' || value === 'vista', 'Choose horalek, decam or vista');
    return value;
  };
const farFrame = () =>
  parseDensityVolumeFrame((JSON.parse(readFileSync(FAR_DIR + 'bank/volume.json', 'utf8')) as { frame: unknown }).frame);

const STAGES: Record<string, () => Promise<unknown>> = {
  slabs: () => bakeSlabs(armOf(process.argv[3]), listed('--planes'), entry),
  'slab-plane': () => bakeSlabPlane(armOf(process.argv[3]), Number(process.argv[4])),
  far: () => bakeFarPictures(entry),
  'far-worker': () => farWorker(Number(process.argv[3]), listed('--tiles')),
  'far-bank': () => prepareFarBank(),
  grades: async () => {
    await gradeFar('decam', FAR_DIR + 'bank/l36-far/');
    await gradeFar('vista', FAR_DIR + 'bank/l36-far/');
  },
  dots: async () => {
    for (const arm of DATASET_ARMS) await bakeDots(arm, farFrame());
  },
  install,
  all: async () => {
    for (const arm of DATASET_ARMS) await bakeSlabs(arm, undefined, entry);
    await bakeFarPictures(entry);
    await prepareFarBank();
    await STAGES.grades!();
    await STAGES.dots!();
    await install();
  },
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const stage = STAGES[process.argv[2] ?? ''];
  need(stage, 'Choose a stage: ' + Object.keys(STAGES).join(', '));
  await stage();
}
