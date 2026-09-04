import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import sharp from "sharp";

import { renderMarker } from "../../../navigation/marker-recipe.mjs";
import { PREPARED_VENUS_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_VENUS_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_VENUS_SKY_SUN } from "../runtime/preparedSkySun.mjs";
import { PREPARED_VENUS_PANEL } from "../site/preparedPanel.mjs";
import { PREPARED_VENUS_SURFACE_GALLERY } from "../site/preparedSurfaceGallery.mjs";
import { PREPARED_VENUS_TITLE } from "../site/preparedTitle.mjs";
import {
  deriveVenusPreparedMaterial,
  readVenusAtmosphereSource,
} from "../tools/atmosphere-source.mjs";
import { verifyVenusSourceManifest } from "../tools/source-manifest.mjs";
import venusMarker from "../tools/navigation-marker.mjs";
import {
  ESO_CUBEMAP_REGISTRATION_ROTATION_DEGREES,
  equatorialDirectionToGalactic,
  galacticToEsoPanoramaSample,
  rotateDirectionForEsoRegistration,
} from "../tools/starfield-projection.mjs";

const publicRoot = resolve("public/scenes/venus");
const sourceRoot = resolve("src/planets/venus/source");

test("prepares Venus from the complete checked source closure", async () => {
  assert.deepEqual(await verifyVenusSourceManifest(), {
    inputCount: 21,
    generatedIntermediateCount: 0,
    documentCount: 3,
  });
});

test("preserves accepted Venus navigation marker pixels at both densities", async () => {
  for (const [tileSize, hash] of [[16, "d83eafd35fb15756f5c97811ad3e927eed674907b39d2c523d827da8524cea26"], [32, "00901a9310bee86579bcf86eb590c7f713cef14254d4eab2c239b8985c9017d0"]]) {
    const bytes = await renderMarker(venusMarker, { sourcePath: resolve("src/planets/venus/source/navigation/venus.webp"), tileSize });
    assert.equal(createHash("sha256").update(bytes).digest("hex"), hash);
  }
});

