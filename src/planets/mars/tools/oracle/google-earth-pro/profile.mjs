const DEG_TO_RAD = Math.PI / 180;

export const GOOGLE_EARTH_PRO_MARS_ORACLE = Object.freeze({
  schema: "cssmars-google-earth-pro-oracle-profile@1",
  qualification: "STATIC_SOURCE_INFORMED_BEHAVIORAL_ORACLE",
  pixelParityQualification: "UNPROVEN_UNTIL_MATCHED_NATIVE_CAPTURE",
  application: Object.freeze({
    name: "Google Earth Pro",
    bundleIdentifier: "com.Google.GoogleEarthPro",
    buildVersion: "7.3.7.1327",
    architecture: "x86_64",
    dmgSha256:
      "20df0f4927f312f8d47e60294b9a77fd60e44be61476a581fb9195c029ba0893",
    rendererSha256:
      "11c6efe1ea0a75535485ab3804a09fc6f2ad3dd7c43f8c7d695a48d928890cd0",
  }),
  mode: Object.freeze({
    databasePrefix: "mars",
    acceptedDatabaseNames: Object.freeze(["earth", "moon", "mars", "sky"]),
    customAtmosphereState: true,
    customAtmosphereColor: true,
  }),
  renderer: Object.freeze({
    camera: Object.freeze({
      stateTuple: Object.freeze([
        "latitude",
        "longitude",
        "altitude",
        "distance",
        "verticalFov",
        "heading",
        "tilt",
        "roll",
      ]),
      groundHorizontalFovDegrees: Object.freeze({
        minimum: 30,
        default: 85,
        maximum: 90,
        transitionSeconds: 0.7,
      }),
      trackballDrag: 1.2,
      viewpointDrag: 0.4,
      viewpointRotationMinimum: 0.005,
      viewpointZoomMinimum: 0.00001,
      liveSaveImageProjection: Object.freeze({
        viewport: Object.freeze([0, 0, 2093, 1295]),
        horizontalFovDegrees: 60.00000022609544,
        verticalFovDegrees: 39.31583348061063,
        qualification:
          "LIVE_GL_SKY_RAY_BASIS_CONFIRMED_ACROSS_201_NATIVE_HEADLESS_SAMPLES",
      }),
      granularBodyFrameContract: Object.freeze({
        sampleCount: 201,
        viewDirection:
          "radial*cos(tilt) + (right0*sin(heading) + up0*cos(heading))*sin(tilt)",
        viewRight: "right0*cos(heading) - up0*sin(heading)",
        viewUp:
          "(right0*sin(heading) + up0*cos(heading))*cos(tilt) - radial*sin(tilt)",
        maximumAngularResidualDegrees: 0.0000027,
        qualification:
          "LIVE_GL_EQUATION_FIT_ACROSS_SIX_NATIVE_HEADLESS_TRAJECTORIES",
      }),
    }),
    stars: Object.freeze({
      catalogRoute: "/stars.pb",
      drawCount: 5_000,
      spriteSizeInches: 0.0625,
      cameraTransform: "starsToCameraMatrix",
      fragmentExposure: 40,
      model:
        "catalogue-points-with-radial-sprite-lookup-and-exponential-tone-map",
      liveResources: Object.freeze({
        skyMap: Object.freeze({
          dimensions: Object.freeze([2048, 1024]),
          rgbaSha256:
            "9dc7b1e30130e7381c0c2ed96cd683503e6a562a1e06aa0cfe71efb5d2bd0b64",
        }),
        radialResponse: Object.freeze({
          dimensions: Object.freeze([32, 1]),
          rgbaSha256:
            "0ecff9d2783cbc0ed1cf8143b64d8490d3bc846202229367c667c5f1686085f1",
        }),
        catalogueBuffer: Object.freeze({
          bytes: 160_000,
          recordStrideBytes: 32,
          sha256:
            "4c4844106795fad461f1925f926b16633abba709b67caca4d53dc86cb6d2214a",
        }),
        qualification: "EXACT_LIVE_BOUND_GL_BYTES",
      }),
      granularProjection: Object.freeze({
        catalogueSphereDistance: "(near + far) / 2",
        equatorialToSkyMap: Object.freeze([
          Object.freeze([0.021264964991874913, 0.9258241815260848,
            -0.3773557816085095]),
          Object.freeze([-0.4695467737088542, 0.34247276962487033,
            0.8137802101822247]),
          Object.freeze([0.8826514635216324, 0.15988119303393328,
            0.44200042583243565]),
        ]),
        maximumReconstructedMvpElementResidual: 0.00015650436121683597,
        qualification:
          "LIVE_GL_COUPLED_SKYMAP_AND_CATALOGUE_CONTRACT_ACROSS_201_SAMPLES",
      }),
    }),
    sun: Object.freeze({
      visibleModel: "earth::evll::SunModel",
      lightModel: "earth::evll::SunLight",
      billboardResources: Object.freeze(["sun", "sun3"]),
      billboardScale: 13,
      highTransition: 0.5,
      lowTransition: 0,
      improvedSunEnabledByDefault: false,
      independentFromStarfieldPlane: true,
      liveDefaultBillboard: Object.freeze({
        resource: "sun",
        dimensions: Object.freeze([128, 128]),
        rgbaSha256:
          "c1dee9ba5e25abf4bdbb8e00b3b9fa78441f5e71b72c058485415886d4f4a30b",
        blend: Object.freeze(["SRC_ALPHA", "ONE"]),
        depthTest: true,
        depthWrite: false,
        poseCount: 56,
        qualification:
          "EXACT_LIVE_BOUND_GL_BYTES_AND_CLIENT_QUAD_MATRICES",
      }),
      granularPlacement: Object.freeze({
        centerDistanceOverFar: 0.9395660778622476,
        halfExtentOverFar: 0.056785294765488575,
        halfExtentOverCenter: 0.06043778729728664,
        maximumVisibleCenterReplayResidualPixels: 0.23802346625592666,
        empiricalBodyFrameAngularRateDegreesPerHour: -15.007944027108215,
        qualification:
          "LIVE_GL_201_SAMPLE_SCALE_AND_TIME_FIT; EPOCH_CONTROL_UNRESOLVED",
      }),
    }),
    atmosphere: Object.freeze({
      improvedAtmosphereEnabledByDefault: false,
      earthAltitudeKm: 170,
      marsAltitudeKm: 50,
      earthCoefficientPair: Object.freeze([0.0025, 0.001]),
      marsCoefficientPair: Object.freeze([0.001, 0.002]),
      marsModeScale: 1.6129032258064517,
      evidenceQualification:
        "STATIC_GHIDRA_CONSTANT_BINDING; final colour and blend output require native capture",
    }),
  }),
  marsBodyRecord: Object.freeze({
    parent: "sun",
    radiusEarthUnits: 0.53261210410787,
    siderealRotationDays: 1.02595675,
    orbitalPeriodDays: 686.98,
    orbitalElements: Object.freeze({
      ascendingNodeRadians: 0.8649397987278379,
      ascendingNodeRadiansPerDay: 3.6840584384021503e-7,
      inclinationRadians: 0.03228335517413911,
      inclinationRadiansPerDay: -3.1066860685499064e-10,
      argumentOfPerihelionRadians: 5.000396232231785,
      argumentOfPerihelionRadiansPerDay: 5.113134029935108e-7,
      semiMajorAxisAu: 1.523688,
      semiMajorAxisAuPerDay: 0,
      eccentricity: 0.093405,
      eccentricityPerDay: 2.516e-9,
      meanAnomalyRadians: 0.32466789278523717,
      meanAnomalyRadiansPerDay: 0.009145887900527656,
    }),
    evidenceQualification:
      "STATIC_GHIDRA_BODY_TABLE; field semantics corroborated by the recovered Mars orbital coefficient series",
  }),
  capture: Object.freeze({
    nativeContentSize: Object.freeze({ width: 2092, height: 1295 }),
    browserViewport: Object.freeze({
      width: 2092,
      height: 1295,
      deviceScaleFactor: 1,
    }),
    nativePath:
      "patched Apple-event SaveScreenShot TEXT path; Google high-resolution save-image renderer; JPEG quality fixed at 100",
    headlessExecution: Object.freeze({
      interactiveAquaSessionAllowed: false,
      currentSessionBackgroundProcessAllowed: true,
      isolatedMacOsSessionRequired: false,
      visibleWindowCountRequired: 0,
      foregroundOwnershipAllowed: false,
    }),
    animation: "disabled-or-settled-before-every-capture",
    chrome: "hidden-in-both-renderers",
    colorScheme: "dark",
    fixedTimeUtc: "2026-09-02T12:00:00Z",
    stableComparisonsRequired: 2,
    stabilityIntervalMilliseconds: 500,
    stabilityChannelTolerance: 3,
    maximumChangedPixelRatio: 0.0005,
  }),
  componentWeights: Object.freeze({
    cameraAndSilhouette: 0.2,
    surfaceRegistration: 0.25,
    terminatorAndShadow: 0.2,
    atmosphereAndLimb: 0.15,
    starfield: 0.1,
    sun: 0.1,
  }),
  unresolvedRuntimeInputs: Object.freeze([
    "exact Mars database response bytes",
    "exact /stars.pb response bytes before Google converts it to the captured 160000-byte GPU catalogue buffer",
    "exact sun3 improved-path billboard bytes; the default live path binds the captured sun resource instead",
    "final OpenGL colour management outside the confirmed 2164x1295 save-image path",
    "repeatable renderer epoch binding; the live sweep records native timeline state and per-pose Sun vectors",
    "Mars-to-cssEarth geographic and camera registration",
  ]),
});

