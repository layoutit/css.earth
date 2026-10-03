import { parsePagedRecipe } from '@cssearth/objects';
export { parsePagedDatasetBindings, isPagedEllipsoidRecipe, type PagedDatasetBindings } from '@cssearth/objects';
import { preparedControlPitch } from '@cssearth/engine';
import { LIT_DEFAULT_VIEW } from '../../../scene/index.ts';
export function parsePagedProfile(value: unknown) {
  const parsed = parsePagedRecipe(value);
  const controlPitch = preparedControlPitch(LIT_DEFAULT_VIEW.initialScenePitchDegrees, parsed.camera);
  return { ...parsed, camera: { ...parsed.camera, ...LIT_DEFAULT_VIEW, defaultControlPitchDegrees: controlPitch,
    materialReferenceControlPitchDegrees: controlPitch, materialReferenceControlYawDegrees: LIT_DEFAULT_VIEW.defaultControlYawDegrees } };
}
