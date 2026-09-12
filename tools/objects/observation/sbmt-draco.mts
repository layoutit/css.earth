import { createHash } from 'node:crypto';
import { decodeDracoIof } from './draco-fits.mts';
import { parseSbmtSumPointing } from './sbmt-pointing.mts';
import { sbmtSumToArchivedCamera } from './sbmt-camera.mts';

const productName = /^dart_(\d{10}_\d{5})_(\d{2})_iof\.fits$/u;
const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

/** DART's native make_sumfiles.in binds a SUM ID to a particular image
 * version. The SUM ID and camera time alone do not identify that image.
 * Native example: SBMT dimorphos/dart-dimorphos-v004/draco/make_sumfiles.in.
 * Retain the mapping as a pinned input alongside the selected SUM and FITS.
 */
export function bindSbmtDracoAcquisition(mapping: string, imageName: string,
  image: { captureId: string; startTime: string; width: number; height: number },
  pointing: { sumId: string; timeUtc: string; sampleCount: number; lineCount: number }) {
  const product = productName.exec(imageName);
  if (!product || product[1] !== image.captureId) throw new Error('DRACO filename does not identify the decoded capture.');
  const utc = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2}\.\d+)$/u.exec(image.startTime);
  if (!utc || !months[Number(utc[2]) - 1]) throw new Error('Unsupported DRACO acquisition UTC.');
  const sourceTime = `${utc[1]} ${months[Number(utc[2]) - 1]} ${utc[3]} ${utc[4]}`;
  const matches = mapping.replaceAll('\r', '').split('\n').map(line => line.trim().split(/\s+/u))
    .filter(fields => fields[0] === pointing.sumId || fields.at(-1) === imageName);
  if (matches.length !== 1) throw new Error('SBMT index lacks a unique image and SUM association.');
  const row = matches[0];
  if (row.length !== 11 || row[0] !== pointing.sumId || row[10] !== imageName ||
      row.slice(1, 5).join(' ') !== sourceTime || pointing.timeUtc !== sourceTime ||
      row.slice(5, 10).some(token => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u.test(token))) {
    throw new Error('SBMT image, pointing and native mapping disagree.');
  }
  if (image.width !== pointing.sampleCount || image.height !== pointing.lineCount) throw new Error('SBMT camera and detector dimensions disagree.');
  return { imageName, imageVersion: product[2], sumId: pointing.sumId, observedAt: `${image.startTime}Z` };
}

/** A preparation-only provider adapter. It decodes a precisely paired native
 * acquisition; it does not certify terrain registration or create a lens.
 * The enclosing source manifest remains the owner of acquisition and pins.
 */
export function decodeSbmtDracoObservation(input: {
  imageName: string; imageBytes: Buffer; pointingName: string; pointingText: string; mappingText: string;
  expectedTarget: '(65803) Didymos' | '(65803) Didymos I (Dimorphos)';
}) {
  const image = decodeDracoIof(input.imageBytes);
  const pointing = parseSbmtSumPointing(input.pointingText);
  if (image.target !== input.expectedTarget) throw new Error('DRACO target differs from the selected body.');
  if (input.pointingName !== `${pointing.sumId}.SUM`) throw new Error('SBMT SUM filename differs from its native ID.');
  const acquisition = bindSbmtDracoAcquisition(input.mappingText, input.imageName, image, pointing);
  const camera = sbmtSumToArchivedCamera(pointing);
  return { image, pointing, camera, report: {
    ...acquisition, provider: 'SBMT', instrument: 'DRACO', target: image.target,
    sourceImage: { name: input.imageName, sha256: sha256(input.imageBytes) },
    sourcePointing: { name: input.pointingName, sha256: sha256(input.pointingText) },
    sourceAssociation: { name: 'make_sumfiles.in', sha256: sha256(input.mappingText) },
    pixels: image.report,
    registration: 'not-evaluated',
    interpretation: 'Native acquisition and pointing decoded. Independent terrain registration and shape correspondence are still required.',
  } };
}
