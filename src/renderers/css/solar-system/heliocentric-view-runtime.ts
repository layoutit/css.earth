import {
  projectHeliocentricView,
  trailWeightsForSpans,
  validTrailSpans,
  validatePreparedHeliocentricView,
} from "./heliocentric-view.js";
import { validateLabelPolicy } from "@cssearth/engine";
import {createHeliocentricCaptions} from './heliocentric-captions.js';
import type {CaptionPlan,LabelPolicyOptions} from './heliocentric-captions.js';
import {writePieces,validPhaseAtlas,phaseFrameFor,validSprite,applySprite,formatNumber,clamp} from './heliocentric-sprites.js';
import type {SpriteWithUrl,SystemMarkers,PhaseAtlas} from './heliocentric-sprites.js';
import type {HeliocentricViewPlan,HeliocentricProjection,HeliocentricProjectionInput,TrailSpans,OrbitSegment} from './heliocentric-view.js';
import type {ExposureOptions} from "@cssearth/engine";
export interface HeliocentricMountOptions {host:HTMLElement;before?:HTMLElement|null;plan:HeliocentricViewPlan;objectId:string;sunImageUrl:string;markerSprite:SpriteWithUrl;systemMarkers?:SystemMarkers|null;labels?:CaptionPlan|null;orbitPoolSpare?:number;systemPoolSpare?:number;}
export type RetainedHeliocentricView = ReturnType<typeof mountRetainedHeliocentricView>;