test("publishes the prepared Venus scene and shell content", () => {
  assert.equal(PREPARED_VENUS_TITLE.label, "Venus");
  assert.equal(PREPARED_VENUS_PANEL.planetId, "venus");
  assert.match(PREPARED_VENUS_PANEL.introduction, /second planet from the Sun/u);
  assert.deepEqual(PREPARED_VENUS_PANEL.facts, [
    { label: "Distance", value: "108 million km" },
    { label: "Diameter", value: "12,104 km" },
    { label: "Year", value: "225 Earth days" },
    { label: "Day", value: "243 Earth days" },
  ]);
  assert.equal(PREPARED_VENUS_SCENE.schema,
    "cssvenus-prepared-runtime-scene@1");
  assert.equal(PREPARED_VENUS_SCENE.runtimeGeometry, false);
  assert.equal(PREPARED_VENUS_SCENE.runtimeRasterization, false);
  assert.equal(
    PREPARED_VENUS_SCENE.counts.textureLeafCount,
    PREPARED_VENUS_SCENE.body.longitudeSegments *
      (PREPARED_VENUS_SCENE.body.latitudeSegments - 2) + 2,
  );
  assert.equal(PREPARED_VENUS_SCENE.counts.polarLeafCount, 2);
  assert.equal(PREPARED_VENUS_SCENE.body.axialTiltDegrees, 3);
  assert.equal(PREPARED_VENUS_SCENE.body.rotationDirection, "retrograde");
  assert.equal(PREPARED_VENUS_SCENE.body.latitudeSegments, 16);
  assert.equal(PREPARED_VENUS_SCENE.body.longitudeSegments, 32);
  assert.deepEqual(PREPARED_VENUS_SCENE.body.sourceMapSize, [1024, 768]);
  assert.equal(PREPARED_VENUS_SCENE.body.polarRadius,
    PREPARED_VENUS_SCENE.body.equatorialRadius);
  assert.equal(PREPARED_VENUS_SCENE.camera.state.rotX, 40);
  assert.equal(PREPARED_VENUS_SCENE.camera.state.rotY, -105);
  assert.equal(PREPARED_VENUS_SCENE.camera.state.zoom, 1.9);
  assert.equal(PREPARED_VENUS_SCENE.camera.initialScenePitchDegrees, 40);
  assert.equal(PREPARED_VENUS_SCENE.camera.maximumScenePitchDegrees, 65);
  assert.equal(PREPARED_VENUS_SCENE.camera.defaultControlPitchDegrees,
    34.230769230769226);
  assert.equal(PREPARED_VENUS_SCENE.camera.defaultControlYawDegrees, -105);
  assert.equal(PREPARED_VENUS_SCENE.camera.logicalBodyDiameter, 496);
  assert.deepEqual(PREPARED_VENUS_SCENE.camera.responsiveFit, {
    model: "continuous-aspect-smoothstep",
    portraitBaseWidthShare: 0.34,
    narrowPortraitWidthShareGain: 0.08,
    landscapeWidthShareGain: 0.02,
    narrowPortraitAspectRatio: 0.46,
    portraitAspectRatio: 0.75,
    squareAspectRatio: 1,
    maximumHeightShare: 0.61,
    maximumMobilePreviewShare: 0.925,
    minimumZoom: 0.42,
    maximumZoom: 2,
  });
  assert.equal(PREPARED_VENUS_SCENE.camera.pitchBounded, false);
  assert.equal(PREPARED_VENUS_SCENE.camera.yawBounded, false);
  assert.equal(PREPARED_VENUS_SCENE.camera.cameraModel,
    "accumulated-matrix3d");
  assert.match(PREPARED_VENUS_SCENE.camera.sceneStyle, /rotateX\(40deg\)/u);
  assert.match(PREPARED_VENUS_SCENE.camera.sceneStyle, /rotate\(-105deg\)/u);
  assert.ok(Math.abs(Math.hypot(
    ...PREPARED_VENUS_SKY_SUN.referenceViewDirection,
  ) - 1) < 1e-12);
  assert.equal(PREPARED_VENUS_SCENE.material.defaultFrame, 31);
  assert.equal(PREPARED_VENUS_SCENE.starfield.schema,
    "cssearth-prepared-cubic-sky@2");
  assert.equal(PREPARED_VENUS_SCENE.starfield.runtimeRasterization, false);
  assert.equal(PREPARED_VENUS_SCENE.starfield.faces.length, 6);
  assert.equal(PREPARED_VENUS_SCENE.starfield.source,
    "ESO eso0932a all-sky panorama");
  assert.equal(PREPARED_VENUS_SCENE.starfield.sourceCredit, "ESO/S. Brunier");
  assert.equal(PREPARED_VENUS_SCENE.starfield.sourceLicense, "CC-BY-4.0");
  assert.deepEqual(PREPARED_VENUS_SCENE.starfield.sourceMapSize, [6000, 3000]);
  assert.equal(PREPARED_VENUS_SCENE.starfield.faceSize, 1024);
  assert.equal(PREPARED_VENUS_SCENE.starfield.faceSize2x, 2048);
  assert.deepEqual(PREPARED_VENUS_SCENE.starfield.photographicLevels, {
    blackPoint: 8,
    gamma: 1.2,
    gain: 0.6,
  });
  assert.deepEqual(PREPARED_VENUS_SCENE.starfield.photographicSeparation, {
    model: "wrapped-gaussian-diffuse-plus-photographic-detail",
    sourceSigmaPixels: 9,
    diffuseGain: 0.85,
    detailGain: 0.65,
    evidence: "accepted Venus planet-first visual hierarchy",
    standardDiffuseGain: 0.68,
    standardDetailGain: 0.4,
  });
  assert.deepEqual(
    PREPARED_VENUS_SCENE.starfield.photographicRegistration.rotationDegrees,
    ESO_CUBEMAP_REGISTRATION_ROTATION_DEGREES,
  );
  assert.equal(PREPARED_VENUS_SCENE.starfield.pointSourcePresentation.selectedCount,
    5000);
  assert.equal(
    PREPARED_VENUS_SCENE.starfield.pointSourcePresentation
      .logicalPointFootprintPixels,
    1,
  );
  assert.equal(PREPARED_VENUS_SCENE.starfield.cameraPitchResponse, -1);
  assert.equal(PREPARED_VENUS_SCENE.starfield.cameraZoomResponse, 0);
  assert.equal(PREPARED_VENUS_SCENE.counts.starfieldFaceCount, 6);
  assert.equal("sun" in PREPARED_VENUS_SCENE.starfield, false);
  assert.equal(PREPARED_VENUS_SKY_SUN.schema,
    "cssearth-prepared-directional-sun@3");
  assert.equal(PREPARED_VENUS_SKY_SUN.billboard, true);
  assert.equal(PREPARED_VENUS_SKY_SUN.bakedIntoStarfield, false);
  assert.equal(PREPARED_VENUS_SKY_SUN.runtimeRasterization, false);
  assert.equal(PREPARED_VENUS_SKY_SUN.asset.googlePixelsRedistributed, false);
  assert.equal(PREPARED_VENUS_SCENE.counts.sunBillboardCount, 1);
  assert.equal(PREPARED_VENUS_SCENE.counts.sunCubemapBakeCount, 0);
});

