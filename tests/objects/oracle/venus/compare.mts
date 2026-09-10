import type { ReferenceManifest, BrowserManifest } from "./manifest-types.mts";
import type { Analysis } from "./analysis-types.mts";
import type { GoogleCamera, OraclePose } from "./profile.mts";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  analyzeScenePng,
  classifySceneLod,
  comparePngBuffers,
  compareStarfieldFeatures,
  compareSunPresentations,
  interactionDelta,
  writeIndependentCaptures,
} from "./image-analysis.mts";
import {
  GOOGLE_MAPS_VENUS_URL,
  deriveBrowserCamera,
  ORACLE_COMPONENT_WEIGHTS,
  ORACLE_CAMERA_MODEL,
  ORACLE_CAMERA_TOLERANCE,
  ORACLE_LENS,
  ORACLE_POSES,
  ORACLE_QUALIFICATION,
  ORACLE_SCENE_CLIP,
  ORACLE_VIEWPORT,
} from "./profile.mts";

type ComponentScores = { starfield: ReturnType<typeof compareStarfieldFeatures>; sun: ReturnType<typeof compareSunPresentations> };
const componentIds = ["starfield", "sun"] as const;
const componentEntries = componentIds.map((id) => [id, ORACLE_COMPONENT_WEIGHTS[id]] as const);

export async function compareOracleCaptures({
  outputRoot,
  referenceManifest,
  browserManifest,
}: { outputRoot: string; referenceManifest: ReferenceManifest; browserManifest: BrowserManifest }) {
  validateManifests(referenceManifest, browserManifest);
  const poses: Awaited<ReturnType<typeof comparePose>>[] = [];
  const loaded = new Map<string, Buffer>();
  for (const pose of ORACLE_POSES) {
    poses.push(await comparePose(pose, referenceManifest, browserManifest, outputRoot, loaded));
  }

  const defaultReference = requiredBuffer(loaded, "reference:default");
  const defaultBrowser = requiredBuffer(loaded, "browser:default");
  const interactions = ORACLE_POSES.filter(({ id }) => id !== "default")
    .map((pose) => {
      const reportedPose = poses.find(({ id }) => id === pose.id);
      if (!reportedPose) throw new Error(`Missing compared pose ${pose.id}.`);
      if (!reportedPose.reference.lod.comparableSpaceScene) {
        return Object.freeze({
          id: pose.id,
          mappingQualification: pose.mappingQualification,
          qualification: "EXCLUDED_GOOGLE_MAP_DETAIL_LOD",
          referenceDelta: null,
          browserDelta: null,
          deltaDifference: null,
        });
      }
      const referenceDelta = interactionDelta(
        defaultReference,
        requiredBuffer(loaded, `reference:${pose.id}`),
      );
      const browserDelta = interactionDelta(
        defaultBrowser,
        requiredBuffer(loaded, `browser:${pose.id}`),
      );
      return Object.freeze({
        id: pose.id,
        mappingQualification: pose.mappingQualification,
        qualification: "COMPARABLE_SPACE_SCENE",
        referenceDelta: backgroundDeltaOnly(referenceDelta),
        browserDelta: backgroundDeltaOnly(browserDelta),
        deltaDifference: Object.freeze({
          backgroundChangedPixelRatio: Math.abs(
            (referenceDelta.backgroundChangedPixelRatio ?? 0) -
            (browserDelta.backgroundChangedPixelRatio ?? 0),
          ),
        }),
      });
    });

  const structuralFailures = structuralFailuresFor(
    referenceManifest,
    browserManifest,
  );
  const scoredPoses = poses.filter((pose): pose is typeof pose & { componentScores: ComponentScores } => pose.componentScores !== null);
  const componentScoreSummary = Object.freeze(Object.fromEntries(
    componentEntries.map(([id, weight]) => {
      const eligiblePoses = scoredPoses.filter(({ componentScores }) =>
        Number.isFinite(componentScores[id].score));
      const qualifiedPoses = eligiblePoses.filter(({ componentScores }) =>
        componentScores[id].qualified);
      const appearanceCoveredPoses = id === "sun"
        ? qualifiedPoses.filter(({ componentScores }) =>
          componentScores.sun.appearanceCoverage)
        : qualifiedPoses;
      const averageScore = qualifiedPoses.length === 0
        ? null
        : qualifiedPoses.reduce((sum, pose) =>
          sum + numericScore(pose.componentScores[id].score), 0) / qualifiedPoses.length;
      return [id, Object.freeze({
        weight,
        qualifiedPoseCount: qualifiedPoses.length,
        eligiblePoseCount: eligiblePoses.length,
        appearanceCoveredPoseCount: appearanceCoveredPoses.length,
        comparablePoseCount: scoredPoses.length,
        coverageQualified: appearanceCoveredPoses.length > 0,
        averageScore,
        averageScorePercent: averageScore === null ? null : averageScore * 100,
        weightedContribution: averageScore === null
          ? null
          : averageScore * weight,
        weightedContributionPercent: averageScore === null
          ? null
          : averageScore * weight * 100,
      })];
    }),
  ));
  const coverageFailures = Object.entries(componentScoreSummary)
    .filter(([, component]) => !component.coverageQualified)
    .map(([id]) => id === "sun"
      ? "SUN_APPEARANCE_COVERAGE_MISSING"
      : `${id.toUpperCase()}_COVERAGE_MISSING`);
  const endpointsQualified = scoredPoses.length > 0 &&
    scoredPoses.every(({ endpointQualification }) =>
      endpointQualification.qualified);
  const presentationScoreQualified = structuralFailures.length === 0 &&
    endpointsQualified && coverageFailures.length === 0;
  const presentationScore = presentationScoreQualified
    ? Object.values(componentScoreSummary).reduce((sum, component) =>
      sum + numericScore(component.weightedContribution), 0)
    : null;
  const availableComponents = Object.values(componentScoreSummary)
    .filter(({ averageScore }) => Number.isFinite(averageScore));
  const availableWeight = availableComponents.reduce((sum, component) =>
    sum + component.weight, 0);
  const diagnosticScoreWithAvailableEvidence = availableWeight === 0
    ? null
    : availableComponents.reduce((sum, component) =>
      sum + numericScore(component.averageScore) * component.weight, 0) / availableWeight;
  const report = Object.freeze({
    schema: "cssvenus-google-maps-oracle-report@8",
    comparedAt: new Date().toISOString(),
    oracleValid: structuralFailures.length === 0,
    parityQualified: false,
    presentationScoreQualified,
    presentationScore,
    presentationScorePercent: presentationScore === null
      ? null
      : presentationScore * 100,
    diagnosticScoreWithAvailableEvidence,
    diagnosticScoreWithAvailableEvidencePercent:
      diagnosticScoreWithAvailableEvidence === null
        ? null
        : diagnosticScoreWithAvailableEvidence * 100,
    diagnosticAvailableWeight: availableWeight,
    coverageFailures: Object.freeze(coverageFailures),
    componentWeights: ORACLE_COMPONENT_WEIGHTS,
    componentScoreSummary,
    qualification: ORACLE_QUALIFICATION,
    canonicalGoogleMapsUrl: GOOGLE_MAPS_VENUS_URL,
    viewport: ORACLE_VIEWPORT,
    sceneClip: ORACLE_SCENE_CLIP,
    visualOrder: Object.freeze([
      "google-maps-reference",
      "latest-css-earth-browser",
      "absolute-difference",
    ]),
    uiChrome: "excluded-from-both-comparison-sides",
    animation: "none-settled-endpoints-only",
    isolatedCaptureOrder: Object.freeze([
      "starfield",
      "sun",
    ]),
    lens: browserManifest.lens,
    structuralFailures,
    poses,
    interactions,
  });
  const reportPath = resolve(outputRoot, "report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (!report.oracleValid) {
    throw new Error(
      `Venus Google Maps oracle is structurally invalid: ` +
      structuralFailures.join("; "),
    );
  }
  return Object.freeze({ report, reportPath });
}

