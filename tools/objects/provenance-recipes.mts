import { alternativeForLens } from './terrestrial-layers/alternative-lenses.mts';
import {record, records, maybeRecord, text, texts, optionalText, namedRecords, textValues, provenanceManifest} from './provenance-records.mts';
import {CANONICAL_PREPARED_IMAGE_DENSITY as RASTER_DENSITY} from '../../src/platform/prepared-object-assets.mts';
import type {ProductBinding, ProvenanceGap, ProvenanceRecipeSource, GeographicProvenance} from './provenance-records.mts';
// Dependency bindings for the shared preparers. These follow acquisition paths
// and recipe operations, never factsheet links, publisher names, or UI credits.
// Unknown capabilities remain explicit gaps rather than receiving invented edges.
export function provenanceProducts({id, recipes, manifest: inputManifest, lenses: inputLenses, assets: inputAssets, geographic, runtimeUrls = []}: {
  id: string; recipes: ReadonlyMap<string, ProvenanceRecipeSource>; manifest: unknown; lenses?: unknown; assets?: unknown; geographic?: GeographicProvenance; runtimeUrls?: readonly string[];
}) {
  const manifest = provenanceManifest(inputManifest), lenses = maybeRecord(inputLenses), assets = maybeRecord(inputAssets);
  const products: ProductBinding[] = [], unresolved: ProvenanceGap[] = [], prefix = `/scenes/${id}/`;
  const inputPaths = new Set([...manifest.inputs, ...(manifest.documents ?? []), ...(manifest.generatedIntermediates ?? [])].map(input => input.path));
  const controls = namedRecords(lenses?.controls ?? []).map(lens => Object.assign({}, lens, {label: optionalText(lens.label), qualification: optionalText(lens.qualification), description: optionalText(lens.description)}));
  const recipe = (name: string) => recipes.get(name)?.parameters;
  const paths = (value: unknown, base = '') => {
    const found = new Set<string>();
    const visit = (node: unknown): void => {
      if (typeof node === 'string') {
        const path = inputPaths.has(node) ? node : inputPaths.has(base + node) ? base + node : null;
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
  const urls = (value: unknown) => {
    const found = new Set<string>();
    const visit = (node: unknown): void => {
      if (typeof node === 'string' && node.startsWith(prefix) && !/[\s;()]/u.test(node)) found.add(node);
      else if (Array.isArray(node)) node.forEach(visit);
      else if (node && typeof node === 'object') Object.values(node).forEach(visit);
    };
    visit(value); return [...found];
  };
  const surface = (lensId: string) => Array.isArray(assets?.surfaces)
    ? records(assets.surfaces).find(item => item.id === lensId) : maybeRecord(maybeRecord(assets?.surfaces)?.[lensId]);
  const outputs = (lensId: string) => urls([controls.find(lens => lens.id === lensId), surface(lensId)]);
  const group = (consumer: string) => manifest.inputs.filter(input => input.consumers.includes(consumer)).map(input => input.path);
  const add = (key: string, recipeId: string, selector: string, used: string[], process: string, extra: Partial<ProductBinding> = {}) => {
    const lens = controls.find(lens => lens.id === key);
    const value: ProductBinding = { id: key, label: lens?.label ?? key, recipe: recipeId, selector, observationAttribution: 'source-lineage',
      inputPaths: [...new Set(used)], parents: [], urls: outputs(key), process,
      limitations: [lens?.qualification, lens?.description].filter((value): value is string => Boolean(value)), lensIds: lens ? [key] : [],
      recipeDependencies: [recipeId], ...extra };
    products.push(value);
  };
  const raster = recipe('raster'), terrestrial = recipe('terrestrial');
  const addObservationLenses = () => namedRecords(record(recipe('observations')).lenses).forEach((plan, index) => add(plan.id, 'observations', `/lenses/${index}`, paths(plan),
    'Apply the declared observation, polar coverage and spectral display operation.', {
      interpretation: { operation: plan.operation, qualification: plan.qualification ?? maybeRecord(plan.control)?.qualification },
    }));
  // A body on the shared sphere lane takes only its lighting bank from the raster recipe; its lenses are observations.
  const lightingOnlyRaster = raster?.schema === 'cssearth-raster-recipe@1' && Array.isArray(raster.surfaces) && !raster.surfaces.length;
  if (raster?.schema === 'cssearth-raster-recipe@1') {
    const name = (template: unknown, density: number, key?: string) => prefix + text(template).replaceAll('{id}', key ?? '')
      .replaceAll('{suffix}', density === 2 ? '@2x' : '').replaceAll('{density}', String(density));
    namedRecords(raster.surfaces).forEach((plan, index) => {
      // A science block names its pinned inputs (continuum frames, off-limb context images) beside the surface source.
      // An HMI continuum mosaic names its frames under the science block; its `source` is their directory, not an input.
      const frames = maybeRecord(maybeRecord(plan.science)?.synoptic)?.kind === 'hmi-continuum-mosaic';
      const used = [...(frames ? [] : [text(plan.source)]), ...paths(plan.coverage), ...paths(plan.science)];
      // A surface-observation lens consumes its whole pinned group (frames, cameras, companions) and its reference shape.
      const surfaceObservation = maybeRecord(plan.science)?.kind === 'surface-observation' ? record(plan.science) : null;
      if (surfaceObservation) used.push(...group(text(record(surfaceObservation.lens).consumer)), text(record(surfaceObservation.shape).path));
      const controlledDetail=maybeRecord(maybeRecord(plan.science)?.detailMosaic);
      if(controlledDetail?.format==='controlled-geotiff')used.push(...group(text(controlledDetail.consumer)));
      const outputUrls = [name(plan.output, RASTER_DENSITY, plan.id), name(plan.thumbnail, 1, plan.id)];
      if (!raster.polesCombined) outputUrls.push(name(raster.polesOutput, RASTER_DENSITY, plan.id));
      const emission = maybeRecord(raster.emission);
      if (emission) outputUrls.push(name(emission.offLimbOutput, RASTER_DENSITY, plan.id), name(emission.limbOutput, RASTER_DENSITY, plan.id));
      const synoptic = maybeRecord(maybeRecord(plan.science)?.synoptic);
      const nativePoles = plan.nativeSourcePoles || maybeRecord(plan.science)?.nativePhotographicSampling;
      add(plan.id, 'raster', `/surfaces/${index}`, used, nativePoles
        ? 'Prepare latitude bands with the declared coverage/exposure policy; sample the pinned original photograph directly for polar sprites, then encode the existing texture layout.'
        : 'Decode source map, apply the declared coverage/exposure policy, pack latitude bands, project poles and encode textures.', {
        inputRoles: frames ? {} : { [text(plan.source)]: { role: 'appearance', evidence: `Raster source at /surfaces/${index}/source.` } },
        ...(maybeRecord(plan.science)?.kind === 'glb-base-color' ? { observationAttribution: 'none' as const } : {}),
        urls: outputUrls, interpretation: { falseColor: plan.falseColor,
          ...(maybeRecord(plan.science)?.kind === 'glb-base-color' ? { kind: 'illustrative-model', resolvedSurfaceObservation: false } : {}),
          ...(controlledDetail ? { controlledPhotographicDetail: controlledDetail, originalIllumination:true } : {}),
          ...(nativePoles ? { polarSampling: 'original-photograph-footprint' } : {}),
          ...(surface(plan.id)?.coverageCompletion ? { coverageCompletion: surface(plan.id)?.coverageCompletion } : {}),
          ...(synoptic ? { synoptic: { kind: synoptic.kind, ...(synoptic.fits ? { fits: synoptic.fits } : {}), ...(maybeRecord(synoptic.continuum) ? { continuum: { maximumLatitudeDegrees: record(synoptic.continuum).maximumLatitudeDegrees, palette: record(synoptic.continuum).palette } } : {}) } } : {}),
          ...(surfaceObservation ? { surfaceObservation: { format: record(surfaceObservation.lens).format, shape: surfaceObservation.shape, transfer: record(surfaceObservation.lens).transfer,
            photometry: record(surfaceObservation.lens).photometry, display: record(surfaceObservation.lens).display, originalIllumination: true } } : {}) },
      });
    });
    if (raster.polesCombined) add('surface-poles', 'raster', '/polesOutput', [], 'Assemble polar tiles from the interpreted surface maps.', {
      parents: namedRecords(raster.surfaces).map(plan => plan.id), urls: [name(raster.polesOutput, RASTER_DENSITY)], lensIds: [],
    });
    if (raster.interior) {
      const plan = record(raster.interior);
      add('interior', 'raster', '/interior', [text(plan.source), text(plan.surface)], 'Prepare a schematic core and outer shell from the structural source; pack the cutaway textures.', {
        urls: [...['outerOutput', 'outerPolesOutput', 'coreOutput', 'corePolesOutput', 'sectionOutput'].map(key => name(plan[key], RASTER_DENSITY)), name(plan.thumbnail, 1)],
        observationAttribution: 'none', interpretation: { kind: 'schematic-interior', observedInteriorImagery: false },
      });
    }
    if (raster.lighting) {
      const plan = record(raster.lighting), file = optionalText(maybeRecord(plan.metadata)?.rendererSourceSnapshot)?.replace(/^source\//u, '');
      add('lighting', 'raster', '/lighting', file ? [file] : [], 'Evaluate the declared surface-lighting model into phase banks.', {
        urls: urls(assets?.lighting), lensIds: [], interpretation: { kind: 'rendering-model' },
      });
    }
    if (raster.atmosphere) add('atmosphere', 'raster', '/atmosphere', paths(raster.atmosphere), 'Prepare the declared atmospheric material and observation layers.', {
      urls: ['materialOutput', 'observationOutput', 'lightingOutput'].map(key => name(record(raster.atmosphere)[key], RASTER_DENSITY)), lensIds: [],
    });
    if (lightingOnlyRaster && recipe('observations')?.lenses) addObservationLenses();
  } else if (terrestrial?.kind === 'solid-observation-body') {
    const plans = record(terrestrial.raster), geometry = record(terrestrial.geometry);
    namedRecords(plans.observations).forEach((plan, index) => {
      // This is the same lensId/consumer join used by prepareSolidRasters.
      const observation = manifest.inputs.filter(input => input.consumers.includes('surfaces') && input.lensId === plan.id);
      add(plan.id, 'terrestrial', `/raster/observations/${index}`, observation.map(input => input.path),
        plan.nativePhotographicSampling
          ? 'Sample the original published photographic grid over each retained atlas texel footprint, apply the existing illumination and encode the atlas; retain the separate map previews.'
          : 'Apply the source-defined validity and registration policy, then prepare the projected observation texture.', {
          inputRoles: Object.fromEntries(observation.map(input => [input.path, { role: 'appearance', evidence: `Observation selected at /raster/observations/${index}.` }])),
          parents: plan.monochromeBase ? [text(plan.monochromeBase)] : [], interpretation: { validity: plan.validity,
            ...(plan.nativePhotographicSampling ? {nativePhotographicSampling:plan.nativePhotographicSampling} : {}) },
        });
    });
    for (const kind of ['scientific', 'observedColors', 'shapeViews', 'surfaceObservations']) {
      namedRecords(plans[kind] ?? []).forEach((plan, index) => {
        const used = paths(plan);
        if (plan.consumer) used.push(...group(text(plan.consumer)));
        if (kind === 'shapeViews') used.push(...paths(geometry.radialTerrain));
        add(plan.id, 'terrestrial', `/raster/${kind}/${index}`, used,
          `Prepare the ${kind} recipe with its declared sampling, registration and display policy.`, {
            parents: plan.monochromeBase ? [text(plan.monochromeBase)] : [], interpretation: { kind, qualification: plan.title ?? plan.description },
          });
      });
    }
    // Mesh geometry changes the final sampled surface as well as its silhouette.
    if (geometry.radialTerrain) {
      for (const product of products) {
        const model = alternativeForLens(records(geometry.radialTerrainAlternatives ?? []), product.id)
          ?? geometry.radialTerrain;
        const modelPaths = paths(model);
        product.inputPaths = [...new Set([...product.inputPaths, ...modelPaths])];
        product.inputRoles = { ...product.inputRoles, ...Object.fromEntries(modelPaths.map(path => [path, { role: 'geometry' as const, evidence: 'Source selected by the terrestrial radial-terrain geometry recipe.' }])) };
      }
    }
  } else if (terrestrial?.kind === 'affine-photographic-atmosphere') {
    const lenses = record(terrestrial.lenses);
    add(text(record(lenses.normal).id), 'terrestrial', '/source', [text(record(terrestrial.source).path)],
      'Prepare the registered visible-color mosaic and affine surface projection.');
    namedRecords(lenses.plans).forEach((plan, index) => add(plan.id, 'terrestrial', `/lenses/plans/${index}`,
      [...paths(plan), ...paths(terrestrial.shapePath), ...paths(terrestrial.atmospherePath)],
      'Prepare the declared registered surface lens and affine atmospheric presentation.'));
  } else if (recipe('shape-model')) {
    const plan = record(recipe('shape-model'));
    const surfaces = Array.isArray(plan.surfaces) ? namedRecords(plan.surfaces.map(item => ({ ...record(item), id: text(record(item).lens) }))) : [];
    // The shape source is the measurement record the manifest binds to this recipe; each lens adds its own surface source.
    for (const lens of controls) {
      const surface = surfaces.find(item => item.id === lens.id), kind = maybeRecord(surface?.science)?.kind;
      const used = [...group('shape-model').filter(path => !surfaces.some(item => item.source === path && item.id !== lens.id)), ...paths(surface?.science)];
      if (kind === 'glb-base-color') add(lens.id, 'shape-model', '', used,
        "Carry the published model's base-color texture through its own UVs onto the authored shape; an illustration, not an observation.", {
          observationAttribution: 'none', interpretation: { kind: 'illustrative-model', resolvedSurfaceObservation: false } });
      else if (kind === 'disc-integrated-color') add(lens.id, 'shape-model', '', used,
        'Fill the authored shape with the published whole-disc colour and V geometric albedo, uniform; no surface map.', {
          interpretation: { kind: 'disc-integrated-color', resolvedSurfaceObservation: false } });
      else add(lens.id, 'shape-model', '', used,
        'Fill the authored shape with the shared neutral gray display convention; no surface texture.', {
          observationAttribution: 'none', interpretation: { kind: 'neutral-shape', resolvedSurfaceObservation: false } });
    }
  } else if (recipe('observations')?.lenses) {
    addObservationLenses();
  } else if (recipe('surface')?.lenses) {
    const plan = record(recipe('surface'));
    // In this family geometry.sources is an executable input map, not an
    // attribution inventory. The material preparer reads these exact paths.
    const baseInputs = paths(recipe('geometry')?.sources);
    const baseRecipes = ['geometry', 'materials', 'rings'];
    namedRecords(plan.lenses).forEach((lens, index) => add(lens.id, 'surface', `/lenses/${index}`,
      [...paths(lens, `${plan.sourceSubdirectory}/`), ...baseInputs, ...paths(recipe('materials')), ...paths(recipe('rings'))],
      'Prepare the declared spectral material operation over the prepared body and ring materials.', {
        observationAttribution: lens.sourceKind === 'schematic-morphology-illustration' ? 'none' : 'source-lineage',
        interpretation: { operation: lens.operation, sourceKind: lens.sourceKind }, recipeDependencies: ['surface', ...baseRecipes],
      }));
    // The base material and cutaway are produced by the material recipe.
    for (const lens of controls.filter(lens => !products.some(product => product.id === lens.id))) {
      add(lens.id, 'geometry', '', [...baseInputs, ...paths(recipe('materials')), ...paths(recipe('rings'))],
        'Prepare the source-defined oblate body, ring and cutaway material.', { recipeDependencies: baseRecipes,
          ...(lens.view === 'interior' ? { observationAttribution: 'none' as const, interpretation: { kind: 'schematic-interior' } } : {}),
        });
    }
  } else if (recipe('paged-ellipsoid')) {
    const plan = record(recipe('paged-ellipsoid')), planSurface = record(plan.surface), maps = records(planSurface.maps);
    maps.forEach((map, index) => {
      const lens = controls.find(lens => lens.surfaceUrl === prefix + map.name + '.webp');
      if (lens) add(lens.id, 'paged-ellipsoid', `/surface/maps/${index}`,
        [text(map.path), ...paths(map.scientific), ...(map.compositeClouds ? [text(record(planSurface.clouds).path)] : []),
          ...(maybeRecord(map.deepOceanFill) ? [text(record(map.deepOceanFill).path)] : [])],
        maybeRecord(map.scientific)?.kind === 'gebco-elevation'
          ? 'Decode signed terrain heights and coordinate axes, interpolate elevations, apply the authored palette and cartographic relief, and prepare the globe, minimap and unshaded legend.'
          : maybeRecord(map.scientific)?.kind === 'black-marble-radiance'
            ? 'Decode pinned annual snow-free radiance, average native cells by spherical area before applying logarithmic false color, and prepare the globe, poles, minimap, thumbnail and legend. Preserve missing coverage separately from valid zero radiance.'
          : map.nativePhotographicSampling
            ? `Sample the original photographic grids at each retained atlas footprint, apply the declared display transfer and cloud composite, and encode the existing texture layout.${maybeRecord(map.deepOceanFill) ? ' Where the plain source carries its declared arbitrary deep-ocean fill, take the ocean sample from the declared second edition instead, without the display transfer, fading the replacement to nothing at the edge of that region.' : ''}`
            : 'Prepare the global reference map and its declared cloud composite.',
        maybeRecord(map.deepOceanFill) ? {
          interpretation: { kind: 'observed-colour-with-depth-shaded-deep-ocean',
            replacedColor: record(map.deepOceanFill).replacedColor, tolerance: record(map.deepOceanFill).tolerance,
            blendSourcePixels: record(map.deepOceanFill).blendSourcePixels,
            limitations: 'Deep ocean colour is shaded from depth, not observed water colour. The plain edition replaces those pixels with one arbitrary reflectance, so they carry no measurement. This is not a calibrated depth scale. Shallow and coastal water remains observed imagery.' },
        } : maybeRecord(map.scientific)?.kind === 'gebco-elevation' ? {
          interpretation: { kind: 'modeled-elevation', units: 'm', datum: 'mean sea level',
            grid: record(map.scientific).grid, palette: record(map.scientific).palette, relief: record(map.scientific).relief },
        } : maybeRecord(map.scientific)?.kind === 'black-marble-radiance' ? {
          interpretation: { kind: 'observed-nighttime-radiance', units: record(map.scientific).units,
            product: record(map.scientific).product, year: record(map.scientific).year, band: record(map.scientific).band,
            grid: record(map.scientific).grid, display: record(map.scientific).display,
            aggregation: 'spherical-area weighted mean; at least 50% valid coverage per displayed cell',
            limitations: 'Public mosaic has no QA or observation-count bands. Aurora and transient lights can remain. This is not a sky-brightness model.' },
        } : {});
    });
    for (const lens of controls.filter(lens => !products.some(product => product.id === lens.id))) {
      if (lens.view === 'interior') {
        const tomography = lens.interiorSource ? recipe(text(lens.interiorSource)) : null;
        add(lens.id, 'paged-ellipsoid', '/interiorPath', [text(plan.interiorPath), ...paths(tomography)],
          tomography ? 'Sample pinned mantle velocities on the cut planes and shell; normalize by the area-weighted depth mean and bake the signed palette. Keep crust and core schematic.'
            : 'Prepare the source-defined schematic interior.', {
            observationAttribution: tomography ? 'source-lineage' : 'none',
            interpretation: { kind: tomography ? 'seismic-model-with-schematic-layers' : 'schematic-interior',
              ...(tomography ? { quantity: tomography.quantity, reference: tomography.reference, source: tomography.source, depth: tomography.depth, sectionLongitudesDegrees: tomography.sectionLongitudesDegrees } : {}) },
            recipeDependencies: ['paged-ellipsoid', ...(tomography ? ['mantle-tomography'] : [])],
            parents: controls.filter(control => control.surfaceUrl === prefix + maps[0].name + '.webp').map(control => control.id),
            urls: [...runtimeUrls.filter(url => url.startsWith(prefix + id + '-interior-') && !Object.hasOwn(record(lens.interiorTextures ?? {}), url)),
              ...textValues(lens.interiorTextures ?? {}), text(lens.thumbnailUrl),
              ...(tomography ? [prefix + record(tomography.legend).image] : [])],
          });
      }
      else if (geographic?.noise?.pin.id === lens.id) {
        const { pin, prepared, directory } = geographic.noise;
        add(lens.id, 'paged-ellipsoid', '/geographic/noise', [`${directory}/manifest.json`, `${directory}/${pin.file}`],
          'Decode the pinned GeoJSON, validate coordinates and period, rasterize source-colored polygons, then prepare geographic texture pages.', {
            urls: [...urls(prepared.roots), prefix + id + '-lens-noise.webp'],
            observationAttribution: 'none', interpretation: { kind: 'modeled-noise', year: pin.year, period: pin.period, units: pin.units,
              decodedSourceSha256: pin.decodedSha256, qualification: pin.qualification },
          });
      }
      // Geographic pages carry a separate release/receipt; never infer their
      // provenance from the global base-map fallback used by a lens button.
      else unresolved.push({ product: lens.id, reason: 'Requires geographic release provenance; the global base map does not establish this dataset.' });
    }
  }
  // A dataset that names a companion cloud prepares nothing of its own: it keeps the plates of the lens it borrows and
  // turns on a volume another package prepares, pins and accounts for. Its parent is that lens; the cloud's own
  // evidence lives in the companion package's provenance, which the volume presentation binds.
  for (const lens of controls) {
    const volume = maybeRecord(lens.volume);
    if (!volume || products.some(product => product.id === lens.id)) continue;
    add(lens.id, 'content', '', [],
      'Keep the borrowed lens\'s prepared plates and enable the companion volume this dataset names.', {
        parents: [text(volume.surface)],
        interpretation: { kind: 'companion-volume', objectId: text(volume.objectId), lensId: text(volume.lensId), surface: text(volume.surface) },
      });
  }
  for (const lens of controls) {
    if (!products.some(product => product.lensIds.includes(lens.id)) && !unresolved.some(gap => gap.product === lens.id))
      unresolved.push({ product: lens.id, reason: 'The preparation capability has no product dependency binding yet.' });
  }
  if (recipe('content')) {
    add('content', 'content', '', [recipes.get('content')!.path.replace(/^source\//u, '')],
      'Compile the authored facts, dataset recipes and references into the shared content document.', {
        label: 'Object information', urls: ['object:prepared/content.json'], lensIds: [],
      });
  }
  records(recipe('charts')?.charts ?? []).forEach((plan, index) => add(`chart:${index}`, 'charts', `/charts/${index}`,
    paths(plan.source), 'Prepare the authored scientific chart from its bound data and mathematical recipe.', {
      label: text(plan.title ?? plan.kind), urls: [prefix + plan.output], lensIds: [],
      interpretation: { kind: plan.kind, qualification: maybeRecord(plan.metadata)?.qualification },
    }));
  const features = recipe('features');
  if (features?.schema === 'cssearth-surface-features@1') {
    const directory = text(features.directory);
    const traces = maybeRecord(features.traces);
    add('features', 'features', '', [`${directory}/manifest.json`, ...(features.archive === null ? [] : [`${directory}/${text(features.archive)}`]), text(features.surfaceMap), ...(typeof features.notes === 'string' ? [`${directory}/${features.notes}`] : []), ...(maybeRecord(features.sites) ? [`${directory}/${text(maybeRecord(features.sites)!.document)}`, ...(Array.isArray(maybeRecord(features.sites)!.inputs) ? (maybeRecord(features.sites)!.inputs as unknown[]).map(item => `${directory}/${text(item)}`) : [])] : []),
        ...(maybeRecord(features.landmarks) ? [`${directory}/${text(maybeRecord(features.landmarks)!.document)}`, ...paths(maybeRecord(features.landmarks)!.inputs)] : []),
        ...(traces ? [`${text(traces.directory)}/manifest.json`, `${text(traces.directory)}/${text(traces.archive)}`] : [])],
      features.landmarks ? 'Verify the pinned mission geography and coordinates; select region-interior points on the unchanged display mesh using the released categorical surface, or project cited coordinates onto that mesh. Retain source frames, placement limits and mission naming credits.' : 'Verify the pinned Gazetteer archive, decode its attribute table and datum, exclude the declared type codes, anchor each IAU centre point on the prepared body mesh, rank features by diameter and prepare each outline: a rim circle, the published extent, or mapped structural traces selected inside that extent.', {
        label: 'Named features', urls: [prefix + text(features.output)], lensIds: [],
        interpretation: { kind: 'nomenclature-centre-points', excludedTypeCodes: features.excludedTypeCodes },
      });
  }
  return { products, unresolved };
}
