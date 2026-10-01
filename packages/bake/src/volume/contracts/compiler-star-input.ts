import { type EmissionVector3, type CompilerStarMaterial } from '@cssearth/objects';
export interface CompilerStarInput { id: string; positionArcsec: EmissionVector3; rgb: [number, number, number]; widthPx?: number; diameterUnits?: number; alpha: number; materials?: Record<string, CompilerStarMaterial> }
