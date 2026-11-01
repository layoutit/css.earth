/**
 * The accepted physical model, read from `source/model/` (restored from the source mirror) and the fitted values in
 * `source/preparation/l36/`. It is one fixed model: no earlier version is read and nothing is fitted here.
 */
import { readFile } from 'node:fs/promises';
import { array, json, loadWarp, need, num, numbers, rec, ROOT, type Raster } from './inputs.mts';
import { volumeObject, type Component, type VolumeObject } from './catalogue-volume.mts';
import { readGrade, type Grade } from './grade.mts';
import type { V3 } from './geometry.mts';

export const OBJECT = 'src/objects/lmc-volume/';
export const RECORDS = ROOT + OBJECT + 'source/preparation/l36/';
const MODEL = ROOT + OBJECT + 'source/model/';
/** Everything the bake builds on the way to `prepared/`; ignored by Git. */
export const BAKE_DIR = 'output/lmc-bake/';
const FIELD_HALF_KPC = 10;
/**
 * Cells across each population field. The far pictures use one 9.77 pc grid. The near slabs were baked on the coarser grids
 * the model was fitted on (39 pc for the old stars, 19.5 pc for the young), and the published slabs hold that sampling.
 */
const GRIDS = {
  far: { disc: ['field-disc.f32le', 2048], bar: ['field-bar.f32le', 2048], young: ['field-young.f32le', 2048] },
  slab: { disc: ['slab-disc.f32le', 512], bar: ['slab-bar.f32le', 512], young: ['slab-young.f32le', 1024] },
} as const;
type Grid = keyof typeof GRIDS;

export interface Owner {
  id: string;
  kind: string;
  component: Component;
  prior: number;
  maximum: number;
  measuredAge: boolean;
  logAge: number | null;
  aliases: string[];
}
export interface GaiaPointField {
  count: number;
  positions: Float64Array;
  rgb: Float32Array;
  components: Uint8Array;
}
export interface OldPopulation {
  disc: Raster;
  bar: Raster;
  points: GaiaPointField;
  oldFraction: number;
  youngFraction: number;
}
export interface DustLayer {
  column: Raster;
  strength: number;
  clouds: VolumeObject[];
  extinctionRgb: V3;
}
export interface CatalogueScene {
  objects: VolumeObject[];
  owners: Owner[];
  warp: Raster;
  colors: V3[];
  barSigmaZ: number;
  innerDiscColor: V3;
  oldPopulation: OldPopulation;
  dustLayer: DustLayer;
  youngDensity: Raster;
  youngOwner: string;
  youngTint: V3;
  outskirtsGain: number;
  innerDiscGain: number;
  barGain: number;
}
export interface LmcModel {
  scene: CatalogueScene;
  amplitudes: Float64Array;
  grade: Grade;
}

const text = (v: unknown) => {
  need(typeof v === 'string', 'Expected a model record string');
  return v;
};
const triple = (v: unknown): V3 => {
  const a = numbers(v, 3);
  return [a[0]!, a[1]!, a[2]!];
};
function component(v: unknown): Component {
  const n = num(v);
  need(n === 0 || n === 1 || n === 2 || n === 3 || n === 4, 'Invalid model component');
  return n;
}
function readObject(value: unknown): VolumeObject {
  const r = rec(value),
    kind = r.kind,
    b = array(r.basis);
  need(
    kind === 'ball' || kind === 'shell' || kind === 'filament' || kind === 'dust' || kind === 'dust-tent',
    'Invalid model primitive',
  );
  return volumeObject({
    id: text(r.id),
    owner: text(r.owner),
    kind,
    component: component(r.component),
    center: triple(r.center),
    basis: [triple(b[0]), triple(b[1]), triple(b[2])],
    axes: triple(r.axes),
    inner: num(r.inner),
    color: triple(r.color),
    weight: num(r.weight),
    source: text(r.source),
    ...(r.halfSpace ? { halfSpace: triple(r.halfSpace) } : {}),
  });
}
function readOwner(value: unknown): Owner {
  const r = rec(value);
  need(typeof r.measuredAge === 'boolean', 'Invalid model owner age status');
  return {
    id: text(r.id),
    kind: text(r.kind),
    component: component(r.component),
    prior: num(r.prior),
    maximum: num(r.maximum),
    measuredAge: r.measuredAge,
    logAge: r.logAge === null ? null : num(r.logAge),
    aliases: array(r.aliases).map(text),
  };
}
const bytes = async (name: string, length: number) => {
  const data = await readFile(MODEL + name);
  need(data.length === length, 'Wrong model file size: ' + name);
  return Uint8Array.from(data).buffer;
};
async function field([name, cells]: readonly [string, number]): Promise<Raster> {
  const values = new Float32Array(await bytes(name, cells * cells * 4));
  need(
    values.every(v => Number.isFinite(v) && v >= 0),
    'Invalid model field: ' + name,
  );
  return { n: cells, half: FIELD_HALF_KPC, values, mask: new Uint8Array(cells * cells).fill(1) };
}

