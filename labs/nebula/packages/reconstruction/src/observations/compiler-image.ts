import type { Affine } from '../registration/affine.ts';
export interface CompilerRaster { width: number; height: number; data: Uint8Array; path: string; sha256: string }
export interface CompilerImage { id: string; label: string; credit: string; page: string; matrix: Affine;
  nativeWidth: number; nativeHeight: number; original: CompilerRaster; diffuse: CompilerRaster; stars: CompilerRaster;
  sampleRgb(x: number, y: number, out: [number, number, number]): boolean;
  sampleOriginal(x: number, y: number, out: [number, number, number]): boolean;
  sampleLowRgb?(x: number, y: number, out: [number, number, number]): boolean;
  sampleLowOriginal?(x: number, y: number, out: [number, number, number]): boolean;
  pixelToSky(x: number, y: number): [number, number] }
