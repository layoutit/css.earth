import { CANONICAL_PREPARED_IMAGE_DENSITY, canonicalPreparedAsset, preparedResourcePool } from '@cssearth/renderer/rendering/prepared-object-assets.ts';
import { POINT_MIN_RADIUS_PX } from '@cssearth/engine';
import type { PreparedVariant, PreparedWrite } from '@cssearth/renderer/rendering/prepared-presentation.ts';
import type { AtlasAddress, PresentationInputs, PresentationDraft, SourceMaterialTrack } from './types.js';
import type { PreparedNode, PresentationAdapters } from './adapters.js';
import { seamOutsetBinding, seamOutsetInitialValue } from '../scene/seam-outset.js';
const PREPARED_PRESENTATION_SCHEMA = 'cssearth-prepared-presentation@3';
const BILLBOARD_LIGHTING_KEY = 'lighting-billboard', SHADOWLESS_BILLBOARD_KEY = 'shadowless-billboard';
export async function prepareRowBankCutaway(input: PresentationInputs, adapters: PresentationAdapters): Promise<PresentationDraft> {
  const { namespace: ns, scene: plan, assets, lenses, sun } = input;
  const { createPreparedNodeTree, prepareCssomDeclarationReads } = adapters;

  const bank = assets.lighting.banks[String(CANONICAL_PREPARED_IMAGE_DENSITY)], normal = lenses.controls.find(lens => lens.id === lenses.defaultLens);
  if (!normal) throw new TypeError("The default lens is missing.");
  // The stars ride the scene matrix through the prepared astrometric
  // registration, exactly like the observed Sun.
  if (plan.starfield.cameraContract !== "scene-locked-unbounded-accumulated-matrix3d" || typeof plan.starfield.sceneRegistration !== "string") {
    throw new TypeError("Object cubic-sky camera binding is incompatible.");
  }
  // The far view's lighting: every frame in one small atlas, so the overlay
  // keeps the phase while the row shards stop streaming.
  const billboard = bank.billboard;
  if (!billboard || typeof billboard.schema !== "string" || billboard.presentations.length !== assets.lighting.frameCount) {
    throw new Error("Object has no prepared billboard lighting atlas.");
  }
  for (const lens of lenses.controls) if (!/^#[0-9a-f]{6}$/u.test(lens.billboardColor ?? "")) throw new Error(`Object lens ${lens.id} has no prepared billboard colour.`);
  const interiorKeys = ["outerSurface", "outerPoles", "outerSurfaceUnlit", "outerPolesUnlit", "core", "corePoles", "section"];
  const entries = [
    { key: "shadowless", url: bank.shadowless.url, pool: "warm" },
    { key: SHADOWLESS_BILLBOARD_KEY, url: billboard.shadowless.url, pool: "warm" },
    // The billboard atlas serves the far view with shadows on; it loads when that view needs a frame.
    { key: BILLBOARD_LIGHTING_KEY, url: billboard.url, pool: "billboard" },
    ...lenses.controls.filter(lens => lens.view === "exterior").flatMap(lens => {
      const pool = lens.id === lenses.defaultLens ? "warm" : "lenses";
      return [{ key: `surface:${lens.id}`, url: canonicalPreparedAsset(lens.surfaceUrl, lens.surface2xUrl), pool },
        { key: `poles:${lens.id}`, url: canonicalPreparedAsset(lens.polesUrl, lens.poles2xUrl), pool }];
    }),
    ...interiorKeys.map(name => ({ key: `interior:${name}`, pool: "lenses", url: canonicalPreparedAsset(assets.interior[`${name}Url`], assets.interior[`${name}2xUrl`]) })),
    ...bank.rows.map((row, index) => ({ key: `lighting:${index}`, url: row.url, pool: "lighting" })),
  ];
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads([
    ...plan.bodyLeaves, ...plan.interior.outerBodyLeaves, ...plan.interior.coreLeaves, ...plan.interior.sectionLeaves].map(leaf => leaf.style)) });
  // A true perspective camera (the shared orbit writes its perspective and
  // eye from the prepared plan): the body is placed by dolly on the scene
  // root, the roots are never scaled.
  const camera = b.element("div", `polycss-camera ${ns}-camera object-render-root`);
  const scene = b.element("div", `polycss-scene ${ns}-scene`); scene.style.transform = plan.camera.defaultTransform;
  const system = b.mesh(`${ns}-system`); system.style.transform = plan.systemTransform;
  // The outset reaches both the body and the cutaway body, which reuses the surface leaves.
  const seamOutset = plan.preparedSurface?.seamRepair?.outset;
  if (seamOutset) system.style.setProperty(seamOutset.property, seamOutsetInitialValue(seamOutset, plan.camera.logicalBodyDiameter));
  const body = b.mesh(`${ns}-body`); body.style.transform = plan.bodyTransform;
  const surfaceUrl = canonicalPreparedAsset(normal.surfaceUrl, normal.surface2xUrl), polesUrl = canonicalPreparedAsset(normal.polesUrl, normal.poles2xUrl);
  const texture = (node: PreparedNode, name: string, url: string) => node.style.setProperty(name, `url("${url}")`);
  texture(body, `--${ns}-surface-image`, surfaceUrl); texture(body, `--${ns}-poles-image`, polesUrl);
  b.append(null, camera); b.append(camera, scene); b.append(scene, system); b.append(system, body);
  for (const leaf of plan.bodyLeaves) b.append(body, b.leaf(leaf));
  const cutaway = b.mesh(`${ns}-cutaway`), cutawayBody = b.mesh(`${ns}-cutaway-body`); cutawayBody.style.transform = plan.interior.bodyTransform;
  // A hidden retained subtree must not fetch its cutaway textures on mount.
  cutaway.style.display = "none";
  // Every leaf reads its own mesh's surface and poles images (scene/projector.ts): the cutaway shell, the core and the
  // sections each set theirs, and the lens variants rewrite them.
  const interiorUrl = (name: string) => canonicalPreparedAsset(assets.interior[`${name}Url`], assets.interior[`${name}2xUrl`]);
  texture(cutawayBody, `--${ns}-surface-image`, interiorUrl("outerSurface")); texture(cutawayBody, `--${ns}-poles-image`, interiorUrl("outerPoles"));
  b.append(system, cutaway); b.append(cutaway, cutawayBody);
  for (const leaf of plan.interior.outerBodyLeaves) b.append(cutawayBody, b.leaf(leaf));
  const core = b.mesh(`${ns}-interior-core`); core.style.transform = plan.interior.bodyTransform; b.append(cutaway, core);
  texture(core, `--${ns}-surface-image`, interiorUrl("core")); texture(core, `--${ns}-poles-image`, interiorUrl("corePoles"));
  for (const leaf of plan.interior.coreLeaves) b.append(core, b.leaf(leaf));
  const sections = b.mesh(`${ns}-interior-sections`); sections.style.transform = plan.interior.bodyTransform; b.append(cutaway, sections);
  texture(sections, `--${ns}-surface-image`, interiorUrl("section"));
  for (const leaf of plan.interior.sectionLeaves) b.append(sections, b.leaf(leaf));
  // The overlay root carries the billboard (a flat disc of the surface's mean
  // colour fitted to the same silhouette as the overlay above it, which
  // lights it) and the terminator overlay.
  const materialRoot = b.element("div", `${ns}-material-root object-render-root`);
  materialRoot.style.setProperty(`--${ns}-billboard-color`, normal.billboardColor);
  const billboardDisc = b.element("s", `${ns}-billboard`), materialLeaf = b.element("s", `${ns}-material`);
  b.append(null, materialRoot); b.append(materialRoot, billboardDisc); b.append(materialRoot, materialLeaf);
  const { tree, index } = b.finish({ camera, scene });
  const address = (p: AtlasAddress, resource = `lighting:${p.rowIndex}`, row = p.rowIndex) => ({ resource, frame: p.frameIndex, row,
    backgroundPosition: p.backgroundPosition, backgroundSize: p.backgroundSize });
  // The near bank streams row shards; past the geometry stage the far bank
  // draws the same frame from the billboard atlas (one row).
  const billboardAddress = (p: AtlasAddress) => address(p, BILLBOARD_LIGHTING_KEY, 0);
  const track: SourceMaterialTrack = { id: "lighting", target: index(materialLeaf), frame: { source: "sun-z", minimum: assets.lighting.minimumLightViewZ,
      maximum: assets.lighting.maximumLightViewZ, count: assets.lighting.frameCount, baseFrame: 0, remap: null },
    banks: [{ id: "rows", frames: bank.presentations.map(p => address(p)), default: null, fixed: { resource: "shadowless", frame: bank.shadowless.frameIndex, row: null, backgroundPosition: bank.shadowless.backgroundPosition, backgroundSize: bank.shadowless.backgroundSize },
      rows: bank.rows.map((_, row) => ({ row, resource: `lighting:${row}`, firstFrame: row * bank.transport.framesPerRow,
        lastFrame: Math.min(bank.presentations.length - 1, (row + 1) * bank.transport.framesPerRow - 1) })) },
    { id: "billboard", frames: billboard.presentations.map(billboardAddress), default: null, fixed: { resource: SHADOWLESS_BILLBOARD_KEY, frame: billboard.shadowless.frameIndex, row: null, backgroundPosition: billboard.shadowless.backgroundPosition, backgroundSize: billboard.shadowless.backgroundSize },
      rows: [{ row: 0, resource: BILLBOARD_LIGHTING_KEY, firstFrame: 0, lastFrame: billboard.presentations.length - 1 }] }],
    farBank: "billboard",
    demand: { capacity: bank.transport.maximumRetainedRowCount, defaultFrame: bank.transport.defaultFrame },
    rotation: { kind: "angle", source: "view-sun", reference: "prepared", baseDegrees: assets.lighting.baseLightAzimuthDegrees,
      zeroAtPole: false, property: `--${ns}-light-roll` }, frameAttribute: null, modeAttribute: null, quoted: true };
  const variants: PreparedVariant[] = lenses.controls.flatMap(lens => [false, true].map(shadows => {
    const interior = lens.view === "interior", writeTexture = (target: PreparedNode, name: string, resource: string): PreparedWrite => ({ kind: "texture", target: index(target), name, resource, quoted: true });
    return { when: { lensId: lens.id, shadows }, required: interior
      ? [`surface:${lenses.defaultLens}`, `poles:${lenses.defaultLens}`, ...interiorKeys.filter(name => shadows ? !name.endsWith('Unlit') : !['outerSurface','outerPoles'].includes(name)).map(name => `interior:${name}`)] : [`surface:${lens.id}`, `poles:${lens.id}`],
      writes: [
        { kind: "style", target: index(cutaway), name: "display", value: interior ? "block" : "none" },
        ...(interior ? [writeTexture(cutawayBody, `--${ns}-surface-image`, `interior:outerSurface${shadows?'':'Unlit'}`),
          writeTexture(cutawayBody, `--${ns}-poles-image`, `interior:outerPoles${shadows?'':'Unlit'}`)]
          : [writeTexture(body, `--${ns}-surface-image`, `surface:${lens.id}`), writeTexture(body, `--${ns}-poles-image`, `poles:${lens.id}`)]),
        { kind: "attribute", target: -1, name: "data-view", value: interior ? "interior" : null },
        { kind: "attribute", target: -1, name: "data-lens", value: interior || lens.id === lenses.defaultLens ? null : lens.id },
        { kind: "class", target: -1, name: `${ns}-hide-shadows`, value: !shadows },
        { kind: "style", target: index(materialRoot), name: `--${ns}-billboard-color`, value: lens.billboardColor },
      ], materials: [{ track: "lighting", bank: "rows", mode: shadows ? "frames" : "fixed", enabled: true, rotationEnabled: shadows,
        frameOverride: shadows ? null : assets.lighting.frameCount - 1, clearWhenHidden: false, fixedMode: "full-phase-curvature",
        modeLabel: shadows ? "directional-terminator" : "full-phase-curvature",
        addressAttributes: [{ name: "data-material-frame", source: shadows ? "frame" : "literal", value: null },
          { name: "data-material-mode", source: "literal", value: shadows ? null : "full-phase-curvature" }],
      }] };
  }));
  const pose = plan.interior.presentationOrbit;
  const startup = entries.filter(entry => entry.pool === "warm").map(entry => entry.key);
  return { schema: PREPARED_PRESENTATION_SCHEMA, camera: plan.camera, sky: plan.starfield, sun,
    assets: { entries, pools: [preparedResourcePool("warm", entries, { retention: "warm", decoding: "sync" }),
      preparedResourcePool("lenses", entries, { retention: "selection", decoding: "sync", capacity: interiorKeys.length + 1, concurrency: interiorKeys.length + 1 }),
      preparedResourcePool("lighting", entries, { retention: "selection", decoding: "sync", capacity: bank.transport.maximumRetainedRowCount,
        concurrency: bank.transport.maximumRetainedRowCount, eviction: "capacity", reuse: true }),
      preparedResourcePool("billboard", entries, { retention: "selection", decoding: "sync" })],
      // Lighting rows load when shadows are turned on; shadows start off and show the one shadowless frame.
      startup },
    tree, variants, resourceOrder: "materials-first", materials: [track],
    viewBindings: [
      // The terminator overlay fitted to the projected silhouette; it never
      // shrinks below the marker it lights at the far stage.
      { kind: "silhouette-fit", target: index(materialRoot), minimumRadius: POINT_MIN_RADIUS_PX,
        unitScale: 2 / plan.camera.logicalBodyDiameter },
      // Level of detail from the camera's published stage (see styles.css).
      { kind: "view-attribute", target: -1, property: "data-lod", source: "level-of-detail-stage", precision: null },
      { kind: "view-property", target: index(materialRoot), property: `--${ns}-billboard-opacity`, source: "billboard-opacity", precision: 6 },
      ...(seamOutset ? [seamOutsetBinding(seamOutset, index(system))] : []),
    ],
    animations: [{ target: index(cutaway), id: `${ns}-interior-presentation-orbit`, mode: "pose", duration: pose.durationMilliseconds,
      sourceMinimum: plan.camera.minimumControlPitchDegrees, millisecondsPerDegree: pose.millisecondsPerControlDegree, keyframes: pose.keyframes }] };
}
