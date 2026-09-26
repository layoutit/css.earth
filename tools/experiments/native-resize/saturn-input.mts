import type { bindCameraInputListeners } from '@cssearth/renderer/navigation/camera-input-listeners.ts';

type Bindings = Parameters<typeof bindCameraInputListeners>[0];

/** Trace-only input substitution. The real trackball and complete renderer stay
 * unchanged. Native dimensions are transported to those existing callbacks;
 * this is deliberately not presented as a completed script-free renderer. */
export function bindSaturnResizeInput(bindings: Bindings): Bindings {
  const mode = new URL(location.href).searchParams.get('traceInput');
  const samples: [number, number][] = [];
  Reflect.set(window, '__saturnInputSamples', samples);
  bindings.lifetime.onDispose(() => Reflect.deleteProperty(window, '__saturnInputSamples'));
  const observed: Bindings = { ...bindings,
    onPointerDown(event) { samples.length = 0; samples.push([event.clientX, event.clientY]); bindings.onPointerDown(event); },
    onPointerMove(event) {
      if (event.buttons === 1) {
        const coalesced = event.getCoalescedEvents();
        for (const sample of coalesced.length ? coalesced : [event]) samples.push([sample.clientX, sample.clientY]);
      }
      bindings.onPointerMove(event);
    },
  };
  if (mode !== 'resize' && mode !== 'size') return observed;
  const { inputSurface, lifetime, onPointerDown, onPointerMove, endPointer } = observed;
  const doc = inputSurface.ownerDocument;
  const box = doc.createElement('div');
  box.className = 'native-saturn-resize';
  box.style.width = box.style.height = '4096px';
  box.setAttribute('aria-label', 'Native resize camera input experiment');
  const style = doc.createElement('style');
  style.textContent = `
    .object-input-surface { overflow: hidden; }
    .native-saturn-resize { position: absolute; left: -2048px; top: -2048px;
      min-width: 3584px; min-height: 3584px; max-width: 4608px; max-height: 4608px;
      overflow: scroll; resize: both; background: transparent; opacity: 0;
      touch-action: none; ${mode === 'size' ? 'contain: size;' : ''} }
    .native-saturn-resize::-webkit-scrollbar { width: 3000px; height: 3000px; background: transparent; }
    .native-saturn-resize::-webkit-scrollbar-thumb,
    .native-saturn-resize::-webkit-scrollbar-corner,
    .native-saturn-resize::-webkit-resizer { background: transparent; }
  `;
  doc.head.append(style);
  inputSurface.append(box);
  const originalCapture = inputSurface.setPointerCapture;
  const originalHasCapture = inputSurface.hasPointerCapture;
  const originalRelease = inputSurface.releasePointerCapture;
  inputSurface.setPointerCapture = id => box.setPointerCapture(id);
  inputSurface.hasPointerCapture = id => box.hasPointerCapture(id);
  inputSurface.releasePointerCapture = id => box.releasePointerCapture(id);
  let active: { event: PointerEvent; x: number; y: number; width: number; height: number } | null = null;
  let lastEvent: PointerEvent | null = null;
  let sampleCount = 0;
  const dimensions = () => {
    const width = Number.parseFloat(box.style.width), height = Number.parseFloat(box.style.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error('Invalid native resize dimensions.');
    return { width, height };
  };
  const sample = (type: string, source: PointerEvent) => {
    if (!active) return source;
    const { width, height } = dimensions();
    const event = new PointerEvent(type, { pointerId: source.pointerId, pointerType: source.pointerType,
      isPrimary: source.isPrimary, button: source.button, buttons: source.buttons,
      clientX: active.x + width - active.width, clientY: active.y + height - active.height,
      bubbles: true, cancelable: true });
    Object.defineProperty(event, 'timeStamp', { value: source.timeStamp });
    return event;
  };
  const flush = () => {
    if (!active || !lastEvent) return;
    sampleCount++;
    onPointerMove(sample('pointermove', lastEvent));
  };
  const observer = new MutationObserver(bindings.guardNative(flush));
  observer.observe(box, { attributes: true, attributeFilter: ['style'] });
  Reflect.set(window, '__nativeSaturnInput', {
    mode, dimensions, samples: () => sampleCount,
    reset() { if (active) throw new Error('Cannot reset a held resize.'); box.style.width = box.style.height = '4096px'; },
  });
  lifetime.onDispose(() => {
    observer.disconnect(); box.remove(); style.remove();
    inputSurface.setPointerCapture = originalCapture;
    inputSurface.hasPointerCapture = originalHasCapture;
    inputSurface.releasePointerCapture = originalRelease;
    Reflect.deleteProperty(window, '__nativeSaturnInput');
  });
  return { ...observed,
    onPointerDown(event) {
      if (event.target !== box) return onPointerDown(event);
      const size = dimensions();
      active = { event, x: event.clientX, y: event.clientY, ...size };
      lastEvent = event;
      onPointerDown(event);
    },
    onPointerMove(event) {
      if (!active) return onPointerMove(event);
      lastEvent = event;
    },
    endPointer(event) {
      if (active) { flush(); const translated = sample(event.type, event); endPointer(translated); active = null; lastEvent = null; }
      else endPointer(event);
    },
  };
}
