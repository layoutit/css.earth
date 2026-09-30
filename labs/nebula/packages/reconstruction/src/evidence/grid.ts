import { applyAffine, type Affine as Matrix } from '../registration/affine.ts';
import type { EvidenceGrid } from './model.ts';
export function evidenceGrid(frame: { width: number; height: number; fieldArcminutes: [number, number] },
  images: { nativeWidth: number; nativeHeight: number; imageToFrame: Matrix }[]): EvidenceGrid {
  const corners = images.flatMap(image => [[0,0],[image.nativeWidth,0],[0,image.nativeHeight],[image.nativeWidth,image.nativeHeight]].map(p=>applyAffine(image.imageToFrame,[p[0]!,p[1]!])));
  const originX = Math.min(0, ...corners.map(p => p[0])), originY = Math.min(0, ...corners.map(p => p[1]));
  const extentWidth = Math.max(frame.width, ...corners.map(p => p[0])) - originX;
  const extentHeight = Math.max(frame.height, ...corners.map(p => p[1])) - originY;
  // Square angular pixels remain square even for a non-square catalogue frame.
  const angularWidth = extentWidth / frame.width * frame.fieldArcminutes[0] * 60;
  const angularHeight = extentHeight / frame.height * frame.fieldArcminutes[1] * 60;
  const scale = 768 / Math.max(angularWidth, angularHeight), width = Math.max(1, Math.round(angularWidth * scale)), height = Math.max(1, Math.round(angularHeight * scale));
  return { width, height, frameWidth: frame.width, frameHeight: frame.height, originX, originY, extentWidth, extentHeight,
    fieldArcminutes: frame.fieldArcminutes, arcsecondsPerPixel: angularWidth / width };
}
export function samplingArcseconds(image: { nativeWidth: number; nativeHeight: number; width: number; height: number; imageToFrame: Matrix }, grid: EvidenceGrid): number {
  const [a, b, c, d] = image.imageToFrame, xUnit = grid.fieldArcminutes[0] * 60 / grid.frameWidth, yUnit = grid.fieldArcminutes[1] * 60 / grid.frameHeight;
  // Largest singular value handles rotated, mildly anisotropic registration conservatively.
  const ax = a * image.nativeWidth / image.width * xUnit, ay = b * image.nativeWidth / image.width * yUnit;
  const bx = c * image.nativeHeight / image.height * xUnit, by = d * image.nativeHeight / image.height * yUnit;
  const xx = ax * ax + ay * ay, yy = bx * bx + by * by, xy = ax * bx + ay * by;
  return Math.sqrt((xx + yy + Math.hypot(xx - yy, 2 * xy)) / 2);
}
