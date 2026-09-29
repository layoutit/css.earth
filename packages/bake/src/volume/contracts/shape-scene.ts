/** Viewer-facing subset of an already validated authored-shape result. Research settings remain host-owned. */
export interface PreparedShapeScene {
  id: string;
  /** The detected geometry file the scene was baked from, in its image's structure directory. */
  geometryFile: string;
  width: number; height: number; unitsPerPixel: number;
  empty: boolean; quality: 'draft' | 'detailed';
  neutral?: { path: string };
  textured?: { path: string };
}