function qualifyEndpoint(pose: OraclePose, referenceLod: ReturnType<typeof classifyReferenceLod>, referenceAnalysis: Analysis | null, componentScores: ComponentScores | null) {
  if (!referenceLod.comparableSpaceScene || !referenceAnalysis ||
      !componentScores) {
    return Object.freeze({
      qualified: false,
      qualification: "EXCLUDED_GOOGLE_MAP_DETAIL_LOD",
      failures: Object.freeze([
        "Google removed the starfield and Sun at this map-detail LOD",
      ]),
    });
  }
  const failures = [];
  for (const [id, component] of Object.entries(componentScores)) {
    if (!component.qualified) failures.push(`${id} component is unqualified`);
  }
  return Object.freeze({
    qualified: failures.length === 0,
    qualification: failures.length === 0
      ? "OBSERVABLE_ENDPOINT_AND_COMPONENTS_QUALIFIED"
      : "INVALID_ENDPOINT_OR_COMPONENT",
    failures: Object.freeze(failures),
  });
}

function relevantAnalysis(analysis: Analysis | null) {
  if (!analysis) return null;
  return Object.freeze({
    sun: analysis.sun,
    background: analysis.background,
  });
}

function backgroundDeltaOnly(delta: ReturnType<typeof interactionDelta>) {
  return Object.freeze({
    backgroundChangedPixelRatio: delta.backgroundChangedPixelRatio,
  });
}

