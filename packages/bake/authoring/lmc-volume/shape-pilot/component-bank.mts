/** Independent finite emitters share the galaxy frame, but never its thin-disc selector. */
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validatePreparedCssVolume, type PreparedCssVolume } from '@cssearth/objects';
import { json, need } from '../inputs.mts';
import { SHAPE_DIR } from './source.mts';
export const COMPONENT_DIR = 'src/objects/lmc-volume/.local/versions/l36/components/';

export function composeFiniteComponents(background: PreparedCssVolume, parts: readonly { id: string; volume: PreparedCssVolume }[]): PreparedCssVolume {
  const names = new Set<string>();
  const resources = [background, ...parts.map(p => p.volume)].flatMap(v => v.resources);
  need(new Set(resources.map(r => r.path)).size === resources.length, 'Component textures must have distinct prepared identities');
  return validatePreparedCssVolume({ ...background, stackCompositing: 'transparent-normalized', resources,
    components: parts.map(({ id, volume }) => {
      need(!names.has(id), 'Duplicate finite component'); names.add(id);
      need(volume.frame.referenceFrame === background.frame.referenceFrame && volume.frame.epochJdTt === background.frame.epochJdTt && volume.frame.metersPerUnit === background.frame.metersPerUnit && JSON.stringify(volume.frame.originM) === JSON.stringify(background.frame.originM) && JSON.stringify(volume.frame.localToReferenceXyzw) === JSON.stringify(background.frame.localToReferenceXyzw), 'A finite component must share the physical galaxy frame');
      return { id, boundsUnits: volume.frame.boundsUnits, ...(volume.mergedOpticalCopies ? { mergedOpticalCopies: volume.mergedOpticalCopies } : {}),
        stacks: volume.stacks.map(s => ({ ...s, leaves: s.leaves.map(l => ({ ...l, id: id + '-' + l.id, ...(l.opticalSlab ? { opticalSlab: { ...l.opticalSlab, id: id + '-' + l.opticalSlab.id } } : {}) })) })) };
    }), provenance: { model: 'l36', generator: 'packages/bake/authoring/lmc-volume/shape-pilot/component-bank.mts', physicalParametersChanged: 0 },
    approximation: { independentLocalComponents: true, dustOwner: 'continuous background', ordering: 'Finite emission overlays the continuous background. Scalar RGBA emission remains approximate.' },
  });
}

export async function componentPilot() {
  const background = validatePreparedCssVolume(await json(SHAPE_DIR + 'banks/background/volume.json'));
  const parts = await Promise.all(['cloud', 'shell'].map(async id => ({ id, volume: validatePreparedCssVolume(await json(SHAPE_DIR + 'banks/' + id + '/volume.json')) })));
  const volume = composeFiniteComponents(background, parts);
  const layers = [volume, ...parts.map(p => p.volume)].reduce((n, v) => n + v.stacks.reduce((m, s) => m + s.leaves.length, 0), 0);
  need(layers === 33, 'The tiny integration pilot stays within the original total budget');
  await mkdir(COMPONENT_DIR, { recursive: true }); await writeFile(COMPONENT_DIR + 'pilot-volume.json', JSON.stringify(volume) + '\n');
  console.log('FINITE_COMPONENT_PILOT_PREPARED ' + layers); return volume;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await componentPilot();
