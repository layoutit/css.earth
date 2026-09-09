import type { Exposure, ExposureOptions, ExposureKnobs, StarPresentation } from "@cssearth/engine";
import type { Vector3 } from './types.js';
export interface CubicSkyFace {id:string;url:string;url2x:string;highContrastUrl:string;highContrastUrl2x:string;}
export interface PreparedRetainedStar extends StarPresentation {color:Vector3;direction:Vector3;magnitude:number;name?:string|null;band:string;transform:string;}
export interface PreparedCatalogueStars {exposure:ExposureOptions & {maxRadiusPx:number};retained:readonly PreparedRetainedStar[];retainedRadiusShareOfHalfSide:number;limitingMagnitude:number;count:number;photographicCount:number;retainedCount:number;bands:readonly unknown[];coexistence:string;}
export interface CubicSkyPlan {faces:readonly CubicSkyFace[];cameraPitchResponse:number;cameraZoomResponse:number;presentationPitchOffsetDegrees:number;presentationYawOffsetDegrees:number;sceneRegistration?:string;cameraContract?:string|{source:string;sourcePath:string;rotationResponse:number;zoomResponse:number;horizontalFovDegrees:number;focalLengthOverViewportWidth:number;qualification:string};projection?:{cssPerspective:string;horizontalFovDegrees:number;focalLengthOverViewportWidth?:number};catalogueStars?:PreparedCatalogueStars;sun?:{localDirection:Vector3;initialViewDirection:Vector3};}
export interface CubicSkyMountOptions {host:HTMLElement;plan:CubicSkyPlan;imageDensity:number;objectId:string;requireSun?:boolean;renderContent?:boolean;}
export type RetainedCubicSky = ReturnType<typeof mountRetainedCubicSky>;
const exposureKnob = (key:string): key is keyof ExposureKnobs => key in EXPOSURE_KNOBS;
import { createExposure, exposureLimits, screenFactor, starPresentation, EXPOSURE_KNOBS, POINT_MIN_RADIUS_PX } from "@cssearth/engine";

