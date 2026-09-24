/** Bind cloud zoom to the latest view without rebuilding the retained scene. */
export function bindViewportZoom<T extends { zoom: number }>(element: HTMLElement,
  view: { readonly current: T }, onView: (value: T) => void,
  onExtent?: (extent: { width: number; height: number }) => void) {
  const observer = onExtent ? new ResizeObserver(([entry]) => {
    if (entry) onExtent({ width: entry.contentRect.width, height: entry.contentRect.height });
  }) : null;
  observer?.observe(element);
  const wheel = (event: WheelEvent) => {
    event.preventDefault(); const current = view.current;
    onView({ ...current, zoom: Math.max(.15, Math.min(12, current.zoom * Math.exp(-event.deltaY * .0015))) });
  };
  element.addEventListener('wheel', wheel, { passive: false });
  return () => { observer?.disconnect(); element.removeEventListener('wheel', wheel); };
}

export interface ImageViewportCamera { x: number; y: number; zoom: number }
/** Image inspection zoom preserves the image coordinate under the pointer. */
export function bindImageZoom(element: HTMLElement, camera: { readonly current: ImageViewportCamera },
  onCamera: (value: ImageViewportCamera) => void) {
  const wheel = (event: WheelEvent) => {
    event.preventDefault(); const bounds = element.getBoundingClientRect(), old = camera.current;
    const zoom = Math.min(12, Math.max(.015, old.zoom * Math.exp(-event.deltaY * .0015)));
    const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
    onCamera({ zoom, x: x - (x - old.x) * zoom / old.zoom, y: y - (y - old.y) * zoom / old.zoom });
  };
  element.addEventListener('wheel', wheel, { passive: false });
  return () => element.removeEventListener('wheel', wheel);
}
