import { requireObjectControls } from '../scene-contract.mjs';

const profiles = new WeakSet();
export const isObjectBrowserProfile = profile => profiles.has(profile);

// The profile supplies observations and user actions for the actual common
// runtime. Object files supply audit/source facts and declarative view mappings.
export function createObjectBrowserProfile({ id, inputSelector, audit, controls,
  independentLenses = [], visibleViews = [], cameraFields = ['pitch', 'zoom'] }) {
  requireObjectControls(controls, id);
  // Preserve the fields in an object's recorded audit without supplying a
  // private camera reader. All values come from the same shared orbit state.
  const supportedCameraFields = ['pitch', 'controlPitch', 'controlYaw', 'zoom'];
  if (!Array.isArray(cameraFields) || !cameraFields.includes('pitch') || !cameraFields.includes('zoom') ||
      new Set(cameraFields).size !== cameraFields.length || cameraFields.some(field => !supportedCameraFields.includes(field))) {
    throw new TypeError('Camera observation fields must use the shared orbit coordinates and include pitch and zoom.');
  }
  cameraFields = Object.freeze([...cameraFields]);
  const lensIds = controls.lenses?.controls.map(lens => lens.id) ?? [];
  for (const lens of independentLenses) {
    if (!lensIds.includes(lens.id) || typeof lens.selectionKey !== 'string') throw new TypeError('Independent lens mapping must use actual controls.');
  }
  for (const view of visibleViews) {
    if (!lensIds.includes(view.lensId) || typeof view.attribute !== 'string' || !view.attribute.startsWith('data-') || typeof view.value !== 'string') throw new TypeError('Visible view mapping must name a retained stage attribute and actual lens.');
  }
  const key = `__${id}`, defaultLens = controls.lenses?.defaultLens ?? null;
  const profile = Object.freeze({ id, inputSelector, audit, objectControls: controls,
    async waitForRuntime(page) {
      // Readiness is state, independent of whether a paused scene is painting.
      // Do not start a second browser waiter after that state is already true.
      if (await page.evaluate(key => window[key]?.ready === true, key)) return;
      await page.waitForFunction(key => window[key]?.ready === true, key);
    },
    pause: page => page.evaluate(() => {
      const input = document.querySelector('input[name="motion"]'); if (input.checked) input.click();
    }),
    playbackRunning: page => page.evaluate(key => window[key].runtime.playback().animations.some(animation => animation.running), key),
    camera: page => page.evaluate(({ key, fields }) => {
      const state = window[key].camera.state();
      return Object.fromEntries(fields.map(field => [field, state[field]]));
    }, { key, fields: cameraFields }),
    setCamera: (page, { pitch, controlPitch = pitch, controlYaw, zoom }) => page.evaluate(({ key, controlPitch, controlYaw, zoom }) =>
      window[key].camera.setState({ controlPitch, ...(controlYaw === undefined ? {} : { controlYaw }), zoom }),
    { key, controlPitch: pitch ?? controlPitch, controlYaw, zoom }),
    bounds: page => page.evaluate(key => {
      const stats = window[key].camera.stats();
      return { minimumPitch: stats.minimumPitchDegrees, maximumPitch: stats.maximumPitchDegrees,
        defaultPitch: stats.defaultControlPitchDegrees, pitchBounded: stats.pitchBounded,
        minimumZoom: stats.minimumZoom, maximumZoom: stats.maximumZoom, defaultZoom: stats.defaultZoom };
    }, key),
    stable: page => page.evaluate(key => window[key].assertStableDomIdentity(), key),
    runtimePresent: page => page.evaluate(key => typeof window[key] !== 'undefined', key),
    retainedImages: page => page.evaluate(key => window[key].runtime.resources().images.entries.filter(entry => entry.ready).length, key),
    selectedDensity: page => page.evaluate(key => window[key].renderStats.selectedPreparedDensity, key),
    selectLens: (page, lensId) => page.evaluate(async ({ key, lensId, independentLenses }) => {
      const runtime = window[key];
      for (const lens of independentLenses) {
        const enabled = runtime.runtime.selection().committed[lens.selectionKey];
        if (lens.id === lensId) return enabled ? true : runtime.lenses.select(lens.id);
        if (enabled) await runtime.lenses.select(lens.id);
      }
      return runtime.lenses.select(lensId);
    }, { key, lensId, independentLenses }),
    lens: page => page.evaluate(({ key, independentLenses }) => {
      const runtime = window[key], selection = runtime.runtime.selection().committed;
      const independent = independentLenses.find(lens => selection[lens.selectionKey]);
      return { ...runtime.lenses.state(), id: independent?.id ?? selection.lensId };
    }, { key, independentLenses }),
    visibleLens: page => page.locator('.planet-stage').evaluate((stage, { defaultLens, visibleViews }) =>
      visibleViews.find(view => stage.getAttribute(view.attribute) === view.value)?.lensId ?? stage.dataset.lens ?? defaultLens,
    { defaultLens, visibleViews }),
    pressedLens: page => page.evaluate(independentLenses => {
      const pressed = [...document.querySelectorAll('button[name="lens"][aria-pressed="true"]')].map(button => button.value);
      return independentLenses.find(lens => pressed.includes(lens.id))?.id ?? pressed[0] ?? null;
    }, independentLenses),
    retainedReport: page => page.evaluate(key => ({ initialNodeCount: window[key].dom.retainedInitialNodeCount,
      stableNodeCount: window[key].stableNodes.length }), key),
  });
  profiles.add(profile); return profile;
}
