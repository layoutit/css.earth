/** Platform-neutral accounting. The host supplies its tested retained-DOM cost profile. */
export interface RenderElementProfile {
  schema: 'cssearth-render-element-profile@1';
  id: string;
  maximumElements: number;
  elementsPerSlab: number;
  elementsPerStar: number;
  reservedElements: number;
}
export interface RenderElementBudget {
  schema: 'cssearth-render-element-budget@1';
  profile: RenderElementProfile;
  starCount: number;
  slabCount: number;
  maximumSlabs: number;
  totalElements: number;
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, minimum: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
export function readRenderElementProfile(value: unknown): RenderElementProfile {
  if (!record(value) || value.schema !== 'cssearth-render-element-profile@1' || typeof value.id !== 'string' || !value.id ||
      !integer(value.maximumElements, 1) || !integer(value.elementsPerSlab, 1) || !integer(value.elementsPerStar, 1) ||
      !integer(value.reservedElements, 0) || value.reservedElements >= value.maximumElements)
    throw new TypeError('Invalid retained render-element profile.');
  return { schema: value.schema, id: value.id, maximumElements: value.maximumElements, elementsPerSlab: value.elementsPerSlab,
    elementsPerStar: value.elementsPerStar, reservedElements: value.reservedElements };
}
/** Counts hidden retained elements too; no stars are selected or removed here. */
export function renderElementCount(profile: RenderElementProfile, starCount: number, slabCount: number): number {
  const cost = readRenderElementProfile(profile);
  if (!integer(starCount, 0) || !integer(slabCount, 0)) throw new TypeError('Render-element counts must be nonnegative safe integers.');
  const count = cost.reservedElements + starCount * cost.elementsPerStar + slabCount * cost.elementsPerSlab;
  if (!Number.isSafeInteger(count)) throw new TypeError('Render-element count exceeds exact integer range.');
  return count;
}
export function maximumRenderSlabs(profile: RenderElementProfile, starCount: number): number {
  const cost = readRenderElementProfile(profile), reserved = renderElementCount(cost, starCount, 0);
  const maximum = Math.floor((cost.maximumElements - reserved) / cost.elementsPerSlab);
  if (maximum < 3) throw new RangeError(`Retained stars and renderer overhead leave no complete XYZ volume within ${cost.maximumElements} elements.`);
  return maximum;
}
export function createRenderElementBudget(profile: RenderElementProfile, starCount: number, slabCount: number): RenderElementBudget {
  const cost = readRenderElementProfile(profile), maximumSlabs = maximumRenderSlabs(cost, starCount);
  const totalElements = renderElementCount(cost, starCount, slabCount);
  if (slabCount < 3 || slabCount > maximumSlabs) throw new RangeError(`Prepared volume needs ${totalElements} retained elements; limit is ${cost.maximumElements}.`);
  return { schema: 'cssearth-render-element-budget@1', profile: cost, starCount, slabCount, maximumSlabs, totalElements };
}
/** A shared component bank may reserve stars that are added only to the final union scene. */
export function readRenderElementBudget(value: unknown, actualStars: number, actualSlabs: number, expectedProfile?: RenderElementProfile): RenderElementBudget {
  if (!record(value) || value.schema !== 'cssearth-render-element-budget@1' || !integer(value.starCount, 0) ||
      !integer(actualStars, 0) || actualStars > value.starCount) throw new TypeError('Invalid retained render-element budget or star reservation.');
  const profile = readRenderElementProfile(value.profile);
  if (expectedProfile && JSON.stringify(profile) !== JSON.stringify(readRenderElementProfile(expectedProfile)))
    throw new TypeError('Saved render-element profile differs from its host renderer.');
  const expected = createRenderElementBudget(profile, value.starCount, actualSlabs);
  if (value.slabCount !== expected.slabCount || value.maximumSlabs !== expected.maximumSlabs || value.totalElements !== expected.totalElements)
    throw new TypeError('Saved render-element budget differs from its retained scene.');
  return expected;
}
