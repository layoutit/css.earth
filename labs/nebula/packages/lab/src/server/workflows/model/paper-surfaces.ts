/** `model <id> --method paper-surfaces`: the surfaces a paper publishes for the nebula, as the object's image-layer
 * recipe holds them (Cas A's shell from DeLaney et al. 2010, the Helix's rings, M57's ring and lobes…), drawn on the
 * registered photograph the bake lays on them. Read-only: it reads the recipe (the working copy when there is one) and
 * writes only the lab result. */
import { isRecord } from '@cssearth/core';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { photographOutlines, photographPixel, readPlateRecipe, speedPoints, speedTable } from '../../../features/plates/plates-model.ts';
import type { LabObject } from '../lab-objects.ts';
import { readRecipeState } from '../plates/working-copy.ts';
import { ellipsePoints, LAB_MODEL_SCHEMA, shown, type LabModel, type ModelOutline, type ModelSurface, creditLabel } from './model-output.ts';

/** Most speed-table rows drawn: a denser table is shown one row in every stride, evenly. */
const MOST_POINTS = 4000;

/** Every published outline in the geometry: a closed curve of position angles and radii about the star. */
function radialOutlines(geometry: Record<string, unknown>, at: (east: number, north: number) => [number, number]): ModelOutline[] {
  const found: ModelOutline[] = [];
  const visit = (node: unknown, path: string[]) => {
    if (!isRecord(node)) return;
    const angles = node.positionAnglesDeg, radii = node.radiiArcsec, scale = typeof node.scale === 'number' ? node.scale : 1;
    if (Array.isArray(angles) && Array.isArray(radii) && angles.length === radii.length && angles.length >= 3 && angles.every(Number.isFinite) && radii.every(Number.isFinite)) {
      const points = (angles as number[]).map((pa, index) => { const r = (radii as number[])[index]! * scale, turn = pa * Math.PI / 180; return at(r * Math.sin(turn), r * Math.cos(turn)); });
      found.push({ id: path.join('.'), label: `${path.join(' · ')} (measured)`, kind: 'outline', closed: true, points });
    }
    for (const [key, value] of Object.entries(node)) visit(value, [...path, key]);
  };
  for (const [key, value] of Object.entries(geometry)) visit(value, [key]);
  return found;
}
/** The first numbers of a geometry block, for the Model tab's table. */
function values(node: Record<string, unknown>): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  const visit = (value: unknown, path: string[]) => {
    if (Object.keys(out).length >= 8) return;
    if (typeof value === 'number' && Number.isFinite(value)) out[path.join('.')] = shown(value);
    else if (isRecord(value)) for (const [key, inner] of Object.entries(value)) { if (!['source', 'basis', 'columns', 'outline'].includes(key)) visit(inner, [...path, key]); }
  };
  visit(node, []);
  return out;
}

export async function paperSurfaces(root: string, object: LabObject, stage: (message: string, fraction: number) => void): Promise<LabModel> {
  if (object.kind !== 'plates') throw new TypeError(`${object.id} has no image-layer recipe: paper surfaces are read from source/recipe.json's geometry.`);
  stage('Reading the recipe and manifest', .1);
  const { recipe: raw, working } = await readRecipeState(root, object.id);
  const manifest: unknown = JSON.parse(await readFile(resolve(root, object.object, 'source/manifest.json'), 'utf8').catch(() => 'null'));
  const recipe = readPlateRecipe(raw, manifest);
  const geometry = isRecord(raw) && isRecord(raw.geometry) ? raw.geometry : {};
  const notes: string[] = [];
  if (working) notes.push('Read from the unsaved working copy.');
  stage('Drawing the published surfaces on the photograph', .4);
  const cosDec = Math.cos(recipe.observation.centerDecDeg * Math.PI / 180);
  const starEast = (recipe.target.raDeg - recipe.observation.centerRaDeg) * cosDec * 3600, starNorth = (recipe.target.decDeg - recipe.observation.centerDecDeg) * 3600;
  const outlines: ModelOutline[] = [];
  if (recipe.cropped) notes.push('The recipe reads a window of a larger photograph: no single frame to draw the surfaces on.');
  else {
    for (const ellipse of photographOutlines(recipe, raw)) outlines.push({ id: ellipse.id, label: ellipse.id, kind: ellipse.id === 'disc' || ellipse.id === 'ring' ? 'plate' : 'ellipse', closed: true,
      points: ellipsePoints(ellipse.cx, ellipse.cy, ellipse.rx, ellipse.ry, ellipse.rotationDeg) });
    outlines.push(...radialOutlines(geometry, (east, north) => photographPixel(recipe, starEast + east, starNorth + north)));
  }
  let points: LabModel['points'] = [], speedRows = 0;
  const table = recipe.cropped ? null : speedTable(raw);
  if (table) {
    stage(`Reading the speed table ${table.path}`, .6);
    const text = await readFile(resolve(root, object.object, 'source', table.path), 'utf8').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
    if (text === null) notes.push(`${table.path} is not restored here (pnpm setup:sources): speeds not drawn.`);
    else { const read = speedPoints(recipe, table, text, MOST_POINTS); points = read.points; speedRows = read.rows; }
  }
  const surfaces: ModelSurface[] = recipe.geometry.map(item => ({ kind: item.kind, label: item.kind,
    ...(item.source ? { record: `src/sources/${item.source}.json` } : {}), values: isRecord(geometry[item.kind]) ? values(geometry[item.kind] as Record<string, unknown>) : {} }));
  if (!surfaces.length) throw new TypeError(`${object.id}: the recipe's geometry names no published surface (rings, shape, surface, densityGrid…).`);
  if (surfaces.some(item => ['surface', 'densityGrid', 'body'].includes(item.kind)) && !recipe.cropped)
    notes.push('A mesh or density grid is drawn by its fitted frame only; its silhouette is not traced here.');
  stage('Writing the result', .9);
  const picture = recipe.pictures.original ?? recipe.photograph.path;
  return { schema: LAB_MODEL_SCHEMA, id: object.id, method: 'paper-surfaces', createdAt: new Date().toISOString(),
    image: { path: `${object.object}/source/${picture}`, width: recipe.photograph.width, height: recipe.photograph.height, label: creditLabel(recipe.photograph.credit) },
    outlines, points, surfaces,
    metrics: { surfaces: surfaces.length, outlines: outlines.length, speedRows, speedPointsShown: points.length, distancePc: recipe.distancePc },
    files: [], notes };
}
