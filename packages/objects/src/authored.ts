import type { ObjectDescriptor } from './descriptor.js';
import { parseObjectDescriptor } from './parse.js';

export type ShapeKind = 'sphere' | 'ellipsoid' | 'radial-terrain';
/** A recipe input by id and package path. Its bytes are pinned once, in the source manifest, never here. */
export interface SourceReference { readonly id: string; readonly path: string; }
export interface ShapeRecipe { readonly kind: ShapeKind; readonly radiusKm: number; readonly polarRadiusKm?: number; readonly secondaryRadiusKm?: number; }
export interface MaterialRecipe { readonly id: string; readonly source: string; readonly model: 'lit' | 'unlit' | 'emissive'; readonly frameBank?: string; }
export interface FrameBankRecipe { readonly id: string; readonly source: string; readonly frames: number; readonly rows: number; readonly residentRows: number; }
export interface LensRecipe { readonly id: string; readonly source: string; readonly material?: string; readonly frameBank?: string; }
export interface SurfaceRecipe { readonly id: string; readonly source: string; readonly projection: 'equirectangular' | 'cubemap'; readonly lenses: readonly LensRecipe[]; }
export interface LayerRecipe { readonly source: string; readonly material?: string; readonly frameBank?: string; }
export interface CutawayRecipe extends LayerRecipe { readonly surface: string; readonly lens: string; }
export interface MotionRecipe { readonly id: string; readonly source: string; readonly target: 'body' | 'cutaway' | 'rings' | 'atmosphere' | 'emission'; readonly durationMs: number; }
export interface DestinationsRecipe { readonly source: string; readonly maxEntries: number; }
/** A prepared named-feature catalogue anchored to the body surface (nomenclature labels). */
export interface FeaturesRecipe { readonly source: string; readonly maxEntries: number; }
export interface WorldFrameRecipe { readonly referenceFrame: string; readonly epochJdTt: number; readonly originM: readonly [number, number, number]; readonly presentationToReference: readonly [number, number, number, number, number, number, number, number, number]; readonly orbitUpReference: readonly [number, number, number]; readonly metersPerUnit: number; readonly bodyRadiusM: number; }
export interface AuthoredRecipe {
  readonly schema: 'cssearth-authored-object@1';
  readonly sources: readonly SourceReference[];
  readonly shape: ShapeRecipe;
  readonly surfaces: readonly SurfaceRecipe[];
  readonly materials?: readonly MaterialRecipe[];
  readonly frameBanks?: readonly FrameBankRecipe[];
  readonly cutaway?: CutawayRecipe;
  readonly atmosphere?: LayerRecipe;
  readonly rings?: LayerRecipe;
  readonly emission?: LayerRecipe;
  readonly motion?: readonly MotionRecipe[];
  readonly destinations?: DestinationsRecipe;
  readonly features?: FeaturesRecipe;
  readonly worldFrame?: WorldFrameRecipe;
}
export interface AuthoredObjectDescriptor extends ObjectDescriptor { readonly recipe: AuthoredRecipe; }

const identifier = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const digest = /^[a-f0-9]{64}$/;
type Input = Record<string, unknown>;

