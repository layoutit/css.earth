export const PLANET_SPEED_STATES = Object.freeze([
  Object.freeze({ label: "off", value: 0 }),
  Object.freeze({ label: "normal", value: 1 }),
  Object.freeze({ label: "fast", value: 2 }),
  Object.freeze({ label: "fastest", value: 3 }),
  Object.freeze({ label: "superfast", value: 4 }),
]);

export const PLANET_SHADOW_DEFAULT = false;

export function bindSpeedControl({
  button, initialValue = 1, lifetime, onChange, onError,
}) {
  let index = PLANET_SPEED_STATES.findIndex(({ value }) => value === initialValue);
  if (index < 0 || typeof button?.addEventListener !== "function" ||
      typeof lifetime?.onDispose !== "function" || typeof onChange !== "function" ||
      typeof onError !== "function") {
    throw new TypeError("Speed binding requires a known rate, button, lifetime, and callbacks.");
  }
  let enabled = false;
  function publish() {
    const selected = PLANET_SPEED_STATES[index];
    button.dataset.state = selected.label;
    button.setAttribute("aria-label", `Speed: ${selected.label}`);
    button.disabled = !enabled;
  }
  function change() {
    if (!enabled || lifetime.disposed) return;
    const next = (index + 1) % PLANET_SPEED_STATES.length;
    try {
      onChange(PLANET_SPEED_STATES[next].value);
      if (lifetime.disposed) return;
      index = next;
      publish();
    } catch (error) { onError(error); }
  }
  if (!lifetime.disposed) {
    button.addEventListener("click", change);
  }
  lifetime.onDispose(() => {
    enabled = false;
    button.removeEventListener("click", change);
    button.disabled = true;
  });
  if (!lifetime.disposed) publish();
  return Object.freeze({
    state() { return Object.freeze({ speed: PLANET_SPEED_STATES[index].value }); },
    setEnabled(value) {
      if (lifetime.disposed) return;
      enabled = value === true;
      publish();
    },
  });
}

export function createPlanetFeatureControls({
  stage,
  classes,
  lifetime,
  onError,
  onShadowsVisibilityChange = null,
}) {
  if (!(stage instanceof HTMLElement) || !classes ||
      typeof lifetime?.onDispose !== "function" || typeof onError !== "function") {
    throw new TypeError("Planet feature controls require a stage and prepared class bindings.");
  }
  const root = document.querySelector(".planet-settings");
  if (!(root instanceof HTMLElement)) throw new Error("Planet options block is missing.");
  const events = new AbortController();
  const settings = {
    rings: true,
    shadows: PLANET_SHADOW_DEFAULT,
    speed: 1,
  };
  let animations = Object.freeze([]);
  let destroyed = false;
  let speed = null;
  const toggleNames = ["rings"].filter((name) =>
    typeof classes[name] === "string" && classes[name].length > 0);
  lifetime.onDispose(destroy);
  if (lifetime.disposed) throw new Error("Planet feature controls require a live scene.");
  const shadowsInput = requiredInput("shadows");
  const speedButton = root.querySelector('button[name="speed"]');
  if (!(speedButton instanceof HTMLButtonElement)) throw new Error("Planet speed control is missing.");

  for (const name of toggleNames) {
    const input = requiredInput(name);
    input.checked = settings[name];
    stage.classList.toggle(classes[name], !settings[name]);
    input.addEventListener("change", () => {
      if (destroyed || lifetime.disposed) return;
      try {
        settings[name] = input.checked;
        stage.classList.toggle(classes[name], !input.checked);
      } catch (error) { onError(error); }
    }, { signal: events.signal });
  }
  shadowsInput.checked = settings.shadows;
  publishShadows();
  shadowsInput.addEventListener("change", () => {
    if (destroyed || lifetime.disposed) return;
    try {
      settings.shadows = shadowsInput.checked;
      publishShadows();
    } catch (error) { onError(error); }
  }, { signal: events.signal });
  speed = bindSpeedControl({
    button: speedButton, lifetime, onError,
    onChange(value) {
      for (const animation of animations) animation.playbackRate = value;
      settings.speed = value;
    },
  });

  return Object.freeze({
    state() {
      return Object.freeze({
        rings: settings.rings,
        shadows: settings.shadows,
      });
    },
    optionsState() { return Object.freeze({ speed: settings.speed }); },
    bindRuntime({ animations: nextAnimations }) {
      if (destroyed || lifetime.disposed) return;
      animations = Object.freeze([...nextAnimations]);
      for (const animation of animations) animation.playbackRate = settings.speed;
      onShadowsVisibilityChange?.(settings.shadows);
      speed.setEnabled(true);
    },
    destroy,
  });

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    events.abort();
    speed?.setEnabled(false);
    for (const name of toggleNames) stage.classList.remove(classes[name]);
    if (classes.shadows) stage.classList.remove(classes.shadows);
    animations = Object.freeze([]);
  }
  function requiredInput(name) {
    const input = root.querySelector(`input[name="${name}"][type="checkbox"]`);
    if (!(input instanceof HTMLInputElement)) throw new Error(`Planet ${name} control is missing.`);
    return input;
  }
  function publishShadows() {
    if (classes.shadows) {
      stage.classList.toggle(classes.shadows, !settings.shadows);
    }
    onShadowsVisibilityChange?.(settings.shadows);
  }
}