const MEDIUM_RANGE_METERS = 7_800_000;

export const GOOGLE_EARTH_PRO_MARS_POSES = Object.freeze([
  ...[-60, -30, 0, 30, 60].flatMap((latitude) =>
    Array.from({ length: 8 }, (_, longitudeIndex) => pose({
      latitude,
      longitude: longitudeIndex * 45,
      tilt: 0,
      rangeMeters: MEDIUM_RANGE_METERS,
      family: "global-latitude-longitude",
    }))),
  ...[-35, 35].flatMap((latitude) =>
    Array.from({ length: 4 }, (_, longitudeIndex) => pose({
      latitude,
      longitude: longitudeIndex * 90 + 22.5,
      heading: longitudeIndex % 2 === 0 ? 30 : 330,
      tilt: 35,
      rangeMeters: MEDIUM_RANGE_METERS,
      family: "oblique-heading-tilt",
    }))),
  ...[4_200_000, 13_500_000].flatMap((rangeMeters) =>
    Array.from({ length: 4 }, (_, longitudeIndex) => pose({
      latitude: 0,
      longitude: longitudeIndex * 90,
      tilt: 0,
      rangeMeters,
      family: rangeMeters < MEDIUM_RANGE_METERS ? "near-zoom" : "far-zoom",
    }))),
]);

