/** Attach model pictures for unresolved views; resolved views retain the X/Y/Z slab bank. */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { type PreparedCssVolume } from '@cssearth/objects';
import { prepareVolumeImpostors } from '@cssearth/bake/volume-leaves';
import { compileGalaxySliceVolume } from '../../milky-way-dust/galaxy-slice-compile.mts';
import { slabDir } from '../datasets/slabs.mts';
import { FAR_RADIUS, FAR_SIZE, modelFarViews } from './far-model.mts';
import { FAR_DIR } from './far-pictures.mts';
import { deliveryPhysicalFrame, KPC_M } from './delivery-frame.mts';
import { json, need } from '../inputs.mts';

type PictureOptions = Parameters<typeof prepareVolumeImpostors>[0];

/** Use the shared projected-size handoff. A distant but resolved galaxy is still layered. */
export function attachModelFarPictures(
  volume: PreparedCssVolume,
  renderView: NonNullable<PictureOptions['renderView']>,
  writeResource: PictureOptions['writeResource'],
) {
  return prepareVolumeImpostors({
    volume,
    brightness: { overall: 1, x: 1, y: 1, z: 1 },
    prefix: 'l36-far',
    views: modelFarViews(),
    radiusUnits: FAR_RADIUS,
    readResource: async () => {
      throw Error('Far pictures must never be rendered from slabs');
    },
    writeResource,
    renderView,
  });
}

/** The Horálek slab bank compiled to a volume, with the far pictures attached and written beside it. */
export async function prepareFarBank() {
  const outputDirectory = FAR_DIR + 'bank/',
    slabs = slabDir('horalek') + 'bank/',
    volume = compileGalaxySliceVolume(
      await json(slabs + 'prototype.json'),
      deliveryPhysicalFrame(),
      slabs,
      'lmc-volume',
      {
        record: 'source/preparation/l36/fit.json',
        texturePrefix: 'l36-near',
      },
    );
  need(volume.frame.metersPerUnit === KPC_M, 'The shared slab compiler must retain one kpc per unit');
  const result = await attachModelFarPictures(
    volume,
    async view => {
      const { data, info } = await sharp(FAR_DIR + 'pictures/' + view.id + '.png')
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      need(info.width === FAR_SIZE && info.height === FAR_SIZE && info.channels === 4, 'Invalid far picture');
      return { rgba: data, size: FAR_SIZE };
    },
    async (path, bytes) => {
      await mkdir(dirname(outputDirectory + path), { recursive: true });
      await writeFile(outputDirectory + path, bytes);
    },
  );
  await writeFile(outputDirectory + 'volume.json', JSON.stringify(result) + '\n');
  console.log('LMC_FAR_BANK ' + result.impostors!.views.length);
  return result;
}
