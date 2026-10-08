import { SHELL_SETTING_NAMES } from '@cssearth/objects';

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { parseHTML } from 'linkedom';
import { createSceneLifetime } from '@cssearth/engine';
import { createSettingsController } from './shell-settings.mts';
import { createWorldPreferences } from '../world/world-preferences.mts';
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
  motion.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(preferences.state.motionEnabled, false, 'the retained listener still controls motion');
  assert.equal(find<HTMLInputElement>(document, '[name="speed"]')!.disabled, true);
  controller.destroy(); lifetime.destroy();
});

// What a page's panel carries follows its body (ObjectShell.astro): a galaxy has only the two switches of the shared map.
const pageMarkup = (rows: { motion?: boolean; lightCurves?: boolean; surfaceLabels?: boolean }) => `<section id="object-settings" class="object-settings-panel" popover="auto"><h2>Settings</h2><div class="object-settings">
  ${rows.motion ? `<label class="object-motion-setting-control"><input class="object-motion-setting" name="motion" type="checkbox" disabled>
    <span id="motion-blocked" class="object-motion-blocked" hidden>Reduced motion</span></label>` : ''}
  ${rows.lightCurves ? '<label><input class="object-light-curves-setting" name="lightCurves" type="checkbox" checked disabled></label>' : ''}
  ${rows.surfaceLabels ? '<label><input class="object-surface-labels-setting" name="surfaceLabels" type="checkbox" disabled></label>' : ''}
  <label><input class="object-heliosphere-setting" name="heliosphere" type="checkbox" disabled></label>
  <label><input class="object-illustration-models-setting" name="illustrationModels" type="checkbox" disabled></label>
</div></section>`;

test('a switch that arrives with a body is enabled, shows the kept preference and sets it; one that leaves takes nothing with it', () => {
  const { document, window } = parseHTML(`<html><body>${pageMarkup({})}</body></html>`);
  const lifetime = createSceneLifetime();
  const preferences = createWorldPreferences({ getWorld: () => null, onMotionChange() {} });
  const controller = createSettingsController(document, window as unknown as BrowserWindow, preferences, lifetime);
  const panel = find(document, 'section')!;
  const names = () => [...panel.querySelectorAll('input')].map(input => input.name);
  const arrive = (rows: Parameters<typeof pageMarkup>[0]) => { updateSettingsPanel(panel, parseHTML(pageMarkup(rows)).document.querySelector('section')!); controller.bindObject(); };
  assert.deepEqual(names(), ['heliosphere', 'illustrationModels']);
  assert.equal(find<HTMLInputElement>(document, '[name="heliosphere"]')!.disabled, false);
  controller.setPlaybackState({ allowed: false, reason: 'reduced-motion' });
  preferences.set('motionEnabled', true);
  preferences.set('lightCurvesEnabled', false);

  arrive({ motion: true, surfaceLabels: true });
  assert.deepEqual(names(), ['motion', 'surfaceLabels', 'heliosphere', 'illustrationModels']);
  const motion = find<HTMLInputElement>(document, '[name="motion"]')!, labels = find<HTMLInputElement>(document, '[name="surfaceLabels"]')!;
  assert.equal(motion.disabled, false); assert.equal(motion.checked, true, 'rotation was turned on before this body');
  assert.equal(motion.getAttribute('aria-describedby'), 'motion-blocked', 'the arriving switch is told why it is paused');
  assert.equal(labels.disabled, false); assert.equal(labels.checked, false);
  labels.checked = true; labels.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(preferences.state.surfaceLabelsEnabled, true);
  assert.equal(document.body.dataset.surfaceLabels, 'on');

  arrive({ lightCurves: true });
  assert.deepEqual(names(), ['lightCurves', 'heliosphere', 'illustrationModels']);
  const light = find<HTMLInputElement>(document, '[name="lightCurves"]')!;
  assert.equal(light.disabled, false); assert.equal(light.checked, false, 'light curves were turned off before this star');
  assert.equal(preferences.state.motionEnabled, true); assert.equal(preferences.state.surfaceLabelsEnabled, true);
  assert.equal(document.body.dataset.surfaceLabels, 'on', 'the preference outlives its switch');

  arrive({ motion: true, surfaceLabels: true });
  const again = find<HTMLInputElement>(document, '[name="surfaceLabels"]')!;
  assert.notEqual(again, labels, 'the switch is a new element'); assert.equal(again.checked, true);
  again.checked = false; again.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(preferences.state.surfaceLabelsEnabled, false, 'the new element is listened to');
  controller.destroy(); lifetime.destroy();
  assert.equal(again.disabled, true);
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
  light.checked = false; light.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(preferences.state.lightCurvesEnabled, false); assert.equal(preferences.state.motionEnabled, false);
  assert.deepEqual(changes, ['playback'], 'the switch republishes playback');
  lifetime.destroy();
});

test('the gear carries its open panel as aria-expanded, and a new scene starts it closed', () => {
  const { document, window } = parseHTML(`<html><body><button class="object-settings-action" popovertarget="object-settings" aria-expanded="true"></button>${settingsMarkup(false)}</body></html>`);
  const lifetime = createSceneLifetime();
  const preferences = createWorldPreferences({ getWorld: () => null, onMotionChange() {} });
  createSettingsController(document, window as unknown as BrowserWindow, preferences, lifetime);
  const gear = document.querySelector('.object-settings-action')!, panel = find(document, 'section')!;
  assert.equal(gear.getAttribute('aria-expanded'), 'false', 'the scene before left the panel open');
  const toggle = (newState: string) => panel.dispatchEvent(Object.assign(new window.Event('beforetoggle'), { newState }));
  toggle('open'); assert.equal(gear.getAttribute('aria-expanded'), 'true');
  toggle('closed'); assert.equal(gear.getAttribute('aria-expanded'), 'false');
  lifetime.destroy();
});
