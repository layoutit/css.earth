import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow, PlaybackState } from '../browser/browser-types.mts';
import type { WorldPreferences } from '../world/world-preferences.mts';
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
  // The switch of each preference. A page carries the switches that act on its body (ObjectShell.astro): rotation,
  // light curves and surface labels come and go with the scene, so each is read where it is used. The heliosphere and
  // the illustration models are on the map of every page.
  const switches = { motionEnabled: '.object-motion-setting', lightCurvesEnabled: '.object-light-curves-setting',
    heliosphereEnabled: '.object-heliosphere-setting', illustrationModelsEnabled: '.object-illustration-models-setting',
    surfaceLabelsEnabled: '.object-surface-labels-setting' } as const;
  type Toggle = keyof typeof switches;
  const toggles = Object.keys(switches) as Toggle[];
  const everyPage: readonly Toggle[] = ['heliosphereEnabled', 'illustrationModelsEnabled'];
  const input = (key: Toggle) => {
    const found = panel.querySelector(switches[key]);
    if (found === null ? everyPage.includes(key) : !(found instanceof windowTarget.HTMLInputElement)) throw new Error("Object shell settings controls are incomplete.");
    return found as HTMLInputElement | null;
  };
  let speed = panel.querySelector<HTMLInputElement>(
    '.object-speed-setting[type="range"][name="speed"]',
  );
  if (speed !== null && !(speed instanceof windowTarget.HTMLInputElement)) throw new Error("Object shell settings controls are incomplete.");
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  // Every control applies as it changes, so the form's submit button (for a page without script) leaves the panel while
  // this controller runs it: it sat under the live toggles as "Apply settings" (2026-10-01).
  // It stays off: the next scene's controller takes over the same panel, and a page without script never ran this.
  panel.querySelector('.object-settings-submit')?.remove();
  const opening = (event: Event) => {
    if (!(event.target instanceof windowTarget.Element) || !event.target.closest(`[popovertarget="${panel.id}"]`)) return;
    showSection(panel, true);
    // A body arrived at in the session brings the button back with its page's panel: it showed again under the toggles
    // on TRAPPIST-1e opened from its system (2026-10-02).
    panel.querySelector('.object-settings-submit')?.remove();
  };
  documentTarget.addEventListener('click', opening, { capture: true, signal: events.signal });
  panel.addEventListener('toggle', event => { if ((event as ToggleEvent).newState === 'closed') showSection(panel, false); }, { signal: events.signal });
  // The gear shows its open panel as its own `aria-expanded`, which its pressed look reads: it comes before the panel, so
  // no selector reaches it from there. `beforetoggle` runs in the task that opens or closes the panel.
  const gear = documentTarget.querySelector(`[popovertarget="${panel.id}"]`);
  const expand = (open: boolean) => { if (gear?.getAttribute('aria-expanded') !== String(open)) gear?.setAttribute('aria-expanded', String(open)); };
  panel.addEventListener('beforetoggle', event => expand((event as ToggleEvent).newState === 'open'), { signal: events.signal });
  // The shell starts before anyone can open the panel. A panel left open by the scene before leaves the page here
  // without an event, so the gear is told.
  showSection(panel, false);
  expand(false);
  lifetime.onDispose(() => showSection(panel, true));
  const render = () => {
    for (const key of toggles) {
      const control = input(key);
      if (control && control.checked !== preferences.state[key]) control.checked = preferences.state[key];
    }
    const speedDisabled = !preferences.state.motionEnabled || speed?.dataset.runtimeReady === 'false';
    if (speed && speed.disabled !== speedDisabled) speed.disabled = speedDisabled;
    const illustrations = preferences.state.illustrationModelsEnabled ? 'on' : 'off', labels = preferences.state.surfaceLabelsEnabled ? 'on' : 'off';
    if (documentTarget.body.dataset.illustrationModels !== illustrations) documentTarget.body.dataset.illustrationModels = illustrations;
    if (documentTarget.body.dataset.surfaceLabels !== labels) documentTarget.body.dataset.surfaceLabels = labels;
  };
  // The switches are served disabled, and one that arrives with a body's page is too: each is enabled where it is found.
  const enable = () => { for (const key of toggles) { const control = input(key); if (control?.disabled) control.disabled = false; } };
  enable();
  // One listener on the panel hears every switch, whichever page brought it.
  panel.addEventListener('change', event => {
    const key = toggles.find(key => event.target === input(key));
    if (key) preferences.set(key, (event.target as HTMLInputElement).checked);
  }, { signal: events.signal });
  lifetime.onDispose(preferences.subscribe(key => {
    render();
    if (key === 'surfaceLabelsEnabled') documentTarget.body.dispatchEvent(new windowTarget.Event('objectsurfacelabelschange'));
  }));
  render();

  // The last published reason: a rotation switch that arrives with a body's page is told why it is paused.
  let playbackReason: PlaybackState['reason'] | null = null;
  const explain = () => {
    const motion = input('motionEnabled');
    if (!motion || playbackReason === null) return;
    const row = motion.closest<HTMLElement>(".object-motion-setting-control")!;
    const explanation = requiredElement(row, ".object-motion-blocked");
    const blocked = preferences.state.motionEnabled && playbackReason === "reduced-motion";
    if (row.dataset.motionBlocked !== String(blocked)) row.dataset.motionBlocked = String(blocked);
    if (explanation.hidden !== !blocked) explanation.hidden = !blocked;
    const descriptions = new Set((motion.getAttribute("aria-describedby") ?? "")
      .split(/\s+/u).filter(id => id && id !== explanation.id));
    if (blocked) descriptions.add(explanation.id);
    const description = [...descriptions].join(' ');
    if (description) {
      if (motion.getAttribute('aria-describedby') !== description) motion.setAttribute('aria-describedby', description);
    } else if (motion.hasAttribute('aria-describedby')) motion.removeAttribute('aria-describedby');
  };
  return Object.freeze({
    bindObject() {
      const next = panel.querySelector('.object-speed-setting[type="range"][name="speed"]');
      if (next !== null && !(next instanceof windowTarget.HTMLInputElement)) throw new Error('Object speed control is invalid.');
      speed = next;
      enable();
      render();
      explain();
    },
    setPlaybackState({ reason }: PlaybackState) {
      playbackReason = reason;
      render();
      explain();
    },
    destroy() {
      events.abort();
      for (const key of toggles) { const control = input(key); if (control) control.disabled = true; }
      delete documentTarget.body.dataset.surfaceLabels;
    },
  });
}
