import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSbmtSumPointing } from './sbmt-pointing.mts';

const sourceURL = 'https://sbmt.jhuapl.edu/sbmt/prod/data/dimorphos/dart-dimorphos-v004/draco/sumfiles/D7175061219G.SUM';
const fixtureExcerptProvenance = {
  sourceURL,
  formatReferenceUrl: 'https://isis.astrogeology.usgs.gov/8.1.0/Application/presentation/PrinterFriendly/sumspice/sumspice.html',
  sumId: 'D7175061219G',
  excerpt: 'fixed header, two LANDMARKS rows, empty LIMB FITS section, and END FILE marker',
} as const;

const fixture = `D7175061219G
2022 SEP 26 23:14:12.737
  1024  1024  9728 65535                                      NPX, NLN, THRSH
    0.2628334300D+04    0.5125000000D+03    0.5125000000D+03  MMFL, CTR
   -0.1227887246D+02    0.6840586016D+02    0.1137922398D+02   SCOBJ
   -0.7323769102D+00   -0.1896764178D-01   -0.6806352106D+00   CX
   -0.6578520959D+00   -0.2381637704D+00    0.7144988723D+00   CY
   -0.1756550066D+00    0.9710397763D+00    0.1619477432D+00   CZ
   -0.7579943922D+00   -0.6312103893D+00   -0.1643713657D+00  SZ
   76.9229    0.0000    0.0000    0.0031  -76.9262    0.0000  K-MATRIX
    0.00000D+00    0.00000D+00    0.00000D+00    0.00000D+00  DISTORTION
    0.1500000000D-01    0.1500000000D-01    0.1500000000D-01  SIGMA_VSO
    0.1000000000D-03    0.1000000000D-03    0.1000000000D-03  SIGMA_PTG
LANDMARKS
EP0003    267.50    797.58
EP0004    279.79    781.35
LIMB FITS
END FILE
`;

test('preserves SBMT SUM calibration, source vectors, and landmark image coordinates', () => {
  const pointing = parseSbmtSumPointing(fixture);
  assert.equal(fixtureExcerptProvenance.sourceURL, sourceURL);
  assert.equal(pointing.sumId, 'D7175061219G');
  assert.equal(pointing.timeUtc, '2022 SEP 26 23:14:12.737');
  assert.deepEqual([pointing.sampleCount, pointing.lineCount, pointing.lowerDnThreshold, pointing.upperDnThreshold], [1024, 1024, 9728, 65535]);
  assert.deepEqual([pointing.focalLengthMillimetres, pointing.opticalAxisSampleLineCenter], [2628.3343, [512.5, 512.5]]);
  assert.deepEqual(pointing.spacecraftToObjectCenterBodyFixed, [-12.27887246, 68.40586016, 11.37922398]);
  assert.deepEqual(pointing.kMatrix, [[76.9229, 0, 0], [0.0031, -76.9262, 0]]);
  assert.deepEqual(pointing.distortion, [0, 0, 0, 0]);
  assert.deepEqual(pointing.sigmaVso, [0.015, 0.015, 0.015]);
  assert.deepEqual(pointing.sigmaPtg, [0.0001, 0.0001, 0.0001]);
  assert.deepEqual(pointing.landmarks, [
    { id: 'EP0003', sampleLineCenter: [267.5, 797.58] },
    { id: 'EP0004', sampleLineCenter: [279.79, 781.35] },
  ]);
  assert.deepEqual(pointing.limbFits, []);
});

test('accepts empty landmark or limb-fit sections while rejecting malformed SUM grammar', () => {
  assert.throws(() => parseSbmtSumPointing(fixture.replace('K-MATRIX', 'K MATRIX')), /K-MATRIX/);
  const noLandmarks = parseSbmtSumPointing(fixture.replace('LANDMARKS\nEP0003    267.50    797.58\nEP0004    279.79    781.35\n', 'LANDMARKS\n'));
  assert.deepEqual(noLandmarks.landmarks, []);
  const limbFit = parseSbmtSumPointing(fixture.replace('LIMB FITS\nEND FILE', 'LIMB FITS\nLP0001  511.25  20.50\nEND FILE'));
  assert.deepEqual(limbFit.limbFits, [{ id: 'LP0001', sampleLineCenter: [511.25, 20.5] }]);
});
