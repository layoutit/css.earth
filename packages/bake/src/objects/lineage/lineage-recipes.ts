import { alternativeForLens } from '../layers/terrestrial/index.ts';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import type { InputRole } from '@cssearth/objects/provenance';

const record = requireRecord, text = requireString;
const records = (value: unknown) => requireArray(value).map(item => requireRecord(item));
const maybeRecord = (value: unknown) => value == null ? undefined : requireRecord(value);
const optionalText = (value: unknown) => value == null ? undefined : requireString(value);
const namedRecords = (value: unknown) => records(value).map(item => Object.assign({}, item, { id: requireString(item.id) }));

export interface ManifestInput { readonly path: string; readonly consumers: readonly string[]; readonly lensId?: string }
/** One prepared product and the manifest paths its recipe operation reads. */
export interface ProductBinding {
  id: string; label: string; lensIds: string[]; inputPaths: string[]; parents: string[];
  inputRoles?: Readonly<Record<string, { role: InputRole; evidence: string }>>;
  observationAttribution: 'source-lineage' | 'none';
  interpretation?: { kind?: string; sourceKind?: string };
  limitations: string[];
}
const kind = (value: string) => ({ kind: value });
/** An artist's surface (a model's base-colour texture or a published global map): shown unchanged, never an observation. */
const illustration = (plan: Record<string, unknown>) => ['glb-base-color', 'equirectangular-illustration'].includes(String(maybeRecord(plan.science)?.kind));

/**
 * Which manifest paths each prepared product of a layered body reads, by preparation family. These follow acquisition paths
 * and recipe operations, never factsheet links, publisher names, or UI credits; a lens whose family names no binding has no
 * product. `controls` are the prepared lens controls, `noise` the geographic noise pin when the body has one.
 */
