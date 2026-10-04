import assert from 'node:assert/strict';
import test from 'node:test';
import { archivePrograms } from './programs.mts';
// Plain node:test: path arithmetic only.

test('a program file is named directly inside the archive programs folder, never by a path', () => {
  const spitzer = archivePrograms('spitzer');
  assert.equal(spitzer.path, 'packages/telescope-cli/src/archives/spitzer/programs');
  assert.equal(spitzer.file('a.json'), 'packages/telescope-cli/src/archives/spitzer/programs/a.json');
  assert.equal(archivePrograms('jwst').file('hr-8799-1194.json'), 'packages/telescope-cli/src/archives/jwst/programs/hr-8799-1194.json');
  for (const name of ['', '.', '..', 'x/a.json', '../a.json', 'x\\a.json'])
    assert.throws(() => spitzer.file(name), /not the name of a file/u, name);
});
