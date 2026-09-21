import { implementationPins } from '@cssearth/nebula-lab/server/implementation';
/** Prepare a stellar replacement while retaining the exact previously inspected cloud. */
import { readFile, readdir, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { geometrySha, readGeometryPin } from '../geometry/registered-source.ts';
import { jointRecord } from '../../../features/joint-fit/model.ts';
import { readObservations } from '../../../features/observations/models/model.ts';
import { readCompilerRecipe, readCompilerRequest } from '../../../features/compiler/model.ts';
import { prepareCatalogueStars } from './catalogue-stars.ts';
import { COMPILER_STAR_PROFILE_PATH, prepareCompilerStarSprites } from '../../../adapters/application/star-sprites.ts';
import { validateCompilerResult } from './compile.ts';
import { readCompilerResult } from '../../../features/compiler/result.ts';
import { readRetainedEmissionField } from '@cssearth/volume-core/fields/retained-emission';
import { COMPILER_PHYSICAL_REFERENCE } from '@cssearth/volume-core/coordinates/compiler-frame';

export async function refreshCompilerStars(root: string, recipePath: string, previousResultPath: string) {
  const started = performance.now();
  const bytes = await readFile(resolve(root, previousResultPath)), base = await validateCompilerResult(root, JSON.parse(bytes.toString()));
  const recipeBytes = await readFile(resolve(root, recipePath)), recipe = readCompilerRecipe(JSON.parse(recipeBytes.toString()));
  if (!recipe.depthRecipe || recipe.sampledRecipe || recipe.jointRecipe) throw new TypeError('Stellar refresh requires a pinned image-frame cloud.');
  const previous: unknown = JSON.parse((await readGeometryPin(root, base.method)).toString());
  if (!jointRecord(previous)) throw new TypeError('Missing retained cloud method.');
  const oldRecipe = readCompilerRecipe(previous.recipe), request = readCompilerRequest(previous.request);
  const cloudRecipe = ({ observedStars: _stars, maximumStars: _budget, ...rest }: typeof recipe) => rest;
  if (JSON.stringify(cloudRecipe(oldRecipe)) !== JSON.stringify(cloudRecipe(recipe)) || request.recipePath !== recipePath)
    throw new TypeError('Only stellar inputs may change during a retained-cloud refresh.');
  const observationsBytes = await readFile(resolve(root, recipe.observationCatalogue));
  const observations = readObservations(JSON.parse(observationsBytes.toString()));
  if (!jointRecord(previous.physicalDepth) || !jointRecord(previous.physicalDepth.recipe) ||
      typeof previous.physicalDepth.recipe.path !== 'string' || typeof previous.physicalDepth.recipe.sha256 !== 'string') throw new TypeError('Missing retained sky frame.');
  const retainedDepth: unknown = JSON.parse((await readGeometryPin(root, { path: previous.physicalDepth.recipe.path, sha256: previous.physicalDepth.recipe.sha256 })).toString());
  if (!jointRecord(retainedDepth) || !Array.isArray(retainedDepth.centerIcrsDegrees) ||
      JSON.stringify(retainedDepth.centerIcrsDegrees) !== JSON.stringify(observations.frame.centerIcrsDegrees)) throw new TypeError('Stellar refresh cannot change the retained cloud sky frame.');
  const sourceBytes = recipe.observedStars ? await readFile(resolve(root, recipe.observedStars.path)) : undefined;
  if (sourceBytes && geometrySha(sourceBytes) !== recipe.observedStars!.sha256) throw new TypeError('Observed stellar source changed.');
  const model = readRetainedEmissionField(JSON.parse((await readGeometryPin(root, base.model)).toString()));
  const origin = base.scene.coordinates.localOriginArcsec;
  const depthSign = base.scene.frame.referenceFrame === COMPILER_PHYSICAL_REFERENCE ? -1 : 1;
  const prepared = sourceBytes ? prepareCatalogueStars(JSON.parse(sourceBytes.toString()), model, observations.frame.centerIcrsDegrees, recipe.maximumStars, base.sources.map(source => source.id)) :
    { stars: base.scene.stars.map(({ positionUnits, ...star }) => ({ ...star, positionArcsec: [positionUnits[0] + origin[0], positionUnits[1] + origin[1], positionUnits[2] * depthSign + origin[2]] as [number, number, number] })),
      receipt: { method: 'retained-stellar-photometry@1', selectedCount: base.scene.stars.length, interpretation: 'Existing residual-derived positions and per-lens light retained exactly; only the prepared point profile changes. Not a newly measured catalogue.' } };
  const implementation = await implementationPins(root, ['labs/nebula/packages/lab/src/server/workflows/compiler/refresh-stars.ts']);
  const id = geometrySha(JSON.stringify({ method: 'retained-cloud-stellar-refresh@1', base: geometrySha(bytes), recipe: geometrySha(recipeBytes), implementation,
    starProfile: geometrySha(await readFile(resolve(root, COMPILER_STAR_PROFILE_PATH))), stars: prepared }));
  const directory = `.local/nebula-lab/compiler/${id}`; await mkdir(resolve(root, directory), { recursive: true });
  const save = async (name: string, data: Uint8Array) => { const path = `${directory}/${name}`; await writeFile(resolve(root, `${path}.pending`), data);
    await rename(resolve(root, `${path}.pending`), resolve(root, path)); return { path, sha256: geometrySha(data) }; };
  let physicalDepth = previous.physicalDepth;
  if (jointRecord(physicalDepth)) {
    const copy = async (v: unknown, name: string) => {
      if (!jointRecord(v) || typeof v.path !== 'string' || typeof v.sha256 !== 'string') throw new TypeError('Missing depth snapshot.');
      return save(name, await readGeometryPin(root, { path: v.path, sha256: v.sha256 }));
    };
    physicalDepth = { ...physicalDepth, recipe: await copy(physicalDepth.recipe, 'depth-recipe.json'), evidence: await copy(physicalDepth.evidence, 'physical-evidence.json') };
  }
  const method = await save('method.json', Buffer.from(JSON.stringify({ ...previous, recipe, recipeSha256: geometrySha(recipeBytes), implementation, physicalDepth,
    observedStars: recipe.observedStars ? { source: recipe.observedStars, ...prepared.receipt } : undefined, stellarAppearance: prepared.receipt,
    stars: prepared.receipt.interpretation, execution: 'Only stellar presentation recomputed. All cloud resources, geometry, alpha, material and fit metrics retained without new qualification.',
    retainedCloud: { result: { path: previousResultPath, sha256: geometrySha(bytes) }, method: base.method, volumeId: base.scene.volumeId ?? base.id } }, null, 2)));
  const starSprites = await prepareCompilerStarSprites(root, directory, prepared.stars);
  const stars = prepared.stars.map(({ positionArcsec, ...star }) => ({ ...star,
    positionUnits: [positionArcsec[0] - origin[0], positionArcsec[1] - origin[1], (positionArcsec[2] - origin[2]) * depthSign] }));
  const result = readCompilerResult({ ...base, id, method, scene: { ...base.scene, id, volumeId: base.scene.volumeId ?? base.id, stars, ...starSprites },
    metrics: { ...base.metrics, stars: stars.length }, pipeline: [...base.pipeline.filter(stage => stage.id !== 'stars'),
      { id: 'stars', label: recipe.observedStars ? 'Prepare measured catalogue lights · retained cloud' : 'Prepare soft stellar profiles · retained cloud', state: 'complete', seconds: (performance.now() - started) / 1000 }] });
  await validateCompilerResult(root, result);
  const resultPin = await save('result.json', Buffer.from(JSON.stringify(result)));
  const inputs = [recipePath, recipe.observationRecipe, recipe.observationCatalogue, recipe.structureRecipe, recipe.structureCatalogue, ...(recipe.observedStars ? [recipe.observedStars.path] : []),
    ...implementation.map(owner => owner.path)];
  if (recipe.depthRecipe) {
    inputs.push(recipe.depthRecipe);
    const depth: unknown = JSON.parse(await readFile(resolve(root, recipe.depthRecipe), 'utf8'));
    if (!jointRecord(depth) || !jointRecord(depth.evidence) || typeof depth.evidence.path !== 'string') throw new TypeError('Missing depth evidence.');
    inputs.push(depth.evidence.path);
  }
  const publication = { schema: 'cssearth-nebula-compiler-published@1', recipePath, result: resultPin,
    inputs: await Promise.all(inputs.map(async path => ({ path, sha256: geometrySha(await readFile(resolve(root, path))) }))) };
  return { result, publication, receipt: prepared.receipt };
}
