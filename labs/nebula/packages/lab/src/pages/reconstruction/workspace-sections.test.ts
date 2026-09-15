import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceSections, type WorkspaceCapabilities } from './workspace-sections';

const render = (capabilities: WorkspaceCapabilities) => renderToStaticMarkup(createElement(WorkspaceSections, {
  active: 'compiler', capabilities, onChange() {},
}));
const buttons = (markup: string) => [...markup.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)].map(match => ({ attributes: match[1]!, label: match[2]! }));
const ids = ['compiler', 'sources', 'structure', 'combined', 'kinematics', 'joint', 'volume'];

test('all workspaces show the same ordered sections regardless of available capabilities', () => {
  for (const capabilities of [{ compiler: true }, { compiler: true, structure: true, combined: true },
    { compiler: true, sources: true, structure: true, combined: true, kinematics: true, joint: true, volume: true }, {}]) {
    const rows = buttons(render(capabilities));
    assert.deepEqual(rows.map(row => row.label), ['Model', 'Source candidates', 'Structures', 'Combined', 'Velocity', 'Joint fit', 'Volume baseline']);
    assert.deepEqual(rows.map(row => /data-workspace-section="([^"]+)"/.exec(row.attributes)?.[1]), ids);
  }
});

test('configured tools stay enabled and unavailable velocity keeps its explanatory reason', () => {
  const available = buttons(render({ compiler: true, sources: true, kinematics: true, volume: true }));
  for (const id of ['compiler', 'sources', 'kinematics', 'volume'])
    assert.doesNotMatch(available[ids.indexOf(id)]!.attributes, /disabled/);
  const missing = buttons(render({ compiler: true }))[ids.indexOf('kinematics')]!;
  assert.match(missing.attributes, /disabled=""/);
  assert.match(missing.attributes, /title="Velocity evidence is not configured for this object\."/);
  const qualified = buttons(render({ kinematics: 'Only registered image evidence is available.' }))[ids.indexOf('kinematics')]!;
  assert.match(qualified.attributes, /disabled=""/);
  assert.match(qualified.attributes, /title="Only registered image evidence is available\."/);
});
