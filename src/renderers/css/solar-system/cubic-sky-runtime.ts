export interface CubicSkyCameraContract {source:string;sourcePath:string;rotationResponse:number;zoomResponse:number;horizontalFovDegrees:number;focalLengthOverViewportWidth:number;qualification:string;}
export interface CubicSkyPlan {cameraPitchResponse:number;cameraZoomResponse:number;presentationPitchOffsetDegrees:number;presentationYawOffsetDegrees:number;sceneRegistration?:string;cameraContract?:string|CubicSkyCameraContract;projection?:{cssPerspective:string;horizontalFovDegrees:number;focalLengthOverViewportWidth?:number};}
export interface CubicSkyMountOptions {host:HTMLElement;plan:CubicSkyPlan;objectId:string;}
export type RetainedCubicSky = ReturnType<typeof mountRetainedCubicSky>;

/**
 * An object's retained sky orientation. The application draws one shared universe sky, so an object keeps only these
 * orientation handles, which its camera and orbit publish to; it renders no sky images or stars.
 */
export function mountRetainedCubicSky({
  host,
  plan,
  objectId,
}: CubicSkyMountOptions) {
  if (!(host instanceof HTMLElement) || !/^[a-z][a-z0-9-]*$/u.test(objectId)) {
    throw new TypeError("Retained cubic sky mount arguments are invalid.");
  }
  const root = document.createElement("div");
  root.className = `object-cubic-sky ${objectId}-skybox`;
  root.ariaHidden = "true";
  if (plan.projection?.cssPerspective) {
    root.style.setProperty(
      "--object-cubic-sky-camera-distance",
      plan.projection.cssPerspective,
    );
  }
  const cube = document.createElement("div");
  cube.className = `object-cubic-sky-cube ${objectId}-skybox-cube`;
  const orientation = document.createElement("div");
  orientation.className =
    `object-cubic-sky-orientation ${objectId}-skybox-orientation`;
  cube.appendChild(orientation);
  root.appendChild(cube);
  host.prepend(root);
  let publishedMatrix: string | null = null;
  let publishedZoomScale: number | null = null;
  return Object.freeze({
    root,
    cube,
    orientation,
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
        root.style.setProperty("--object-cubic-sky-zoom", String(zoomScale));
        publishedZoomScale = zoomScale;
      }
    },
    destroy() {
      root.remove();
    },
  });
}
