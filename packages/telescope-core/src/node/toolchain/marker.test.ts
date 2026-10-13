import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { it as test } from 'node:test';
import { installedMarkerIssue, readToolchainPins, writeInstalledMarker } from './marker.js';

// An installed environment recorded this generated command before the package moved.
const installedCommand = '#    pip-compile --strip-extras --output-file=packages/telescope/toolchains/requirements.lock requirements.in';

test('the relocated astronomy lock still matches an installed marker with its original path comment', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'astronomy-marker-'));
  try {
    const pins = readToolchainPins('astroquery', 'toolchain.json');
    assert.ok(pins.lock !== null);
    const recordedLock = pins.lock.split('\n').map(line => line.startsWith('#    pip-compile ') ? installedCommand : line).join('\n');
    writeInstalledMarker(root, { ...pins, file: 'packages/telescope/toolchains/toolchain.json', lock: recordedLock });
    assert.equal(installedMarkerIssue(root, pins), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the marker still refuses lock comment and descriptor formatting changes', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'astronomy-marker-'));
  try {
    const pins = readToolchainPins('astroquery', 'toolchain.json');
    assert.ok(pins.lock !== null);
    assert.ok(pins.lock.includes(installedCommand));
    writeInstalledMarker(root, pins);
    const changedLock = pins.lock.replace(installedCommand, installedCommand.replace('packages/telescope/', 'packages/telescope-core/'));
    assert.equal(installedMarkerIssue(root, { ...pins, lock: changedLock }), 'other-pins');
    assert.equal(installedMarkerIssue(root, { ...pins, descriptor: `${pins.descriptor}\n` }), 'other-pins');
  } finally { await rm(root, { recursive: true, force: true }); }
});
