/**
 * The near slabs of one dataset: the model without its catalogue gas and discrete dust clouds, which move to dots, in that
 * dataset's grade. Each plane is its own process, so a stopped bake resumes at the plane it lost.
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import {
  bankSpec,
  planeCamera,
  planeLayout,
  writeGalaxyModelBank,
  type GalaxyBankFit,
  type GalaxyPlane,
} from './fitted-bank.mts';
import { projectLmcSlab } from './slab-source.mts';
import { array, json, need, num, numbers, rec } from '../inputs.mts';
import { BAKE_DIR, RECORDS } from '../scene.mts';
import { allGasSource } from './regions.mts';
import { type DatasetArm, armGrade } from './arms.mts';

const STRIP = 256,
  WORKERS = 5;
/** 26 physical intervals, seven of which also get a second optical layer: 33 layers in all. */
export const SLAB_SPEC = bankSpec({
  box: { min: [-10, -10, -2.1], max: [10, 10, 2.1] },
  counts: [10, 9, 7],
  size: 2048,
  record: 'source/preparation/l36/fit.json',
  texturePrefix: 'l36-near',
  hybrid: { densePerAxis: [2, 2, 3] },
});
export const slabDir = (arm: DatasetArm) => BAKE_DIR + 'slabs-' + arm + '/';
export const slabLayouts = () =>
  ([0, 1, 2] as const).flatMap(axis =>
    Array.from({ length: SLAB_SPEC.counts[axis] }, (_, index) => planeLayout(SLAB_SPEC, axis, index)),
  );
const stem = (arm: DatasetArm, l: ReturnType<typeof slabLayouts>[number]) =>
  slabDir(arm) + `local-${l.axis}-${l.index}`;

export async function bakeSlabPlane(arm: DatasetArm, i: number) {
  const { source, background } = await allGasSource(),
    scene = { ...background, dustLayer: { ...background.dustLayer, clouds: [] } },
    grade = armGrade(arm) ?? source.grade,
    layout = slabLayouts()[i]!,
    camera = planeCamera(SLAB_SPEC, layout),
    pixels = layout.width * layout.height,
    rgb = new Float64Array(pixels * 3),
    tau = new Float64Array(pixels);
  for (let left = 0; left < layout.width; left += STRIP) {
    const part = new Uint8Array(pixels);
    for (let y = 0; y < layout.height; y++)
      part.fill(1, y * layout.width + left, y * layout.width + Math.min(layout.width, left + STRIP));
    const fresh = projectLmcSlab({ ...source, grade, scene }, layout.domain, camera, part);
    for (let p = 0; p < pixels; p++)
      if (part[p]) {
        rgb[p * 3] = fresh.rgb[p * 3]!;
        rgb[p * 3 + 1] = fresh.rgb[p * 3 + 1]!;
        rgb[p * 3 + 2] = fresh.rgb[p * 3 + 2]!;
        tau[p] = fresh.tau[p]!;
      }
  }
  const out = stem(arm, layout);
  await writeFile(out + '-rgb.f64le', Buffer.from(rgb.buffer));
  await writeFile(out + '-tau.f64le', Buffer.from(tau.buffer));
  await writeFile(out + '.json', JSON.stringify({ complete: true, axis: layout.axis, index: layout.index }) + '\n');
  console.log('LMC_SLAB_PLANE ' + arm + ' ' + i);
}

async function readPlanes(arm: DatasetArm): Promise<GalaxyPlane[]> {
  return Promise.all(
    slabLayouts().map(async l => {
      const rgb = await readFile(stem(arm, l) + '-rgb.f64le'),
        tau = await readFile(stem(arm, l) + '-tau.f64le');
      need(rgb.length === l.width * l.height * 24 && tau.length === l.width * l.height * 8, 'Truncated slab plane');
      return {
        axis: l.axis,
        index: l.index,
        center: l.center,
        width: l.width,
        height: l.height,
        rgb: new Float64Array(Uint8Array.from(rgb).buffer),
        tau: new Float64Array(Uint8Array.from(tau).buffer),
      };
    }),
  );
}

/** Project what is missing, then encode the bank with the frozen fits. `planes` limits the run to a pilot and skips encoding. */
export async function bakeSlabs(arm: DatasetArm, planes: readonly number[] | undefined, entry: string) {
  await mkdir(slabDir(arm), { recursive: true });
  const layouts = slabLayouts(),
    wanted = planes ?? layouts.map((_, i) => i),
    pending = (
      await Promise.all(
        wanted.map(async i =>
          (await access(stem(arm, layouts[i]!) + '.json').then(
            () => true,
            () => false,
          ))
            ? -1
            : i,
        ),
      )
    ).filter(i => i >= 0);
  let next = 0;
  const run = async () => {
    while (next < pending.length) {
      const i = pending[next++]!;
      await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, ['--max-old-space-size=9000', entry, 'slab-plane', arm, String(i)], {
          stdio: ['ignore', 'inherit', 'inherit'],
        });
        child.once('close', code => (code === 0 ? resolve() : reject(Error('Slab plane failed: ' + i))));
      });
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, run));
  if (planes) return;
  const encoding = rec(await json(RECORDS + 'slab-encoding.json')),
    fits: GalaxyBankFit[] = array(encoding.fits).map(value => {
      const r = rec(value),
        c = numbers(r.rgb, 3);
      return {
        rgb: [c[0]!, c[1]!, c[2]!],
        gamma: num(r.gamma),
        dust: num(r.dust),
        emissionOpacity: num(r.emissionOpacity),
      };
    });
  need(fits.length === 3, 'One fit per axis');
  await writeGalaxyModelBank(
    slabDir(arm) + 'bank/',
    SLAB_SPEC,
    await readPlanes(arm),
    fits,
    new Set(array(encoding.dense).map(String)),
  );
  console.log('LMC_SLABS ' + arm);
}