export function mountRetainedCubicSky({
  host,
  plan,
  imageDensity,
  objectId,
  requireSun = true,
  renderContent = true,
}: CubicSkyMountOptions) {
  if (!(host instanceof HTMLElement) || ![1, 2].includes(imageDensity) ||
      !/^[a-z][a-z0-9-]*$/u.test(objectId)) {
    throw new TypeError("Retained cubic sky mount arguments are invalid.");
  }
  const root = document.createElement("div");
  root.className = `planet-cubic-sky ${objectId}-skybox`;
  root.ariaHidden = "true";
  if (plan.projection?.cssPerspective) {
    root.style.setProperty(
      "--planet-cubic-sky-camera-distance",
      plan.projection.cssPerspective,
    );
  }
  const cube = document.createElement("div");
  cube.className = `planet-cubic-sky-cube ${objectId}-skybox-cube`;
  const orientation = document.createElement("div");
  orientation.className =
    `planet-cubic-sky-orientation ${objectId}-skybox-orientation`;
  // The shared universe supplies the visible sky in the application. Its
  // object camera still needs these orientation handles, but no image leaves.
  for (const face of renderContent ? plan.faces : []) {
    const element = document.createElement("div");
    element.className =
      `planet-cubic-sky-face planet-cubic-sky-${face.id} ` +
      `${objectId}-skybox-face ${objectId}-skybox-${face.id}`;
    const selectedUrl = imageDensity === 2 ? face.url2x : face.url;
    const selectedHighContrastUrl = imageDensity === 2
      ? face.highContrastUrl2x
      : face.highContrastUrl;
    element.style.setProperty(
      "--planet-cubic-sky-standard-image",
      `url("${selectedUrl}")`,
    );
    element.style.setProperty(
      "--planet-cubic-sky-high-contrast-image",
      `url("${selectedHighContrastUrl}")`,
    );
    orientation.appendChild(element);
  }
  // Catalogue stars (opt-in, see prepare-catalogue-stars.mjs): the retained
  // band as points just inside the faces, each placed by its prepared cube
  // transform, sized by a scale the root's size sets (a point at 0.99 of the
  // half side appears at perspective / (0.99 half side) of its CSS size),
  // coloured and dimmed by the chain's luminance. Retained once; the
  // orientation's matrix carries them with the faces.
  let starGroup: HTMLDivElement | null = null;
  let starResizeObserver: ResizeObserver | null = null;
  const stars = renderContent ? plan.catalogueStars ?? null : null;
  const starElements: {element:HTMLElement;star:PreparedRetainedStar;presentation:StarPresentation|null}[] = [];
  let starScreenFactor = 1;
  const writeStarRadius = (element:HTMLElement, presentation:StarPresentation, maxRadiusPx:number) => {
    // The reference applies its pixel floor and ceiling AFTER viewport
    // scaling. Compensate the existing CSS factor so it cannot enlarge the cap.
    const rawRadiusPx = presentation.rawRadiusPx * starScreenFactor;
    const radiusPx = Math.min(maxRadiusPx, Math.max(POINT_MIN_RADIUS_PX, rawRadiusPx));
    element.style.setProperty("--planet-cubic-sky-star-radius", `${Number((radiusPx / starScreenFactor).toFixed(5))}px`);
  };
  const writeStar = (element:HTMLElement, star:PreparedRetainedStar, presentation:StarPresentation, maxRadiusPx = stars!.exposure.maxRadiusPx) => {
    writeStarRadius(element, presentation, maxRadiusPx);
    element.style.setProperty("--planet-cubic-sky-star-halo",
      `rgb(${star.color[0]} ${star.color[1]} ${star.color[2]} / ${Number(presentation.haloAlpha.toFixed(3))})`);
    element.style.setProperty("--planet-cubic-sky-star-luminance", String(Number(presentation.luminance.toFixed(4))));
  };
  if (stars !== null) {
    starGroup = document.createElement("div");
    starGroup.className = `planet-cubic-sky-stars ${objectId}-skybox-stars`;
    for (const star of stars.retained) {
      const element = document.createElement("s");
      element.className = `planet-cubic-sky-star planet-cubic-sky-star-${star.band}`;
      element.style.backgroundColor = `rgb(${star.color[0]}, ${star.color[1]}, ${star.color[2]})`;
      writeStar(element, star, star);
      element.style.transform = star.transform;
      if (star.name) element.dataset.name = star.name;
      element.dataset.magnitude = String(star.magnitude);
      element.dataset.direction = star.direction.join(",");
      starGroup.appendChild(element);
      starElements.push({ element, star, presentation: star });
    }
    orientation.appendChild(starGroup);
  }
  // The session's exposure: null while the prepared chain applies.
  let sessionExposure: Exposure | null = null;
  let starExposureWrites = 0;
  const exposureState = () => {
    const source = sessionExposure === null ? "prepared" : "session";
    const exposure = sessionExposure ?? (stars === null ? null : createExposure(stars.exposure));
    if (exposure === null) return null;
    const limits = exposureLimits(exposure);
    return Object.freeze({
      source,
      fovDegrees: exposure.fovDegrees, screenFactor: screenFactor(root.clientWidth, root.clientHeight),
      adaptationLuminanceCdM2: exposure.adaptationLuminanceCdM2, exposureScale: exposure.exposureScale,
      intensityMax: exposure.intensityMax, maxRadiusPx: exposure.maxRadiusPx, haloPeak: exposure.haloPeak,
      linearScale: exposure.linearScale,
      limitingMagnitude: Number(limits.limitingMagnitude.toFixed(3)),
      hintsLimitMagnitude: Number(limits.hintsLimitMagnitude.toFixed(3)),
      pinMagnitude: Number(limits.pinMagnitude.toFixed(3)),
      retainedCount: starElements.length,
      drawnCount: starElements.filter(({ presentation }) => presentation !== null && presentation.luminance > 0).length,
      writes: starExposureWrites,
    });
  };
  cube.appendChild(orientation);
  root.appendChild(cube);
  host.prepend(root);
  const measureStarScale = () => {
    if (starGroup === null || stars === null) return;
    const view = root.ownerDocument.defaultView!;
    const perspective = parseFloat(view.getComputedStyle(root).perspective);
    const halfSide = Math.max(root.clientWidth, root.clientHeight);
    if (!(perspective > 0) || !(halfSide > 0)) return;
    const scale = perspective / (stars.retainedRadiusShareOfHalfSide * halfSide);
    starGroup.style.setProperty("--planet-cubic-sky-star-scale", scale.toFixed(5));
    const nextScreenFactor = screenFactor(root.clientWidth, root.clientHeight);
    starGroup.style.setProperty("--planet-cubic-sky-star-screen-factor",
      nextScreenFactor.toFixed(4));
    if (nextScreenFactor !== starScreenFactor) {
      starScreenFactor = nextScreenFactor;
      const exposure = sessionExposure ?? stars.exposure;
      for (const { element, presentation } of starElements) {
        if (presentation !== null) writeStarRadius(element, presentation, exposure.maxRadiusPx);
      }
    }
  };
  measureStarScale();
  if (starGroup !== null && typeof ResizeObserver === "function") {
    starResizeObserver = new ResizeObserver(() => measureStarScale());
    starResizeObserver.observe(root);
  }
  let publishedMatrix: string | null = null;
  let publishedZoomScale: number | null = null;
  return Object.freeze({
    root,
    cube,
    orientation,
    starGroup,
    retainedStarCount: starGroup === null ? 0 : starGroup.childElementCount,
    catalogueStars: stars === null ? null : Object.freeze({
      limitingMagnitude: stars.limitingMagnitude, count: stars.count, photographicCount: stars.photographicCount,
      retainedCount: stars.retainedCount, bands: stars.bands, coexistence: stars.coexistence,
    }),
    // Session exposure knob (see star-photometry.mjs): every field optional,
    // omitted ones keep their current value, null restores the prepared
    // chain. Recomputes the retained points only (one style write per star
    // per field); the photograph keeps its prepared exposure. Returns the
    // applied values with the limits they imply.
    setStarExposure(options:ExposureKnobs | null = null) {
      if (stars === null) return null;
      if (options !== null && (typeof options !== "object" || Array.isArray(options))) {
        throw new TypeError("Star exposure options must be a record or null.");
      }
      if (options === null) {
        sessionExposure = null;
      } else {
        const current = sessionExposure ?? createExposure(stars.exposure);
        const next: ExposureOptions = { fovDegrees: stars.exposure.fovDegrees, screenFactor: 1 };
        for (const name of Object.keys(EXPOSURE_KNOBS)) {
          if (!exposureKnob(name)) continue;
          const value = options[name] === undefined ? current[name] : options[name];
          if (!Number.isFinite(value)) throw new TypeError(`Star exposure ${name} must be finite.`);
          next[name] = value;
        }
        for (const name of Object.keys(options)) {
          if (!(name in EXPOSURE_KNOBS)) throw new TypeError(`Unknown star exposure knob: ${name}.`);
        }
        sessionExposure = createExposure(next);
      }
      const exposure = sessionExposure ?? createExposure(stars.exposure);
      for (const entry of starElements) {
        const { element, star } = entry;
        const presentation = sessionExposure === null ? star : starPresentation(exposure, star.magnitude);
        entry.presentation = presentation;
        if (presentation === null) {
          element.style.setProperty("--planet-cubic-sky-star-luminance", "0");
        } else writeStar(element, star, presentation, exposure.maxRadiusPx);
        starExposureWrites += 1;
      }
      return exposureState();
    },
    starExposure: exposureState,
    faceCount: orientation.querySelectorAll(".planet-cubic-sky-face").length,
    setOrientation({ matrix, zoom, defaultZoom }: {matrix:string;zoom:number;defaultZoom:number}) {
      if (typeof matrix !== "string" || !Number.isFinite(zoom) ||
          !Number.isFinite(defaultZoom) || defaultZoom <= 0) {
        throw new TypeError("Retained cubic sky camera publication is invalid.");
      }
      if (matrix !== publishedMatrix) {
        orientation.style.transform = matrix;
        publishedMatrix = matrix;
      }
      const zoomScale = 1 + plan.cameraZoomResponse *
        (zoom / defaultZoom - 1);
      if (zoomScale !== publishedZoomScale) {
        root.style.setProperty("--planet-cubic-sky-zoom", String(zoomScale));
        publishedZoomScale = zoomScale;
      }
    },
    destroy() {
      starResizeObserver?.disconnect();
      root.remove();
    },
  });
}