/** The whole model, with its population fields on the grid `grid` names. */
export async function loadModel(grid: Grid = 'slab'): Promise<LmcModel> {
  const recipe = rec(await json(RECORDS + 'recipe.json')),
    fit = rec(await json(RECORDS + 'fit.json')),
    controls = rec(fit.sceneControls),
    structure = rec(await json(MODEL + 'structure.json')),
    owners = array(structure.owners).map(readOwner),
    young = owners.find(o => o.kind === 'population'),
    rows = array(await json(MODEL + 'owner-amplitudes.json')),
    count = num(recipe.oldPoints);
  need(young, 'The model has no diffuse young population');
  young.id = 'Gaia-diffuse-young';
  young.aliases = ['Gaia DR3 Young 1 + Young 2'];
  need(rows.length === owners.length, 'The owner amplitudes do not match the owners');
  const amplitudes = Float64Array.from(rows, (v, i) => {
    const r = rec(v);
    need(r.id === owners[i]!.id, 'The owner amplitudes are in another order');
    return num(r.amplitude);
  });
  const oldPopulation: OldPopulation = {
    disc: await field(GRIDS[grid].disc),
    bar: await field(GRIDS[grid].bar),
    points: {
      count,
      positions: new Float64Array(await bytes('old-points-positions.f64le', count * 24)),
      rgb: new Float32Array(await bytes('old-points-rgb.f32le', count * 12)),
      components: new Uint8Array(await bytes('old-points-components.u8', count)),
    },
    oldFraction: num(controls.oldResolvedFraction),
    youngFraction: num(controls.youngResolvedFraction),
  };
  const DUST_CELLS = 2048,
    dustColumn = new Float32Array(await bytes('dust-column.f32le', DUST_CELLS * DUST_CELLS * 4));
  return {
    scene: {
      objects: array(structure.objects).map(readObject),
      owners,
      warp: await loadWarp(MODEL + 'oden-surface.json'),
      colors: array(recipe.colors).map(triple),
      barSigmaZ: num(recipe.barSigmaZ),
      innerDiscColor: triple(recipe.innerDiscColor),
      oldPopulation,
      dustLayer: {
        column: {
          n: DUST_CELLS,
          half: FIELD_HALF_KPC,
          values: dustColumn,
          mask: new Uint8Array(DUST_CELLS * DUST_CELLS).fill(1),
        },
        strength: num(recipe.dustStrength),
        clouds: array(await json(MODEL + 'dust-clouds.json')).map(readObject),
        extinctionRgb: triple(recipe.dustExtinctionRgb),
      },
      youngDensity: await field(GRIDS[grid].young),
      youngOwner: young.id,
      youngTint: triple(controls.youngTint),
      outskirtsGain: num(controls.outskirtsGain),
      innerDiscGain: num(controls.innerDiscGain),
      barGain: num(controls.barGain),
    },
    amplitudes,
    grade: readGrade(fit.grade),
  };
}
