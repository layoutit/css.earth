import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { updateSettingsPanel, updateShellElement } from '../navigation/navigation-shell-content.mts';

const toggle = (name: string) => `<label><input type="checkbox" name="${name}" form="object-settings-form"><span>${name}</span></label>`;
const speed = '<label><span>Speed</span><input type="range" name="speed" form="object-settings-form"></label>';
function panel(rows: string) {
  const { document } = parseHTML(`<section><h2 id="object-settings-title">Settings</h2><div class="object-settings">${rows}</div></section>`);
  return document.querySelector('section')!;
}

test('settings remove only unsupported controls and retain the rows that follow', () => {
  const earth = panel(toggle('motion') + speed + toggle('shadows') + toggle('surfaceLabels'));
  const identities = [...earth.querySelectorAll('input:not([name="speed"]), h2, .object-settings')];
  const previousSpeed = earth.querySelector('[name="speed"]');
  const lutetia = panel(toggle('motion') + toggle('shadows') + toggle('surfaceLabels'));
  updateSettingsPanel(earth, lutetia);
  assert.equal(earth.querySelector('[name="speed"]'), null);
  assert.equal(previousSpeed?.isConnected, false);
  assert.deepEqual([...earth.querySelectorAll('input, h2, .object-settings')], identities);
  updateSettingsPanel(earth, panel(toggle('motion') + speed + toggle('shadows') + toggle('surfaceLabels')));
  assert.deepEqual([...earth.querySelectorAll('input:not([name="speed"]), h2, .object-settings')], identities);
  assert.ok(earth.querySelector('[name="speed"]'));
});

test('settings follow authored order and replace only controls whose element kind changes', () => {
  const target = panel(toggle('motion') + '<button name="mode">Mode</button>' + toggle('shadows'));
  const motion = target.querySelector('[name="motion"]'), shadows = target.querySelector('[name="shadows"]');
  updateSettingsPanel(target, panel(toggle('motion') + toggle('mode') + toggle('shadows')));
  assert.equal(target.querySelector('[name="mode"]')?.tagName, 'INPUT');
  updateSettingsPanel(target, panel(toggle('shadows') + toggle('mode') + toggle('motion')));
  assert.deepEqual([...target.querySelectorAll('input')].map(node => node.name), ['shadows', 'mode', 'motion']);
  assert.equal(target.querySelector('[name="motion"]'), motion);
  assert.equal(target.querySelector('[name="shadows"]'), shadows);
});

test('Sources updates its link and text without replacing the link, spans or text nodes', () => {
  const link = (body: string, credit: string) => parseHTML(`<a href="/${body}/README.md"><span>${credit}</span><span>Sources</span></a>`).document.querySelector('a')!;
  const target = link('earth', 'NASA, JPL and 2 more');
  const spans = [...target.children], text = spans[0].firstChild;
  updateShellElement(target, link('lutetia', 'ESA, NASA, JPL and 1 more'));
  assert.equal(target.getAttribute('href'), '/lutetia/README.md');
  assert.deepEqual([...target.children], spans);
  assert.equal(spans[0].firstChild, text);
  assert.equal(text?.nodeValue, 'ESA, NASA, JPL and 1 more');
});