function record(value: unknown, at: string): Input {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) throw new TypeError(`${at} must be an object.`);
  return value as Input;
}
function keys(input: Input, allowed: readonly string[], at: string): void {
  for (const key of Object.keys(input)) if (!allowed.includes(key)) throw new TypeError(`${at}.${key} is not supported.`);
}
function id(value: unknown, at: string): string {
  if (typeof value !== 'string' || !identifier.test(value)) throw new TypeError(`${at} must be a stable identifier.`);
  return value;
}
function positive(value: unknown, at: string, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value))) throw new TypeError(`${at} must be a positive${integer ? ' integer' : ''}.`);
  return value;
}
function sourcePath(value: unknown, at: string): string {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.split('/').includes('..') || /[\\\u0000-\u0020]/.test(value)) throw new TypeError(`${at} must be a relative source path.`);
  return value;
}
function tuple(value: unknown, size: number, at: string): readonly number[] {
  if (!Array.isArray(value) || value.length !== size || value.some(item => typeof item !== 'number' || !Number.isFinite(item))) throw new TypeError(`${at} must contain ${size} finite numbers.`);
  return [...value];
}
function freeze<T extends object>(value: T): T { return Object.freeze(value); }
function unique(values: readonly string[], at: string): void {
  if (new Set(values).size !== values.length) throw new TypeError(`${at} contains duplicate identifiers.`);
}
function optionalRef(value: unknown, available: ReadonlySet<string>, at: string): string | undefined {
  if (value === undefined) return undefined;
  const reference = id(value, at);
  if (!available.has(reference)) throw new TypeError(`${at} references an unknown capability.`);
  return reference;
}
function sourceRef(value: unknown, sources: ReadonlySet<string>, at: string): string {
  const reference = id(value, at);
  if (!sources.has(reference)) throw new TypeError(`${at} references an unknown source.`);
  return reference;
}
function layer(value: unknown, sources: ReadonlySet<string>, materials: ReadonlySet<string>, frames: ReadonlySet<string>, at: string): LayerRecipe {
  const input = record(value, at); keys(input, ['source', 'material', 'frameBank'], at);
  return freeze({ source: sourceRef(input.source, sources, `${at}.source`),
    ...(input.material === undefined ? {} : { material: optionalRef(input.material, materials, `${at}.material`)! }),
    ...(input.frameBank === undefined ? {} : { frameBank: optionalRef(input.frameBank, frames, `${at}.frameBank`)! }), });
}
function sources(value: unknown): readonly SourceReference[] {
  if (!Array.isArray(value) || !value.length) throw new TypeError('recipe.sources must be a nonempty array.');
  const output = value.map((item, index) => {
    const input = record(item, `recipe.sources[${index}]`); keys(input, ['id', 'path'], `recipe.sources[${index}]`);
    return freeze({ id: id(input.id, `recipe.sources[${index}].id`), path: sourcePath(input.path, `recipe.sources[${index}].path`) });
  });
  unique(output.map(item => item.id), 'recipe.sources');
  return freeze(output);
}
function parseFrameBanks(value: unknown, sourceIds: ReadonlySet<string>): readonly FrameBankRecipe[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new TypeError('recipe.frameBanks must be an array.');
  const output = value.map((item, index) => {
    const at = `recipe.frameBanks[${index}]`, input = record(item, at); keys(input, ['id', 'source', 'frames', 'rows', 'residentRows'], at);
    const frames = positive(input.frames, `${at}.frames`, true), rows = positive(input.rows, `${at}.rows`, true), residentRows = positive(input.residentRows, `${at}.residentRows`, true);
    if (residentRows > rows || frames < rows) throw new TypeError(`${at} has an invalid frame residency budget.`);
    return freeze({ id: id(input.id, `${at}.id`), source: sourceRef(input.source, sourceIds, `${at}.source`), frames, rows, residentRows });
  });
  unique(output.map(item => item.id), 'recipe.frameBanks'); return freeze(output);
}
function parseMaterials(value: unknown, sourceIds: ReadonlySet<string>, frameIds: ReadonlySet<string>): readonly MaterialRecipe[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new TypeError('recipe.materials must be an array.');
  const output = value.map((item, index) => {
    const at = `recipe.materials[${index}]`, input = record(item, at); keys(input, ['id', 'source', 'model', 'frameBank'], at);
    if (input.model !== 'lit' && input.model !== 'unlit' && input.model !== 'emissive') throw new TypeError(`${at}.model is not supported.`);
    const model = input.model as MaterialRecipe['model'];
    return freeze({ id: id(input.id, `${at}.id`), source: sourceRef(input.source, sourceIds, `${at}.source`), model,
      ...(input.frameBank === undefined ? {} : { frameBank: optionalRef(input.frameBank, frameIds, `${at}.frameBank`)! }), });
  });
  unique(output.map(item => item.id), 'recipe.materials'); return freeze(output);
}
function parseSurfaces(value: unknown, sourceIds: ReadonlySet<string>, materialIds: ReadonlySet<string>, frameIds: ReadonlySet<string>): readonly SurfaceRecipe[] {
  if (!Array.isArray(value) || !value.length) throw new TypeError('recipe.surfaces must be a nonempty array.');
  const output = value.map((item, index) => {
    const at = `recipe.surfaces[${index}]`, input = record(item, at); keys(input, ['id', 'source', 'projection', 'lenses'], at);
    if (input.projection !== 'equirectangular' && input.projection !== 'cubemap') throw new TypeError(`${at}.projection is not supported.`);
    if (!Array.isArray(input.lenses)) throw new TypeError(`${at}.lenses must be an array.`);
    const lenses = input.lenses.map((item, lensIndex) => {
      const lensAt = `${at}.lenses[${lensIndex}]`, lens = record(item, lensAt); keys(lens, ['id', 'source', 'material', 'frameBank'], lensAt);
      return freeze({ id: id(lens.id, `${lensAt}.id`), source: sourceRef(lens.source, sourceIds, `${lensAt}.source`),
        ...(lens.material === undefined ? {} : { material: optionalRef(lens.material, materialIds, `${lensAt}.material`)! }),
        ...(lens.frameBank === undefined ? {} : { frameBank: optionalRef(lens.frameBank, frameIds, `${lensAt}.frameBank`)! }), });
    });
    unique(lenses.map(lens => lens.id), `${at}.lenses`);
    const projection = input.projection as SurfaceRecipe['projection'];
    return freeze({ id: id(input.id, `${at}.id`), source: sourceRef(input.source, sourceIds, `${at}.source`), projection, lenses: freeze(lenses) });
  });
  unique(output.map(item => item.id), 'recipe.surfaces'); return freeze(output);
}
function parseWorldFrame(value: unknown): WorldFrameRecipe | undefined {
  if (value === undefined) return undefined;
  const input = record(value, 'recipe.worldFrame'); keys(input, ['referenceFrame', 'epochJdTt', 'originM', 'presentationToReference', 'orbitUpReference', 'metersPerUnit', 'bodyRadiusM'], 'recipe.worldFrame');
  if (typeof input.referenceFrame !== 'string' || !input.referenceFrame) throw new TypeError('recipe.worldFrame.referenceFrame must be a name.');
  const origin = tuple(input.originM, 3, 'recipe.worldFrame.originM');
  const matrix = tuple(input.presentationToReference, 9, 'recipe.worldFrame.presentationToReference');
  const up = tuple(input.orbitUpReference, 3, 'recipe.worldFrame.orbitUpReference');
  const originM: WorldFrameRecipe['originM'] = Object.freeze([origin[0]!, origin[1]!, origin[2]!] as [number, number, number]);
  const presentationToReference: WorldFrameRecipe['presentationToReference'] = Object.freeze([matrix[0]!, matrix[1]!, matrix[2]!, matrix[3]!, matrix[4]!, matrix[5]!, matrix[6]!, matrix[7]!, matrix[8]!] as [number, number, number, number, number, number, number, number, number]);
  const orbitUpReference: WorldFrameRecipe['orbitUpReference'] = Object.freeze([up[0]!, up[1]!, up[2]!] as [number, number, number]);
  return freeze({ referenceFrame: input.referenceFrame, epochJdTt: positive(input.epochJdTt, 'recipe.worldFrame.epochJdTt'), originM, presentationToReference, orbitUpReference, metersPerUnit: positive(input.metersPerUnit, 'recipe.worldFrame.metersPerUnit'), bodyRadiusM: positive(input.bodyRadiusM, 'recipe.worldFrame.bodyRadiusM') });
}

