export const GOOGLE_EARTH_PRO_APPLE_EVENT_API = Object.freeze({
  schema: "cssmars-google-earth-pro-apple-event-api@1",
  suite: "Erth",
  source:
    "Google Earth Pro 7.3.7.1327 googleearth.sdef plus local x86_64 decompilation",
  commands: Object.freeze({
    getViewInfo: Object.freeze({
      event: "GCVW",
      result: Object.freeze([
        "latitude",
        "longitude",
        "distance",
        "tilt",
        "azimuth",
      ]),
    }),
    setViewInfo: Object.freeze({
      event: "SCVW",
      directParameter: "View Info record",
      optionalParameter: "speed",
      observedLimits: Object.freeze({
        latitudeDegrees: Object.freeze([-90, 90]),
        longitudeDegrees: Object.freeze([-180, 180]),
        distanceMeters: Object.freeze([0, null]),
        tiltDegrees: Object.freeze([0, 90]),
        azimuthDegrees: Object.freeze([-360, 360]),
        speed: Object.freeze([0, 10]),
        instantaneousSpeedMinimum: 5,
      }),
      caveat:
        "The terrain-aware renderer may normalize the requested distance and azimuth after the Apple-event handler clamps them.",
    }),
    saveScreenShot: Object.freeze({
      event: "SVSC",
      actualDirectParameterType: "TEXT path",
      documentedDirectParameterType: "file",
      actualExtensionBehavior: "appends .jpg unless the TEXT path ends in .jpg",
      actualResultSemantics:
        "The boolean reports parameter parsing, not confirmed file creation.",
      renderer: "high-resolution save-image renderer",
      originalRateLimiter: Object.freeze({
        intervalSeconds: 600,
        fullQualityCaptures: 10,
        fullQuality: 100,
        throttledQuality: 1,
      }),
    }),
    getPointOnTerrain: Object.freeze({
      event: "GPOT",
      input: "normalized screen coordinates in [-1, 1]",
      actualResult: "latitude, longitude, ground altitude",
      documentedResult: "X, Y, Z coordinates",
    }),
    getStreamingProgress: Object.freeze({
      event: "GSPR",
      result: "integer percentage",
    }),
    getCurrentVersion: Object.freeze({
      event: "GCVN",
      result: "major, minor, patch, build integer list",
    }),
    moveCamera: Object.freeze({
      event: "Move",
      input: "normalized X and Y velocity in [-1, 1]",
    }),
  }),
  installedHandlerCount: 7,
  hiddenAppleEventHandlersFound: 0,
  qualification:
    "BOUND_BINARY_AND_LIVE_CALLS; undocumented behaviors are specific to renderer SHA-256 11c6efe1ea0a75535485ab3804a09fc6f2ad3dd7c43f8c7d695a48d928890cd0",
});

export const GOOGLE_EARTH_PRO_MARS_ORACLE_PATCH = Object.freeze({
  schema: "cssmars-google-earth-pro-local-patch@1",
  sourceRendererSha256:
    "11c6efe1ea0a75535485ab3804a09fc6f2ad3dd7c43f8c7d695a48d928890cd0",
  target: "Contents/Frameworks/libgoogleearth_pro.dylib",
  patches: Object.freeze([
    Object.freeze({
      id: "unthrottled-save-screenshot-quality",
      virtualAddress: 0x3a8c3,
      fileOffset: 0x3a8c3,
      expectedHex: "0f4fd8",
      replacementHex: "909090",
      instructionBefore: "cmovg %eax, %ebx",
      effect:
        "Preserve Google renderer JPEG quality 100 after capture ten; counter and renderer path remain intact.",
    }),
  ]),
  distribution: "LOCAL_ANALYSIS_ONLY_DO_NOT_REDISTRIBUTE",
});
