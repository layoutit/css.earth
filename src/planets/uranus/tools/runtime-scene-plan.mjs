function runtimeLeaf(leaf) {
  return Object.freeze({
    ...(leaf.tag ? { tag: leaf.tag } : {}),
    ...(leaf.className ? { className: leaf.className } : {}),
    style: leaf.style,
    ...(leaf.projectiveTextureLayer
      ? { projectiveTextureLayer: leaf.projectiveTextureLayer }
      : {}),
  });
}

function runtimeBodyBand(band) {
  return Object.freeze({
    visualRotationSeconds: band.visualRotationSeconds,
    leaves: Object.freeze(band.leaves.map(runtimeLeaf)),
  });
}

function runtimeMoon(moon) {
  const portraitStyle = moon.major
    ? `--polycss-atlas-width:96px;--polycss-atlas-height:96px;` +
      `background-position:${-moon.atlasIndex * 96}px 0px;` +
      "background-size:480px 192px"
    : "";
  const shadowStyle = moon.major
    ? `--polycss-atlas-width:96px;--polycss-atlas-height:96px;` +
      `background-position:${-moon.atlasIndex * 96}px -96px;` +
      "background-size:480px 192px"
    : "";
  return Object.freeze({
    id: moon.id,
    name: moon.name,
    major: moon.major,
    meanRadiusKm: moon.meanRadiusKm,
    portraitDiameter: moon.portraitDiameter,
    phaseDegrees: moon.phaseDegrees,
    phaseQualification: moon.phaseQualification,
    meanAnomalyDegrees: moon.meanAnomalyDegrees,
    sourceEpoch: moon.sourceEpoch,
    presentationEpoch: moon.presentationEpoch,
    displayOrbitRadius: moon.displayOrbitRadius,
    inclinationDeg: moon.inclinationDeg,
    nodeDeg: moon.nodeDeg,
    orbitTransform: moon.orbitTransform,
    bodyTransform: moon.bodyTransform,
    guideDiameter: moon.guideDiameter,
    semiMajorAxisKm: moon.semiMajorAxisKm,
    leaves: Object.freeze(moon.major
      ? [runtimeLeaf({
        tag: "s",
        className: "uranus-moon-portrait",
        style: portraitStyle,
      }), runtimeLeaf({
        tag: "s",
        className: "uranus-moon-shadow",
        style: shadowStyle,
      })]
      : [runtimeLeaf({
        tag: "b",
        className: "uranus-moon-dot",
        style: "",
      })]),
    billboard: moon.billboard,
    ...(moon.label ? { label: moon.label } : {}),
    ...(moon.shadow ? { shadow: moon.shadow } : {}),
  });
}

export function createRuntimeScenePlan(source) {
  return Object.freeze({
    schema: "cssuranus-prepared-runtime-scene@1",
    camera: source.camera,
    systemTransform: source.systemTransform,
    meshTransform: source.meshTransform,
    motion: source.motion,
    assets: Object.freeze({
      surfaces: Object.freeze(Object.fromEntries(Object.entries(
        source.assets.surfaces,
      ).map(([lensId, lens]) => [lensId, Object.freeze({
        1: Object.freeze({
          surface: lens[1].surface.url,
          poles: lens[1].poles.url,
        }),
        2: Object.freeze({
          surface: lens[2].surface.url,
          poles: lens[2].poles.url,
        }),
      })]))),
      fixedMaterial: Object.freeze(Object.fromEntries(Object.entries(
        source.assets.fixedMaterial,
      ).map(([lensId, lens]) => [lensId, Object.freeze({
        1: lens[1].url,
        2: lens[2].url,
      })]))),
      shadowlessMaterial: Object.freeze(Object.fromEntries(Object.entries(
        source.assets.shadowlessMaterial,
      ).map(([lensId, lens]) => [lensId, Object.freeze({
        1: lens[1].url,
        2: lens[2].url,
      })]))),
      materialViewBank: Object.freeze(Object.fromEntries(Object.entries(
        source.assets.materialViewBank,
      ).map(([lensId, lens]) => [lensId, Object.freeze({
        1: Object.freeze({
          rows: Object.freeze(lens[1].rows.map(({ url }) => url)),
        }),
        2: Object.freeze({
          rows: Object.freeze(lens[2].rows.map(({ url }) => url)),
        }),
      })]))),
      rings: Object.freeze({
        1: source.assets.rings[1].url,
        2: source.assets.rings[2].url,
        shadow: Object.freeze({
          1: source.assets.rings.shadow[1].url,
          2: source.assets.rings.shadow[2].url,
        }),
      }),
      moonAtlas: Object.freeze({
        1: source.assets.moonAtlas[1].url,
        2: source.assets.moonAtlas[2].url,
      }),
    }),
    planetFaceRetention: source.planetFaceRetention,
    preparedSurface: source.preparedSurface,
    preparedLighting: source.preparedLighting,
    fixedMaterialPlane: Object.freeze({
      transform: source.fixedMaterialPlane.transform,
      leaf: runtimeLeaf(source.fixedMaterialPlane.leaf),
      orbitPlayback: source.fixedMaterialPlane.orbitPlayback,
    }),
    preparedRingSource: source.preparedRingSource,
    ringPlane: runtimeLeaf(source.ringPlane),
    ringShadowPlane: runtimeLeaf(source.ringShadowPlane),
    moons: Object.freeze({
      presentation: source.moons.presentation,
      moons: Object.freeze(source.moons.moons.map(runtimeMoon)),
      minorMoonDots: Object.freeze(source.moons.minorMoonDots.map((moon) =>
        Object.freeze({ id: moon.id, style: "" }))),
      counts: source.moons.counts,
    }),
    bodyBands: Object.freeze(source.bodyBands.map(runtimeBodyBand)),
    preparedMotion: source.preparedMotion,
    counts: source.counts,
    transport: Object.freeze({
      sourceSchema: source.schema,
      sourceMetadataModule: "preparedScene.mjs",
      retainedLeafFields: Object.freeze([
        "tag",
        "className",
        "style",
        "projectiveTextureLayer",
      ]),
      runtimeSourceParsing: false,
    }),
  });
}
