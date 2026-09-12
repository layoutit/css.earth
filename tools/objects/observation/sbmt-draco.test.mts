import assert from 'node:assert/strict';
import test from 'node:test';
import { bindSbmtDracoAcquisition } from './sbmt-draco.mts';

// One native association row from SBMT's public DART Dimorphos v004 release.
const row = 'D7175061219G    2022 SEP 26 23:14:12.737    1    1    1      0.00         0     dart_0401930040_12262_02_iof.fits';
const name = 'dart_0401930040_12262_02_iof.fits';
const image = { captureId: '0401930040_12262', startTime: '2022-09-26T23:14:12.737', width: 1024, height: 1024 };
const pointing = { sumId: 'D7175061219G', timeUtc: '2022 SEP 26 23:14:12.737', sampleCount: 1024, lineCount: 1024 };

test('binds the exact published image version through the native SUM mapping', () => {
  assert.deepEqual(bindSbmtDracoAcquisition(row, name, image, pointing), {
    imageName: name, imageVersion: '02', sumId: pointing.sumId, observedAt: '2022-09-26T23:14:12.737Z',
  });
  assert.throws(() => bindSbmtDracoAcquisition(row, name.replace('_02_', '_01_'), image, pointing), /disagree/);
  assert.throws(() => bindSbmtDracoAcquisition(row, name, { ...image, captureId: '0401930040_12263' }, pointing), /capture/);
});

test('rejects ambiguous association, corrected time and incompatible detector geometry', () => {
  assert.throws(() => bindSbmtDracoAcquisition(`${row}\n${row}`, name, image, pointing), /unique/);
  assert.throws(() => bindSbmtDracoAcquisition(row, name, image, { ...pointing, timeUtc: '2022 SEP 26 23:14:12.739' }), /disagree/);
  assert.throws(() => bindSbmtDracoAcquisition(row, name, { ...image, width: 512 }, pointing), /dimensions/);
  assert.throws(() => bindSbmtDracoAcquisition(row.replace('D7175061219G', 'OTHER'), name, image, pointing), /disagree/);
});