function weightedComponentScore(componentScores: ComponentScores) {
  const eligible = componentEntries
    .filter(([id]) => Number.isFinite(componentScores[id].score));
  const weight = eligible.reduce((sum, [, componentWeight]) =>
    sum + componentWeight, 0);
  if (weight === 0) return null;
  return eligible.reduce((score, [id, componentWeight]) =>
    score + numericScore(componentScores[id].score) * componentWeight, 0) / weight;
}

function classifyReferenceLod(bytes: Buffer, camera: GoogleCamera, defaultCamera: GoogleCamera) {
  const imageEvidence = classifySceneLod(bytes);
  const rangeRatio = camera.rangeUnit === "m" &&
    defaultCamera.rangeUnit === "m" && camera.range !== null && defaultCamera.range !== null
    ? camera.range / defaultCamera.range
    : null;
  const mapDetailLod = rangeRatio !== null && Number.isFinite(rangeRatio) && rangeRatio < 0.75;
  return Object.freeze({
    state: mapDetailLod ? "map-detail" : imageEvidence.state,
    comparableSpaceScene: !mapDetailLod && imageEvidence.comparableSpaceScene,
    basis: mapDetailLod
      ? "settled-google-camera-range-switches-away-from-space-scene"
      : imageEvidence.basis,
    rangeRatioFromDefault: rangeRatio,
    imageEvidence,
  });
}

function validateManifests(reference: ReferenceManifest, browser: BrowserManifest) {
  if (reference.schema !== "cssvenus-google-maps-reference@3") {
    throw new TypeError("Google Maps reference manifest schema is incompatible.");
  }
  if (browser.schema !== "cssvenus-browser-oracle-capture@3") {
    throw new TypeError("cssEarth browser manifest schema is incompatible.");
  }
  if (reference.canonicalUrl !== GOOGLE_MAPS_VENUS_URL) {
    throw new Error("Google Maps reference did not start from the canonical URL.");
  }
  if (JSON.stringify(reference.cameraModel) !==
      JSON.stringify(browser.cameraModel)) {
    throw new Error("Reference and browser camera contracts differ.");
  }
  if (JSON.stringify(reference.viewport) !== JSON.stringify(browser.viewport) ||
      JSON.stringify(reference.sceneClip) !== JSON.stringify(browser.sceneClip)) {
    throw new Error("Reference and browser capture geometry differ.");
  }
  if (reference.animation !== "settled-endpoints-only" ||
      browser.animation !== "paused-at-zero-settled-endpoints-only") {
    throw new Error("Oracle inputs are not animation-free endpoint captures.");
  }
}

