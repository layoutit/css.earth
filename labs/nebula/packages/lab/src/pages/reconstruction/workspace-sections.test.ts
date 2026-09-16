import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceSectionItems, type WorkspaceCapabilities } from './workspace-sections';

const render = (capabilities: WorkspaceCapabilities) => renderToStaticMarkup(createElement(WorkspaceSectionItems, {
  active: 'compiler', capabilities, onChange() {},
}));
const buttons = (markup: string) => [...markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].filter(match => match[1]!.includes('data-workspace-section')).map(match => ({ attributes: match[1]!, label: /aria-label="([^"]+)"/.exec(match[1]!)?.[1] }));
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
    assert.match(available[ids.indexOf(id)]!.attributes, /aria-disabled="false"/);
  const missing = buttons(render({ compiler: true }))[ids.indexOf('kinematics')]!;
  assert.match(missing.attributes, /aria-disabled="true"/);
  assert.match(render({ compiler: true }), /Velocity evidence is not configured for this object\./);
  const qualified = buttons(render({ kinematics: 'Only registered image evidence is available.' }))[ids.indexOf('kinematics')]!;
  assert.match(qualified.attributes, /aria-disabled="true"/);
  assert.match(render({ kinematics: 'Only registered image evidence is available.' }), /Only registered image evidence is available\./);
});
