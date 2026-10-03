/** Pure authored nebula delivery envelope; transport and preparation stay with callers. */
export const NEBULA_DELIVERY_SCHEMA = 'cssearth-nebula-delivery@2';
export interface NebulaSkyFrame {
  centerIcrsDegrees: [number, number]; distancePc: number;
  /** ICRS vectors for one source X/Y/Z unit, including image handedness. */
  imageRotationDegrees: number;
  arcsecPerUnit: number;
}
const record = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError('Expected nebula delivery object.'); return v as Record<string, unknown>; };
const text = (v: unknown) => { if (typeof v !== 'string' || !v) throw new TypeError('Expected nebula delivery text.'); return v; };
const finite = (v: unknown) => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError('Expected finite nebula delivery value.'); return v; };
interface Pin { path: string }
function pin(v: unknown): Pin {
  const p = record(v), path = text(p.path);
  return { path };
}
export function readNebulaDelivery(v: unknown) {
  const r = record(v), frame = record(r.sky), center = frame.centerIcrsDegrees;
  if (r.schema !== NEBULA_DELIVERY_SCHEMA || !/^[a-z][a-z0-9-]*$/.test(text(r.id)) ||
      !['compiler','axial-symmetry','density-grid'].includes(text(r.method)) || !Array.isArray(center) || center.length !== 2 || !Array.isArray(r.inputPins)) throw new TypeError('Invalid nebula delivery recipe.');
  if (!(finite(r.framingRadiusUnits)>0) || !/^https:\/\//.test(text(r.sourceUrl))) throw new TypeError('Invalid nebula framing/source URL.');
  if (r.attachedTo !== undefined && !/^[a-z][a-z0-9-]*$/.test(text(r.attachedTo))) throw new TypeError('Invalid attached body id.');
  if (r.compositeRecipe !== undefined && r.method !== 'compiler') throw new TypeError('Optical composite requires compiler delivery.');
  if (r.compactInputs !== undefined && !['compiler','sampled','symmetry','density-grid'].includes(text(r.compactMethod))) throw new TypeError('Invalid compact bake method.');
  if (r.compactInputs !== undefined && ((r.compactMethod === 'symmetry') !== (r.method === 'axial-symmetry'))) throw new TypeError('Compact method and delivery method differ.');
  // A density-grid delivery bakes checked-in volume recipes and their grids, one per dataset.
  if ((r.compactMethod === 'density-grid') !== (r.method === 'density-grid')) throw new TypeError('Density-grid delivery names its own compact method.');
  let grids: { id: string; label: string; recipe: Pin; sourceUrl?: string; occultingCentreUnits?: [number,number,number] }[] | undefined;
  if (r.method === 'density-grid') {
    if (!Array.isArray(r.grids) || !r.grids.length) throw new TypeError('A density-grid delivery lists its grids.');
    grids = r.grids.map(value => {
      const row = record(value);
      if (!/^[a-z][a-z0-9-]*$/.test(text(row.id))) throw new TypeError('Invalid density-grid dataset id.');
      if (row.sourceUrl !== undefined && !/^https:\/\//.test(text(row.sourceUrl))) throw new TypeError('Invalid density-grid source URL.');
      const centre = row.occultingCentreUnits;
      if (centre !== undefined && (!Array.isArray(centre) || centre.length !== 3 || !centre.every(value => typeof value === 'number' && Number.isFinite(value))))
        throw new TypeError('Invalid density-grid occulting centre.');
      return { id: text(row.id), label: text(row.label), recipe: pin(row.recipe),
        ...(row.sourceUrl === undefined ? {} : { sourceUrl: text(row.sourceUrl) }),
        ...(centre === undefined ? {} : { occultingCentreUnits: [centre[0], centre[1], centre[2]] as [number,number,number] }) };
    });
    if (new Set(grids.map(grid => grid.id)).size !== grids.length) throw new TypeError('Duplicate density-grid dataset id.');
    if (!grids.some(grid => grid.id === text(r.defaultDataset))) throw new TypeError('The default dataset names no density grid.');
  }
  const sky: NebulaSkyFrame = { centerIcrsDegrees: [finite(center[0]),finite(center[1])], distancePc: finite(frame.distancePc),
    imageRotationDegrees: finite(frame.imageRotationDegrees), arcsecPerUnit: finite(frame.arcsecPerUnit) };
  return { id: text(r.id), method: text(r.method), request: pin(r.request), inputPins: r.inputPins.map(pin), sky,
    sourceUrl: text(r.sourceUrl), description: text(r.description), defaultDataset: text(r.defaultDataset),
    framingRadiusUnits: finite(r.framingRadiusUnits), acceptedLabResult: text(r.acceptedLabResult),
    ...(r.compactInputs === undefined ? {} : { compactInputs: pin(r.compactInputs), compactMethod: text(r.compactMethod) }),
    ...(grids === undefined ? {} : { grids }),
    ...(r.attachedTo === undefined ? {} : { attachedTo: text(r.attachedTo) }),
    ...(r.compositeRecipe === undefined ? {} : { compositeRecipe: pin(r.compositeRecipe) }),
    ...(r.fieldStars === undefined ? {} : { fieldStars: pin(r.fieldStars) }),
    ...(r.symmetryDirectory === undefined ? {} : { symmetryDirectory: text(r.symmetryDirectory) }) };
}
export type NebulaDelivery = ReturnType<typeof readNebulaDelivery>;