test("publishes the checked ESO full sky as six prepared DPR cube faces",
  async () => {
  const source = JSON.parse(await readFile(
    resolve(sourceRoot, "stars/hyg-v41-field.json"),
    "utf8",
  ));
  assert.equal(source.schema, "cssvenus-prepared-star-cubemap-source@1");
  assert.equal(source.source.sha256,
    "d9f69fd86bbf90a4e4d52b4c5c53eacfa6dfc0bfdef85bfd94f095e0bebe4ebd");
  assert.equal(source.source.catalogRows, 119626);
  assert.equal(source.presentation.selectedStars, 60000);
  assert.equal(source.presentation.pointOpacity, 0.78);
  assert.equal(source.stars.length, 60000);
  assert.deepEqual(PREPARED_VENUS_SCENE.starfield.faces.map(({ id }) => id),
    ["front", "right", "back", "left", "top", "bottom"]);
  let exactBlackPixels = 0;
  let darkPixels = 0;
  let brightDetailPixels = 0;
  let highFrequencyPixels = 0;
  let pixelCount = 0;
  for (const face of PREPARED_VENUS_SCENE.starfield.faces) {
    assert.match(face.url, /venus-starfield-[a-z]+-standard\.webp$/u);
    assert.match(face.url2x, /venus-starfield-[a-z]+-standard@2x\.webp$/u);
    assert.match(face.highContrastUrl, /venus-starfield-[a-z]+\.webp$/u);
    assert.match(
      face.highContrastUrl2x,
      /venus-starfield-[a-z]+@2x\.webp$/u,
    );
    for (const [url, size] of [[face.url, 1024], [face.url2x, 2048]]) {
      const preparedFace = sharp(resolve(publicRoot, url.split("/").at(-1)));
      const [metadata, raw] = await Promise.all([
        preparedFace.metadata(),
        preparedFace.clone().removeAlpha().raw().toBuffer(),
      ]);
      assert.deepEqual([metadata.width, metadata.height], [size, size],
        `${face.id} ${size}`);
      if (size !== 1024) continue;
      const blurred = await preparedFace.clone()
        .removeAlpha()
        .blur(2)
        .raw()
        .toBuffer();
      for (let offset = 0; offset < raw.length; offset += 3) {
        const red = raw[offset];
        const green = raw[offset + 1];
        const blue = raw[offset + 2];
        if (red === 0 && green === 0 && blue === 0) exactBlackPixels += 1;
        const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        const blurredLuminance = 0.2126 * blurred[offset]
          + 0.7152 * blurred[offset + 1]
          + 0.0722 * blurred[offset + 2];
        if (luminance <= 2) darkPixels += 1;
        if (luminance > 64) brightDetailPixels += 1;
        if (Math.abs(luminance - blurredLuminance) >= 6) {
          highFrequencyPixels += 1;
        }
        pixelCount += 1;
      }
    }
  }
  assert.ok(exactBlackPixels / pixelCount > 0.4,
    "prepared starfield should preserve a true black floor");
  assert.ok(exactBlackPixels / pixelCount < 0.8,
    "prepared starfield should retain photographed Galactic structure");
  assert.ok(darkPixels / pixelCount > 0.6,
    "prepared starfield should keep most of the sky visually dark");
  assert.ok(brightDetailPixels > 0,
    "prepared starfield should retain compact bright points");
  assert.ok(highFrequencyPixels / pixelCount < 0.1,
    "prepared starfield should keep fine detail subordinate to the planet");
});

