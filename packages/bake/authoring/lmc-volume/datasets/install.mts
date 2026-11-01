/** Install the delivered bank from the bake's outputs: one model on three datasets, each with its own slabs, dots and far pictures, Horálek the default. */
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PREPARED_VOLUME_DATASETS_SCHEMA, validatePreparedCssVolume } from '@cssearth/objects';
import { inventoryPreparedAssets, writeVolumeDatasetBank } from '@cssearth/objects/node';
import { json, need } from '../inputs.mts';
import { BAKE_DIR, OBJECT } from '../scene.mts';
import { discBacking, type BackingRecord } from './backing-disc.mts';
import { dotsBank, dotsDir } from './gas-dots.mts';
import { gradedFarDir } from './grade-far.mts';
import { slabDir } from './slabs.mts';
import { slabImage, slabLeaf } from './slab-delivery.mts';
import { FAR_DIR } from '../delivery/far-pictures.mts';

const PREPARED = OBJECT + 'prepared',
  STAGE = BAKE_DIR + 'install-stage',
  ARMS = { 'decam-smash': 'decam', 'vista-vmc': 'vista' } as const;
/** The sight-line cosines between which the thin stack hands over to the side stacks. */
const HANDOVER = [0.15, 0.65] as const,
  DISC_PLANE = { right: [1, 0, 0] as [number, number, number], up: [0, 1, 0] as [number, number, number] };
const BANK_MEANING = [
  'Published geometry and catalogue populations, globally graded against the Earth photograph.',
  '26 fitted physical X/Y/Z slabs with seven second optical layers whenever the galaxy is resolved, including Earth distance.',
  'Source-model pictures are reserved for unresolved projected sizes.',
  'Catalogue grain is already included in the prepared textures.',
].join(' ');
interface PresentationRecord {
  id: string;
  input: string;
  label: string;
  title: string;
  description: string;
}

