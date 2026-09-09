// Dependency bindings for the shared preparers. These follow acquisition paths
// and recipe operations, never factsheet links, publisher names, or UI credits.
// Unknown capabilities remain explicit gaps rather than receiving invented edges.
export function provenanceProducts({ id, recipes, manifest, lenses, assets, geographic, runtimeUrls = [] }) {
  const products = [], unresolved = [], prefix = `/scenes/${id}/`;
  const inputPaths = new Set([...manifest.inputs, ...(manifest.documents ?? []), ...(manifest.generatedIntermediates ?? [])].map(input => input.path));
  const controls = lenses?.controls ?? [];
  const recipe = name => recipes.get(name)?.parameters;
  const paths = (value, base = '') => {
    const found = new Set();
    const visit = node => {
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
  const urls = value => {
    const found = new Set();
    const visit = node => {
      if (typeof node === 'string' && node.startsWith(prefix) && !/[\s;()]/u.test(node)) found.add(node);
      else if (Array.isArray(node)) node.forEach(visit);
      else if (node && typeof node === 'object') Object.values(node).forEach(visit);
    };
    visit(value); return [...found];
  };
  const surface = lensId => Array.isArray(assets?.surfaces)
    ? assets.surfaces.find(item => item.id === lensId) : assets?.surfaces?.[lensId];
  const outputs = lensId => urls([controls.find(lens => lens.id === lensId), surface(lensId)]);
  const group = consumer => manifest.inputs.filter(input => input.consumers.includes(consumer)).map(input => input.path);
  const add = (key, recipeId, selector, used, process, extra = {}) => {
    const lens = controls.find(lens => lens.id === key);
    const value = { id: key, label: lens?.label ?? key, recipe: recipeId, selector,
      inputPaths: [...new Set(used)], parents: [], urls: outputs(key), process,
      limitations: [lens?.qualification, lens?.description].filter(Boolean), lensIds: lens ? [key] : [],
      recipeDependencies: [recipeId], ...extra };
    products.push(value);
  };
  const raster = recipe('raster'), terrestrial = recipe('terrestrial');
  if (raster?.schema === 'cssearth-raster-recipe@1') {
    const name = (template, density, key) => prefix + template.replaceAll('{id}', key ?? '')
      .replaceAll('{suffix}', density === 2 ? '@2x' : '').replaceAll('{density}', String(density));
    raster.surfaces.forEach((plan, index) => {
      const used = [plan.source, ...paths(plan.coverage)];
      const outputUrls = [...raster.densities.map(d => name(plan.output, d, plan.id)), name(plan.thumbnail, 1, plan.id)];
      if (!raster.polesCombined) outputUrls.push(...raster.densities.map(d => name(raster.polesOutput, d, plan.id)));
      add(plan.id, 'raster', `/surfaces/${index}`, used, 'Decode source map, apply the declared coverage/exposure policy, pack latitude bands, project poles and encode textures.', {
        urls: outputUrls, interpretation: { falseColor: plan.falseColor,
          ...(surface(plan.id)?.coverageCompletion ? { coverageCompletion: surface(plan.id).coverageCompletion } : {}) },
      });
    });
    if (raster.polesCombined) add('surface-poles', 'raster', '/polesOutput', [], 'Assemble polar tiles from the interpreted surface maps.', {
      parents: raster.surfaces.map(plan => plan.id), urls: raster.densities.map(d => name(raster.polesOutput, d)), lensIds: [],
    });
    if (raster.interior) {
      const plan = raster.interior;
      add('interior', 'raster', '/interior', [plan.source, plan.surface], 'Prepare a schematic core and outer shell from the structural source; pack the cutaway textures.', {
        urls: [...raster.densities.flatMap(d => ['outerOutput', 'outerPolesOutput', 'coreOutput', 'corePolesOutput', 'sectionOutput'].map(key => name(plan[key], d))), name(plan.thumbnail, 1)],
        interpretation: { kind: 'schematic-interior', observedInteriorImagery: false },
      });
    }
    if (raster.lighting) {
      const plan = raster.lighting, file = plan.metadata?.rendererSourceSnapshot?.replace(/^source\//u, '');
      add('lighting', 'raster', '/lighting', file ? [file] : [], 'Evaluate the declared surface-lighting model into phase banks.', {
        urls: urls(assets?.lighting), lensIds: [], interpretation: { kind: 'rendering-model' },
      });
    }
    if (raster.atmosphere) add('atmosphere', 'raster', '/atmosphere', paths(raster.atmosphere), 'Prepare the declared atmospheric material and observation layers.', {
      urls: raster.densities.flatMap(d => ['materialOutput', 'observationOutput', 'lightingOutput'].map(key => name(raster.atmosphere[key], d))), lensIds: [],
    });
  } else if (raster?.kind === 'observation-lenses') {
    raster.lenses.forEach((plan, index) => add(plan.id, 'raster', `/lenses/${index}`, [plan.input],
      'Decode the observation or elevation grid, apply its coverage/palette policy, and project the surface and poles.', {
        interpretation: { qualification: plan.qualification, coverage: plan.coverage, elevation: plan.elevation },
      }));
  } else if (raster?.kind === 'synoptic-emission') {
    raster.variants.forEach((plan, index) => add(plan.id, 'raster', `/variants/${index}`, paths(plan),
      'Prepare the declared synoptic map, stabilize polar sampling, project surface/poles, and prepare limb context.', {
        interpretation: { kind: plan.kind, ...(plan.kind === 'continuum-disc-mosaic' ? { observationInterval: raster.continuum } : {}), fits: plan.fits },
      }));
  } else if (terrestrial?.kind === 'solid-observation-body') {
    const plans = terrestrial.raster;
    plans.observations.forEach((plan, index) => {
      // This is the same lensId/consumer join used by prepareSolidRasters.
      const observation = manifest.inputs.filter(input => input.consumers.includes('surfaces') && input.lensId === plan.id);
      add(plan.id, 'terrestrial', `/raster/observations/${index}`, observation.map(input => input.path),
        'Apply the source-defined validity and registration policy, then prepare the projected observation texture.', {
          parents: plan.monochromeBase ? [plan.monochromeBase] : [], interpretation: { validity: plan.validity },
        });
    });
    for (const kind of ['scientific', 'mosaics', 'observedColors', 'shapeViews', 'surfaceObservations']) {
      (plans[kind] ?? []).forEach((plan, index) => {
        const used = paths(plan);
        if (plan.consumer) used.push(...group(plan.consumer));
        if (kind === 'shapeViews') used.push(...paths(terrestrial.geometry.radialTerrain));
        add(plan.id, 'terrestrial', `/raster/${kind}/${index}`, used,
          `Prepare the ${kind} recipe with its declared sampling, registration and display policy.`, {
            parents: plan.monochromeBase ? [plan.monochromeBase] : [], interpretation: { kind, qualification: plan.title ?? plan.description },
          });
      });
    }
    // Mesh geometry changes the final sampled surface as well as its silhouette.
    if (terrestrial.geometry.radialTerrain) {
      for (const product of products) {
        const model = terrestrial.geometry.radialTerrainAlternatives?.find(model => model.lensId === product.id)
          ?? terrestrial.geometry.radialTerrain;
        product.inputPaths = [...new Set([...product.inputPaths, ...paths(model)])];
      }
    }
  } else if (terrestrial?.kind === 'affine-photographic-atmosphere') {
    add(terrestrial.lenses.normal.id, 'terrestrial', '/source', [terrestrial.source.path],
      'Prepare the registered visible-color mosaic and affine surface projection.');
    terrestrial.lenses.plans.forEach((plan, index) => add(plan.id, 'terrestrial', `/lenses/plans/${index}`,
      [...paths(plan), ...paths(terrestrial.shapePath), ...paths(terrestrial.atmospherePath)],
      'Prepare the declared registered surface lens and affine atmospheric presentation.'));
  } else if (recipe('shape-model')) {
    const plan = recipe('shape-model');
    for (const lens of controls) add(lens.id, 'shape-model', '', [plan.surfaceModel],
      'Extract the source model base color and project it onto the authored shape.', {
        interpretation: { kind: 'illustrative-model', resolvedSurfaceObservation: false },
      });
  } else if (recipe('observations')?.lenses) {
    recipe('observations').lenses.forEach((plan, index) => add(plan.id, 'observations', `/lenses/${index}`, paths(plan),
      'Apply the declared observation, polar coverage and spectral display operation.', {
        interpretation: { operation: plan.operation, qualification: plan.qualification ?? plan.control?.qualification },
      }));
  } else if (recipe('surface')?.lenses) {
    const plan = recipe('surface');
    // In this family geometry.sources is an executable input map, not an
    // attribution inventory. The material preparer reads these exact paths.
    const baseInputs = paths(recipe('geometry')?.sources);
    const baseRecipes = ['geometry', 'materials', 'rings'];
    plan.lenses.forEach((lens, index) => add(lens.id, 'surface', `/lenses/${index}`,
      [...paths(lens, `${plan.sourceSubdirectory}/`), ...baseInputs, ...paths(recipe('materials')), ...paths(recipe('rings'))],
      'Prepare the declared spectral material operation over the prepared body and ring materials.', {
        interpretation: { operation: lens.operation, sourceKind: lens.sourceKind }, recipeDependencies: ['surface', ...baseRecipes],
      }));
    // The base material and cutaway are produced by the material recipe.
    for (const lens of controls.filter(lens => !products.some(product => product.id === lens.id))) {
      add(lens.id, 'geometry', '', [...baseInputs, ...paths(recipe('materials')), ...paths(recipe('rings'))],
        'Prepare the source-defined oblate body, ring and cutaway material.', { recipeDependencies: baseRecipes,
          ...(lens.view === 'interior' ? { interpretation: { kind: 'schematic-interior' } } : {}),
        });
    }
  } else if (recipe('paged-ellipsoid')) {
    const plan = recipe('paged-ellipsoid');
    plan.surface.maps.forEach((map, index) => {
      const lens = controls.find(lens => lens.surfaceUrl === prefix + map.name + '.webp');
      if (lens) add(lens.id, 'paged-ellipsoid', `/surface/maps/${index}`,
        [map.path, ...paths(map.scientific), ...(map.compositeClouds ? [plan.surface.clouds.path] : [])],
        map.scientific?.kind === 'gebco-elevation'
          ? 'Decode signed terrain heights and coordinate axes, interpolate elevations, apply the authored palette and cartographic relief, and prepare the globe, minimap and unshaded legend.'
          : 'Prepare the global reference map and its declared cloud composite.',
        map.scientific?.kind === 'gebco-elevation' ? {
          interpretation: { kind: 'modeled-elevation', units: 'm', datum: 'mean sea level',
            grid: map.scientific.grid, palette: map.scientific.palette, relief: map.scientific.relief },
        } : {});
    });
    for (const lens of controls.filter(lens => !products.some(product => product.id === lens.id))) {
      if (lens.view === 'interior') {
        const tomography = lens.interiorSource ? recipe(lens.interiorSource) : null;
        add(lens.id, 'paged-ellipsoid', '/interiorPath', [plan.interiorPath, ...paths(tomography)],
          tomography ? 'Sample pinned mantle velocities on the cut planes and shell; normalize by the area-weighted depth mean and bake the signed palette. Keep crust and core schematic.'
            : 'Prepare the source-defined schematic interior.', {
            interpretation: { kind: tomography ? 'seismic-model-with-schematic-layers' : 'schematic-interior',
              ...(tomography ? { quantity: tomography.quantity, reference: tomography.reference, source: tomography.source, depth: tomography.depth, sectionLongitudesDegrees: tomography.sectionLongitudesDegrees } : {}) },
            recipeDependencies: ['paged-ellipsoid', ...(tomography ? ['mantle-tomography'] : [])],
            parents: controls.filter(control => control.surfaceUrl === prefix + plan.surface.maps[0].name + '.webp').map(control => control.id),
            urls: [...runtimeUrls.filter(url => url.startsWith(prefix + id + '-interior-') && !Object.hasOwn(lens.interiorTextures ?? {}, url)),
              ...Object.values(lens.interiorTextures ?? {}), lens.thumbnailUrl,
              ...(tomography ? [prefix + tomography.legend.image] : [])],
          });
      }
      else if (geographic?.noise?.pin.id === lens.id) {
        const { pin, prepared, directory } = geographic.noise;
        add(lens.id, 'paged-ellipsoid', '/geographic/noise', [`${directory}/manifest.json`, `${directory}/${pin.file}`],
          'Decode the pinned GeoJSON, validate coordinates and period, rasterize source-colored polygons, then prepare geographic texture pages.', {
            urls: [...urls(prepared.roots), prefix + id + '-lens-noise.webp'],
            interpretation: { kind: 'modeled-noise', year: pin.year, period: pin.period, units: pin.units,
              decodedSourceSha256: pin.decodedSha256, qualification: pin.qualification },
          });
      }
      // Geographic pages carry a separate release/receipt; never infer their
      // provenance from the global base-map fallback used by a lens button.
      else unresolved.push({ product: lens.id, reason: 'Requires geographic release provenance; the global base map does not establish this dataset.' });
    }
  }
  for (const lens of controls) {
    if (!products.some(product => product.lensIds.includes(lens.id)) && !unresolved.some(gap => gap.product === lens.id))
      unresolved.push({ product: lens.id, reason: 'The preparation capability has no product dependency binding yet.' });
  }
  if (recipe('content')) {
    add('content', 'content', '', [recipes.get('content').path.replace(/^source\//u, '')],
      'Compile the authored introduction, facts, dataset descriptions and references into the shared content document.', {
        label: 'Object information', urls: ['object:prepared/content.json'], lensIds: [],
      });
  }
  (recipe('charts')?.charts ?? []).forEach((plan, index) => add(`chart:${index}`, 'charts', `/charts/${index}`,
    paths(plan.source), 'Prepare the authored scientific chart from its bound data and mathematical recipe.', {
      label: plan.title ?? plan.kind, urls: [prefix + plan.output], lensIds: [],
      interpretation: { kind: plan.kind, qualification: plan.metadata?.qualification },
    }));
  return { products, unresolved };
}
