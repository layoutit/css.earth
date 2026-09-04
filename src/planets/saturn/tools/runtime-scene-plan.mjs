function runtimeLeaf(leaf) {
  return {
    ...(leaf.tag ? { tag: leaf.tag } : {}),
    ...(leaf.className ? { className: leaf.className } : {}),
    style: leaf.style,
  };
}

function runtimeBodyBand(band) {
  return {
    visualRotationSeconds: band.visualRotationSeconds,
    leaves: band.leaves.map(runtimeLeaf),
  };
}

function runtimePreparedPresentation(presentation) {
  return {
    ...(presentation.assetUrl ? { assetUrl: presentation.assetUrl } : {}),
    ...(presentation.asset2xUrl
      ? { asset2xUrl: presentation.asset2xUrl }
      : {}),
    ...(presentation.frameIndex === undefined
      ? {}
      : { frameIndex: presentation.frameIndex }),
    ...(presentation.rowIndex === undefined
      ? {}
      : { rowIndex: presentation.rowIndex }),
    ...(presentation.backgroundPosition
      ? { backgroundPosition: presentation.backgroundPosition }
      : {}),
    ...(presentation.backgroundSize
      ? { backgroundSize: presentation.backgroundSize }
      : {}),
  };
}

function runtimePreparedRowPlan(plan) {
  const runtimeVariant = (variant) => ({
    runtimeAtlas: runtimePreparedPresentation(variant.runtimeAtlas),
    ...(variant.defaultPresentation ? {
      defaultPresentation: runtimePreparedPresentation(
        variant.defaultPresentation,
      ),
    } : {}),
    rows: variant.rows.map(runtimePreparedPresentation),
    presentations: variant.presentations.map(runtimePreparedPresentation),
  });
  return {
    model: plan.model,
    ...(plan.defaultVariant ? { defaultVariant: plan.defaultVariant } : {}),
    defaultPreparedFrame: plan.defaultPreparedFrame,
    defaultPreparedRow: plan.defaultPreparedRow,
    initialWarmRows: plan.initialWarmRows,
    maximumRetainedAtlasCount: plan.maximumRetainedAtlasCount,
    ...(plan.variants ? {
      variants: Object.fromEntries(Object.entries(plan.variants).map(
        ([id, variant]) => [id, runtimeVariant(variant)],
      )),
    } : runtimeVariant(plan)),
    initialDecodedWorkingSetBytes: plan.initialDecodedWorkingSetBytes,
    maximumDecodedWorkingSetBytes: plan.maximumDecodedWorkingSetBytes,
    fullAtlasDecodedRgbaBytes: plan.fullAtlasDecodedRgbaBytes,
  };
}

function runtimeInteriorAtmosphere(atmosphere) {
  return {
    model: atmosphere.model,
    frameCount: atmosphere.frameCount,
    minimumScenePitchDegrees: atmosphere.minimumScenePitchDegrees,
    maximumScenePitchDegrees: atmosphere.maximumScenePitchDegrees,
    leaf: runtimeLeaf(atmosphere.leaf),
    runtimeShards: runtimePreparedRowPlan(atmosphere.runtimeShards),
  };
}

function runtimeMoonShadowAtlas(atlas) {
  return {
    frameCount: atlas.frameCount,
    minimumScenePitchDegrees: atlas.minimumScenePitchDegrees,
    maximumScenePitchDegrees: atlas.maximumScenePitchDegrees,
    runtimeShards: runtimePreparedRowPlan(atlas.runtimeShards),
  };
}

