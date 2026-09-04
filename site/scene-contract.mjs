import {
  DESKTOP_VIEWPORT_MIN,
  MOBILE_TOUCH_ACTION,
  MOBILE_VIEWPORT_MAX,
  MOBILE_VIEWPORT_QUERY,
} from "./runtime-policy.mjs";

export const OBJECT_BEHAVIOR = Object.freeze({
  camera: Object.freeze({
    draggingDown: "toward-top-down",
    draggingUp: "toward-lower-view",
    horizontalOrbit: false,
    wheelTowardPage: "zoom-out",
    wheelTowardUser: "zoom-in",
  }),
  mobile: Object.freeze({
    maximumWidthPixels: MOBILE_VIEWPORT_MAX,
    mediaQuery: MOBILE_VIEWPORT_QUERY,
    touchAction: MOBILE_TOUCH_ACTION,
    wheelZoom: false,
  }),
  desktop: Object.freeze({
    minimumWidthPixels: DESKTOP_VIEWPORT_MIN,
  }),
  rendering: Object.freeze({
    retainedDom: true,
    maximumMountedScenes: 1,
    maximumCamerasPerScene: 1,
    bodyDependentLayerRegistration: "camera-synchronized-retained-presentation",
    retainedLightingOverlay: true,
    canvas: false,
    sceneSvg: false,
    preparedStateTransport: true,
    runtimeSourceDerivation: false,
    sourceAuthorityRequests: false,
    dprSelection: "fixed-per-mount",
  }),
  lighting: Object.freeze({
    control: "shadows",
    states: Object.freeze(["off", "on"]),
    default: "off",
    shadowsOffPresentation: "prepared-shadowless-overlay",
    overlayRetainedAcrossStates: true,
  }),
  lifecycle: Object.freeze({
    pauseBeforeReady: "target-paused",
    resumeBeforeReady: "target-running",
    destroyBeforeReady: "cancel-publication",
    destroyIdempotent: true,
  }),
  shell: Object.freeze({
    required: true,
    optionalCapabilities: Object.freeze([
      "introduction",
      "facts",
      "charts",
      "lenses",
      "settings",
      "credits",
    ]),
  }),
});

export function requireSceneLifecycle(mount, objectId = "unknown") {
  if (!mount ||
      typeof mount.ready?.then !== "function" ||
      typeof mount.pause !== "function" ||
      typeof mount.resume !== "function" ||
      typeof mount.destroy !== "function") {
    throw new TypeError(
      `cssEarth scene ${objectId} must provide ready, pause, resume, and destroy.`,
    );
  }
  return mount;
}
