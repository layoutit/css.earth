/** Viewer-facing subset of an already validated authored-shape result. Research settings remain host-owned. */
export interface PreparedShapeScene {
  id: string;
  width: number; height: number; unitsPerPixel: number;
  empty: boolean; quality: 'draft' | 'detailed';
  neutral?: { path: string };
  textured?: { path: string };
}