export function createMarsNativeCaptureKml(
  poses = GOOGLE_EARTH_PRO_MARS_POSES,
) {
  const placemarks = poses.map((entry) => `
    <Placemark>
      <name>${escapeXml(entry.id)}</name>
      <ExtendedData>
        <Data name="oracle-family"><value>${escapeXml(entry.family)}</value></Data>
      </ExtendedData>
      <LookAt>
        <longitude>${entry.nativeCamera.longitude}</longitude>
        <latitude>${entry.nativeCamera.latitude}</latitude>
        <altitude>0</altitude>
        <heading>${entry.nativeCamera.heading}</heading>
        <tilt>${entry.nativeCamera.tilt}</tilt>
        <range>${entry.nativeCamera.rangeMeters}</range>
        <altitudeMode>absolute</altitudeMode>
      </LookAt>
      <Point>
        <coordinates>${entry.nativeCamera.longitude},${entry.nativeCamera.latitude},0</coordinates>
      </Point>
    </Placemark>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>cssEarth Mars Google Earth Pro oracle sweep</name>${placemarks}
  </Document>
</kml>
`;
}

function pose({
  latitude,
  longitude,
  heading = 0,
  tilt,
  rangeMeters,
  family,
}) {
  const normalizedLongitude = normalizeLongitude(longitude);
  const rangeKilometers = Math.round(rangeMeters / 1_000);
  const id = [
    `lat-${signedSlug(latitude)}`,
    `lon-${signedSlug(normalizedLongitude)}`,
    `head-${String(heading).padStart(3, "0")}`,
    `tilt-${String(tilt).padStart(2, "0")}`,
    `range-${rangeKilometers}km`,
  ].join("__");
  return Object.freeze({
    id,
    family,
    nativeCamera: Object.freeze({
      latitude,
      longitude: normalizedLongitude,
      heading,
      tilt,
      roll: 0,
      rangeMeters,
    }),
    registrationHint: Object.freeze({
      unitDirection: Object.freeze(sphericalDirection(
        normalizedLongitude,
        latitude,
      )),
      browserCamera: null,
      qualification: "UNCALIBRATED_UNTIL_MATCHED_NATIVE_CAPTURE",
    }),
  });
}

function sphericalDirection(longitudeDegrees, latitudeDegrees) {
  const longitude = longitudeDegrees * DEG_TO_RAD;
  const latitude = latitudeDegrees * DEG_TO_RAD;
  const latitudeRadius = Math.cos(latitude);
  return [
    latitudeRadius * Math.sin(longitude),
    -Math.sin(latitude),
    latitudeRadius * Math.cos(longitude),
  ];
}

function normalizeLongitude(value) {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function signedSlug(value) {
  const prefix = value < 0 ? "m" : "p";
  return `${prefix}${String(Math.abs(value)).replaceAll(".", "p")}`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