export async function install() {
  const native = validatePreparedCssVolume(await json(FAR_DIR + 'bank/volume.json')),
    presented = ((await json(OBJECT + 'source/presentation.json')) as { datasets: PresentationRecord[] }).datasets,
    manifest = (await json(OBJECT + 'source/manifest.json')) as { inputs: { id: string; sourceUrl?: string }[] };
  const sourceUrl = (input: string) => {
    const url = manifest.inputs.find(i => i.id === input)?.sourceUrl;
    need(url, 'A dataset input has no source URL: ' + input);
    return url!;
  };
  await rm(STAGE, { recursive: true, force: true });
  await mkdir(STAGE, { recursive: true });
  await cp(FAR_DIR + 'bank/l36-far', STAGE + '/l36-far', { recursive: true });
  const put = async (from: string, to: string) => {
    await mkdir(dirname(STAGE + '/' + to), { recursive: true });
    await writeFile(STAGE + '/' + to, await readFile(from));
    return (await stat(from)).size;
  };
  const slabSources = new Map<string, { width: number; height: number }>(),
    shipSlab = <T extends Parameters<typeof slabLeaf>[0]>(leaf: T) =>
      slabLeaf(leaf, slabSources.get(leaf.texturePath)!);
  const putSlab = async (from: string, to: string) => {
    const { bytes, width, height, source } = await slabImage(from);
    await mkdir(dirname(STAGE + '/' + to), { recursive: true });
    await writeFile(STAGE + '/' + to, bytes);
    slabSources.set(to, source);
    return { bytes: bytes.length, width, height };
  };
  const resources = await Promise.all(
    native.resources.map(async r =>
      r.path.startsWith('l36-near/')
        ? { ...r, ...(await putSlab(slabDir('horalek') + 'bank/' + r.path.slice(9), r.path)) }
        : r,
    ),
  );
  for (const name of ['gas-dots.bin', 'gas-dots-atlas.webp']) await put(dotsDir('horalek') + name, name);
  const first = validatePreparedCssVolume({
    ...native,
    resources,
    stacks: native.stacks.map(s => ({ ...s, leaves: s.leaves.map(shipSlab) })),
    pointOverlays: ['gas-dots.bin'],
    thinHandoverCosines: HANDOVER,
    stackCompositing: 'transparent-normalized',
    impostors: { ...native.impostors!, discPlane: DISC_PLANE },
  });
  const text = (id: string) => {
    const r = presented.find(d => d.id === id);
    need(r, 'No presentation record for ' + id);
    return r!;
  };
  const dataset = (id: string, volume: typeof first) => ({
    id,
    label: text(id).label,
    title: text(id).title,
    description: text(id).description,
    sourceUrl: sourceUrl(text(id).input),
    volume,
    stars: { frame: first.frame, points: [] },
    brightness: { overall: 1, x: 1, y: 1, z: 1 },
  });
  const datasets = [dataset('horalek-widefield', first)];
  for (const [id, arm] of Object.entries(ARMS)) {
    const rename = (path: string) => path.replace(/^l36-near\//u, arm + '-near/').replace(/^l36-far\//u, arm + '-far/'),
      swap = <T extends { texturePath: string }>(leaf: T) => ({ ...leaf, texturePath: rename(leaf.texturePath) });
    const own = await Promise.all(
      first.resources.map(async r =>
        r.path.startsWith('l36-near/')
          ? { ...r, path: rename(r.path), ...(await putSlab(slabDir(arm) + 'bank/' + r.path.slice(9), rename(r.path))) }
          : { ...r, path: rename(r.path), bytes: await put(gradedFarDir(arm) + r.path.slice(8), rename(r.path)) },
      ),
    );
    const bank = dotsBank(arm);
    for (const name of [bank + '.bin', bank + '-atlas.webp']) await put(dotsDir(arm) + name, name);
    datasets.push(
      dataset(
        id,
        validatePreparedCssVolume({
          ...first,
          pointOverlays: [bank + '.bin'],
          resources: own,
          stacks: first.stacks.map(s => ({ ...s, leaves: s.leaves.map(swap) })),
          impostors: { ...first.impostors!, views: first.impostors!.views.map(swap) },
        }),
      ),
    );
  }
  await writeVolumeDatasetBank(STAGE, {
    schema: PREPARED_VOLUME_DATASETS_SCHEMA,
    id: 'lmc-volume',
    defaultDataset: 'horalek-widefield',
    framingRadiusUnits: 5,
    contextVisibility: 'galactic',
    starsEnabled: false,
    pointVisibility: { hiddenBelowRadiusPixels: 2, fullAboveRadiusPixels: 24 },
    provenance: {
      model: 'l36',
      approvedCommit: 'e4ebd6c94263f73dc020ad0d1443901182310329',
      source: 'source/preparation/l36/recipe.json',
      delivery: 'source/delivery.json',
      meaning: BANK_MEANING,
    },
    datasets,
  });
  await rm(PREPARED, { recursive: true, force: true });
  await rename(STAGE, PREPARED);
  await rm('src/objects/lmc/prepared/text.json', { force: true });
  const run = (...args: string[]) => execFileSync(process.execPath, args, { stdio: 'inherit' });
  run('packages/bake/cli/prepare-galaxy-backing.mts', OBJECT, 'backing');
  const backing = PREPARED + '/backing.json';
  await writeFile(backing, JSON.stringify(discBacking((await json(backing)) as BackingRecord)) + '\n');
  for (const args of [
    ['site/build/prepare/catalog/prepare-volume-presentation.mts', '--object=lmc-volume'],
    ['site/build/prepare/authored/prepare-authored.ts', 'lmc', '--write', '--full'],
    ['site/build/prepare/authored/prepare-text.mts', 'lmc'],
    ['site/build/prepare/authored/prepare-object-json.mts', 'lmc'],
    ['packages/bake/cli/prepare-dataset-sprites.mts'],
    ['site/build/prepare/catalog/prepare-facilities.mts', '--catalog-only'],
  ])
    run(...args);
  await inventoryPreparedAssets({ objectId: 'lmc', objectDirectory: 'src/objects/lmc/' });
  await inventoryPreparedAssets({ objectId: 'lmc-volume', objectDirectory: OBJECT });
  run('site/build/prepare/catalog/prepare-catalog.mts');
  console.log('LMC_DATASETS_INSTALLED');
}
