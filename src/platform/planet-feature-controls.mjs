export const PLANET_SPEED_STATES = Object.freeze([
  Object.freeze({ label: "off", value: 0 }),
  Object.freeze({ label: "normal", value: 1 }),
  Object.freeze({ label: "fast", value: 2 }),
  Object.freeze({ label: "fastest", value: 3 }),
  Object.freeze({ label: "superfast", value: 4 }),
]);

export const PLANET_SHADOW_DEFAULT = false;

export function createPlanetFeatureControls({
  stage,
  classes,
  onShadowsVisibilityChange = null,
}) {
  if (!(stage instanceof HTMLElement) || !classes) {
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
  const shadowsInput = requiredInput("shadows");
  const speedButton = root.querySelector('button[name="speed"]');
  if (!(speedButton instanceof HTMLButtonElement)) throw new Error("Planet speed control is missing.");

  const toggleNames = ["rings"].filter((name) =>
    typeof classes[name] === "string" && classes[name].length > 0);
  for (const name of toggleNames) {
    const input = requiredInput(name);
    input.checked = settings[name];
    stage.classList.toggle(classes[name], !settings[name]);
    input.addEventListener("change", () => {
      settings[name] = input.checked;
      stage.classList.toggle(classes[name], !input.checked);
    }, { signal: events.signal });
  }
  shadowsInput.checked = settings.shadows;
  publishShadows();
  shadowsInput.addEventListener("change", () => {
    settings.shadows = shadowsInput.checked;
    publishShadows();
  }, { signal: events.signal });
  let speedIndex = PLANET_SPEED_STATES.findIndex(({ value }) => value === settings.speed);
  publishSpeed();
  speedButton.addEventListener("click", () => {
    speedIndex = (speedIndex + 1) % PLANET_SPEED_STATES.length;
    settings.speed = PLANET_SPEED_STATES[speedIndex].value;
    publishSpeed();
    for (const animation of animations) animation.playbackRate = settings.speed;
  }, { signal: events.signal });

  return Object.freeze({
    state() {
      return Object.freeze({
        rings: settings.rings,
        shadows: settings.shadows,
      });
    },
    optionsState() { return Object.freeze({ speed: settings.speed }); },
    bindRuntime({ animations: nextAnimations }) {
      animations = Object.freeze([...nextAnimations]);
      for (const animation of animations) animation.playbackRate = settings.speed;
      onShadowsVisibilityChange?.(settings.shadows);
    },
    destroy() {
      events.abort();
      for (const name of toggleNames) {
        stage.classList.remove(classes[name]);
      }
      if (classes.shadows) stage.classList.remove(classes.shadows);
      for (const animation of animations) animation.playbackRate = 1;
      animations = Object.freeze([]);
    },
  });

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
  function publishSpeed() {
    const state = PLANET_SPEED_STATES[speedIndex];
    speedButton.dataset.state = state.label;
    speedButton.setAttribute("aria-label", `Speed: ${state.label}`);
  }
}
