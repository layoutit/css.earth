import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow, PlaybackState } from '../browser/browser-types.mts';
import type { WorldPreferences } from '../world-preferences.mts';
import { requiredElement, requiredSection } from '../browser/browser-types.mts';
import { showSection } from '@cssearth/renderer';

export function createSettingsController(
  documentTarget: Document,
  windowTarget: BrowserWindow,
  preferences: WorldPreferences,
  lifetime: SceneLifetime,
) {
  // The panel is mounted only while it is open: the gear mounts it just before its popover opens, and closing takes it off
  // the page again (detached-sections.ts). The server renders it mounted, so the gear works without JavaScript.
  const panel = requiredSection(documentTarget, '.object-settings-panel');
  const motion = panel.querySelector(".object-motion-setting");
  const lightCurves = panel.querySelector(".object-light-curves-setting");
  const heliosphere = panel.querySelector(".object-heliosphere-setting");
  const illustrationModels = panel.querySelector(".object-illustration-models-setting");
  const surfaceLabels = panel.querySelector(".object-surface-labels-setting");
  let speed = panel.querySelector<HTMLInputElement>(
    '.object-speed-setting[type="range"][name="speed"]',
  );
  if (!(motion instanceof windowTarget.HTMLInputElement) || !(lightCurves instanceof windowTarget.HTMLInputElement) ||
      !(heliosphere instanceof windowTarget.HTMLInputElement) ||
      !(illustrationModels instanceof windowTarget.HTMLInputElement) ||
      !(surfaceLabels instanceof windowTarget.HTMLInputElement) ||
      (speed !== null && !(speed instanceof windowTarget.HTMLInputElement))) {
    throw new Error("Object shell settings controls are incomplete.");
  }
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  const opening = (event: Event) => {
    if (event.target instanceof windowTarget.Element && event.target.closest(`[popovertarget="${panel.id}"]`)) showSection(panel, true);
  };
  documentTarget.addEventListener('click', opening, { capture: true, signal: events.signal });
  panel.addEventListener('toggle', event => { if ((event as ToggleEvent).newState === 'closed') showSection(panel, false); }, { signal: events.signal });
  if (!panel.matches(':popover-open')) showSection(panel, false);
  lifetime.onDispose(() => showSection(panel, true));
  const inputs = { motionEnabled: motion, lightCurvesEnabled: lightCurves, heliosphereEnabled: heliosphere,
    illustrationModelsEnabled: illustrationModels, surfaceLabelsEnabled: surfaceLabels };
  type Toggle = keyof typeof inputs;
  const render = () => {
    for (const key of Object.keys(inputs) as Toggle[]) {
      if (inputs[key].checked !== preferences.state[key]) inputs[key].checked = preferences.state[key];
    }
    const speedDisabled = !preferences.state.motionEnabled || speed?.dataset.runtimeReady === 'false';
    if (speed && speed.disabled !== speedDisabled) speed.disabled = speedDisabled;
    const illustrations = illustrationModels.checked ? 'on' : 'off', labels = surfaceLabels.checked ? 'on' : 'off';
    if (documentTarget.body.dataset.illustrationModels !== illustrations) documentTarget.body.dataset.illustrationModels = illustrations;
    if (documentTarget.body.dataset.surfaceLabels !== labels) documentTarget.body.dataset.surfaceLabels = labels;
  };
  for (const key of Object.keys(inputs) as Toggle[]) {
    const input = inputs[key];
    if (input.disabled) input.disabled = false;
    input.addEventListener('change', () => preferences.set(key, input.checked), { signal: events.signal });
  }
  lifetime.onDispose(preferences.subscribe(key => {
    render();
    if (key === 'surfaceLabelsEnabled') documentTarget.body.dispatchEvent(new windowTarget.Event('objectsurfacelabelschange'));
  }));
  render();

  const row = motion.closest<HTMLElement>(".object-motion-setting-control")!;
  const explanation = requiredElement(row, ".object-motion-blocked");
  return Object.freeze({
    bindObject() {
      const next = panel.querySelector('.object-speed-setting[type="range"][name="speed"]');
      if (next !== null && !(next instanceof windowTarget.HTMLInputElement)) throw new Error('Object speed control is invalid.');
      speed = next;
      render();
    },
    setPlaybackState({ reason }: PlaybackState) {
      render();
      const blocked = preferences.state.motionEnabled && reason === "reduced-motion";
      if (row.dataset.motionBlocked !== String(blocked)) row.dataset.motionBlocked = String(blocked);
      if (explanation.hidden !== !blocked) explanation.hidden = !blocked;
      const descriptions = new Set((motion.getAttribute("aria-describedby") ?? "")
        .split(/\s+/u).filter(id => id && id !== explanation.id));
      if (blocked) descriptions.add(explanation.id);
      const description = [...descriptions].join(' ');
      if (description) {
        if (motion.getAttribute('aria-describedby') !== description) motion.setAttribute('aria-describedby', description);
      } else if (motion.hasAttribute('aria-describedby')) motion.removeAttribute('aria-describedby');
    },
    destroy() {
      events.abort();
      for (const input of [motion, lightCurves, heliosphere, illustrationModels, surfaceLabels]) input.disabled = true;
      delete documentTarget.body.dataset.surfaceLabels;
    },
  });
}
