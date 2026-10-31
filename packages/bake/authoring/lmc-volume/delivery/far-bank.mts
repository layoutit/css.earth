/** Attach model pictures for unresolved views; resolved views retain the X/Y/Z slab bank. */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { type PreparedCssVolume } from '@cssearth/objects';
import { prepareVolumeImpostors } from '@cssearth/bake/volume-leaves';
import { compileGalaxySliceVolume } from '../../milky-way-dust/galaxy-slice-compile.mts';
import { FULL_DIR } from './near-pilot.mts';
import { FAR_DIR, FAR_RADIUS, FAR_SIZE, modelFarViews } from './far-model.mts';
import { deliveryPhysicalFrame, KPC_M } from './delivery-frame.mts';
import { json, rec, need } from '../inputs.mts';

type PictureOptions = Parameters<typeof prepareVolumeImpostors>[0];

/** Use the shared projected-size handoff. A distant but resolved galaxy is still layered. */
export function attachModelFarPictures(
  volume: PreparedCssVolume,
  renderView: NonNullable<PictureOptions['renderView']>,
  writeResource: PictureOptions['writeResource'],
) {
  return prepareVolumeImpostors({
    volume, brightness: { overall: 1, x: 1, y: 1, z: 1 }, prefix: 'l36-far',
    views: modelFarViews(), radiusUnits: FAR_RADIUS,
    readResource: async () => { throw Error('Far pictures must never be rendered from slabs'); },
    writeResource, renderView,
  });
}

export async function prepareFarBank(pilot = false) {
  const size = pilot ? 128 : FAR_SIZE;
  const sourceDirectory = FAR_DIR + (pilot ? 'pilot-bounds/' : 'pictures/');
  const outputDirectory = FAR_DIR + (pilot ? 'bank-pilot/' : 'bank/');
  need(rec(await json(FAR_DIR + (pilot ? 'replay.json' : 'result.json'))).complete === true, 'Completed model pictures are required');
  if (!pilot) need(rec(await json(FAR_DIR + 'bank-pilot/complete.json')).complete === true, 'Tiny packaging must pass before native packaging');
  const volume = compileGalaxySliceVolume(await json(FULL_DIR + 'bank/prototype.json'), deliveryPhysicalFrame(), FULL_DIR + 'bank/', 'lmc-volume', {
    record: 'source/preparation/l36/fit.json', texturePrefix: 'l36-near',
  });
  need(volume.frame.metersPerUnit === KPC_M, 'The shared slab compiler must retain one kpc per unit');
  const result = await attachModelFarPictures(volume, async view => {
    const { data, info } = await sharp(sourceDirectory + view.id + '.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    need(info.width === size && info.height === size && info.channels === 4, 'Invalid native model picture');
    return { rgba: data, size };
  }, async (path, bytes) => {
    await mkdir(dirname(outputDirectory + path), { recursive: true });
    await writeFile(outputDirectory + path, bytes);
  });
  await writeFile(outputDirectory + 'volume.json', JSON.stringify(result) + '\n');
  await writeFile(outputDirectory + 'complete.json', JSON.stringify({ complete: true, pilot, size, views: result.impostors!.views.length, metersPerUnit: result.frame.metersPerUnit }) + '\n');
  console.log('FAR_BANK_COMPLETE ' + result.impostors!.views.length + ' ' + size);
  return result;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await prepareFarBank(process.argv.includes('--pilot'));