export function createRuntimeScenePlan(source) {
  return {
    schema: "csssaturn-prepared-runtime-scene@1",
    camera: source.camera,
    systemTransform: source.systemTransform,
    meshTransform: source.meshTransform,
    preparedSurface: {
      mode: source.preparedSurface.mode,
      assetUrl: source.preparedSurface.assetUrl,
      assetBytes: source.preparedSurface.assetBytes,
      assetSha256: source.preparedSurface.assetSha256,
      faceCount: source.preparedSurface.faceCount,
      uvLayout: source.preparedSurface.uvLayout,
      equivalentBodySampleWidth:
        source.preparedSurface.equivalentBodySampleWidth,
      equivalentBodySampleHeight:
        source.preparedSurface.equivalentBodySampleHeight,
      seamRepair: source.preparedSurface.seamRepair,
    },
    transport: {
      sourceSchema: source.schema,
      sourceMetadataModule: "preparedScene.mjs",
      retainedLeafFields: ["tag", "className", "style"],
      minorMoonFields: ["style"],
      runtimeSourceParsing: false,
    },
    preparedLighting: {
      mode: source.preparedLighting.mode,
      orbitAtlas: {
        frameCount: source.preparedLighting.orbitAtlas.frameCount,
        frameRows: source.preparedLighting.orbitAtlas.frameRows,
        minimumScenePitchDegrees:
          source.preparedLighting.orbitAtlas.minimumScenePitchDegrees,
        maximumScenePitchDegrees:
          source.preparedLighting.orbitAtlas.maximumScenePitchDegrees,
        runtimeShards: runtimePreparedRowPlan(
          source.preparedLighting.orbitAtlas.runtimeShards,
        ),
      },
    },
    fixedMaterialPlane: {
      transform: source.fixedMaterialPlane.transform,
      leaf: runtimeLeaf(source.fixedMaterialPlane.leaf),
      interactionProjection: source.fixedMaterialPlane.interactionProjection,
    },
    interactionFrames: source.interactionFrames,
    preparedRingSource: {
      planeVisualOrbitSeconds: source.preparedRingSource.planeVisualOrbitSeconds,
      saturnGmKm3PerS2: source.preparedRingSource.saturnGmKm3PerS2,
      shadowModel: {
        systemTiltDegrees:
          source.preparedRingSource.shadowModel.systemTiltDegrees,
        systemNodeDegrees:
          source.preparedRingSource.shadowModel.systemNodeDegrees,
      },
    },
    ringPlane: runtimeLeaf(source.ringPlane),
    ringMotionPlates: source.ringMotionPlates.map((plate) => ({
      population: plate.population,
      compositeMode: plate.compositeMode,
      durationSeconds: plate.durationSeconds,
      textureUrl: plate.textureUrl,
      texture2xUrl: plate.texture2xUrl,
      leaf: runtimeLeaf(plate.leaf),
    })),
    ringMotionExpansionPlates: source.ringMotionExpansionPlates.map((plate) => ({
      population: plate.population,
      compositeMode: plate.compositeMode,
      durationSeconds: plate.durationSeconds,
      leaf: runtimeLeaf(plate.leaf),
    })),
    ringShadowPlane: runtimeLeaf(source.ringShadowPlane),
    ringPointGroups: source.ringPointGroups.map((group) => ({
      pointMode: group.pointMode,
      animated: group.animated,
      compositeMode: group.compositeMode,
      durationSeconds: group.durationSeconds,
      leaves: group.leaves.map(runtimeLeaf),
      expansionLeaves: group.expansionLeaves.map(runtimeLeaf),
    })),
    moons: {
      presentation: {
        minorMoonPreparedPositionCount:
          source.moons.presentation.minorMoonPreparedPositionCount,
      },
      shadowAtlas: runtimeMoonShadowAtlas(source.moons.shadowAtlas),
      moons: source.moons.moons.map((moon) => ({
        id: moon.id,
        orbitTransform: moon.orbitTransform,
        bodyTransform: moon.bodyTransform,
        leaves: moon.leaves.map(runtimeLeaf),
        ...(moon.billboard ? { billboard: moon.billboard } : {}),
        ...(moon.label ? { label: moon.label } : {}),
        ...(moon.shadow ? {
          shadow: {
            counterTransform: moon.shadow.counterTransform,
            projection: moon.shadow.projection,
            leaf: runtimeLeaf(moon.shadow.leaf),
          },
        } : {}),
      })),
      minorMoonDots: source.moons.minorMoonDots.map(({ style }) => ({ style })),
      counts: source.moons.counts,
    },
    bodyBands: source.bodyBands.map(runtimeBodyBand),
    interior: {
      schema: source.interior.schema,
      outerBodyBands: source.interior.outerBodyBands.map(runtimeBodyBand),
      shells: source.interior.shells.map((shell) => ({
        className: shell.className,
        leaves: shell.leaves.map(runtimeLeaf),
      })),
      sectionLeaves: source.interior.sectionLeaves.map(runtimeLeaf),
      atmosphere: runtimeInteriorAtmosphere(source.interior.atmosphere),
      leafCount: source.interior.leafCount,
    },
    preparedMotion: {
      referenceRotationVisualSeconds:
        source.preparedMotion.referenceRotationVisualSeconds,
      obliquityDegrees: source.preparedMotion.obliquityDegrees,
      cameraRotationXDegrees: source.preparedMotion.cameraRotationXDegrees,
    },
    counts: source.counts,
  };
}
