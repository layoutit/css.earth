import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow, PlaybackState } from './browser-types.mts';
import type { ShellSettingsOptions } from './object-shell-types.mts';
import { requiredElement } from './browser-types.mts';

export function createSettingsController(
  documentTarget: Document,
  windowTarget: BrowserWindow,
  { motionEnabled, onMotionChange, heliosphereEnabled, onHeliosphereChange,
    illustrationModelsEnabled, onIllustrationModelsChange, surfaceLabelsEnabled, onSurfaceLabelsChange,
    minimapEnabled, onMinimapChange, threeDStarsEnabled, onThreeDStarsChange }: ShellSettingsOptions,
  lifetime: SceneLifetime,
) {
  if (typeof onMotionChange !== "function") {
    throw new TypeError("Object shell motion change handler must be a function.");
  }
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
  let motionOn = motionEnabled === true;
  for (const input of [motion, heliosphere, illustrationModels, surfaceLabels, minimap, threeDStars]) input.disabled = false;

  const renderMotion = () => {
    motion.checked = motionOn;
    if (speed) speed.disabled = !motionOn || speed.dataset?.runtimeReady === "false";
  };
  motion.addEventListener("change", () => {
    motionOn = motion.checked;
    renderMotion();
    onMotionChange(motionOn);
  }, { signal: events.signal });
  const bindToggle = (input: HTMLInputElement, enabled: boolean, onChange: (enabled: boolean) => void,
    { dataset, event }: { dataset?: string; event?: string } = {}) => {
    const render = () => {
      if (dataset) documentTarget.body.dataset[dataset] = input.checked ? 'on' : 'off';
    };
    input.checked = enabled === true;
    render();
    input.addEventListener('change', () => {
      render();
      if (event) documentTarget.body.dispatchEvent(new Event(event));
      onChange(input.checked);
    }, { signal: events.signal });
  };
  bindToggle(heliosphere, heliosphereEnabled, onHeliosphereChange);
  bindToggle(illustrationModels, illustrationModelsEnabled, onIllustrationModelsChange, { dataset: 'illustrationModels' });
  bindToggle(surfaceLabels, surfaceLabelsEnabled, onSurfaceLabelsChange,
    { dataset: 'surfaceLabels', event: 'objectsurfacelabelschange' });
  bindToggle(minimap, minimapEnabled, onMinimapChange, { dataset: 'minimap' });
  bindToggle(threeDStars, threeDStarsEnabled, onThreeDStarsChange);
  renderMotion();

  return Object.freeze({
    setMotionEnabled(next: boolean) {
      motionOn = next === true;
      renderMotion();
      onMotionChange(motionOn);
    },
    setPlaybackState({ motionRequested, reason }: PlaybackState) {
      motionOn = motionRequested === true;
      renderMotion();
      const row = motion.closest<HTMLElement>(".object-motion-setting-control")!;
      const explanation = requiredElement(row, ".object-motion-blocked");
      const blocked = motionOn && reason === "reduced-motion";
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
