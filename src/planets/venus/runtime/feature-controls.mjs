export function createVenusFeatureControls({
  stage,
  onShadowsVisibilityChange = null,
}) {
  const settings = {
    atmosphere: true,
    shadows: false,
    stars: true,
    speed: 1,
  };
  const root = document.querySelector(".planet-settings");
  if (!(root instanceof HTMLElement)) {
    throw new Error("Venus options block is missing.");
  }
  const events = new AbortController();
  let animations = Object.freeze([]);
  const featureBindings = Object.freeze([
    Object.freeze({ name: "atmosphere", hiddenClass: "venus-hide-atmosphere" }),
    Object.freeze({ name: "stars", hiddenClass: "venus-hide-stars" }),
  ]);
  for (const { name, hiddenClass } of featureBindings) {
    const input = root.querySelector(`input[name="${name}"][type="checkbox"]`);
    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Venus ${name} control is missing.`);
    }
    input.checked = settings[name];
    input.addEventListener("change", () => {
      settings[name] = input.checked;
      stage.classList.toggle(hiddenClass, !input.checked);
    }, { signal: events.signal });
  }
  const shadows = root.querySelector('input[name="shadows"][type="checkbox"]');
  if (!(shadows instanceof HTMLInputElement)) {
    throw new Error("Venus shadows control is missing.");
  }
  shadows.checked = false;
  shadows.addEventListener("change", () => {
    settings.shadows = shadows.checked;
    onShadowsVisibilityChange?.(settings.shadows);
  }, { signal: events.signal });
  const speed = root.querySelector('button[name="speed"]');
  if (!(speed instanceof HTMLButtonElement)) {
    throw new Error("Venus speed control is missing.");
  }
  const states = Object.freeze([
    Object.freeze({ label: "off", value: 0 }),
    Object.freeze({ label: "normal", value: 1 }),
    Object.freeze({ label: "fast", value: 2 }),
    Object.freeze({ label: "fastest", value: 3 }),
    Object.freeze({ label: "superfast", value: 4 }),
  ]);
  let stateIndex = 1;
  publishSpeed();
  speed.addEventListener("click", () => {
    stateIndex = (stateIndex + 1) % states.length;
    settings.speed = states[stateIndex].value;
    publishSpeed();
    for (const animation of animations) animation.playbackRate = settings.speed;
  }, { signal: events.signal });

  return Object.freeze({
    state() {
      return Object.freeze({
        atmosphere: settings.atmosphere,
        shadows: settings.shadows,
        stars: settings.stars,
      });
    },
    optionsState() {
      return Object.freeze({ speed: settings.speed });
    },
    bindRuntime(runtime) {
      animations = runtime.animations;
      for (const animation of animations) animation.playbackRate = settings.speed;
      onShadowsVisibilityChange?.(settings.shadows);
    },
    destroy() {
      for (const { hiddenClass } of featureBindings) stage.classList.remove(hiddenClass);
      for (const animation of animations) animation.playbackRate = 1;
      events.abort();
      animations = Object.freeze([]);
    },
  });

  function publishSpeed() {
    const state = states[stateIndex];
    speed.dataset.state = state.label;
    speed.setAttribute("aria-label", `Speed: ${state.label}`);
  }
}
