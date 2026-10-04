import type { EmissionVector3 } from '../emission/coordinates.js';
import type { CompilerStarMaterial } from './compiler-bake.js';
export interface CompilerStarInput { id: string; positionArcsec: EmissionVector3; rgb: [number, number, number]; widthPx?: number; diameterUnits?: number; alpha: number; materials?: Record<string, CompilerStarMaterial> }