test("registers the Y-up ICRS sky to the ESO Galactic panorama", () => {
  const rightAscension = 101.28715533 * Math.PI / 180;
  const declination = -16.71611586 * Math.PI / 180;
  const galactic = equatorialDirectionToGalactic([
    Math.cos(declination) * Math.cos(rightAscension),
    Math.sin(declination),
    Math.cos(declination) * Math.sin(rightAscension),
  ]);
  assert.ok(Math.abs(galactic.longitudeDegrees - 227.23028548) < 1e-6,
    "Sirius Galactic longitude");
  assert.ok(Math.abs(galactic.latitudeDegrees - -8.89028243) < 1e-6,
    "Sirius Galactic latitude");
  assert.deepEqual(galacticToEsoPanoramaSample(0, 0, 6000, 3000), {
    x: 2999.5,
    y: 1499.5,
  });
  const largeMagellanicCloud = galacticToEsoPanoramaSample(
    280.47,
    -32.89,
    6000,
    3000,
  );
  assert.ok(largeMagellanicCloud.x > 4300 && largeMagellanicCloud.x < 4350);
  assert.ok(largeMagellanicCloud.y > 2040 && largeMagellanicCloud.y < 2060);
  const registered = rotateDirectionForEsoRegistration([0, 0, -1]);
  assert.ok(Math.abs(Math.hypot(...registered) - 1) < 1e-12);
});

test("publishes a byte-bound clean-room Sun independently of the cube",
  async () => {
    assert.equal(PREPARED_VENUS_SKY_SUN.asset.sourcePixels,
      "repository-authored-clean-room-raster");
    assert.equal(PREPARED_VENUS_SKY_SUN.asset.googlePixelsRedistributed, false);
    assert.equal(PREPARED_VENUS_SKY_SUN.appearance.model,
      "clean-room-native-radial-profile-fit");
    assert.equal(PREPARED_VENUS_SKY_SUN.projection.fixedAngularSize, true);
    for (const density of [
      PREPARED_VENUS_SKY_SUN.asset.density1,
      PREPARED_VENUS_SKY_SUN.asset.density2,
    ]) {
      const bytes = await readFile(resolve(
        publicRoot,
        density.url.split("/").at(-1),
      ));
      assert.equal(bytes.byteLength, density.bytes);
      assert.equal(createHash("sha256").update(bytes).digest("hex"),
        density.sha256);
      const metadata = await sharp(bytes).metadata();
      assert.deepEqual([metadata.width, metadata.height],
        [density.width, density.height]);
    }
  });

test("publishes exact source-qualified Venera archive bytes", async () => {
  const source = JSON.parse(await readFile(
    resolve(sourceRoot, "venera/gallery.json"),
    "utf8",
  ));
  assert.equal(PREPARED_VENUS_SURFACE_GALLERY.schema,
    "cssearth-prepared-gallery@1");
  assert.equal(PREPARED_VENUS_SURFACE_GALLERY.id, "surface-photographs");
  assert.equal(PREPARED_VENUS_SURFACE_GALLERY.open, false);
  assert.equal(PREPARED_VENUS_SURFACE_GALLERY.sourcePage,
    "https://pds-geosciences.wustl.edu/missions/venera/");
  assert.match(PREPARED_VENUS_SURFACE_GALLERY.qualification,
    /not modern restorations/u);
  assert.deepEqual(
    PREPARED_VENUS_SURFACE_GALLERY.items.map(({ id }) => id),
    ["venera-9", "venera-10", "venera-13", "venera-14"],
  );
  for (const [item, prepared] of source.items.map((item, index) => [
    item,
    PREPARED_VENUS_SURFACE_GALLERY.items[index],
  ])) {
    const [sourceBytes, publicBytes] = await Promise.all([
      readFile(resolve(sourceRoot, item.sourcePath)),
      readFile(resolve(publicRoot, item.publicFilename)),
    ]);
    assert.equal(Buffer.compare(publicBytes, sourceBytes), 0,
      `${item.id} archive bytes`);
    const metadata = await sharp(publicBytes).metadata();
    assert.deepEqual([metadata.width, metadata.height],
      [item.width, item.height]);
    assert.equal(prepared.sourceUrl, item.sourceUrl);
    assert.equal(prepared.src, `/scenes/venus/${item.publicFilename}`);
  }
});

