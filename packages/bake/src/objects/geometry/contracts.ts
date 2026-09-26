/** Source-space geometry and numeric fields shared by preparation algorithms. */
export interface MeshDimensions { metersPerUnit:number; expectedVertices:number; expectedFaces:number }
export interface SurfaceHit { radius:number; faceId:number }
export interface ClosestSurfacePoint extends SurfaceHit { point:number[]; barycentric:number[]; normal:number[]; distanceMeters:number }
export interface SourceMesh {
  faceProvenance?:ArrayLike<number>; constraintFlags?:ArrayLike<number>; imageGrid?:{zOffsetMeters:number};
  vertices:number; faces:number; positions:number[][]; indices:number[][]; bounds:number[][];
  hit(longitude:number,latitude:number,requireUnique?:boolean):SurfaceHit|null;
  intersect(origin:readonly number[],direction:readonly number[],maximumDistance?:number,requireUnique?:boolean):SurfaceHit|null;
  closestPoint(point:readonly number[],maximumDistance?:number,requireUnique?:boolean):ClosestSurfacePoint|null;
  sample(longitude:number,latitude:number):number|null;
}
export interface SourceSurfaceSample extends ClosestSurfacePoint { value:number; sourceCell?:number }
export interface SourceScalar { sample(longitude:number,latitude:number):number|null; samplePoint?(point:readonly number[]):SourceSurfaceSample|null;
  /** True where a published boundary crosses this output pixel (`pixelDegrees` wide); it is drawn over the value. */
  outline?(longitude:number,latitude:number,pixelDegrees:number):boolean }
export interface SourceFace { id:number; a:number[]; ab:number[]; ac:number[]; min:number[]; max:number[] }
export type FaceTree = {min:number[];max:number[]} & ({items:SourceFace[];left?:never;right?:never}|{items?:never;left:FaceTree;right:FaceTree});
export interface PreparedTriangle { vertices:readonly (readonly number[])[]; normal:number[]; vertexNormals:number[][]; estimated?:boolean }
