import type {ArchiveImage,ArchiveTarget} from './model.ts';
export function imageSuitability(image: ArchiveImage, object: ArchiveTarget) {
  const extent = object.majorArcmin === null ? null : object.majorArcmin * 60;
  const resolutionElements = extent !== null && image.resolutionArcsec !== null ? extent / image.resolutionArcsec : null;
  const fieldRatio = extent !== null && image.fieldDegrees !== null ? image.fieldDegrees * 3600 / extent : null;
  return { resolutionElements, fieldRatio,
    role: resolutionElements === null ? 'unrated' : resolutionElements >= 128 ? 'detail' : 'context' } as const;
}
