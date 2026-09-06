import { pathToFileURL } from "node:url";
import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../../../platform/prepared-object-assets.mjs";
import { PREPARED_NAVIGATION_MARKERS } from "../../../../site/prepared-navigation-markers.mjs";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { PREPARED_PRESENTATION_SCHEMA } from "../../../platform/prepared-presentation-contract.mjs";
import { DEFAULT_LABEL_POLICY } from "../../../platform/label-field.mjs";
import { prepareCssomDeclarationReads } from "../../../../tools/prepared-cssom.mjs";
import { createPreparedNodeTree } from "../../../../tools/prepared-node-tree.mjs";
import { writePreparedPresentation } from "../../../../tools/prepare-presentation.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_MERCURY_SCENE as plan } from "../runtime/preparedScene.mjs";
import { PREPARED_MERCURY_ASSETS as assets } from "../runtime/preparedAssets.mjs";
import { PREPARED_MERCURY_LENSES as lenses } from "../runtime/preparedLenses.mjs";
import { PREPARED_MERCURY_SKY_SUN as sun } from "../runtime/preparedSkySun.mjs";
import { PREPARED_MERCURY_SYSTEM_MARKERS as systemMarkerStrip } from "../runtime/preparedSystemMarkers.mjs";

// The shell's navigation atlas (see site/planet-navigation-marker.css): the
// far-view marker is the header's Mercury sprite, from the same file.
const NAVIGATION_MARKER_ATLAS_URL = "/navigation/planet-markers@2x.webp";
const BILLBOARD_LIGHTING_KEY = "lighting-billboard";