test("binds the prepared Venus material to the checked OpenSpace parameters",
  async () => {
    const source = await readVenusAtmosphereSource();
    const derived = deriveVenusPreparedMaterial(source);
    assert.deepEqual(source, {
      atmosphereHeightKm: 70,
      planetRadiusKm: 6051.9,
      averageGroundReflectance: 0.018,
      groundRadianceEmission: 0.8,
      sunIntensity: 11.47,
      rayleigh: {
        wavelengthsNm: [680, 550, 440],
        scatteringPerKm: [0.019518, 0.01383, 0.00365],
        scaleHeightKm: 15.9,
      },
      mie: {
        scatteringPerKm: [0.05361771, 0.05361771, 0.05361771],
        extinctionPerKm: [
          0.05361771 / 0.98979,
          0.05361771 / 0.98979,
          0.05361771 / 0.98979,
        ],
        scaleHeightKm: 5.42,
        phaseG: 0.85,
      },
    });
    assert.deepEqual(derived.color, [255, 237, 202]);
    assert.equal(derived.outerRadiusScale, 1 + 70 / 6051.9);
    assert.equal(PREPARED_VENUS_SCENE.material.schema,
      "cssvenus-prepared-view-material@1");
    assert.equal(PREPARED_VENUS_SCENE.material.runtimeLightingMath, false);
    assert.equal(PREPARED_VENUS_SCENE.material.runtimeRasterization, false);
    assert.equal(PREPARED_VENUS_SCENE.material.directionalFrameCount, 31);
    assert.equal(PREPARED_VENUS_SCENE.material.frameCount, 32);
    assert.equal(PREPARED_VENUS_SCENE.material.minimumLightViewZ, -0.98);
    assert.equal(PREPARED_VENUS_SCENE.material.maximumLightViewZ, 0.98);
    assert.equal(PREPARED_VENUS_SCENE.material.baseLightAzimuthDegrees, 180);
    assert.equal(PREPARED_VENUS_SCENE.material.backgroundPositions.length, 32);
    assert.equal(PREPARED_VENUS_SCENE.material.outerRadiusScale,
      derived.outerRadiusScale);
    assert.deepEqual(PREPARED_VENUS_SCENE.material.silhouetteCoverage, {
      model: "prepared-analytic-sphere-proportional-overscan",
      coverageScale: 1.002,
      materialScale: 0.992,
      rimFill: "prepared-radial-binary-clamp-to-material-limb",
      runtime: false,
    });
    assert.deepEqual(PREPARED_VENUS_SCENE.material.observationMaterial, {
      model: "prepared-surface-lighting-with-physical-exterior-atmosphere-limb",
      surfaceAtmosphereOpacity: 0,
      exteriorAtmosphereMaximumKm: 70,
      runtimeOpacity: false,
      runtimeRasterization: false,
    });
    assert.deepEqual(PREPARED_VENUS_SCENE.material.sourceParameters, source);
    assert.deepEqual(PREPARED_VENUS_SCENE.material.lightingModel
      .surfaceResponse, {
      model: "prepared-directional-shadow-with-dedicated-flood-frame",
      colorOverlay: false,
      textureExposureShoulder: [1.4, 2.2, 0.9],
      directionalShadowRelease: 0,
      shadowlessFloodShadowRelease: 0.3,
      shadowReleaseSmoothstep: [0.45, 0.92],
    });
    assert.deepEqual(PREPARED_VENUS_SCENE.material.lightingModel
      .presentationPhaseRemap, {
      model: "continuous-crescent-rotation-plateau",
      lowerTransition: [-0.92, -0.85],
      plateau: [-0.85, -0.65],
      plateauViewZ: -0.79,
      upperTransition: [-0.65, -0.5],
    });
  });

