import type { ArchiveImage, ArchiveTarget } from './model.ts';
import { footprintCoverage } from './footprint.ts';

export type ImageOrder = 'best' | 'resolution' | 'coverage';
export function isSupportImage(image: ArchiveImage) {
  const value = image.accessUrl ?? image.id;
  let decoded = value; try { decoded = decodeURIComponent(value); } catch { /* Preserve malformed external text for matching. */ }
  return /(?:[_-](?:asn|mcat|xd-mcat|bunc|cbunc|bimsk|unc|err|error|noise|msk|mask|cov|coverage|exp|wht|weight|ivar|ivm|var))(?:[_-]\d+)?\.(?:fits?|fts)(?:\.(?:gz|fz))?(?:$|[?&#])/i.test(decoded);
}
/** Metadata triage, not a visual-quality measurement. Dimensions cannot establish optical resolution. */
export function imageRank(image: ArchiveImage, object: ArchiveTarget, majorArcsec = object.majorArcmin === null ? null : object.majorArcmin * 60) {
  const fieldArcsec = image.fieldDegrees === null ? null : image.fieldDegrees * 3600;
  const ratio = majorArcsec !== null && fieldArcsec !== null ? fieldArcsec / majorArcsec : null;
  const onTargetSpan = fieldArcsec === null ? majorArcsec : majorArcsec === null ? fieldArcsec : Math.min(fieldArcsec, majorArcsec);
  const elements = onTargetSpan !== null && image.resolutionArcsec !== null && fieldArcsec !== null ? onTargetSpan / image.resolutionArcsec : null;
  const pixels = image.width !== null && image.height !== null ? Math.min(image.width, image.height) : null;
  const targetPixels = pixels !== null && ratio !== null ? pixels * Math.min(1, 1 / ratio) : null;
  const detail = elements !== null && targetPixels !== null ? Math.min(elements, targetPixels) : elements ?? targetPixels;
  let outside = false;
  if (fieldArcsec !== null && majorArcsec !== null && image.raDegrees !== null && image.decDegrees !== null) {
    const radians = Math.PI / 180, deltaRA = (image.raDegrees - object.raDegrees) * radians, deltaDec = (image.decDegrees - object.decDegrees) * radians;
    const a = Math.sin(deltaDec / 2) ** 2 + Math.cos(object.decDegrees * radians) * Math.cos(image.decDegrees * radians) * Math.sin(deltaRA / 2) ** 2;
    const separation = 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a)))) / radians * 3600;
    // FOV can describe a bounding diameter. Only clearly disjoint fields are penalized here.
    outside = separation > (fieldArcsec + majorArcsec) / 2;
  }
  const footprint = footprintCoverage(image, object, majorArcsec);
  outside ||= footprint.center === false;
  const support = isSupportImage(image), reasons: string[] = [];
  if (support) reasons.push('Support product');
  if (outside) reasons.push('Target center outside field');
  else if (footprint.referenceExtent === true) reasons.push('Reference extent inside footprint');
  else if (footprint.center === true) reasons.push('Target center inside · partial extent');
  else reasons.push('Coverage unverified');
  if (image.calibrationLevel >= 3) reasons.push('Combined product');
  reasons.push(image.previewUrl ? 'Preview link available' : 'No image preview');
  const score = (detail === null ? -25 : 5 * Math.log2(1 + Math.max(0, detail))) +
    (footprint.referenceExtent === true ? 35 : footprint.center === true ? 10 : ratio === null ? -10 : 0) + (image.calibrationLevel >= 3 ? 12 : 0) +
    (image.previewUrl ? 4 : 0) - (outside ? 120 : 0) - (support ? 1000 : 0);
  return { score, reasons, support, outside, detail, fieldRatio: ratio };
}
export function rankImages(images: ArchiveImage[], object: ArchiveTarget, order: ImageOrder, majorArcsec?: number | null) {
  const ranked = images.map(image => ({ image, rank: imageRank(image, object, majorArcsec) }));
  return ranked.sort((a, b) => {
    const nonScience = Number(a.rank.support) - Number(b.rank.support) || Number(a.rank.outside) - Number(b.rank.outside);
    if (nonScience) return nonScience;
    if (order === 'resolution') return (a.image.resolutionArcsec ?? Infinity) - (b.image.resolutionArcsec ?? Infinity) || b.rank.score - a.rank.score || a.image.id.localeCompare(b.image.id);
    if (order === 'coverage') return (b.image.fieldDegrees ?? -1) - (a.image.fieldDegrees ?? -1) || b.rank.score - a.rank.score || a.image.id.localeCompare(b.image.id);
    return b.rank.score - a.rank.score || a.image.id.localeCompare(b.image.id);
  }).map(item => item.image);
}
