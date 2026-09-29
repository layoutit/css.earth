/** A retained prepared image plane; renderer-specific classes and camera transforms come from the host. */
export interface ImagePlaneProjection {
  focalPixels: number; principalOffsetPixels: readonly [number, number]; transform: string;
}
export function mountImagePlane<Publication>({ host, before, style, url, classes, project }: {
  host: HTMLElement; before: Node; style: Partial<CSSStyleDeclaration>; url: string;
  classes: { root: string; camera: string; scene: string; mesh: string };
  project(publication: Publication): ImagePlaneProjection;
}) {
  const document = host.ownerDocument;
  const root = document.createElement('div'), camera = document.createElement('div');
  const scene = document.createElement('div'), mesh = document.createElement('div'), image = document.createElement('s');
  root.className = classes.root;
  root.style.background = 'transparent'; root.style.visibility = 'hidden'; root.style.pointerEvents = 'none';
  camera.className = classes.camera; scene.className = classes.scene; mesh.className = classes.mesh;
  Object.assign(image.style, style);
  image.style.backgroundImage = `url(${JSON.stringify(url)})`;
  mesh.append(image); scene.append(mesh); camera.append(scene); root.append(camera); host.insertBefore(root, before);
  return {
    root, image,
    publish(publication: Publication) {
      const projection = project(publication);
      camera.style.perspective = `${projection.focalPixels}px`;
      const [x, y] = projection.principalOffsetPixels;
      camera.style.perspectiveOrigin = `calc(50% + ${x}px) calc(50% + ${y}px)`;
      scene.style.transform = projection.transform;
    },
    setVisible(enabled: boolean, opacity: number) { root.style.visibility = enabled ? 'visible' : 'hidden'; root.style.opacity = String(opacity); },
    destroy() { root.remove(); },
  };
}

/** Prepared overlays remain attached to the renderer's existing retained meshes. */
export function mountOverlayLeaves(meshes: readonly HTMLElement[], id: string, style: Partial<CSSStyleDeclaration>, url: string): HTMLElement[] {
  return meshes.map(mesh => { const node = mesh.ownerDocument.createElement('s'); node.dataset.overlayLeaf = id; node.dataset.imageLayer = 'original'; Object.assign(node.style, style);
            node.style.backgroundImage = `url("${url.replace(/["\\\n\r]/g, character => `\\${character}`)}")`;
            mesh.append(node); return node; });
}
