import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { DownloadCancelledError } from '@cssearth/telescope-core/node';
import { consentHandler, savedDownload, type ConsentState, type DownloadInfo } from './cli-consent.mts';
import type { CliIo } from '../cli.mts';

function terminal(answer: string | undefined = '', stdinIsTTY = true, stdoutIsTTY = true) {
  const prompts: string[] = [], notices: string[] = [];
  const io: CliIo = { stdinIsTTY, stdoutIsTTY, write: () => {}, error: text => notices.push(text),
    question: async prompt => { prompts.push(prompt); return answer; }, close: () => {} };
  return { io, prompts, notices };
}
const download = (bytes: number | null): DownloadInfo => ({ kind: 'download', bytes, archive: 'ALMA', destination: '/tmp/run/pick-4' });

test('terminal consent threshold is 100 MB, includes unknown, and Enter accepts', async () => {
  for (const [bytes, count] of [[99_999_999, 0], [100_000_000, 1], [401_000_000, 1], [null, 1]] as const) {
    const tty = terminal(), state: ConsentState = {};
    await consentHandler(tty.io, { json: false }, state)(download(bytes));
    assert.equal(tty.prompts.length, count);
    if (count) assert.equal(tty.prompts[0], 'Continue? [Y/n] ');
    assert.match(tty.notices[0]!, /Download: .* from ALMA → \/tmp\/run\/pick-4\//u);
    if (bytes === null) assert.match(tty.notices[0]!, /size unknown/u);
    assert.equal(state.download?.bytes, bytes);
  }
});

test('yes, JSON, redirected stdin and redirected stdout skip consent', async () => {
  for (const [json, yes, stdin, stdout] of [[false,true,true,true], [true,false,true,true], [false,false,false,true], [false,false,true,false]] as const) {
    const tty = terminal('n', stdin, stdout);
    await consentHandler(tty.io, { json, yes }, {})(download(null));
    assert.deepEqual(tty.prompts, []);
    assert.equal(tty.notices.length, 1);
  }
});

test('refusal precedes publication and remains cancelled when a provider catches it', async () => {
  const work = await mkdtemp(resolve(tmpdir(), 'consent-refusal-'));
  try {
    const tty = terminal('n'), state: ConsentState = {}, request = consentHandler(tty.io, { json: false }, state);
    await assert.rejects(async () => {
      await request(download(100_000_000));
      await writeFile(resolve(work, 'published.fits'), 'science bytes');
    }, DownloadCancelledError);
    assert.deepEqual(await readdir(work), []);
    assert.equal(state.cancelled, true);
    await assert.rejects(request(download(1)), DownloadCancelledError);
  } finally { await rm(work, { recursive: true, force: true }); }
});

test('implicit Python installation consent is terminal-only and names packages, estimate and toolchains folder', async () => {
  const info = { kind: 'toolchain' as const, name: 'astroquery', bytes: 1_000_000_000,
    packages: ['micromamba', 'Python', 'Astroquery'], destination: '/tmp/user/toolchains/astroquery' };
  for (const [json, yes, stdin, stdout, count] of [[false,false,true,true,1], [true,false,true,true,0], [false,true,true,true,0], [false,false,false,true,0], [false,false,true,false,0]] as const) {
    const tty = terminal('', stdin, stdout);
    await consentHandler(tty.io, { json, yes }, {})(info);
    assert.equal(tty.prompts.length, count);
    assert.match(tty.notices.join(''), /Install: micromamba, Python, Astroquery \(approximately 1000 MB\) → .*toolchains\/astroquery\//u);
  }
});

test('saved download uses archive size and points only to the run', async () => {
  const work = await mkdtemp(resolve(tmpdir(), 'consent-plan-'));
  try {
    await writeFile(resolve(work, 'explore.json'), JSON.stringify({ choices: [{ telescope: 'ALMA', display: { advertisedKilobytes: 401_000 } }] }));
    assert.deepEqual(await savedDownload(work, 1), { ...download(401_000_000), destination: resolve(work, 'pick-1') });
    await writeFile(resolve(work, 'explore.json'), JSON.stringify({ choices: [{ telescope: 'hst' }] }));
    const mast = await savedDownload(work, 1), tty = terminal();
    await consentHandler(tty.io, { json: true }, {})(mast);
    assert.equal(mast.cache,undefined);
    assert.doesNotMatch(tty.notices.join(''), /cache:/u);
    assert.equal(mast.bytes, null);
    assert.match(await readFile(resolve(work, 'explore.json'), 'utf8'), /hst/u);
  } finally { await rm(work, { recursive: true, force: true }); }
});
