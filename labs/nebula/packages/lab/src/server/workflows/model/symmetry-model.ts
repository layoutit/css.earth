/** `model <id> --method symmetry`: the Wenger, Lorenz & Magnor (2013) axial-symmetry fit of the object's experiment
 * recipe, read as surfaces of revolution instead of baked as a volume. It writes the envelope as a binary STL and the
 * `geometry.surface` block the image-layer bake reads (`surface.stl`, `surface-recipe.json`), the photograph's crop the
 * fit saw (`image.png`), and the outlines on that crop. */
import { isRecord } from '@cssearth/core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { emissionProfile, revolvedSurface, surfaceOutlines, surfacePole, surfaceStl } from '@cssearth/nebula-reconstruction/methods/symmetry/surfaces';
import type { LabObject } from '../lab-objects.ts';
import { fitSymmetryRecipe, readSymmetryRecipe } from '../emission-inference/symmetry-fit.ts';
import { LAB_MODEL_SCHEMA, modelDirectory, shown, type LabModel, type ModelOutline, creditLabel } from './model-output.ts';

/** The envelope reaches this fraction of the fit's brightest group: fainter light lies inside the surface. */
export const ENVELOPE_FRACTION = .15;
const WENGER_2013 = 'https://doi.org/10.1111/cgf.12216';

export async function symmetrySurfaces(root: string, object: LabObject, stage: (message: string, fraction: number) => void): Promise<LabModel> {
  const recipePath = object.solvers.symmetry;
  if (!recipePath) throw new TypeError(`${object.id} has no symmetry experiment (subjects.json solvers.symmetry).`);
  stage('Reading the symmetry experiment', .02);
  const recipe = readSymmetryRecipe(await readFile(resolve(root, recipePath), 'utf8'));
  // The sky frame the site bank keeps: its unit on the sky and where north points in the photograph.
  const delivery: unknown = JSON.parse(await readFile(resolve(root, object.object, 'source/delivery.json'), 'utf8').catch(() => 'null'));
  const sky = isRecord(delivery) && isRecord(delivery.sky) ? delivery.sky : null;
  const arcsecPerVolumeUnit = typeof sky?.arcsecPerUnit === 'number' ? sky.arcsecPerUnit : null;
  const northLeftOfUp = typeof sky?.imageRotationDegrees === 'number' ? sky.imageRotationDegrees : null;
  stage('Fitting the photograph (Wenger et al. 2013)', .05);
  const fit = await fitSymmetryRecipe(root, recipePath, recipe, (channel, iteration) =>
    stage(`Fit · channel ${channel + 1}/3 · iteration ${iteration}/${recipe.iterations}`, .05 + .75 * (channel + iteration / recipe.iterations) / 3));
  stage('Reading the fit as surfaces of revolution', .82);
  const { grid, prior, crop } = recipe;
  const surface = revolvedSurface(emissionProfile(fit.results.map(result => result.volume), grid, prior), ENVELOPE_FRACTION);
  // One grid cell on the sky: prepare-emission's volume spans 10 units across the grid's width.
  const arcsecPerCell = arcsecPerVolumeUnit === null ? null : arcsecPerVolumeUnit * 10 / grid.width;
  const pole = surfacePole(prior, northLeftOfUp === null ? 0 : -northLeftOfUp);
  const directory = modelDirectory(root, object.id), relative = (name: string) => `${object.object}/.local/lab/model/${name}`;
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'surface.stl'), surfaceStl(surface));
  const notes = [`Envelope at ${ENVELOPE_FRACTION * 100}% of the fit's peak emission; the wall is each axial position's brightest radius.`,
    ...recipe.assumptions.filter(line => /axis|symmetry|inclination/i.test(line)).map(line => line.split('. ')[0]! + '.')];
  if (pole.tipped) notes.push(`The prior's axis lies in the plane of the sky (${shown(pole.measuredTiltDeg)}° from the sight line); the bake needs a receding end, so the pole is tipped to ${pole.tiltDeg}°. Which lobe recedes is not measured.`);
  if (northLeftOfUp === null) notes.push('No sky frame (delivery.json sky): the pole\'s position angle takes image up as north.');
  const files = [relative('surface.stl')];
  if (arcsecPerCell !== null) {
    await writeFile(resolve(directory, 'surface-recipe.json'), JSON.stringify({ surface: { source: 'wenger-lorenz-magnor-2013', path: 'surface.stl',
      basis: `Axial-symmetry fit (Wenger, Lorenz & Magnor 2013, ${WENGER_2013}) of ${recipePath}, read as the envelope at ${ENVELOPE_FRACTION} of the peak emission. Lab output (model --method symmetry); its source record and the photograph's registration are still to be written before a bake.`,
      arcsecPerUnit: shown(arcsecPerCell), originUnits: [0, 0, 0], pole: { tiltDeg: pole.tiltDeg, paDeg: shown(pole.paDeg), rollDeg: 0, receding: pole.receding }, fitArcsec: shown(arcsecPerCell) } }, null, 2) + '\n');
    files.push(relative('surface-recipe.json'));
  } else notes.push('No sky scale: surface-recipe.json is not written.');
  stage('Writing the fit image', .9);
  await sharp(fit.source).extract(crop).png().toFile(resolve(directory, 'image.png'));
  files.push(relative('image.png'));
  // Grid cell centres to the crop's pixels.
  const sx = crop.width / grid.width, sy = crop.height / grid.height;
  const outlines: ModelOutline[] = surfaceOutlines(surface, prior).map(outline => ({ id: outline.id, label: outline.kind === 'envelope' ? 'Envelope' : 'Wall', kind: outline.kind,
    closed: outline.closed, points: outline.points.map(([x, y]) => [(x + .5) * sx - .5, (y + .5) * sy - .5] as [number, number]) }));
  const lengthCells = surface.samples.at(-1)!.axialCells - surface.samples[0]!.axialCells;
  const widest = Math.max(...surface.samples.map(sample => sample.envelopeCells));
  const arcsec = (cells: number) => arcsecPerCell === null ? `${shown(cells)} cells` : shown(cells * arcsecPerCell);
  return { schema: LAB_MODEL_SCHEMA, id: object.id, method: 'symmetry', createdAt: new Date().toISOString(),
    image: { path: relative('image.png'), width: crop.width, height: crop.height, label: creditLabel(recipe.source.credit) },
    outlines, points: [],
    surfaces: [{ kind: 'surface', label: 'Envelope (revolved)', values: { lengthArcsec: arcsec(lengthCells), widestRadiusArcsec: arcsec(widest), samples: surface.samples.length,
      tiltDeg: pole.tiltDeg, paDeg: shown(pole.paDeg), receding: pole.receding } }],
    metrics: { channels: fit.results.length, iterations: recipe.iterations, solverSeconds: shown(fit.solverSeconds),
      projectionError: 'report' in fit.results[0]! && fit.results[0]!.report ? shown(Math.max(...fit.results.map(result => 'report' in result ? (result.report as { relativeProjectionError: number }).relativeProjectionError : 0))) : null,
      arcsecPerCell: arcsecPerCell === null ? null : shown(arcsecPerCell), envelopeFraction: ENVELOPE_FRACTION },
    files, notes };
}
