import assert from "node:assert/strict";

// Installed only by Chrome conformance. Each receipt retains the actual shared
// owner and forwards its operations; a declaration/marker cannot satisfy it.
export function installObjectRuntimeProbe() {
  const records = [];
  globalThis.__objectRuntimeProbe = Object.freeze({
    own(kind, owner, id) {
      const record = { kind, id, owner, calls: {}, failures: [] };
      records.push(record);
      const facade = {};
      for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(owner))) {
        if (typeof descriptor.value === "function") {
          Object.defineProperty(facade, key, { enumerable: true, value: (...args) => {
            record.calls[key] = (record.calls[key] ?? 0) + 1;
            try { return Reflect.apply(descriptor.value, owner, args); }
            catch (error) { record.failures.push({ operation: key, message: error.message }); throw error; }
          } });
        } else Object.defineProperty(facade, key, { enumerable: true, get: () => owner[key] });
      }
      record.facade = Object.freeze(facade); return record.facade;
    },
    registerNativeAnimation(animation, id) {
      const owner = records.find(record => record.id === id && record.kind === "playback");
      if (!owner) throw new Error("Actual playback owner is missing");
      return owner.facade.register(animation);
    },
    inspect() {
      return records.map(({ kind, id, owner, calls, failures }) => ({ kind, id, calls: { ...calls }, failures: [...failures],
        state: typeof owner.stats === "function" ? owner.stats() : null,
        ...(typeof owner.state === "function" ? { value: owner.state() } : {}) }));
    },
  });
}

export function instrumentObjectRuntime(source) {
  const anchor = "  const environment = { ...nativeServices, ...services };";
  assert.equal(source.split(anchor).length - 1, 1, "Observe the one actual shared runtime service composition");
  return source.replace(anchor, `${anchor}
  if (!globalThis.__objectRuntimeProbe) throw new Error("Runtime probe was not installed");
  for (const [kind, service] of Object.entries({ session: "createLifetime", resources: "createResources",
    playback: "createPlayback", camera: "createOrbit", selection: "createSelection", controls: "createControls" })) {
    if (typeof environment[service] !== "function") continue;
    const constructor = environment[service];
    environment[service] = (...args) => globalThis.__objectRuntimeProbe.own(kind, constructor(...args), definition.id);
  }`);
}
