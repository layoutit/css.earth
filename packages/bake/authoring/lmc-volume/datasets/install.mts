/** Install the delivered LMC bank: one model on three datasets, each with its own slabs, gas and dust dots and far pictures, Horálek the default. */
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { validatePreparedCssVolume } from '@cssearth/objects';
import { inventoryPreparedAssets, readVolumeDatasetBank, writeVolumeDatasetBank } from '@cssearth/objects/node';
import { json, need } from '../inputs.mts';
import { discBacking, type BackingRecord } from './backing-disc.mts';
import { SMOOTH_BACKGROUND_DIR } from './background-all.mts';
import { L37_DIR } from './regions.mts';

const OBJECT = 'src/objects/lmc-volume/', PREPARED = OBJECT + 'prepared', STAGE = L37_DIR + 'install-stage', ARMS = { 'decam-smash': 'decam', 'vista-vmc': 'vista' } as const;
/** The sight-line cosines between which the thin stack hands over to the side stacks. */
const HANDOVER = [.15, .65] as const, DISC_PLANE = { right: [1, 0, 0] as [number, number, number], up: [0, 1, 0] as [number, number, number] };
interface PresentationRecord { id: string; input: string; label: string; title: string; description: string }

export async function install() {
  const bank = await readVolumeDatasetBank(PREPARED), base = bank.datasets[0]!, native = base.volume;
  need(base.id === 'horalek-widefield', 'The default dataset comes first');
  const presented = (await json(OBJECT + 'source/presentation.json') as { datasets: PresentationRecord[] }).datasets, manifest = await json(OBJECT + 'source/manifest.json') as { inputs: { id: string; sourceUrl?: string }[] };
  const sourceUrl = (input: string) => { const url = manifest.inputs.find(i => i.id === input)?.sourceUrl; need(url, 'A dataset input has no source URL: ' + input); return url!; };
  await rm(STAGE, { recursive: true, force: true }); await cp(PREPARED, STAGE, { recursive: true });
  const put = async (from: string, to: string) => { await mkdir(dirname(STAGE + '/' + to), { recursive: true }); await writeFile(STAGE + '/' + to, await readFile(from)); return (await stat(from)).size; };
  const resources = await Promise.all(native.resources.map(async r => r.path.startsWith('l36-near/') ? { ...r, bytes: await put(SMOOTH_BACKGROUND_DIR + 'bank/' + r.path.slice(9), r.path) } : r));
  for (const name of ['gas-dots.bin', 'gas-dots-atlas.webp']) await put(L37_DIR + 'dots-all/' + name, name);
  const first = validatePreparedCssVolume({ ...native, resources, pointOverlays: ['gas-dots.bin'], thinHandoverCosines: HANDOVER, stackCompositing: 'transparent-normalized', impostors: { ...native.impostors!, discPlane: DISC_PLANE } });
  const text = (id: string) => { const r = presented.find(d => d.id === id); need(r, 'No presentation record for ' + id); return r!; }, datasets = [{ ...base, volume: first, stars: { ...base.stars, frame: first.frame }, label: text(base.id).label, title: text(base.id).title, description: text(base.id).description, sourceUrl: sourceUrl(text(base.id).input) }];
  for (const [id, arm] of Object.entries(ARMS)) {
    const rename = (path: string) => path.replace(/^l36-near\//u, arm + '-near/').replace(/^l36-far\//u, arm + '-far/'), swap = <T extends { texturePath: string }>(leaf: T) => ({ ...leaf, texturePath: rename(leaf.texturePath) });
    const own = await Promise.all(first.resources.map(async r => { const from = r.path.startsWith('l36-near/') ? L37_DIR + 'background-' + arm + '/bank/' + r.path.slice(9) : L37_DIR + 'grades/' + arm + '-far/' + r.path.slice(8); return { ...r, path: rename(r.path), bytes: await put(from, rename(r.path)) }; }));
    for (const name of ['gas-dots-' + arm + '.bin', 'gas-dots-' + arm + '-atlas.webp']) await put(L37_DIR + 'dots-' + arm + '/' + name, name);
    const volume = validatePreparedCssVolume({ ...first, pointOverlays: ['gas-dots-' + arm + '.bin'], resources: own, stacks: first.stacks.map(s => ({ ...s, leaves: s.leaves.map(swap) })), impostors: { ...first.impostors!, views: first.impostors!.views.map(swap) } });
    datasets.push({ ...datasets[0]!, id, label: text(id).label, title: text(id).title, description: text(id).description, sourceUrl: sourceUrl(text(id).input), volume });
  }
  await writeVolumeDatasetBank(STAGE, { ...bank, datasets });
  const backing = STAGE + '/backing.json'; await writeFile(backing, JSON.stringify(discBacking(await json(backing) as BackingRecord)) + '\n');
  await rm(PREPARED, { recursive: true, force: true }); await rename(STAGE, PREPARED);
  await rm('src/objects/lmc/prepared/text.json', { force: true });
  for (const args of [['site/build/prepare/catalog/prepare-volume-presentation.mts', '--object=lmc-volume'], ['site/build/prepare/authored/prepare-authored.ts', 'lmc', '--write', '--full'], ['site/build/prepare/authored/prepare-text.mts', 'lmc'], ['site/build/prepare/authored/prepare-object-json.mts', 'lmc'], ['packages/bake/cli/prepare-dataset-sprites.mts'], ['site/build/prepare/catalog/prepare-facilities.mts', '--catalog-only']]) execFileSync(process.execPath, args, { stdio: 'inherit' });
  await inventoryPreparedAssets({ objectId: 'lmc', objectDirectory: 'src/objects/lmc/' }); await inventoryPreparedAssets({ objectId: 'lmc-volume', objectDirectory: OBJECT }); execFileSync(process.execPath, ['site/build/prepare/catalog/prepare-catalog.mts'], { stdio: 'inherit' });
  console.log('LMC_DATASETS_INSTALLED');
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await install();
