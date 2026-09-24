export interface CameraViewportSnapshot {
  readonly bounds: { readonly x: number; readonly y: number; readonly left: number; readonly top: number; readonly width: number; readonly height: number };
  readonly focalPixels: number;
  readonly previewTop: number | null;
  /** The scene area left open by fixed chrome (a phone's header above, the readout riding on the drawer below), in
   * client pixels. The camera centres the focus body on it; null where no chrome covers the scene. */
  readonly openArea: { readonly top: number; readonly bottom: number } | null;
  /** How far the shell's header reaches down into the stage, in CSS pixels, on every layout: scene labels stay out
   * of that band. Zero without a header. */
  readonly coveredTopPixels: number;
}
/** Fixed chrome that covers the scene: the open area runs from the bottom of `above` to the top of `below`. */
export interface CameraViewportChrome { readonly above: HTMLElement | null; readonly below: HTMLElement | null }
/** Shell chrome the labels avoid on every layout: the header row the wordmark, filters and actions share. */
export interface CameraViewportLabelChrome { readonly header: HTMLElement | null }
export interface CameraViewport {
  read(cssPerspective: string): CameraViewportSnapshot;
  subscribe(listener: () => void): () => void;
  destroy(): void;
}

/** The shell's physical cameras share its viewport. Keep measurement and resize
 * ownership alive across object mounts; scene construction only reads a snapshot.
 * CSS still resolves authored projection units (including container units). */
export function createCameraViewport(stage: HTMLElement, previewElement: HTMLElement | null = null, chrome: CameraViewportChrome | null = null,
  labelChrome: CameraViewportLabelChrome | null = null): CameraViewport {
  const view = stage.ownerDocument.defaultView;
  if (!view) throw new Error('Camera viewport requires a window.');
  const projections = new Map<string, { probe: HTMLElement; snapshot: CameraViewportSnapshot | null }>();
  let frame: number | null = null, destroyed = false;
  const listeners = new Set<() => void>();
  const measure = () => {
    const bounds = stage.getBoundingClientRect();
    const measuredBounds = Object.freeze({ x: bounds.x, y: bounds.y, left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height });
    const previewTop = previewElement?.getBoundingClientRect().top ?? null;
    // Hidden chrome (display: none) measures as an empty box and covers nothing.
    const edge = (element: HTMLElement | null | undefined, side: 'top' | 'bottom') => {
      const rect = element?.getBoundingClientRect();
      return rect && rect.height > 0 ? rect[side] : null;
    };
    const openTop = Math.max(bounds.top, edge(chrome?.above, 'bottom') ?? bounds.top);
    const openBottom = Math.min(bounds.bottom, edge(chrome?.below, 'top') ?? bounds.bottom);
    const openArea = chrome && openBottom > openTop && (openTop > bounds.top || openBottom < bounds.bottom)
      ? Object.freeze({ top: openTop, bottom: openBottom }) : null;
    const headerBottom = edge(labelChrome?.header, 'bottom');
    const coveredTopPixels = headerBottom === null ? 0 : Math.max(0, Math.min(bounds.height, headerBottom - bounds.top));
    let changed = false;
    for (const entry of projections.values()) {
      const focalPixels = Number.parseFloat(view.getComputedStyle(entry.probe).perspective);
      if (!(bounds.width > 0 && bounds.height > 0 && focalPixels > 0)) {
        throw new Error(`Shared camera viewport has no projection: stage ${bounds.width}×${bounds.height}, probe '${entry.probe.style.perspective}' → '${view.getComputedStyle(entry.probe).perspective}'${entry.probe.isConnected ? '' : ', probe detached'}.`);
      }
      const previous = entry.snapshot;
      if (previous && previous.focalPixels === focalPixels && previous.previewTop === previewTop &&
          previous.openArea?.top === openArea?.top && previous.openArea?.bottom === openArea?.bottom &&
          previous.coveredTopPixels === coveredTopPixels &&
          Object.entries(measuredBounds).every(([key, value]) => previous.bounds[key as keyof CameraViewportSnapshot['bounds']] === value)) continue;
      entry.snapshot = Object.freeze({ bounds: measuredBounds, focalPixels, previewTop, openArea, coveredTopPixels });
      changed = true;
    }
    return changed;
  };
  const refresh = () => {
    if (destroyed || projections.size === 0) return;
    if (measure()) for (const listener of listeners) listener();
  };
  const invalidate = () => {
    // Keep the last published measurement until the layout owner refreshes it.
    // Sidebar content resizes must not force an incoming scene to measure DOM.
    if (destroyed || frame !== null || projections.size === 0) return;
    frame = view.requestAnimationFrame(() => {
      frame = null;
      refresh();
    });
  };
  // ResizeObserver runs after layout. Measure here while geometry is current,
  // instead of next frame after camera/scene writes have dirtied style again.
  const observer = new view.ResizeObserver(() => {
    if (frame !== null) { view.cancelAnimationFrame(frame); frame = null; }
    refresh();
  });
  observer.observe(stage);
  if (previewElement) observer.observe(previewElement);
  for (const element of [chrome?.above, chrome?.below, labelChrome?.header]) if (element) observer.observe(element);
  view.addEventListener('resize', invalidate, { passive: true });
  view.addEventListener('scroll', invalidate, { passive: true });
  return {
    read(cssPerspective) {
      if (destroyed) throw new Error('Camera viewport has been destroyed.');
      let entry = projections.get(cssPerspective);
      if (!entry) {
        // Each authored projection is resolved once during preparation. An
        // incoming FOV must not invalidate the outgoing camera's snapshot.
        const probe = stage.ownerDocument.createElement('div');
        probe.style.cssText = 'position:absolute;inset:0;visibility:hidden;pointer-events:none';
        probe.ariaHidden = 'true';
        probe.style.perspective = cssPerspective;
        stage.appendChild(probe);
        entry = { probe, snapshot: null };
        projections.set(cssPerspective, entry);
      }
      if (!entry.snapshot) measure();
      return entry.snapshot!;
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame !== null) view.cancelAnimationFrame(frame);
      observer.disconnect();
      view.removeEventListener('resize', invalidate);
      view.removeEventListener('scroll', invalidate);
      listeners.clear();
      for (const { probe } of projections.values()) probe.remove();
      projections.clear();
    },
  };
}
