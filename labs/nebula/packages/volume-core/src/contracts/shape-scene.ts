/** Viewer-facing subset of an already validated authored-shape result. Research settings remain host-owned. */
export interface PreparedShapeScene {
  id: string;
  sourceSha256: string; mapSha256: string; geometrySha256: string;
  width: number; height: number; unitsPerPixel: number;
  empty: boolean; quality: 'draft' | 'detailed';
  neutral?: { path: string; sha256: string };
  textured?: { path: string; sha256: string };
}
