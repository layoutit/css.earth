import type { Point } from '../../registration/affine.ts';
export interface GeometryCandidate {
  id: string; center: Point; radii: Point; angleRadians: number; score: number; coverage: number;
  supportedArcs: { startRadians: number; endRadians: number }[]; groupId?: string;
}
export interface GeometryMap {
  width: number; height: number; candidates: GeometryCandidate[];
  groups: { id: string; members: string[]; center: Point }[];
}
