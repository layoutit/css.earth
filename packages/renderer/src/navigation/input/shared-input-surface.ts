// Native input registrations belong to the application surface. A scene leases
// a callback; releasing it drops the scene closure without invalidating Safari's
// event regions. Standalone mounts retain their ordinary native cleanup.
interface Slot { target: EventTarget; type: string; capture: boolean; passive: boolean | undefined;
  callback: EventListener | null; listener: EventListener; }
const owners = new WeakMap<HTMLElement, Map<string, Slot>>();
export const isSharedInputSurface = (surface: HTMLElement): boolean => owners.has(surface);
export function retainInputSurface(surface: HTMLElement): () => void {
  if (owners.has(surface)) throw new Error('Input surface already has an application owner.');
  const slots = new Map<string, Slot>();
  owners.set(surface, slots);
  const cursor = surface.style.cursor;
  return () => {
    if (!owners.delete(surface)) return;
    for (const slot of slots.values()) {
      slot.callback = null;
      slot.target.removeEventListener(slot.type, slot.listener, { capture: slot.capture });
    }
    slots.clear();
    if (surface.style.cursor !== cursor) surface.style.cursor = cursor;
  };
}
/** The native listener outlives every scene that leases its slot. It is built here, where no scene's callback is in
 * scope, so that it names the slot and nothing of the scene that registered first. */
function createSlot(target: EventTarget, type: string, options: AddEventListenerOptions): Slot {
  const slot: Slot = { target, type, capture: !!options.capture, passive: options.passive,
    callback: null, listener: event => slot.callback?.(event) };
  return slot;
}
export function bindInputEvent<E extends Event>(surface: HTMLElement, key: string, target: EventTarget,
  type: string, callback: (event: E) => void, options: AddEventListenerOptions = {}): () => void {
  const callbackListener = callback as EventListener;
  const slots = owners.get(surface);
  if (!slots) {
    target.addEventListener(type, callbackListener, options);
    return () => target.removeEventListener(type, callbackListener, { capture: options.capture });
  }
  if (options.once || options.signal) throw new Error('Shared input leases own their own release.');
  let slot = slots.get(key);
  if (slot && (slot.target !== target || slot.type !== type || slot.capture !== !!options.capture || slot.passive !== options.passive)) {
    throw new Error(`Shared input registration changed: ${key}`);
  }
  if (!slot) {
    slot = createSlot(target, type, options);
    target.addEventListener(type, slot.listener, options);
    slots.set(key, slot);
  }
  if (slot.callback) throw new Error(`Shared input registration still leased: ${key}`);
  slot.callback = callbackListener;
  return () => { if (slot.callback === callbackListener) slot.callback = null; };
}
