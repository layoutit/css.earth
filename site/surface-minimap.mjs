import { worldRotationFromQuaternion } from '../src/renderers/css/dist/navigation.js';
import { directionOnMap, mapDirection, orbitMapCamera } from './surface-minimap-math.mjs';
import { surfaceViewRectangle } from './surface-minimap-rectangle.mjs';
import { surfaceMapContext, surfaceMapViewport } from './surface-map-context.mjs';

export function loadSurfacePreview(map) {
  const image = map.querySelector('[data-surface-preview-src]');
  if (!image || image.hasAttribute('src')) return;
  image.src = image.dataset.surfacePreviewSrc;
  map.style.setProperty('--surface-preview-image', `url(${JSON.stringify(image.dataset.surfacePreviewSrc)})`);
}

export function createSurfaceMinimap({ drawer, documentTarget, windowTarget, onInteraction, surfaceReader }) {
  const maps = [...drawer.querySelectorAll('[data-surface-minimap], .planet-surface-minimap')];
  const events = new AbortController();
  const elements = new Map(maps.map(map => [map, {
    config: map.dataset.surfaceMinimap ? JSON.parse(map.dataset.surfaceMinimap) : null,
    rectangles: [...map.querySelectorAll('.planet-minimap-viewport')],
    size: null,
  }]));
  let camera = null, unsubscribe = null, frame = null, disposed = false;
  let playing = false, pinching = false;
  const pointers = new Map();
  let pinchDistance = null;
  let visibleMaps = [];
  const active = map => map.isConnected && !documentTarget.hidden && !map.closest('[hidden], details:not([open])');

  function context(map) {
    if (!camera?.navigation || !active(map) || !elements.get(map).config) return null;
    return surfaceReader ? surfaceReader.read(map, camera)
      : surfaceMapContext(elements.get(map).config, camera, documentTarget, windowTarget);
  }

  function render() {
    frame = null;
    if (disposed) return;
    let visible = false;
    for (const map of visibleMaps) {
      if (!active(map)) continue;
      loadSurfacePreview(map);
      const item = elements.get(map);
      if (!item.config) continue;
      const bounds = item.size ??= map.getBoundingClientRect();
      if (!bounds.width || !bounds.height) continue;
      const state = context(map);
      map.dataset.ready = String(Boolean(state));
      if (!state) continue;
      visible = true;
      const optics = camera.navigation.optics();
      const view = surfaceMapViewport(state.scene, optics);
      const extent = surfaceViewRectangle({ eye: state.relative.map(x => x / camera.navigation.frame.bodyRadiusM),
        rotation: worldRotationFromQuaternion(state.world.pose.orientationXyzw), view, axes: state.axes });
      const center = extent.center ?? directionOnMap(state.relative, state.axes);
      map.dataset.centerU = center.u.toFixed(6);
      map.dataset.centerV = center.v.toFixed(6);
      map.dataset.visible = String(Boolean(extent.bounds));
      map.dataset.fullView = String(extent.bounds?.width >= 1 && extent.bounds?.height >= 1);
      const { rectangles } = elements.get(map);
      rectangles.forEach((rect, i) => {
        rect.hidden = !extent.bounds;
        if (!extent.bounds) return;
        rect.style.left = `${(extent.bounds.left + i - 1) * 100}%`;
        rect.style.top = `${extent.bounds.top * 100}%`;
        rect.style.width = `${extent.bounds.width * 100}%`;
        rect.style.height = `${extent.bounds.height * 100}%`;
        rect.style.backgroundSize = `${bounds.width}px ${bounds.height}px`;
        rect.style.backgroundPosition = `${-(extent.bounds.left + i - 1) * bounds.width}px ${-extent.bounds.top * bounds.height}px`;
      });
    }
    if (playing && visible) schedule();
  }
  const schedule = () => {
    if (!disposed && visibleMaps.some(active) && frame === null) frame = windowTarget.requestAnimationFrame(render);
  };
  function syncVisibility() {
    visibleMaps = maps.filter(active);
    if (visibleMaps.some(map => elements.get(map).config)) {
      unsubscribe ??= camera?.sharedView?.subscribe(schedule) ?? null;
      schedule();
    } else {
      unsubscribe?.(); unsubscribe = null;
      if (frame !== null) windowTarget.cancelAnimationFrame(frame);
      frame = null;
      if (visibleMaps.length) schedule();
    }
  }
  function navigate(map, u, v) {
    const state = context(map);
    if (!state) return;
    onInteraction();
    const direction = mapDirection(u, Math.max(.001, Math.min(.999, v)), state.axes);
    camera.navigation.apply(orbitMapCamera(state.world, camera.navigation.frame.originM, direction));
    schedule();
  }
  function point(map, event) {
    const bounds = map.getBoundingClientRect();
    navigate(map, (event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
  }
  function wheel(map, event) {
    if (!camera?.navigation || !active(map)) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    onInteraction();
    // Feed the original deltas into the scene's retained zoom controller.
    const input = documentTarget.querySelector('.planet-input-surface');
    const bounds = input.getBoundingClientRect();
    input.dispatchEvent(new windowTarget.WheelEvent('wheel', {
      bubbles: true, cancelable: true, deltaY: event.deltaY, deltaX: event.deltaX ?? 0,
      deltaMode: event.deltaMode ?? 0, ctrlKey: event.ctrlKey ?? false,
      clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2,
    }));
  }
  for (const map of maps) {
    if (!elements.get(map).config) continue;
    map.addEventListener('pointerdown', event => {
      if (!camera?.navigation || event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      map.focus({ preventScroll: true });
      map.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      map.dataset.dragging = 'true';
      if (pointers.size === 1) point(map, event);
      else {
        pinching = true;
        const [a, b] = [...pointers.values()];
        pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      }
    }, { signal: events.signal });
    map.addEventListener('pointermove', event => {
      if (!pointers.has(event.pointerId)) return;
      event.preventDefault();
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1 && !pinching) point(map, event);
      else if (pointers.size > 1) {
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance > 0 && pinchDistance > 0) wheel(map, { deltaY: -Math.log(distance / pinchDistance) * 400, ctrlKey: true });
        pinchDistance = distance;
      }
    }, { signal: events.signal });
    const release = event => {
      pointers.delete(event.pointerId);
      pinchDistance = null;
      if (map.hasPointerCapture(event.pointerId)) map.releasePointerCapture(event.pointerId);
      if (pointers.size === 0) { delete map.dataset.dragging; pinching = false; }
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) map.addEventListener(type, release, { signal: events.signal });
    map.addEventListener('wheel', event => wheel(map, event), { passive: false, signal: events.signal });
    map.addEventListener('keydown', event => {
      const moves = { ArrowLeft: [-.02, 0], ArrowRight: [.02, 0], ArrowUp: [0, -.04], ArrowDown: [0, .04] };
      if (moves[event.key]) {
        event.preventDefault();
        const [du, dv] = moves[event.key];
        navigate(map, Number(map.dataset.centerU) + du, Number(map.dataset.centerV) + dv);
      } else if (['+', '=', '-'].includes(event.key)) {
        event.preventDefault(); wheel(map, { deltaY: event.key === '-' ? 100 : -100 });
      }
    }, { signal: events.signal });
    map.addEventListener('dragstart', event => event.preventDefault(), { signal: events.signal });
  }
  const observer = maps.length ? new windowTarget.MutationObserver(syncVisibility) : null;
  // Watch visibility/connection owners, not our own rectangle's hidden writes.
  const ancestors = new Set();
  for (const map of maps) for (let node = map; node; node = node.parentElement) ancestors.add(node);
  for (const node of ancestors) observer?.observe(node, { childList: true, attributes: true, attributeFilter: ['hidden', 'open'] });
  const resize = maps.length && windowTarget.ResizeObserver ? new windowTarget.ResizeObserver(entries => {
    for (const entry of entries) {
      const box = entry.borderBoxSize?.[0];
      elements.get(entry.target).size = box?.inlineSize > 0 && box?.blockSize > 0
        ? { width: box.inlineSize, height: box.blockSize } : null;
    }
    syncVisibility();
  }) : null;
  for (const map of maps) resize?.observe(map);
  windowTarget.addEventListener('resize', () => {
    for (const item of elements.values()) item.size = null;
    syncVisibility();
  }, { signal: events.signal });
  documentTarget.addEventListener('visibilitychange', syncVisibility, { signal: events.signal });
  syncVisibility();
  return {
    setPlaybackState(state) { playing = state.allowed; schedule(); },
    setCamera(next) {
      unsubscribe?.(); unsubscribe = null; camera = next;
      pointers.clear(); pinching = false; pinchDistance = null;
      for (const map of maps) delete map.dataset.dragging;
      syncVisibility();
    },
    destroy() {
      disposed = true; unsubscribe?.(); observer?.disconnect(); resize?.disconnect(); events.abort();
      if (frame !== null) windowTarget.cancelAnimationFrame(frame);
      pointers.clear(); camera = null;
    },
  };
}
