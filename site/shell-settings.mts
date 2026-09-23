import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow, PlaybackState } from './browser-types.mts';
import type { WorldPreferences } from './world-preferences.mts';
import { requiredElement } from './browser-types.mts';

export function createSettingsController(
  documentTarget: Document,
  windowTarget: BrowserWindow,
  preferences: WorldPreferences,
  lifetime: SceneLifetime,
) {
  const motion = documentTarget.querySelector(".object-motion-setting");
  const heliosphere = documentTarget.querySelector(".object-heliosphere-setting");
  const illustrationModels = documentTarget.querySelector(".object-illustration-models-setting");
  const surfaceLabels = documentTarget.querySelector(".object-surface-labels-setting");
  const minimap = documentTarget.querySelector(".object-minimap-setting");
  const threeDStars = documentTarget.querySelector(".object-three-d-stars-setting");
  const speed = documentTarget.querySelector(
    '.object-speed-setting[type="range"][name="speed"]',
  );
  if (!(motion instanceof windowTarget.HTMLInputElement) ||
      !(heliosphere instanceof windowTarget.HTMLInputElement) ||
      !(illustrationModels instanceof windowTarget.HTMLInputElement) ||
      !(surfaceLabels instanceof windowTarget.HTMLInputElement) ||
      !(minimap instanceof windowTarget.HTMLInputElement) ||
      !(threeDStars instanceof windowTarget.HTMLInputElement) ||
      (speed !== null && !(speed instanceof windowTarget.HTMLInputElement))) {
    throw new Error("Object shell settings controls are incomplete.");
  }
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  const inputs = { motionEnabled: motion, heliosphereEnabled: heliosphere,
    illustrationModelsEnabled: illustrationModels, surfaceLabelsEnabled: surfaceLabels,
    minimapEnabled: minimap, threeDStarsEnabled: threeDStars };
  type Toggle = keyof typeof inputs;
  const render = () => {
    for (const key of Object.keys(inputs) as Toggle[]) inputs[key].checked = preferences.state[key];
    if (speed) speed.disabled = !preferences.state.motionEnabled || speed.dataset?.runtimeReady === 'false';
    documentTarget.body.dataset.illustrationModels = illustrationModels.checked ? 'on' : 'off';
    documentTarget.body.dataset.surfaceLabels = surfaceLabels.checked ? 'on' : 'off';
    documentTarget.body.dataset.minimap = minimap.checked ? 'on' : 'off';
  };
  for (const key of Object.keys(inputs) as Toggle[]) {
    const input = inputs[key];
    input.disabled = false;
    input.addEventListener('change', () => preferences.set(key, input.checked), { signal: events.signal });
  }
  lifetime.onDispose(preferences.subscribe(key => {
    render();
    if (key === 'surfaceLabelsEnabled') documentTarget.body.dispatchEvent(new Event('objectsurfacelabelschange'));
  }));
  render();

  return Object.freeze({
    setPlaybackState({ reason }: PlaybackState) {
      render();
      const row = motion.closest<HTMLElement>(".object-motion-setting-control")!;
      const explanation = requiredElement(row, ".object-motion-blocked");
      const blocked = preferences.state.motionEnabled && reason === "reduced-motion";
      row.dataset.motionBlocked = String(blocked);
      explanation.hidden = !blocked;
      const descriptions = new Set((motion.getAttribute("aria-describedby") ?? "")
        .split(/\s+/u).filter(id => id && id !== explanation.id));
      if (blocked) descriptions.add(explanation.id);
      if (descriptions.size) motion.setAttribute("aria-describedby", [...descriptions].join(" "));
      else motion.removeAttribute("aria-describedby");
    },
    destroy() {
      events.abort();
      for (const input of [motion, heliosphere, illustrationModels, surfaceLabels, minimap, threeDStars]) input.disabled = true;
      delete documentTarget.body.dataset.surfaceLabels;
    },
  });
}