test("keeps the prepared Venus limb inside the sourced 70 km extent", async () => {
  const material = PREPARED_VENUS_SCENE.material;
  for (const [filename, width, height] of [
    ["venus-material.webp", 2048, 1024],
    ["venus-material@2x.webp", 4096, 2048],
    ["venus-observation-material.webp", 2048, 1024],
    ["venus-observation-material@2x.webp", 4096, 2048],
    ["venus-lighting.webp", 1024, 512],
    ["venus-lighting@2x.webp", 2048, 1024],
  ]) {
    const metadata = await sharp(resolve(publicRoot, filename)).metadata();
    assert.equal(metadata.width, width, `${filename} width`);
    assert.equal(metadata.height, height, `${filename} height`);
  }
  for (const filename of ["venus-lighting.webp", "venus-lighting@2x.webp"]) {
    const stats = await sharp(resolve(publicRoot, filename)).ensureAlpha().stats();
    assert.deepEqual(
      stats.channels.slice(0, 3).map(({ min, max }) => [min, max]),
      [[0, 0], [0, 0], [0, 0]],
      `${filename} must remain a black-opacity shadow atlas`,
    );
  }
  const directionalFrame = Math.round(
    (material.lightingModel.directionalLight.direction[2] -
      material.minimumLightViewZ) /
      (material.maximumLightViewZ - material.minimumLightViewZ) *
      (material.directionalFrameCount - 1),
  );
  const directionalHemispheres = await materialHemisphereAlpha(
    directionalFrame,
  );
  const floodHemispheres = await materialHemisphereAlpha(
    material.defaultFrame,
  );
  assert.ok(
    directionalHemispheres.right > directionalHemispheres.left + 70,
    "prepared Venus Shadows ON frame must have a legible terminator",
  );
  assert.ok(
    Math.abs(floodHemispheres.right - floodHemispheres.left) < 1,
    "prepared Venus Shadows OFF frame must remain symmetric flood lighting",
  );
  const frame = material.defaultFrame;
  const tile = await sharp(resolve(publicRoot, "venus-material.webp"))
    .extract({
      left: frame % material.frameColumns * material.tileSize,
      top: Math.floor(frame / material.frameColumns) * material.tileSize,
      width: material.tileSize,
      height: material.tileSize,
    })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const bodyRadius = PREPARED_VENUS_SCENE.body.equatorialRadius /
    material.logicalSize * material.tileSize;
  const maximumAllowedRadius = bodyRadius * material.outerRadiusScale + Math.SQRT1_2;
  let maximumVisibleRadius = 0;
  for (let y = 0; y < material.tileSize; y += 1) {
    for (let x = 0; x < material.tileSize; x += 1) {
      if (tile[(y * material.tileSize + x) * 4 + 3] === 0) continue;
      maximumVisibleRadius = Math.max(
        maximumVisibleRadius,
        Math.hypot(x + 0.5 - material.tileSize / 2,
          y + 0.5 - material.tileSize / 2),
      );
    }
  }
  assert.ok(maximumVisibleRadius > bodyRadius,
    "prepared Venus atmosphere must extend beyond the body");
  assert.ok(maximumVisibleRadius <= maximumAllowedRadius,
    `prepared Venus limb ${maximumVisibleRadius} exceeds ${maximumAllowedRadius}`);
});

test("ships three source-qualified DPR-specific Venus lenses", async () => {
  assert.equal(PREPARED_VENUS_LENSES.defaultLens, "clouds");
  assert.equal(PREPARED_VENUS_LENSES.runtimeFilters, false);
  assert.equal(PREPARED_VENUS_LENSES.runtimeRasterization, false);
  assert.deepEqual(PREPARED_VENUS_LENSES.controls.map(({ id }) => id),
    ["clouds", "radar", "elevation"]);
  for (const lens of PREPARED_VENUS_LENSES.controls) {
    for (const [url, width, height] of [
      [lens.surfaceUrl, 1040, 768],
      [lens.surface2xUrl, 2080, 1536],
      [lens.polesUrl, 512, 256],
      [lens.poles2xUrl, 1024, 512],
      [lens.thumbnailUrl, 64, 64],
    ]) {
      const metadata = await sharp(resolve(publicRoot, url.split("/").at(-1)))
        .metadata();
      assert.equal(metadata.width, width, `${url} width`);
      assert.equal(metadata.height, height, `${url} height`);
    }
    const { data, info } = await sharp(resolve(
      publicRoot,
      lens.thumbnailUrl.split("/").at(-1),
    )).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const [x, y] of [[0, 0], [63, 0], [0, 63], [63, 63]]) {
      assert.equal(data[(y * info.width + x) * 4 + 3], 255,
        `${lens.id} thumbnail corner ${x},${y}`);
    }
    const expectedMaterial = lens.id === "clouds"
      ? "venus-material"
      : "venus-observation-material";
    assert.equal(lens.materialUrl,
      `/scenes/venus/${expectedMaterial}.webp`);
    assert.equal(lens.material2xUrl,
      `/scenes/venus/${expectedMaterial}@2x.webp`);
  }
});

