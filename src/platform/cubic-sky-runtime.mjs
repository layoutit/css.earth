

export function mountRetainedCubicSky({
  host,
  plan,
  imageDensity,
  objectId,
  requireSun = true,
}) {
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
  for (const face of plan.faces) {
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
  cube.appendChild(orientation);
  root.appendChild(cube);
  host.prepend(root);
  let publishedMatrix = null;
  let publishedZoomScale = null;
  return Object.freeze({
    root,
    cube,
    orientation,
    faceCount: orientation.querySelectorAll(".planet-cubic-sky-face").length,
    setOrientation({ matrix, zoom, defaultZoom }) {
      if (typeof matrix !== "string" || !Number.isFinite(zoom) ||
          !Number.isFinite(defaultZoom) || defaultZoom <= 0) {
        throw new TypeError("Retained cubic sky camera publication is invalid.");
      }
      if (matrix !== publishedMatrix) {
        orientation.style.transform = matrix;
        cube.style.setProperty(`--${objectId}-skybox-orientation`, matrix);
        publishedMatrix = matrix;
      }
      const zoomScale = 1 + plan.cameraZoomResponse *
        (zoom / defaultZoom - 1);
      if (zoomScale !== publishedZoomScale) {
        root.style.setProperty("--planet-cubic-sky-zoom", String(zoomScale));
        root.style.setProperty(`--${objectId}-skybox-zoom`, String(zoomScale));
        publishedZoomScale = zoomScale;
      }
    },
    destroy() {
      root.remove();
    },
  });
}