export function lineageProducts({ id, recipes, inputs, paths: declared, controls: rawControls, noise }: {
  id: string; recipes: ReadonlyMap<string, { path: string; parameters: Record<string, unknown> }>;
  inputs: readonly ManifestInput[]; paths: ReadonlySet<string>; controls: readonly unknown[];
  noise?: { id: string; directory: string; file: string };
}): ProductBinding[] {
  const products: ProductBinding[] = [], prefix = `/scenes/${id}/`;
  const controls = namedRecords(rawControls).map(lens => Object.assign({}, lens, { label: optionalText(lens.label), qualification: optionalText(lens.qualification), description: optionalText(lens.description) }));
  const recipe = (name: string) => recipes.get(name)?.parameters;
  const paths = (value: unknown, base = '') => {
    const found = new Set<string>();
    const visit = (node: unknown): void => {
      if (typeof node === 'string') {
        const path = declared.has(node) ? node : declared.has(base + node) ? base + node : null;
        if (path) found.add(path);
      } else if (Array.isArray(node)) node.forEach(visit);
      else if (node && typeof node === 'object') {
        for (const [key, child] of Object.entries(node)) {
          // Pin inventories and descriptive references do not imply consumption.
          if (!['sourcePins', 'sources', 'descriptor', 'provenance', 'sourceUrls', 'sourceUrl'].includes(key)) visit(child);
        }
      }
    };
    visit(value); return [...found];
  };
  const group = (consumer: string) => inputs.filter(input => input.consumers.includes(consumer)).map(input => input.path);
  const add = (key: string, used: string[], extra: Partial<ProductBinding> = {}) => {
    const lens = controls.find(lens => lens.id === key);
    products.push({ id: key, label: lens?.label ?? key, observationAttribution: 'source-lineage', inputPaths: [...new Set(used)], parents: [],
      limitations: [lens?.qualification, lens?.description].filter((value): value is string => Boolean(value)), lensIds: lens ? [key] : [], ...extra });
  };
  const raster = recipe('raster'), terrestrial = recipe('terrestrial');
  const addObservationLenses = () => namedRecords(record(recipe('observations')).lenses).forEach(plan => add(plan.id,
    [...paths(plan), ...paths(maybeRecord(plan.coverage)?.sources)]));
  // A body on the shared sphere lane takes only its lighting bank from the raster recipe; its lenses are observations.
  const lightingOnlyRaster = raster?.schema === 'cssearth-raster-recipe@1' && Array.isArray(raster.surfaces) && !raster.surfaces.length;
  if (raster?.schema === 'cssearth-raster-recipe@1') {
    namedRecords(raster.surfaces).forEach((plan, index) => {
      // A science block names its pinned inputs (continuum frames, off-limb context images) beside the surface source.
      // An HMI continuum mosaic names its frames under the science block; its `source` is their directory, not an input.
      const frames = maybeRecord(maybeRecord(plan.science)?.synoptic)?.kind === 'hmi-continuum-mosaic';
      const sourcePath = text(plan.source), sourceBase = sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1);
      const used = [...(frames ? [] : [sourcePath]), ...paths(plan.coverage), ...paths(plan.science, sourceBase)];
      // A surface-observation lens consumes its whole pinned group (frames, cameras, companions) and its reference shape.
      const surfaceObservation = maybeRecord(plan.science)?.kind === 'surface-observation' ? record(plan.science) : null;
      if (surfaceObservation) used.push(...group(text(record(surfaceObservation.lens).consumer)), text(record(surfaceObservation.shape).path));
      const controlledDetail = maybeRecord(maybeRecord(plan.science)?.detailMosaic);
      if (controlledDetail?.format === 'controlled-geotiff') used.push(...group(text(controlledDetail.consumer)));
      add(plan.id, used, {
        inputRoles: frames ? {} : { [sourcePath]: { role: 'appearance', evidence: `Raster source at /surfaces/${index}/source.` } },
        ...(illustration(plan) ? { observationAttribution: 'none' as const, interpretation: kind('illustrative-model') } : {}),
      });
    });
    if (raster.interior) {
      const plan = record(raster.interior);
      add('interior', [text(plan.source), text(plan.surface)], { observationAttribution: 'none', interpretation: kind('schematic-interior') });
    }
    if (raster.lighting) {
      const file = optionalText(maybeRecord(record(raster.lighting).metadata)?.rendererSourceSnapshot)?.replace(/^source\//u, '');
      add('lighting', file ? [file] : [], { lensIds: [], interpretation: kind('rendering-model') });
    }
    if (raster.atmosphere) add('atmosphere', paths(raster.atmosphere), { lensIds: [] });
    if (lightingOnlyRaster && recipe('observations')?.lenses) addObservationLenses();
  } else if (terrestrial?.kind === 'solid-observation-body') {
    const plans = record(terrestrial.raster), geometry = record(terrestrial.geometry);
    namedRecords(plans.observations).forEach((plan, index) => {
      // This is the same lensId/consumer join used by prepareSolidRasters.
      const observation = inputs.filter(input => input.consumers.includes('surfaces') && input.lensId === plan.id);
      add(plan.id, observation.map(input => input.path), {
        inputRoles: Object.fromEntries(observation.map(input => [input.path, { role: 'appearance', evidence: `Observation selected at /raster/observations/${index}.` }])),
        parents: plan.monochromeBase ? [text(plan.monochromeBase)] : [],
      });
    });
    for (const family of ['scientific', 'observedColors', 'shapeViews', 'surfaceObservations']) {
      namedRecords(plans[family] ?? []).forEach(plan => {
        const used = paths(plan);
        if (plan.consumer) used.push(...group(text(plan.consumer)));
        if (family === 'shapeViews') used.push(...paths(geometry.radialTerrain));
        add(plan.id, used, { parents: plan.monochromeBase ? [text(plan.monochromeBase)] : [], interpretation: kind(family) });
      });
    }
    // Mesh geometry changes the final sampled surface as well as its silhouette.
    if (geometry.radialTerrain) {
      for (const product of products) {
        const modelPaths = paths(alternativeForLens(records(geometry.radialTerrainAlternatives ?? []), product.id) ?? geometry.radialTerrain);
        product.inputPaths = [...new Set([...product.inputPaths, ...modelPaths])];
        product.inputRoles = { ...product.inputRoles, ...Object.fromEntries(modelPaths.map(path => [path, { role: 'geometry' as const, evidence: 'Source selected by the terrestrial radial-terrain geometry recipe.' }])) };
      }
    }
  } else if (terrestrial?.kind === 'affine-photographic-atmosphere') {
    const lenses = record(terrestrial.lenses);
    add(text(record(lenses.normal).id), [text(record(terrestrial.source).path)]);
    namedRecords(lenses.plans).forEach(plan => add(plan.id, [...paths(plan), ...paths(terrestrial.shapePath), ...paths(terrestrial.atmospherePath)]));
  } else if (recipe('shape-model')) {
    const plan = record(recipe('shape-model'));
    const surfaces = Array.isArray(plan.surfaces) ? namedRecords(plan.surfaces.map(item => ({ ...record(item), id: text(record(item).lens) }))) : [];
    // The shape source is the measurement record the manifest binds to this recipe; each lens adds its own surface source.
    for (const lens of controls) {
      const surface = surfaces.find(item => item.id === lens.id), science = maybeRecord(surface?.science)?.kind;
      const used = [...group('shape-model').filter(path => !surfaces.some(item => item.source === path && item.id !== lens.id)), ...paths(surface?.science)];
      if (science === 'glb-base-color') add(lens.id, used, { observationAttribution: 'none', interpretation: kind('illustrative-model') });
      else if (science === 'disc-integrated-color' || science === 'disc-integrated-band-color') add(lens.id, used, { interpretation: kind(science) });
      else add(lens.id, used, { observationAttribution: 'none', interpretation: kind('neutral-shape') });
    }
  } else if (recipe('surface')?.lenses) {
    if (recipe('observations')?.lenses) addObservationLenses();
    const plan = record(recipe('surface'));
    const materialControls = namedRecords(record(plan.descriptor).controls);
    // In this family geometry.sources is an executable input map, not an
    // attribution inventory. The material preparer reads these exact paths.
    const baseInputs = [...paths(recipe('geometry')?.sources), ...paths(recipe('materials')), ...paths(recipe('rings'))];
    namedRecords(plan.lenses).forEach(lens => add(lens.id, [...paths(lens, `${String(plan.sourceSubdirectory)}/`), ...baseInputs], {
      observationAttribution: lens.sourceKind === 'schematic-morphology-illustration' ? 'none' : 'source-lineage',
      ...(typeof lens.sourceKind === 'string' ? { interpretation: { sourceKind: lens.sourceKind } } : {}),
    }));
    // The base material and cutaway are produced by the material recipe.
    for (const lens of controls.filter(lens => !products.some(product => product.id === lens.id))) {
      const materialControl = materialControls.find(control => control.id === lens.id);
      const qualification = materialControl ? optionalText(materialControl.qualification) : undefined;
      add(lens.id, baseInputs, { ...(qualification ? { limitations: [qualification] } : {}),
        ...(lens.view === 'interior' ? { observationAttribution: 'none' as const, interpretation: kind('schematic-interior') } : {}) });
    }
  } else if (recipe('observations')?.lenses) {
    addObservationLenses();
  } else if (recipe('paged-ellipsoid')) {
    const plan = record(recipe('paged-ellipsoid')), planSurface = record(plan.surface), maps = records(planSurface.maps);
    for (const map of maps) {
      const lens = controls.find(lens => lens.surfaceUrl === prefix + text(map.name) + '.webp');
      if (!lens) continue;
      const scientific = maybeRecord(map.scientific)?.kind, fill = maybeRecord(map.deepOceanFill);
      add(lens.id, [text(map.path), ...paths(map.scientific), ...(map.compositeClouds ? [text(record(planSurface.clouds).path)] : []), ...(fill ? [text(fill.path)] : [])],
        fill ? { interpretation: kind('observed-colour-with-depth-shaded-deep-ocean') }
          : scientific === 'gebco-elevation' ? { interpretation: kind('modeled-elevation') }
          : scientific === 'black-marble-radiance' ? { interpretation: kind('observed-nighttime-radiance') } : {});
    }
    for (const lens of controls.filter(lens => !products.some(product => product.id === lens.id))) {
      if (lens.view === 'interior') {
        const tomography = lens.interiorSource ? recipe(text(lens.interiorSource)) : null;
        add(lens.id, [text(plan.interiorPath), ...paths(tomography)], {
          observationAttribution: tomography ? 'source-lineage' : 'none',
          interpretation: kind(tomography ? 'seismic-model-with-schematic-layers' : 'schematic-interior'),
          parents: controls.filter(control => control.surfaceUrl === prefix + text(maps[0]!.name) + '.webp').map(control => control.id),
        });
      } else if (noise?.id === lens.id) {
        add(lens.id, [`${noise.directory}/manifest.json`, `${noise.directory}/${noise.file}`], { observationAttribution: 'none', interpretation: kind('modeled-noise') });
      }
      // Geographic pages carry a separate release; the global base map a lens button falls back to does not establish them.
    }
  }
  // A dataset that names a companion cloud prepares nothing of its own: it keeps the plates of the lens it borrows and
  // turns on a volume another package prepares. Its parent is that lens; the cloud's own sources are that package's.
  for (const lens of controls) {
    const volume = maybeRecord(lens.volume);
    if (volume && !products.some(product => product.id === lens.id)) add(lens.id, [], { parents: [text(volume.surface)], interpretation: kind('companion-volume') });
  }
  const content = recipes.get('content');
  if (content) add('content', [content.path.replace(/^source\//u, '')], { label: 'Object information', lensIds: [] });
  records(recipe('charts')?.charts ?? []).forEach((plan, index) => add(`chart:${index}`,
    paths([plan.source, ...(plan.kind === 'retrieved-profile' ? records(plan.series).map(series => series.path) : [])]),
    { label: text(plan.title ?? plan.kind), lensIds: [], ...(typeof plan.kind === 'string' ? { interpretation: kind(plan.kind) } : {}) }));
  const features = recipe('features');
  if (features?.schema === 'cssearth-surface-features@1') {
    const directory = text(features.directory), traces = maybeRecord(features.traces), sites = maybeRecord(features.sites), landmarks = maybeRecord(features.landmarks);
    add('features', [`${directory}/manifest.json`, ...(features.archive === null ? [] : [`${directory}/${text(features.archive)}`]), text(features.surfaceMap),
      ...(typeof features.notes === 'string' ? [`${directory}/${features.notes}`] : []),
      ...(sites ? [`${directory}/${text(sites.document)}`, ...(Array.isArray(sites.inputs) ? sites.inputs.map(item => `${directory}/${text(item)}`) : [])] : []),
      ...(landmarks ? [`${directory}/${text(landmarks.document)}`, ...paths(landmarks.inputs)] : []),
      ...(traces ? [`${text(traces.directory)}/manifest.json`, `${text(traces.directory)}/${text(traces.archive)}`] : [])],
    { label: 'Named features', lensIds: [], interpretation: kind('nomenclature-centre-points') });
  }
  return products;
}
