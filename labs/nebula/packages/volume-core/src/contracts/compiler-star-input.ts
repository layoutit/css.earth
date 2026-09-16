import type {EmissionVector3} from './emission.ts';
import type {CompilerStarMaterial} from './compiler-bake.ts';
export interface CompilerStarInput { id: string; positionArcsec: EmissionVector3; rgb: [number, number, number]; widthPx?: number; diameterUnits?: number; alpha: number; materials?: Record<string, CompilerStarMaterial> }
