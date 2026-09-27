import assert from 'node:assert/strict';
import test from 'node:test';
import { archivePrograms, currentArchivePath } from './programs.mts';
// Plain node:test: path arithmetic only.

const spitzer = archivePrograms('spitzer');

test('a file directly inside the former programs directory is found at the same name beside the archive code', () => {
  assert.equal(spitzer.path, 'packages/telescope-cli/src/archives/spitzer/programs');
  assert.equal(spitzer.current('tools/objects/spitzer/programs/a.reproduction.json'), 'packages/telescope-cli/src/archives/spitzer/programs/a.reproduction.json');
  assert.equal(spitzer.current('packages/telescope-cli/src/archives/spitzer/programs/a.reproduction.json'), 'packages/telescope-cli/src/archives/spitzer/programs/a.reproduction.json');
});

test('only a file name directly inside the former directory is mapped; any other recorded path is kept as recorded', () => {
  for (const recorded of ['tools/objects/spitzer/programs/nested/a.json', 'tools/objects/spitzer/programs/../toolchain.json',
    'tools/objects/spitzer/programs/..', 'tools/objects/spitzer/programs/', 'tools/objects/spitzer/programs', 'tools/objects/spitzer/programsX/a.json',
    'tools/objects/chandra/programs/a.json', 'a.reproduction.json'])
    assert.equal(spitzer.current(recorded), recorded, recorded);
});

test('a written or recognised path names one file among the programs, never a path', () => {
  assert.equal(spitzer.file('a.json'), 'packages/telescope-cli/src/archives/spitzer/programs/a.json');
  assert.deepEqual(spitzer.recorded('a.json'), ['packages/telescope-cli/src/archives/spitzer/programs/a.json', 'tools/objects/spitzer/programs/a.json']);
  for (const name of ['', '.', '..', 'x/a.json', '../a.json', 'x\\a.json']) {
    assert.throws(() => spitzer.file(name), /not the name of a file/u, name);
    assert.throws(() => spitzer.recorded(name), /not the name of a file/u, name);
  }
});

test('JWST keeps one programs folder beside each tool that reads it, each found where its former folder was', () => {
  assert.equal(archivePrograms('jwst').path, 'packages/telescope-cli/src/archives/jwst/programs');
  assert.equal(archivePrograms('jwst/imaging').current('tools/objects/jwst/imaging/programs/europa-1250.json'),
    'packages/telescope-cli/src/archives/jwst/imaging/programs/europa-1250.json');
  assert.deepEqual(archivePrograms('jwst/klip').recorded('hr-8799-1194.json'),
    ['packages/telescope-cli/src/archives/jwst/klip/programs/hr-8799-1194.json', 'tools/objects/jwst/klip/programs/hr-8799-1194.json']);
});

test('a path inside a folder that moved whole is found at the same place beside the archive code; anything else is kept', () => {
  assert.equal(currentArchivePath('tools/objects/interferometry/rotir'), 'packages/telescope-cli/src/archives/interferometry/rotir');
  assert.equal(currentArchivePath('tools/objects/interferometry/seasons/a/season.json'), 'packages/telescope-cli/src/archives/interferometry/seasons/a/season.json');
  for (const recorded of ['tools/objects/interferometry', 'tools/objects/interferometry/', 'tools/objects/interferometry/../chandra/toolchain.json',
    'tools/objects/interferometry/rotir/..', 'tools/objects/interferometry//rotir', 'tools/objects/interferometry/./rotir', 'tools/objects/interferometryX/rotir',
    'tools/objects/spitzer/programs/a.json', 'packages/telescope-cli/src/archives/interferometry/rotir', 'rotir'])
    assert.equal(currentArchivePath(recorded), recorded, recorded);
});
