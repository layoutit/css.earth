export interface DskMeshRecipe {
  inputPath: string;
  inputBytes: number;
  inputSha256: string;
  member: string;
  targetId: number;
  frameId: number;
  surfaceId: number;
  sourceVertices: number;
  sourceFaces: number;
  weldedVertices: number;
  spiceypyVersion: '6.0.3';
  cspiceVersion: 'CSPICE_N0067';
}

export function validateDskMeshRecipe(recipe: unknown): DskMeshRecipe;
export function prepareDskMesh(context: {sourceRoot: string; recipe: unknown}): Promise<Buffer>;
