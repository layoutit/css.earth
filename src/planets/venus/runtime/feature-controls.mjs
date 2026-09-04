import { bindSpeedControl } from "../../../platform/planet-feature-controls.mjs";

export function createVenusFeatureControls({
  stage,
  lifetime,
  onError,
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
  lifetime.onDispose(() => events.abort());
  let animations = Object.freeze([]);
  lifetime.onDispose(() => { animations = Object.freeze([]); });
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
    try {
      onShadowsVisibilityChange?.(shadows.checked);
      settings.shadows = shadows.checked;
    } catch (error) { onError(error); }
  }, { signal: events.signal });
  const speed = root.querySelector('button[name="speed"]');
  if (!(speed instanceof HTMLButtonElement)) {
    throw new Error("Venus speed control is missing.");
  }
  const speedControl = bindSpeedControl({
    button: speed, lifetime, onError,
    onChange(value) {
      for (const animation of animations) animation.playbackRate = value;
      settings.speed = value;
    },
  });
  for (const { hiddenClass } of featureBindings) {
    lifetime.onDispose(() => stage.classList.remove(hiddenClass));
  }

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
      if (lifetime.disposed) return;
      animations = runtime.animations;
      for (const animation of animations) animation.playbackRate = settings.speed;
      onShadowsVisibilityChange?.(settings.shadows);
      speedControl.setEnabled(true);
    },
  });
}
