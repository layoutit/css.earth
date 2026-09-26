import { type CompilerBakeResult, readRenderElementBudget } from '@cssearth/bake/volume';
import { CSS_COMPILER_RENDER_BUDGET } from '@cssearth/renderer/volume/compiler-render-budget.ts';
import { samePreparedVolumeTopology } from '@cssearth/renderer/volume/prepared-volume-lod.ts';
import { validatePreparedVolumeLenses, type PreparedVolumeLenses } from '@cssearth/renderer/volume/prepared-volume-lenses.ts';

const AXES = ['x', 'y', 'z'] as const;
// Renderer conformance counts these retained wrappers/markers, including the bank root and empty star wrapper.
const BASE_ELEMENTS = 17, LOD_ELEMENTS = 3, MAX_IMPOSTORS = 26;

/** Final admission is checked after every delivered lens has been assembled. */
export function assertCompilerDeliveryElementBudget(
  sampling: CompilerBakeResult['sampling'] | undefined, data: PreparedVolumeLenses,
): { starCount: number; slabCount: number; impostorCount: number; totalElements: number } | undefined {
  if (sampling?.renderBudget === undefined) return undefined;
  const bank = validatePreparedVolumeLenses(data), first = bank.lenses[0]!;
  if (bank.lenses.some(lens => lens.occultingCentreUnits !== undefined))
    throw new TypeError('The compiler render budget does not admit separate occulting roots.');
  if (bank.lenses.some(lens => !samePreparedVolumeTopology(first.volume, lens.volume)))
    throw new TypeError('The compiler render budget requires one retained topology across every delivered lens.');
  const impostorCount = first.volume.impostors?.views.length ?? 0;
  if (impostorCount > MAX_IMPOSTORS) throw new TypeError('The compiler render budget admits at most 26 impostors.');
  let slabCount = 0, plannedSlabs = 0;
  for (const axis of AXES) {
    const planned = sampling.sliceCounts[axis], actual = first.volume.stacks.find(stack => stack.axis === axis)!.leaves.length;
    if (!Number.isSafeInteger(planned) || planned < 1 || actual > planned)
      throw new TypeError('Delivered leaves exceed the compiler planned XYZ count profile.');
    plannedSlabs += planned; slabCount += actual;
  }
  // The renderer retains one shared catalogue pool; its validator proves identical point geometry for all lenses.
  // Count zero-alpha and disabled points as well. Field-star replacement has already happened at this boundary.
  const starCount = first.stars.points.length;
  readRenderElementBudget(sampling.renderBudget, starCount, plannedSlabs, CSS_COMPILER_RENDER_BUDGET);
  const totalElements = BASE_ELEMENTS + (first.volume.impostors ? LOD_ELEMENTS : 0) + impostorCount + CSS_COMPILER_RENDER_BUDGET.elementsPerSlab * slabCount +
    CSS_COMPILER_RENDER_BUDGET.elementsPerStar * starCount;
  if (!Number.isSafeInteger(totalElements) || totalElements > CSS_COMPILER_RENDER_BUDGET.maximumElements)
    throw new RangeError(`Delivered compiler bank retains ${totalElements} elements; limit is ${CSS_COMPILER_RENDER_BUDGET.maximumElements}.`);
  return { starCount, slabCount, impostorCount, totalElements };
}
