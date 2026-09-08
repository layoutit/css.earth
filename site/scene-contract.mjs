export function requireSceneLifecycle(mount, objectId = "unknown") {
  // Shape only. The router supplies mountScene(stage, { onError }), retains
  // ownership before validation, and owns playback permission. Cancellation,
  // failure cleanup and idempotence are earned by executable lifecycle tests.
  if (!mount ||
      typeof mount.ready?.then !== "function" ||
      typeof mount.pause !== "function" ||
      typeof mount.resume !== "function" ||
      typeof mount.destroy !== "function") {
    throw new TypeError(
      `cssEarth scene ${objectId} must provide ready, pause, resume, and destroy.`,
    );
  }
  return mount;
}

// This validates the actual content supplied to the shared shell, not a second
// declaration of supported capabilities.
export function requireObjectControls(content, objectId = "unknown") {
  if (!content || typeof content !== "object" ||
      !Object.hasOwn(content, "lenses") || !Object.hasOwn(content, "settings")) {
    throw new TypeError(`Object ${objectId} must export its lenses and settings content.`);
  }
  for (const name of ["lenses", "settings"]) {
    if (content[name] != null && !Array.isArray(content[name].controls)) {
      throw new TypeError(`Object ${objectId} ${name} controls must be an array.`);
    }
  }
  const lenses = content.lenses?.controls ?? [];
  const lensIds = lenses.map((lens) => lens?.id);
  if (lensIds.some((id) => typeof id !== "string" || !id) ||
      new Set(lensIds).size !== lensIds.length ||
      (lenses.length && !lensIds.includes(content.lenses.defaultLens))) {
    throw new TypeError(`Object ${objectId} lens IDs/default are invalid.`);
  }
  const settings = content.settings?.controls ?? [];
  const names = settings.map((setting) => setting?.name);
  if (names.some((name) => typeof name !== "string" || !name ||
      ["motion", "skyContrast", "heliosphere", "asteroidOrbits", "asteroidLabels"].includes(name)) || new Set(names).size !== names.length ||
      settings.some((setting) => !["toggle", "cycle"].includes(setting.kind) ||
        typeof setting.label !== "string" || !setting.label ||
        (setting.kind === "toggle" ? typeof setting.checked !== "boolean"
          : typeof setting.state !== "string"))) {
    throw new TypeError(`Object ${objectId} settings controls are invalid.`);
  }
  return content;
}