function structuralFailuresFor(reference: ReferenceManifest, browser: BrowserManifest) {
  const failures = [];
  if (reference.comparisonImagesContainUiChrome !== false ||
      browser.comparisonImagesContainUiChrome !== false) {
    failures.push("comparison imagery contains UI chrome");
  }
  for (const pose of reference.poses) {
    if (!pose.finalUrl.includes("/maps/space/venus/")) {
      failures.push(`reference pose ${pose.id} is not Venus`);
    }
    if (pose.uiChrome.intrudingBoxes.length > 0) {
      failures.push(`reference pose ${pose.id} contains Google UI`);
    }
    if (pose.stability.finalChangedPixelRatio >
        pose.stability.maximumAllowedChangedPixelRatio) {
      failures.push(`reference pose ${pose.id} did not settle`);
    }
  }
  for (const pose of browser.poses) {
    const referencePose = reference.poses.find(({ id }) => id === pose.id);
    const defaultReference = reference.poses.find(({ id }) => id === "default");
    if (!referencePose || !defaultReference) {
      failures.push(`browser pose ${pose.id} has no paired Google camera`);
      continue;
    }
    let expectedCamera = null;
    try {
      expectedCamera = deriveBrowserCamera(
        referencePose.camera,
        defaultReference.camera,
      );
    } catch (error) {
      failures.push(`browser pose ${pose.id} camera mapping failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (expectedCamera && ORACLE_CAMERA_MODEL.browserCoordinates.some((coordinate) =>
      Math.abs(pose.runtime.camera[coordinate] - expectedCamera[coordinate]) >
        ORACLE_CAMERA_TOLERANCE)) {
      failures.push(`browser pose ${pose.id} is not at its mapped Google endpoint`);
    }
    if (pose.cameraMapping?.model !== reference.cameraModel.mapping ||
        JSON.stringify(pose.cameraMapping?.referenceCamera) !==
          JSON.stringify(referencePose.camera)) {
      failures.push(`browser pose ${pose.id} lacks camera mapping provenance`);
    }
    if (pose.uiChrome.visibleNonStageElements.length > 0) {
      failures.push(`browser pose ${pose.id} contains cssEarth UI`);
    }
    if (pose.runtime.animations.some(({ playState }) => playState !== "paused")) {
      failures.push(`browser pose ${pose.id} contains active animation`);
    }
    if (pose.runtime.canvasCount !== 0 || pose.runtime.svgCount !== 0) {
      failures.push(`browser pose ${pose.id} left the PolyCSS scene closure`);
    }
    if (pose.stability.finalChangedPixelRatio >
        pose.stability.maximumAllowedChangedPixelRatio) {
      failures.push(`browser pose ${pose.id} did not settle`);
    }
  }
  if (browser.lens !== ORACLE_LENS) {
    failures.push(`browser lens is ${browser.lens}, expected ${ORACLE_LENS}`);
  }
  return failures;
}

function requiredPose<Pose extends { id: string }>(manifest: { readonly poses: readonly Pose[] }, id: string) {
  const pose = manifest.poses.find((candidate) => candidate.id === id);
  if (!pose) throw new Error(`Manifest is missing pose ${id}.`);
  return pose;
}

async function comparePose(pose: OraclePose, referenceManifest: ReferenceManifest, browserManifest: BrowserManifest, outputRoot: string, loaded: Map<string, Buffer>) {
  const defaultReferencePose = requiredPose<ReferenceManifest["poses"][number]>(referenceManifest, "default");
    const reference = requiredPose<ReferenceManifest["poses"][number]>(referenceManifest, pose.id);
    const browser = requiredPose(browserManifest, pose.id);
    const [referenceBytes, browserBytes] = await Promise.all([
      readFile(reference.scene.path),
      readFile(browser.scene.path),
    ]);
    loaded.set(`reference:${pose.id}`, referenceBytes);
    loaded.set(`browser:${pose.id}`, browserBytes);
    const pixelComparison = comparePngBuffers(referenceBytes, browserBytes);
    if (pixelComparison.width !== ORACLE_SCENE_CLIP.width ||
        pixelComparison.height !== ORACLE_SCENE_CLIP.height) {
      throw new Error(`Pose ${pose.id} does not use the canonical scene crop.`);
    }
    const referenceLod = classifyReferenceLod(
      referenceBytes,
      reference.camera,
      defaultReferencePose.camera,
    );
    const comparableSpaceScene = referenceLod.comparableSpaceScene;
    const referenceAnalysis = comparableSpaceScene
      ? analyzeScenePng(referenceBytes)
      : null;
    const browserAnalysis = comparableSpaceScene
      ? analyzeScenePng(browserBytes)
      : null;
    const independentCaptures = referenceAnalysis && browserAnalysis
      ? await (async () => {
        const isolatedPoseRoot = resolve(outputRoot, "isolated", pose.id);
        await mkdir(isolatedPoseRoot, { recursive: true });
        return writeIndependentCaptures({
          referenceBytes,
          browserBytes,
          referenceAnalysis,
          browserAnalysis,
          outputRoot: isolatedPoseRoot,
        });
      })()
      : null;
    const componentScores = referenceAnalysis && browserAnalysis
      ? Object.freeze({
        starfield: compareStarfieldFeatures(
          referenceBytes,
          browserBytes,
          referenceAnalysis,
          browserAnalysis,
        ),
        sun: compareSunPresentations(
          referenceAnalysis.sun,
          browserAnalysis.sun,
          {
            maximumCentroidDeltaPixels:
              pose.endpointContract.maximumSunCentroidDeltaPixels,
          },
        ),
      })
      : null;
    const endpointQualification = qualifyEndpoint(
      pose,
      referenceLod,
      referenceAnalysis,
      componentScores,
    );
    const diagnosticComponentWeightedScore = endpointQualification.qualified && componentScores
      ? weightedComponentScore(componentScores)
      : null;
    return Object.freeze({
      id: pose.id,
      label: pose.label,
      mappingQualification: pose.mappingQualification,
      qualification: ORACLE_QUALIFICATION,
      reference: Object.freeze({
        path: reference.scene.path,
        sha256: reference.scene.sha256,
        camera: reference.camera,
        lod: referenceLod,
        analysis: relevantAnalysis(referenceAnalysis),
      }),
      browser: Object.freeze({
        path: browser.scene.path,
        sha256: browser.scene.sha256,
        camera: browser.runtime.camera,
        analysis: relevantAnalysis(browserAnalysis),
      }),
      independentCaptures,
      endpointQualification,
      componentScores,
      diagnosticComponentWeightedScore,
      diagnosticComponentWeightedScorePercent:
        diagnosticComponentWeightedScore === null
        ? null
        : diagnosticComponentWeightedScore * 100,
    });
}

function requiredBuffer(loaded: ReadonlyMap<string, Buffer>, key: string): Buffer {
  const bytes = loaded.get(key);
  if (!bytes) throw new Error(`Missing loaded capture ${key}.`);
  return bytes;
}
function numericScore(value: number | null): number {
  if (value === null || !Number.isFinite(value)) throw new Error("Missing finite eligible component score.");
  return value;
}
