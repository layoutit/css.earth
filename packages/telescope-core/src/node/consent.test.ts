import assert from 'node:assert/strict';
import test from 'node:test';
import { assertTransferNotCancelled, DownloadCancelledError, hasTransferConsent, requestTransferConsent, withTransferConsent, type TransferConsent } from './consent.js';

const info: TransferConsent = { kind: 'download', bytes: 100_000_000, archive: 'fixture', destination: '/fixture/run' };

test('transfer consent remains scoped across asynchronous work and concurrent commands', async () => {
  const events: string[] = [];
  assert.equal(hasTransferConsent(), false);
  await requestTransferConsent(info);
  await Promise.all(['first', 'second'].map(name => withTransferConsent(async value => {
    assert.deepEqual(value, info); events.push(name);
  }, async () => {
    await Promise.resolve();
    assert.equal(hasTransferConsent(), true);
    await requestTransferConsent(info);
  })));
  assert.deepEqual(events.sort(), ['first', 'second']);
  assert.equal(hasTransferConsent(), false);
});

test('refused transfer consent propagates before the protected work and clears its scope', async () => {
  let transferred = false;
  await assert.rejects(withTransferConsent(async () => { throw new DownloadCancelledError(); }, async () => {
    await requestTransferConsent(info);
    transferred = true;
  }), DownloadCancelledError);
  assert.equal(transferred, false);
  assert.equal(hasTransferConsent(), false);
});

test('caught cancellation remains latched until the owning command ends', async () => {
  await withTransferConsent(async () => { throw new DownloadCancelledError(); }, async () => {
    await requestTransferConsent(info).catch(() => {});
    assert.throws(assertTransferNotCancelled, DownloadCancelledError);
    await assert.rejects(requestTransferConsent(info), DownloadCancelledError);
  });
  assert.doesNotThrow(assertTransferNotCancelled);
});
