// Prepared texture slots reuse existing surface nodes and their exact UVs. A
// transparent observation is an ordinary background above the selected base.
export function createPreparedTextureOverlay(slots, nodes) {
  const bindings = new Map(), ids = new Set(slots.map(slot => slot.id));
  let active = null;
  for (const slot of slots) for (const binding of slot.bindings) {
    const element = nodes[binding.target];
    bindings.set(`${binding.target}:${binding.name}`, { ...binding, slot: slot.id, element,
      base: element.style.getPropertyValue(binding.name) });
  }
  function publish(binding) {
    const overlay = active?.get(binding.slot);
    const value = overlay ? `url(${JSON.stringify(overlay)})${binding.base && binding.base !== "none" ? `,${binding.base}` : ""}` : binding.base;
    binding.element.style.setProperty(binding.name, value);
  }
  return Object.freeze({
    slots: Object.freeze([...ids]),
    write(target, name, value) {
      const binding = bindings.get(`${target}:${name}`);
      if (!binding) return false;
      binding.base = value; publish(binding); return true;
    },
    set(urls) {
      if (!(urls instanceof Map) || urls.size !== ids.size || [...ids].some(id => typeof urls.get(id) !== "string" || !urls.get(id).startsWith("blob:"))) {
        throw new Error("Observation textures do not match the prepared surface slots.");
      }
      active = new Map(urls); for (const binding of bindings.values()) publish(binding);
    },
    clear() { if (!active) return; active = null; for (const binding of bindings.values()) publish(binding); },
  });
}