/** Validates reusable authored capabilities before a preparation adapter reads sources. */
export function parseAuthoredRecipe(value: unknown): AuthoredRecipe {
  const input = record(value, 'recipe');
  keys(input, ['schema', 'sources', 'shape', 'surfaces', 'materials', 'frameBanks', 'cutaway', 'atmosphere', 'rings', 'emission', 'motion', 'destinations', 'features', 'worldFrame'], 'recipe');
  if (input.schema !== 'cssearth-authored-object@1') throw new TypeError('Unsupported authored recipe schema.');
  const parsedSources = sources(input.sources), sourceIds = new Set(parsedSources.map(item => item.id));
  const shapeInput = record(input.shape, 'recipe.shape'); keys(shapeInput, ['kind', 'radiusKm', 'polarRadiusKm', 'secondaryRadiusKm'], 'recipe.shape');
  if (shapeInput.kind !== 'sphere' && shapeInput.kind !== 'ellipsoid' && shapeInput.kind !== 'radial-terrain') throw new TypeError('recipe.shape.kind is not supported.');
  const radiusKm = positive(shapeInput.radiusKm, 'recipe.shape.radiusKm');
  const polarRadiusKm = shapeInput.polarRadiusKm === undefined ? undefined : positive(shapeInput.polarRadiusKm, 'recipe.shape.polarRadiusKm');
  if ((shapeInput.kind !== 'ellipsoid' && polarRadiusKm !== undefined) || (shapeInput.kind === 'ellipsoid' && polarRadiusKm === undefined)) throw new TypeError('recipe.shape polar radius does not match its kind.');
  const secondaryRadiusKm = shapeInput.secondaryRadiusKm === undefined ? undefined : positive(shapeInput.secondaryRadiusKm, 'recipe.shape.secondaryRadiusKm');
  if (secondaryRadiusKm !== undefined && (shapeInput.kind !== 'ellipsoid' || secondaryRadiusKm > radiusKm || polarRadiusKm! > secondaryRadiusKm)) throw new TypeError('Triaxial axes must satisfy a >= b >= c > 0.');
  const frameBanks = parseFrameBanks(input.frameBanks, sourceIds), frameIds = new Set(frameBanks?.map(item => item.id));
  const materials = parseMaterials(input.materials, sourceIds, frameIds), materialIds = new Set(materials?.map(item => item.id));
  const parsedSurfaces = parseSurfaces(input.surfaces, sourceIds, materialIds, frameIds), surfaceIds = new Set(parsedSurfaces.map(item => item.id));
  const cutaway = input.cutaway === undefined ? undefined : (() => { const at = 'recipe.cutaway', item = record(input.cutaway, at); keys(item, ['source', 'material', 'frameBank', 'surface', 'lens'], at); const shared = layer({ source: item.source, material: item.material, frameBank: item.frameBank }, sourceIds, materialIds, frameIds, at), surface = optionalRef(item.surface, surfaceIds, `${at}.surface`)!; const lenses = new Set(parsedSurfaces.find(value => value.id === surface)!.lenses.map(value => value.id)); return freeze({ ...shared, surface, lens: optionalRef(item.lens, lenses, `${at}.lens`)! }); })();
  const atmosphere = input.atmosphere === undefined ? undefined : layer(input.atmosphere, sourceIds, materialIds, frameIds, 'recipe.atmosphere');
  const rings = input.rings === undefined ? undefined : layer(input.rings, sourceIds, materialIds, frameIds, 'recipe.rings');
  const emission = input.emission === undefined ? undefined : layer(input.emission, sourceIds, materialIds, frameIds, 'recipe.emission');
  const motion = input.motion === undefined ? undefined : (() => { if (!Array.isArray(input.motion)) throw new TypeError('recipe.motion must be an array.'); const output = input.motion.map((item, index) => { const at = `recipe.motion[${index}]`, current = record(item, at); keys(current, ['id', 'source', 'target', 'durationMs'], at); if (!['body', 'cutaway', 'rings', 'atmosphere', 'emission'].includes(String(current.target))) throw new TypeError(`${at}.target is not supported.`); if ((current.target === 'cutaway' && !cutaway) || (current.target === 'rings' && !rings) || (current.target === 'atmosphere' && !atmosphere) || (current.target === 'emission' && !emission)) throw new TypeError(`${at}.target has no authored layer.`); return freeze({ id: id(current.id, `${at}.id`), source: sourceRef(current.source, sourceIds, `${at}.source`), target: current.target as MotionRecipe['target'], durationMs: positive(current.durationMs, `${at}.durationMs`, true) }); }); unique(output.map(item => item.id), 'recipe.motion'); return freeze(output); })();
  const destinations = input.destinations === undefined ? undefined : (() => { const at = 'recipe.destinations', item = record(input.destinations, at); keys(item, ['source', 'maxEntries'], at); return freeze({ source: sourceRef(item.source, sourceIds, `${at}.source`), maxEntries: positive(item.maxEntries, `${at}.maxEntries`, true) }); })();
  const features = input.features === undefined ? undefined : (() => { const at = 'recipe.features', item = record(input.features, at); keys(item, ['source', 'maxEntries'], at); return freeze({ source: sourceRef(item.source, sourceIds, `${at}.source`), maxEntries: positive(item.maxEntries, `${at}.maxEntries`, true) }); })();
  const worldFrame = parseWorldFrame(input.worldFrame);
  return freeze({ schema: 'cssearth-authored-object@1', sources: parsedSources, shape: freeze({ kind: shapeInput.kind, radiusKm, ...(secondaryRadiusKm === undefined ? {} : { secondaryRadiusKm }), ...(polarRadiusKm === undefined ? {} : { polarRadiusKm }) }), surfaces: parsedSurfaces, ...(materials === undefined ? {} : { materials }), ...(frameBanks === undefined ? {} : { frameBanks }), ...(cutaway === undefined ? {} : { cutaway }), ...(atmosphere === undefined ? {} : { atmosphere }), ...(rings === undefined ? {} : { rings }), ...(emission === undefined ? {} : { emission }), ...(motion === undefined ? {} : { motion }), ...(destinations === undefined ? {} : { destinations }), ...(features === undefined ? {} : { features }), ...(worldFrame === undefined ? {} : { worldFrame }) });
}

/** Keeps the legacy envelope compatible while making authored capability data typed. */
export function parseAuthoredObjectDescriptor(value: unknown): AuthoredObjectDescriptor {
  const descriptor = parseObjectDescriptor(value);
  const raw = descriptor.properties.recipe;
  if (raw === undefined) throw new TypeError('object.properties.recipe is required for authored objects.');
  return freeze({ ...descriptor, recipe: parseAuthoredRecipe(raw) });
}
