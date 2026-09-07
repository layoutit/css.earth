export interface PreparedTextureSlot { id: string; bindings: Array<{ target: number; name: string }> }
interface TextureBinding { target: number; name: string; slot: string; element: HTMLElement; base: string }
// Bind prepared slots to existing surface leaves; retain the selected base underneath.
export function createPreparedTextureOverlay(slots: readonly PreparedTextureSlot[], nodes: readonly HTMLElement[]) {
  const bindings = new Map<string, TextureBinding>(), ids = new Set(slots.map(slot => slot.id));
  let active: Map<string, string> | null = null;
  for (const slot of slots) for (const binding of slot.bindings) {
    const element = nodes[binding.target];
    bindings.set(`${binding.target}:${binding.name}`, { ...binding, slot: slot.id, element,
      base: element.style.getPropertyValue(binding.name) });
  }
  function publish(binding: TextureBinding) {
    const overlay = active?.get(binding.slot);
    const value = overlay ? `url(${JSON.stringify(overlay)})${binding.base && binding.base !== 'none' ? `,${binding.base}` : ''}` : binding.base;
    binding.element.style.setProperty(binding.name, value);
  }
  return Object.freeze({
    slots: Object.freeze([...ids]),
    write(target: number, name: string, value: string) {
      const binding = bindings.get(`${target}:${name}`);
      if (!binding) return false;
      binding.base = value; publish(binding); return true;
    },
    set(urls: ReadonlyMap<string, string>) {
      if (!(urls instanceof Map) || urls.size !== ids.size || [...ids].some(id => !urls.get(id)?.startsWith('blob:'))) {
        throw new Error('Observation textures do not match the prepared surface slots.');
      }
      active = new Map(urls); for (const binding of bindings.values()) publish(binding);
    },
    clear() { if (!active) return; active = null; for (const binding of bindings.values()) publish(binding); },
  });
}