export async function prepareMercuryPresentation() {
  const bank = assets.lighting.banks[String(CANONICAL_PREPARED_IMAGE_DENSITY)], normal = lenses.controls.find(lens => lens.id === "normal");
  // The stars ride the scene matrix through the prepared astrometric
  // registration, exactly like the observed Sun.
  if (plan.starfield.cameraContract !== "scene-locked-unbounded-accumulated-matrix3d" || typeof plan.starfield.sceneRegistration !== "string") {
    throw new TypeError("Mercury cubic-sky camera binding is incompatible.");
  }
  // The far view's lighting: every frame in one small atlas, so the overlay
  // keeps the phase while the row shards stop streaming.
  const billboard = bank.billboard;
  if (billboard?.schema !== "cssmercury-prepared-lighting-billboard@1" || billboard.presentations.length !== assets.lighting.frameCount) {
    throw new Error("Mercury has no prepared billboard lighting atlas.");
  }
  for (const lens of lenses.controls) if (!/^#[0-9a-f]{6}$/u.test(lens.billboardColor ?? "")) throw new Error(`Mercury lens ${lens.id} has no prepared billboard colour.`);
  const interiorKeys = ["outerSurface", "outerPoles", "core", "corePoles", "section"];
  const entries = [...preparedSkyResources(plan.starfield, sun, "warm"),
    { key: "poles", url: canonicalPreparedAsset(assets.poles), pool: "warm" },
    { key: "shadowless", url: bank.presentations.at(-1).url, pool: "warm" },
    { key: BILLBOARD_LIGHTING_KEY, url: billboard.url, pool: "warm" },
    ...lenses.controls.filter(lens => lens.view === "exterior").map(lens => ({ key: `surface:${lens.id}`,
      url: canonicalPreparedAsset(lens.surfaceUrl, lens.surface2xUrl), pool: lens.id === "normal" ? "warm" : "lenses" })),
    ...interiorKeys.map(name => ({ key: `interior:${name}`, pool: "lenses", url: canonicalPreparedAsset(assets.interior[`${name}Url`], assets.interior[`${name}2xUrl`]) })),
    ...bank.rows.map((row, index) => ({ key: `lighting:${index}`, url: row.url, pool: "lighting" })),
  ];
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads([
    ...plan.bodyLeaves, ...plan.interior.outerBodyLeaves, ...plan.interior.coreLeaves, ...plan.interior.sectionLeaves].map(leaf => leaf.style)) });
  // A true perspective camera (the shared orbit writes its perspective and
  // eye from the prepared plan): the body is placed by dolly on the scene
  // root, the roots are never scaled.
  const camera = b.element("div", "polycss-camera mercury-camera planet-render-root");
  const scene = b.element("div", "polycss-scene mercury-scene"); scene.style.transform = plan.camera.defaultTransform;
  const system = b.mesh("mercury-system"); system.style.transform = plan.systemTransform;
  const body = b.mesh("mercury-body"); body.style.transform = plan.bodyTransform;
  const surfaceUrl = canonicalPreparedAsset(normal.surfaceUrl, normal.surface2xUrl), polesUrl = canonicalPreparedAsset(assets.poles.url, assets.poles.url2x);
  const texture = (node, name, url) => node.style.setProperty(name, `url("${url}")`);
  texture(body, "--mercury-surface-image", surfaceUrl); texture(body, "--mercury-poles-image", polesUrl);
  b.append(null, camera); b.append(camera, scene); b.append(scene, system); b.append(system, body);
  for (const leaf of plan.bodyLeaves) b.append(body, b.leaf(leaf));
  const cutaway = b.mesh("mercury-cutaway"), cutawayBody = b.mesh("mercury-cutaway-body"); cutawayBody.style.transform = plan.interior.bodyTransform;
  texture(cutawayBody, "--mercury-surface-image", surfaceUrl); texture(cutawayBody, "--mercury-poles-image", polesUrl);
  texture(cutawayBody, "--mercury-interior-outer-image", canonicalPreparedAsset(assets.interior.outerSurfaceUrl, assets.interior.outerSurface2xUrl));
  texture(cutawayBody, "--mercury-interior-outer-poles-image", canonicalPreparedAsset(assets.interior.outerPolesUrl, assets.interior.outerPoles2xUrl));
  b.append(system, cutaway); b.append(cutaway, cutawayBody);
  for (const leaf of plan.interior.outerBodyLeaves) b.append(cutawayBody, b.leaf(leaf));
  const core = b.mesh("mercury-interior-core"); core.style.transform = plan.interior.bodyTransform; b.append(cutaway, core);
  for (const leaf of plan.interior.coreLeaves) b.append(core, b.leaf(leaf));
  const sections = b.mesh("mercury-interior-sections"); sections.style.transform = plan.interior.bodyTransform; b.append(cutaway, sections);
  for (const leaf of plan.interior.sectionLeaves) b.append(sections, b.leaf(leaf));
  // The overlay root carries the billboard (a flat disc of the surface's mean
  // colour fitted to the same silhouette as the overlay above it, which
  // lights it) and the terminator overlay.
  const materialRoot = b.element("div", "mercury-material-root planet-render-root");
  materialRoot.style.setProperty("--mercury-billboard-color", normal.billboardColor);
  const billboardDisc = b.element("s", "mercury-billboard"), materialLeaf = b.element("s", "mercury-material");
  b.append(null, materialRoot); b.append(materialRoot, billboardDisc); b.append(materialRoot, materialLeaf);
  const { tree, index } = b.finish({ camera, scene });
  const address = (p, resource = `lighting:${p.rowIndex}`, row = p.rowIndex) => ({ resource, frame: p.frameIndex, row,
    backgroundPosition: p.backgroundPosition, backgroundSize: p.backgroundSize });
  // The near bank streams row shards; past the geometry stage the far bank
  // draws the same frame from the billboard atlas (one row).
  const billboardAddress = p => address(p, BILLBOARD_LIGHTING_KEY, 0);
  const track = { id: "lighting", target: index(materialLeaf), frame: { source: "sun-z", minimum: assets.lighting.minimumLightViewZ,
      maximum: assets.lighting.maximumLightViewZ, count: assets.lighting.frameCount, baseFrame: 0, remap: null },
    banks: [{ id: "rows", frames: bank.presentations.map(p => address(p)), default: null, fixed: address(bank.presentations.at(-1), "shadowless"),
      rows: bank.rows.map((_, row) => ({ row, resource: `lighting:${row}`, firstFrame: row * bank.transport.framesPerRow,
        lastFrame: Math.min(bank.presentations.length - 1, (row + 1) * bank.transport.framesPerRow - 1) })) },
    { id: "billboard", frames: billboard.presentations.map(billboardAddress), default: null, fixed: billboardAddress(billboard.presentations.at(-1)),
      rows: [{ row: 0, resource: BILLBOARD_LIGHTING_KEY, firstFrame: 0, lastFrame: billboard.presentations.length - 1 }] }],
    farBank: "billboard",
    demand: { capacity: bank.transport.maximumRetainedRowCount, defaultFrame: bank.transport.defaultFrame },
    rotation: { kind: "angle", source: "view-sun", reference: "prepared", baseDegrees: assets.lighting.baseLightAzimuthDegrees,
      zeroAtPole: false, property: "--mercury-light-roll" }, frameAttribute: null, modeAttribute: null, quoted: true };
  const variants = lenses.controls.flatMap(lens => [false, true].flatMap(shadows => [false, true].map(orbit => {
    const interior = lens.view === "interior", writeTexture = (target, name, resource) => ({ kind: "texture", target: index(target), name, resource, quoted: true });
    return { when: { lensId: lens.id, shadows, orbit }, required: interior
      ? ["surface:normal", "poles", ...interiorKeys.map(name => `interior:${name}`)] : [`surface:${lens.id}`, "poles"],
      writes: [
        ...(interior ? [writeTexture(cutawayBody, "--mercury-surface-image", "surface:normal"), writeTexture(cutawayBody, "--mercury-poles-image", "poles")]
          : [writeTexture(body, "--mercury-surface-image", `surface:${lens.id}`), writeTexture(cutawayBody, "--mercury-surface-image", `surface:${lens.id}`)]),
        { kind: "attribute", target: -1, name: "data-view", value: interior ? "interior" : null },
        { kind: "attribute", target: -1, name: "data-lens", value: interior || lens.id === lenses.defaultLens ? null : lens.id },
        { kind: "class", target: -1, name: "mercury-hide-shadows", value: !shadows },
        // The orbit line is retained either way; the class only hides it.
        { kind: "class", target: -1, name: "mercury-hide-orbit", value: !orbit },
        { kind: "style", target: index(materialRoot), name: "--mercury-billboard-color", value: lens.billboardColor },
      ], materials: [{ track: "lighting", bank: "rows", mode: shadows ? "frames" : "fixed", enabled: true, rotationEnabled: shadows,
        frameOverride: shadows ? null : assets.lighting.frameCount - 1, clearWhenHidden: false, fixedMode: "full-phase-curvature",
        modeLabel: shadows ? "directional-terminator" : "full-phase-curvature",
        addressAttributes: [{ name: "data-material-frame", source: shadows ? "frame" : "literal", value: null },
          { name: "data-material-mode", source: "literal", value: shadows ? null : "full-phase-curvature" }],
      }] };
  })));
  const pose = plan.interior.presentationOrbit;
  // The Sun at its true distance as real geometry, the orbit as a true
  // ellipse, and the shell's own Mercury marker (tile and size from the
  // shared atlas) once the disc is too small to read.
  const navigationMarker = PREPARED_NAVIGATION_MARKERS.mercury;
  if (!navigationMarker || !(navigationMarker.presentation?.size > 0)) throw new Error("Mercury has no prepared navigation marker.");
  // The other planets and the Sun as the same atlas tiles at the shell's own
  // sizes: the planetary system's markers are billboards at a fixed screen
  // size, never geometry. Dwarf planets without a navigation tile draw from
  // Mercury's prepared system-marker strip (see prepare-system-markers.mjs).
  const atlasSprite = id => {
    const marker = PREPARED_NAVIGATION_MARKERS[id];
    if (marker && marker.presentation?.size > 0) return { index: marker.index, count: marker.count, size: marker.presentation.size };
    const tile = systemMarkerStrip.tiles[id];
    if (!tile) throw new Error(`No prepared marker for ${id}.`);
    return { url: canonicalPreparedAsset(systemMarkerStrip.density1.url, systemMarkerStrip.density2.url), index: tile.index, count: tile.count, size: tile.size };
  };
  // Captions above the far-view markers, under the shared label policy. The
  // names are the shell's display names (site/objects.mjs), spelled here as
  // this object's own data; the dwarf planets have no shell entry.
  const captionNames = { sun: "Sun", mercury: "Mercury", venus: "Venus", earth: "Earth", mars: "Mars", jupiter: "Jupiter",
    saturn: "Saturn", uranus: "Uranus", neptune: "Neptune", pluto: "Pluto", ceres: "Ceres", eris: "Eris", haumea: "Haumea", makemake: "Makemake" };
  const heliocentricView = { plan: plan.heliocentricView,
    bodyMarker: { url: NAVIGATION_MARKER_ATLAS_URL, index: navigationMarker.index, count: navigationMarker.count, size: navigationMarker.presentation.size },
    systemMarkers: { url: NAVIGATION_MARKER_ATLAS_URL, sun: atlasSprite("sun"),
      bodies: Object.fromEntries(plan.heliocentricView.system.bodies.map(body => [body.id, atlasSprite(body.id)])),
      // Each marker carries its phase from Mercury's own billboard lighting
      // atlas (the same frames the far-view overlay draws), scaled down.
      phase: { url: billboard.url, columns: billboard.columns, rowCount: billboard.rowCount, frameCount: billboard.frameCount,
        minimumLightViewZ: assets.lighting.minimumLightViewZ, maximumLightViewZ: assets.lighting.maximumLightViewZ,
        baseLightAzimuthDegrees: assets.lighting.baseLightAzimuthDegrees } },
    labels: { policy: { ...DEFAULT_LABEL_POLICY }, names: captionNames } };
  return { schema: PREPARED_PRESENTATION_SCHEMA, camera: plan.camera, sky: plan.starfield, sun, assets: { entries, pools: [preparedResourcePool("warm", entries, { retention: "warm", decoding: "sync" }),
      preparedResourcePool("lenses", entries, { retention: "selection", decoding: "sync", capacity: interiorKeys.length + 1, concurrency: interiorKeys.length + 1 }),
      preparedResourcePool("lighting", entries, { retention: "selection", decoding: "sync", capacity: bank.transport.maximumRetainedRowCount,
        concurrency: bank.transport.maximumRetainedRowCount, eviction: "capacity", reuse: true })],
      startup: [...entries.filter(entry => entry.pool === "warm").map(entry => entry.key), ...bank.transport.initialWarmRows.map(row => `lighting:${row}`)] },
    tree, variants, resourceOrder: "materials-first", materials: [track],
    heliocentricView,
    viewBindings: [
      // The terminator overlay fitted to the projected silhouette; it never
      // shrinks below the marker it lights at the far stage.
      { kind: "silhouette-fit", target: index(materialRoot), minimumRadius: navigationMarker.presentation.size / 2,
        unitScale: 2 * plan.camera.defaultZoom / plan.camera.logicalBodyDiameter },
      // Level of detail from the camera's published stage (see styles.css).
      { kind: "view-attribute", target: -1, property: "data-lod", source: "level-of-detail-stage", precision: null },
      { kind: "view-property", target: index(materialRoot), property: "--mercury-billboard-opacity", source: "billboard-opacity", precision: 6 },
    ],
    animations: [{ target: index(cutaway), id: "mercury-interior-presentation-orbit", mode: "pose", duration: pose.durationMilliseconds,
      sourceMinimum: plan.camera.minimumControlPitchDegrees, millisecondsPerDegree: pose.millisecondsPerControlDegree, keyframes: pose.keyframes }] };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await writePreparedPresentation(new URL("../runtime/preparedPresentation.mjs", import.meta.url), await prepareMercuryPresentation(), objectControls);
}