test("keeps Venus runtime code on prepared retained-DOM paths", async () => {
  const [acquire, client, styles] = await Promise.all([
    readFile(new URL("../tools/acquire.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(acquire, /\.\.\/\.\.\/saturn/u);
  assert.equal([...client.matchAll(/devicePixelRatio/gu)].length, 0);
  assert.match(client, /createPolyCamera/u);
  assert.match(client, /createPolyOrbitControls/u);
  assert.match(client, /createPolyScene/u);
  assert.doesNotMatch(client,
    /fetch\(|XMLHttpRequest|canvas|getContext\(|style\.filter/u);
  assert.doesNotMatch(styles,
    /clip-path|(?:-webkit-)?mask|filter:|gradient\(|mix-blend-mode/u);
  assert.doesNotMatch(styles, /opacity:\s*0\.58/u);
  assert.match(client, /materialComposite|venus-material-composite/u);
  assert.match(styles, /venus-material-composite/u);
  assert.match(styles,
    /\.example-stage\s*>\s*:is\(\.polycss-camera, \.venus-material-composite\)\s*\{/u);
});

test("ships source-bound Venus chart metadata", async () => {
  const [spectrum, profile] = await Promise.all([
    readFile(resolve(publicRoot, "venus-atmosphere-spectrum.svg"), "utf8"),
    readFile(resolve(publicRoot, "venus-temperature-pressure-profile.svg"), "utf8"),
  ]);
  assert.deepEqual(metadata(spectrum), {
    source: "NASA GSFC Planetary Spectrum Generator",
    sourceUrl: "https://psg.gsfc.nasa.gov/api.php",
    measurement: "I/F apparent albedo",
    resolution: "R 240",
    points: 253,
    rangeMicrometers: [0.35, 1],
    modeled: "2026-08-30",
  });
  const pressure = metadata(profile);
  assert.equal(pressure.source, "NASA GSFC Planetary Spectrum Generator");
  assert.equal(pressure.layers, 100);
  assert.deepEqual(pressure.pressureRangeBar, [1e-15, 92.1]);
});

function metadata(svg) {
  const match = svg.match(/<metadata>([^<]+)<\/metadata>/u);
  assert.ok(match, "Prepared chart metadata is missing.");
  return JSON.parse(match[1]);
}

async function materialHemisphereAlpha(frame) {
  const size = PREPARED_VENUS_SCENE.material.tileSize;
  const atlas = await sharp(resolve(publicRoot, "venus-material.webp"))
    .extract({
      left: frame % PREPARED_VENUS_SCENE.material.frameColumns * size,
      top: Math.floor(frame / PREPARED_VENUS_SCENE.material.frameColumns) * size,
      width: size,
      height: size,
    })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const radius = PREPARED_VENUS_SCENE.body.equatorialRadius /
    PREPARED_VENUS_SCENE.material.logicalSize * size * 0.9;
  const sums = { left: 0, right: 0 };
  const counts = { left: 0, right: 0 };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) > radius) {
        continue;
      }
      const hemisphere = x < size / 2 ? "left" : "right";
      sums[hemisphere] += atlas[(y * size + x) * 4 + 3];
      counts[hemisphere] += 1;
    }
  }
  return {
    left: sums.left / counts.left,
    right: sums.right / counts.right,
  };
}
