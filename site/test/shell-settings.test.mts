import { SHELL_SETTING_NAMES } from '@cssearth/objects';

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { parseHTML } from 'linkedom';
import { createSceneLifetime } from '@cssearth/engine';
import { createSettingsController } from '../shell/shell-settings.mts';
import { createWorldPreferences } from '../world-preferences.mts';
import { updateSettingsPanel } from '../navigation/navigation-shell-content.mts';
import { setLinkSelected, type BrowserWindow } from '../browser/browser-types.mts';
import { sectionElements } from '@cssearth/renderer';
// A closed settings panel waits off the page (shell-settings.mts); its inputs are found where they wait.
const find = <T extends Element>(document: Document, selector: string) => sectionElements<T & HTMLElement>(document, selector)[0] ?? null;

test('the shell-owned setting names are exactly the setting inputs the shared shell renders', () => {
  const shell = readFileSync(new URL('../components/ObjectShell.astro', import.meta.url), 'utf8');
  const rendered = [...shell.matchAll(/<input class="object-[a-z-]+-setting"[^>]*\bname="([A-Za-z]+)"/gu)].map(match => match[1]);
  assert.ok(rendered.length > 0, 'the shell renders its setting inputs');
  assert.deepEqual(new Set(rendered), SHELL_SETTING_NAMES);
});

const settingsMarkup = (speed: boolean) => `<section id="object-settings" class="object-settings-panel" popover="auto"><h2>Settings</h2><div class="object-settings">
  <label class="object-motion-setting-control"><input class="object-motion-setting" name="motion" type="checkbox" disabled>
    <span id="motion-blocked" class="object-motion-blocked" hidden>Reduced motion</span></label>
  <label><input class="object-light-curves-setting" name="lightCurves" type="checkbox" checked disabled></label>
  ${speed ? '<label><input class="object-speed-setting" name="speed" type="range" disabled></label>' : ''}
  <label><input class="object-heliosphere-setting" name="heliosphere" type="checkbox" disabled></label>
  <label><input class="object-illustration-models-setting" name="illustrationModels" type="checkbox" disabled></label>
  <label><input class="object-surface-labels-setting" name="surfaceLabels" type="checkbox" disabled></label>
</div></section>`;

test('shared settings retain user state and listeners while object Speed comes and goes', () => {
  const { document, window } = parseHTML(`<html><body>${settingsMarkup(true)}</body></html>`);
  const lifetime = createSceneLifetime();
  const preferences = createWorldPreferences({ getWorld: () => null, onMotionChange() {} });
  const controller = createSettingsController(document, window as unknown as BrowserWindow, preferences, lifetime);
  preferences.set('motionEnabled', true);
  preferences.set('surfaceLabelsEnabled', true);
  controller.setPlaybackState({ allowed: false, reason: 'reduced-motion' });
  const motion = find<HTMLInputElement>(document, '[name="motion"]')!;
  const labels = find<HTMLInputElement>(document, '[name="surfaceLabels"]')!;
  const panel = find(document, 'section')!;
  for (const speed of [false, true]) {
    const incoming = parseHTML(settingsMarkup(speed)).document.querySelector('section')!;
    updateSettingsPanel(panel, incoming);
    controller.bindObject();
    assert.equal(find(document, '[name="motion"]'), motion);
    assert.equal(find(document, '[name="surfaceLabels"]'), labels);
    assert.equal(motion.checked, true);
    assert.equal(motion.disabled, false);
    assert.equal(labels.checked, true);
    assert.equal(document.body.dataset.surfaceLabels, 'on');
    assert.equal(motion.getAttribute('aria-describedby'), 'motion-blocked');
    const currentSpeed = find<HTMLInputElement>(document, '[name="speed"]');
    assert.equal(Boolean(currentSpeed), speed);
    if (currentSpeed) assert.equal(currentSpeed.disabled, false);
  }
  motion.checked = false;
  motion.dispatchEvent(new window.Event('change'));
  assert.equal(preferences.state.motionEnabled, false, 'the retained listener still controls motion');
  assert.equal(find<HTMLInputElement>(document, '[name="speed"]')!.disabled, true);
  controller.destroy(); lifetime.destroy();
});

test('repeated playback publication leaves the settings DOM untouched', async () => {
  const { document, window } = parseHTML(`<html><body>${settingsMarkup(true)}</body></html>`);
  const lifetime = createSceneLifetime();
  const preferences = createWorldPreferences({ getWorld: () => null, onMotionChange() {} });
  const controller = createSettingsController(document, window as unknown as BrowserWindow, preferences, lifetime);
  const state = { allowed: false, reason: 'motion-off' };
  controller.setPlaybackState(state);
  const changes: MutationRecord[] = [];
  const observer = new window.MutationObserver(records => changes.push(...records));
  observer.observe(document.body, { attributes: true, subtree: true, childList: true });
  controller.setPlaybackState(state); controller.setPlaybackState(state);
  await Promise.resolve();
  assert.deepEqual(changes, []);
  observer.disconnect(); controller.destroy(); lifetime.destroy();
});

test('selection refresh changes only links whose selection changes', async () => {
  const { document, window } = parseHTML('<html><body><a class="object-link"></a></body></html>');
  const link = find(document, 'a')!;
  const changes: MutationRecord[] = [];
  const observer = new window.MutationObserver(records => changes.push(...records));
  observer.observe(link, { attributes: true });
  setLinkSelected(link, false); setLinkSelected(link, false);
  await Promise.resolve(); assert.deepEqual(changes, []);
  setLinkSelected(link, true);
  await Promise.resolve(); assert.ok(changes.length > 0);
  assert.equal(link.getAttribute('aria-current'), 'page');
  changes.length = 0;
  setLinkSelected(link, true); setLinkSelected(link, true);
  await Promise.resolve(); assert.deepEqual(changes, []);
  setLinkSelected(link, false);
  assert.equal(link.hasAttribute('aria-current'), false);
  assert.equal(link.classList.contains('is-active'), false);
  observer.disconnect();
});

test('Light curves is on by default and is its own preference, apart from illustrative rotation', () => {
  const { document, window } = parseHTML(`<html><body>${settingsMarkup(false)}</body></html>`);
  const lifetime = createSceneLifetime(), changes: string[] = [];
  const preferences = createWorldPreferences({ getWorld: () => null, onMotionChange() { changes.push('playback'); } });
  createSettingsController(document, window as unknown as BrowserWindow, preferences, lifetime);
  const light = find<HTMLInputElement>(document, '[name="lightCurves"]')!, motion = find<HTMLInputElement>(document, '[name="motion"]')!;
  assert.equal(preferences.state.lightCurvesEnabled, true); assert.equal(light.checked, true); assert.equal(motion.checked, false);
  light.checked = false; light.dispatchEvent(new window.Event('change'));
  assert.equal(preferences.state.lightCurvesEnabled, false); assert.equal(preferences.state.motionEnabled, false);
  assert.deepEqual(changes, ['playback'], 'the switch republishes playback');
  lifetime.destroy();
});