// Mounts the retained DOM of a body's heliocentric neighbourhood and moves it
// with the camera:
//   - the Sun, a billboard in its own perspective root (`sunRoot`, inserted
//     before the body's camera root so it paints beneath it and the body
//     covers the Sun when the Sun is beyond it); the shared orbit gives both
//     roots the same eye;
//   - the orbit, a fixed pool of screen-space line pieces in an overlay root
//     that shares the camera root's box, written from the projection's
//     camera-relative float64 result;
//   - a body marker in the same overlay: the object's sprite from the shared
//     navigation atlas, the same few pixels the shell's header draws, whose
//     opacity the object's level-of-detail policy sets so the body stays
//     findable on its orbit once its true disc is too small to read;
//   - when the plan carries the planetary system, its points and captions
//     live in a celestial layer before the focused body's camera, so the
//     body naturally occludes them. Its orbit lines retain their distance fade;
//     and a Sun marker from the atlas that floors the Sun once its sprite is
//     too small to read, exactly as the body marker floors the body.
// Everything is created once; publication only rewrites transforms and
// visibility on the retained nodes.
export function mountRetainedHeliocentricView({
  host,
  before = null,
  plan,
  objectId,
  sunImageUrl,
  markerSprite,
  systemMarkers = null,
  // Captions (see label-field.mjs): a policy and a name per body, the
  // observer's own included; null draws no captions.
  labels = null,
  orbitPoolSpare = 48,
  systemPoolSpare = 8,
}: HeliocentricMountOptions) {
  validatePreparedHeliocentricView(plan);
  if (!(host instanceof HTMLElement) ||
      (before !== null && !(before instanceof HTMLElement)) ||
      !/^[a-z][a-z0-9-]*$/u.test(objectId) || typeof sunImageUrl !== "string" ||
      typeof markerSprite?.url !== "string" || !validSprite(markerSprite)) {
    throw new TypeError("Retained heliocentric view mount arguments are invalid.");
  }
  const system = plan.system ?? null;
  if (system !== null && (typeof systemMarkers?.url !== "string" ||
      !validSprite(systemMarkers.sun) ||
      system.bodies.some((body) => !validSprite(systemMarkers.bodies?.[body.id])) ||
      !validPhaseAtlas(systemMarkers.phase))) {
    throw new TypeError("A prepared planetary system needs a marker sprite for the Sun and every body, and the phase atlas.");
  }
  const phaseAtlas = system === null ? null : systemMarkers!.phase;
  if (labels !== null) {
    validateLabelPolicy(labels.policy);
    const needed = [objectId, ...(system === null ? [] : ["sun", ...system.bodies.map((body) => body.id)])];
    if (needed.some((id) => typeof labels.names?.[id] !== "string" || labels.names[id].length === 0)) {
      throw new TypeError("Captions need a name for the observer, the Sun and every system body.");
    }
  }
  const document = host.ownerDocument;
  const sunRoot = document.createElement("div");
  sunRoot.className =
    `planet-heliocentric-sun-camera planet-render-root ${objectId}-sun-camera`;
  sunRoot.ariaHidden = "true";
  host.insertBefore(sunRoot, before);
  const sun = document.createElement("s");
  // `<object>-directional-sun` is kept as an alias: it is the selector the
  // object's existing sky tests isolate the Sun by.
  sun.className =
    `planet-heliocentric-sun ${objectId}-sun ${objectId}-directional-sun`;
  sun.ariaHidden = "true";
  sun.style.width = `${plan.sun.sprite.imagePixels}px`;
  sun.style.height = `${plan.sun.sprite.imagePixels}px`;
  sun.style.margin = `${-plan.sun.sprite.imagePixels / 2}px 0 0 ` +
    `${-plan.sun.sprite.imagePixels / 2}px`;
  sun.style.backgroundImage = `url("${sunImageUrl}")`;
  sun.hidden = true;
  sunRoot.appendChild(sun);

  // Like the Sun, this sibling paints after the sky and before the body's
  // camera. Native body pixels occlude celestial points and text together.
  const celestialRoot = document.createElement("div");
  celestialRoot.className = `planet-heliocentric-sky planet-render-root ${objectId}-celestial-vault`;
  celestialRoot.ariaHidden = "true";
  host.insertBefore(celestialRoot, before);

  const overlay = document.createElement("div");
  overlay.className =
    `planet-heliocentric-orbit planet-render-root ${objectId}-orbit`;
  overlay.ariaHidden = "true";
  const poolSize = plan.orbit.vertexCount + orbitPoolSpare;
  const pieces: HTMLElement[] = [];
  for (let index = 0; index < poolSize; index += 1) {
    const piece = document.createElement("s");
    piece.className = "planet-heliocentric-orbit-piece";
    piece.style.visibility = "hidden";
    overlay.appendChild(piece);
    pieces.push(piece);
  }
  const marker = document.createElement("s");
  marker.className = `planet-heliocentric-body-marker ${objectId}-body-marker`;
  // The prepared atlas supplies the tile; projection sets its apparent size.
  applySprite(marker, markerSprite);
  marker.style.opacity = "0";
  overlay.appendChild(marker);

  // The atlas supplies the retained image; its navigation size is only the
  // source scale. Publication fits each marker to its apparent physical or
  // photometric diameter at the camera's distance.
  const systemGroup = document.createElement("div");
  systemGroup.className = `planet-heliocentric-system ${objectId}-planetary-system`;
  const systemMarkerGroup = document.createElement("div");
  systemMarkerGroup.className = "planet-heliocentric-system-markers";
  const systemPieces: HTMLElement[] = [];
  const systemMarkerElements = new Map<string,HTMLElement>();
  const systemPhaseElements = new Map<string,{element:HTMLElement;frame:number}>();
  const publishedPhaseRolls = new Map<string,number>();
  let systemPoolSize = 0;
  if (system !== null && systemMarkers !== null && phaseAtlas !== null) {
    systemPoolSize = system.bodies.reduce(
      (total, body) => total + body.orbit.vertexCount + systemPoolSpare,
      0,
    );
    for (let index = 0; index < systemPoolSize; index += 1) {
      const piece = document.createElement("s");
      piece.className =
        "planet-heliocentric-orbit-piece planet-heliocentric-system-orbit-piece";
      piece.style.visibility = "hidden";
      systemGroup.appendChild(piece);
      systemPieces.push(piece);
    }
    for (const body of system.bodies) {
      const element = document.createElement("s");
      element.className =
        `planet-heliocentric-system-marker ${objectId}-system-marker`;
      element.dataset.body = body.id;
      // A body's sprite may come from its own strip (the dwarf planets have
      // no navigation tile); otherwise from the shared atlas.
      applySprite(element, { url: systemMarkers.url, ...systemMarkers.bodies[body.id] });
      // Brightness belongs to the point, independent of orbit visibility.
      element.style.opacity = String(body.illumination.markerOpacity);
      element.style.visibility = "hidden";
      // Phase: the object's own billboard lighting atlas, the frame chosen
      // once from the prepared light depth, scaled to the marker and rolled
      // every publication so its lit side faces the Sun on screen.
      const phase = document.createElement("s");
      phase.className = "planet-heliocentric-marker-phase";
      const frame = phaseFrameFor(phaseAtlas, body.illumination.lightViewZ);
      const size = systemMarkers.bodies[body.id].size;
      phase.style.backgroundImage = `url("${phaseAtlas.url}")`;
      phase.style.backgroundSize = `${phaseAtlas.columns * size}px ${phaseAtlas.rowCount * size}px`;
      phase.style.backgroundPosition = `${-(frame % phaseAtlas.columns) * size}px ` +
        `${-Math.floor(frame / phaseAtlas.columns) * size}px`;
      phase.dataset.frame = String(frame);
      element.appendChild(phase);
      systemMarkerGroup.appendChild(element);
      systemMarkerElements.set(body.id, element);
      systemPhaseElements.set(body.id, { element: phase, frame });
    }
    systemGroup.style.opacity = "0";
    overlay.appendChild(systemGroup);
    celestialRoot.appendChild(systemMarkerGroup);
  }
  // The Sun's floor: the atlas Sun tile over the sprite's position, faded in
  // by the dolly as the sprite falls below the tile's size.
  let sunMarker:HTMLElement|null = null;
  if (system !== null && systemMarkers !== null && phaseAtlas !== null) {
    sunMarker = document.createElement("s");
    sunMarker.className = `planet-heliocentric-sun-marker ${objectId}-sun-marker`;
    applySprite(sunMarker, { ...systemMarkers.sun, url: systemMarkers.url });
    sunMarker.style.opacity = "0";
    sunMarker.style.visibility = "hidden";
    celestialRoot.appendChild(sunMarker);
  }
  // Captions: a fixed pool of retained caption elements in the overlay,
  // laid out above their markers by the one declutter pass, and one hidden
  // measuring element per name so each caption's width per cap height is
  // read from the retained DOM once at mount (no canvas, no per-frame
  // measurement). Their font is the shell's UI stack at the size that lands
  // capitals at the policy's cap height.
  const captions = labels === null ? null : createHeliocentricCaptions({host,celestialRoot,labels,objectId,markerSprite,system,systemMarkers,
    getMarkerOpacity:()=>publishedMarkerOpacity,getSunMarkerOpacity:()=>sunMarkerOpacity,getSunMarkerHidden:()=>publishedSunMarkerHidden});
  host.appendChild(overlay);

  let lastProjection:HeliocentricProjection|null = null;
  let publishedSunTransform:string|null = null;
  let publishedSunHidden = true;
  let publishedOrbitOpacity:string|null = null;
  let publishedMarkerOpacity:string|null = null;
  let publishedSystemOpacity:string|null = null;
  let publishedSunMarkerOpacity:string|null = null;
  let publishedSunMarkerTransform:string|null = null;
  let publishedSunMarkerHidden = true;
  let activePieceCount = 0;
  let overflowCount = 0;
  let activeSystemPieceCount = 0;
  let systemOverflowCount = 0;
  let visibleSystemMarkerCount = 0;
  const publishedSystemMarkerTransforms = new Map<string,string>();
  const systemMarkerHidden = new Map<string,boolean>();
  let systemOpacity = 0;
  let sunMarkerOpacity = 0;
  // A session's trail spans: null draws the prepared trails.
  let trailSpans:TrailSpans|null = null;
  let trailWeights:Readonly<Record<string,readonly number[]>>|null = null;
  let destroyed = false;

  return Object.freeze({
    plan,
    root: sunRoot,
    sunRoot,
    sun,
    overlay,
    celestialRoot,
    marker,
    systemGroup,
    systemMarkerGroup,
    sunMarker,
    retainedOrbitPieceCount: poolSize,
    retainedSystemOrbitPieceCount: systemPoolSize,
    retainedSystemMarkerCount: systemMarkerElements.size,
    retainedSunMarkerCount: sunMarker === null ? 0 : 1,
    retainedCaptionCount: captions?.count ?? 0,
    setSkyView(view: {matrix:string;exposure:Partial<ExposureOptions>|null}) { captions?.setSkyView(view); },
    publish({
      rotation,
      distance,
      focal,
      viewportWidth,
      viewportHeight,
      principalOffset,
      visibleRect = null,
    }: HeliocentricProjectionInput) {
      if (destroyed) throw new Error("Heliocentric view is destroyed.");
      const projection = projectHeliocentricView(plan, {
        rotation,
        distance,
        focal,
        viewportWidth,
        viewportHeight,
        principalOffset,
        visibleRect,
        // Nearby viewpoints still see planets in the vault; only the
        // prepared orbit line work follows the distance-dependent fade.
        system: system !== null,
        systemOrbits: systemOpacity > 0,
        trailWeights,
      });
      lastProjection = projection;
      publishSun(projection);
      publishOrbit(projection);
      if (system !== null && systemMarkers !== null && phaseAtlas !== null) {
        publishSystem(projection);
        publishSunMarker(projection);
      }
      captions?.publish(projection, visibleRect);
      return projection;
    },
    setOrbitOpacity(opacity:number) {
      const value = String(clamp(opacity, 0, 1));
      if (value === publishedOrbitOpacity) return;
      overlay.style.opacity = value;
      publishedOrbitOpacity = value;
    },
    setMarkerOpacity(opacity:number) {
      const value = String(clamp(opacity, 0, 1));
      if (value === publishedMarkerOpacity) return;
      marker.style.opacity = value;
      publishedMarkerOpacity = value;
    },
    // The system orbit visibility, set before publication to skip hidden
    // ring work while retaining visible planetary points.
    setSystemOpacity(opacity:number) {
      if (system === null) throw new Error("The plan carries no planetary system.");
      systemOpacity = clamp(opacity, 0, 1);
      const value = String(systemOpacity);
      if (value === publishedSystemOpacity) return;
      systemGroup.style.opacity = value;
      publishedSystemOpacity = value;
    },
    // Re-weights every prepared ring for a session's spans (null restores
    // the prepared trails); the next publication draws them.
    setTrailSpans(spans:TrailSpans|null|undefined) {
      if (spans === null || spans === undefined) {
        trailSpans = null;
        trailWeights = null;
        return null;
      }
      if (!validTrailSpans(spans)) {
        throw new TypeError("Orbit trail spans must be finite turns leaving part of the orbit undrawn.");
      }
      trailSpans = Object.freeze({ solidTurns: spans.solidTurns, fadeTurns: spans.fadeTurns });
      const weights:Record<string,readonly number[]> = { own: trailWeightsForSpans(plan.orbit.chordBehindTurns, trailSpans) };
      for (const body of system?.bodies ?? []) {
        weights[body.id] = trailWeightsForSpans(body.orbit.chordBehindTurns, trailSpans);
      }
      trailWeights = Object.freeze(weights);
      return trailSpans;
    },
    // Session knob for the caption policy (see label-field.mjs): the cap
    // height, gap, spacing and alpha ceiling may be retuned by eye; null
    // restores the prepared policy. Widths are re-measured on the next
    // publication at the new cap height; the retained pool is unchanged.
    setLabelPolicy(options:LabelPolicyOptions|null = null) {return captions?.setLabelPolicy(options) ?? null;},
    setSunMarkerOpacity(opacity:number) {
      if (sunMarker === null) throw new Error("The plan carries no Sun marker.");
      sunMarkerOpacity = clamp(opacity, 0, 1);
      const value = String(sunMarkerOpacity);
      if (value === publishedSunMarkerOpacity) return;
      sunMarker.style.opacity = value;
      publishedSunMarkerOpacity = value;
    },
    state() {
      return Object.freeze({
        sun: lastProjection?.sun ?? null,
        bodySilhouetteRadius: lastProjection?.body.silhouetteRadius ?? null,
        orbitPieceCount: activePieceCount,
        retainedOrbitPieceCount: poolSize,
        orbitPoolOverflows: overflowCount,
        orbitOpacity: publishedOrbitOpacity === null
          ? 1
          : Number(publishedOrbitOpacity),
        markerOpacity: publishedMarkerOpacity === null
          ? 0
          : Number(publishedMarkerOpacity),
        trailSpans: trailSpans ?? plan.orbit.trailSpans,
        trailSpansSource: trailSpans === null ? "prepared" : "session",
        ...(captions === null ? {} : { captions: captions.state() }),
        ...(system === null ? {} : {
          systemOpacity,
          systemPieceCount: activeSystemPieceCount,
          retainedSystemOrbitPieceCount: systemPoolSize,
          systemPoolOverflows: systemOverflowCount,
          systemMarkerVisibleCount: visibleSystemMarkerCount,
          systemBodies: lastProjection?.system === null || lastProjection?.system === undefined
            ? null
            : Object.freeze(lastProjection.system.bodies.map((body) => Object.freeze({
              id: body.id,
              visible: body.marker.visible,
              classification: body.marker.classification,
              screen: body.marker.screen,
              diameterPx: body.marker.diameterPx,
              alpha: body.marker.alpha,
              physicalDiameterPx: body.marker.physicalDiameterPx,
              orbitPieceCount: body.orbitSegments.length,
              illumination: Object.freeze({
                ...system.bodies.find(({ id }) => id === body.id)!.illumination,
                phaseFrame: systemPhaseElements.get(body.id)!.frame,
                phaseRollDegrees: publishedPhaseRolls.get(body.id) ?? null,
              }),
            }))),
          sunMarkerOpacity,
          sunMarkerVisible: !publishedSunMarkerHidden,
        }),
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      captions?.destroy();
      sunRoot.remove();
      overlay.remove();
      celestialRoot.remove();
    },
  });

  function publishSun(projection:HeliocentricProjection) {
    const state = projection.sun;
    const hidden = !state.visible && state.classification !== "partially-visible";
    if (!hidden && state.eye !== undefined && state.spriteScale !== undefined) {
      // Face the eye: the billboard's +z is the direction from the Sun to
      // the eye; any roll about it is fine for a radially symmetric sprite.
      const eye = state.eye;
      const length = Math.hypot(eye[0], eye[1], eye[2]);
      const normal = [-eye[0] / length, -eye[1] / length, -eye[2] / length];
      const rightLength = Math.hypot(normal[2], normal[0]);
      const right = rightLength > 1e-9
        ? [normal[2] / rightLength, 0, -normal[0] / rightLength]
        : [1, 0, 0];
      const up = [
        normal[1] * right[2] - normal[2] * right[1],
        normal[2] * right[0] - normal[0] * right[2],
        normal[0] * right[1] - normal[1] * right[0],
      ];
      const scale = state.spriteScale;
      // Root coordinates: the eye sits at the principal point, `focal` in
      // front of the root.
      const [ox, oy] = projection.principalOffset;
      const transform = `matrix3d(${[
        right[0] * scale, right[1] * scale, right[2] * scale, 0,
        up[0] * scale, up[1] * scale, up[2] * scale, 0,
        normal[0], normal[1], normal[2], 0,
        ox + eye[0], oy + eye[1], eye[2] + projection.focal, 1,
      ].map(formatNumber).join(",")})`;
      if (transform !== publishedSunTransform) {
        sun.style.transform = transform;
        publishedSunTransform = transform;
      }
    }
    if (hidden !== publishedSunHidden) {
      sun.hidden = hidden;
      publishedSunHidden = hidden;
    }
  }

  function publishOrbit(projection:HeliocentricProjection) {
    const result = writePieces(pieces, projection.orbitSegments, activePieceCount);
    activePieceCount = result.count;
    if (result.overflowed) overflowCount += 1;
    marker.style.transform = `scale(${formatNumber(Math.max(markerSprite.size,
      2 * projection.body.silhouetteRadius) / markerSprite.size)})`;
  }

  function publishSystem(projection:HeliocentricProjection) {
    if (systemMarkers === null || phaseAtlas === null) return;
    const projected = projection.system;
    if (projected === null) {
      // Invisible: hide whatever was active and write nothing else.
      activeSystemPieceCount = writePieces(systemPieces, [], activeSystemPieceCount).count;
      for (const [id, element] of systemMarkerElements) setMarkerHidden(id, element, true);
      visibleSystemMarkerCount = 0;
      return;
    }
    const segments:OrbitSegment[] = [];
    for (const body of projected.bodies) {
      for (const segment of body.orbitSegments) segments.push(segment);
      const element = systemMarkerElements.get(body.id)!;
      const state = body.marker;
      if (state.visible && state.screen !== null) {
        const scale = state.diameterPx / systemMarkers.bodies[body.id].size;
        const transform = `translate(${formatNumber(state.screen[0])}px, ` +
          `${formatNumber(state.screen[1])}px) scale(${formatNumber(scale)})`;
        if (publishedSystemMarkerTransforms.get(body.id) !== transform) {
          element.style.transform = transform;
          publishedSystemMarkerTransforms.set(body.id, transform);
        }
        element.style.opacity = formatNumber(state.alpha);
        // The lit side faces the Sun: the atlas lights from screen right
        // at zero roll, so the roll is the Sun's on-screen direction from
        // the marker (y up, as the object's own overlay measures it).
        const sunScreen = projection.sun.screen ?? null;
        if (sunScreen !== null) {
          const roll = Math.round((Math.atan2(-(sunScreen[1] - state.screen[1]), sunScreen[0] - state.screen[0]) *
            180 / Math.PI - phaseAtlas.baseLightAzimuthDegrees) * 4) / 4;
          if (publishedPhaseRolls.get(body.id) !== roll) {
            systemPhaseElements.get(body.id)!.element.style.transform = `rotate(${roll}deg)`;
            publishedPhaseRolls.set(body.id, roll);
          }
        }
      }
      setMarkerHidden(body.id, element, !state.visible);
    }
    visibleSystemMarkerCount = projected.bodies.filter((body) => body.marker.visible).length;
    const result = writePieces(systemPieces, segments, activeSystemPieceCount);
    activeSystemPieceCount = result.count;
    if (result.overflowed) systemOverflowCount += 1;
  }

  // Visibility follows the projection alone; the dolly's opacity, written
  // after the publication, fades the marker without a second projection.
  function publishSunMarker(projection:HeliocentricProjection) {
    if (sunMarker === null) return;
    const state = projection.sun;
    const hidden = state.screen === undefined ||
      state.classification === "behind-camera" || state.classification === "behind-body" ||
      state.classification === "outside-viewport";
    if (!hidden && state.screen !== undefined) {
      const transform = `translate(${formatNumber(state.screen[0])}px, ` +
        `${formatNumber(state.screen[1])}px)`;
      if (transform !== publishedSunMarkerTransform) {
        sunMarker.style.transform = transform;
        publishedSunMarkerTransform = transform;
      }
    }
    if (hidden !== publishedSunMarkerHidden) {
      sunMarker.style.visibility = hidden ? "hidden" : "";
      publishedSunMarkerHidden = hidden;
    }
  }

  // Captions for every marker on screen: the observer (always admitted, at
  // its marker's opacity), the Sun (by its marker), and each system body
  // (by brightness, once the system is visible). The pass, the slots and
  // the writes are all bounded by the policy's pool.
  function setMarkerHidden(id:string, element:HTMLElement, hidden:boolean) {
    if (systemMarkerHidden.get(id) === hidden) return;
    element.style.visibility = hidden ? "hidden" : "";
    systemMarkerHidden.set(id, hidden);
  }
}
