import { type DensityVolumeFrame, type ObservationMapping, rayToOverlayPlane } from '@cssearth/bake/volume';
export function realizeRegisteredStars<T extends {id:string;raDeg:number;decDeg:number}>(existing:readonly T[],options:{frame:DensityVolumeFrame;sourceMapping:ObservationMapping;mapping:ObservationMapping;depthAt(x:number,y:number,id:string):number;sampleSignal(x:number,y:number,z:number):number}){
 const {frame,sourceMapping,mapping,depthAt,sampleSignal}=options;
  const stars: (T & {positionUnits:[number,number,number];cloudSignal:number;cloudPartIds:string[]})[] = [], unsupported: { id: string; reason: string }[] = [];
  for (const star of existing) {
    const a = star.raDeg * Math.PI / 180, d = star.decDeg * Math.PI / 180;
    const tangent = rayToOverlayPlane([Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)], frame);
    const uv = sourceMapping.uvAtTangent(tangent[0], tangent[1]);
    if (!uv) { unsupported.push({ id: star.id, reason: 'Measured ray is outside the original reference footprint.' }); continue; }
    const [x, y] = mapping.tangentAtUv(...uv);
    try {
      // Unit cloud emission reuses the existing bounded CDF while conditioning
      // ONLY on decoded source density and the solid-angle volume Jacobian.
      const depth = depthAt(x,y,star.id);
      const positionUnits = mapping.pointAtDepth(x, y, depth);
      const cloudSignal = sampleSignal(...positionUnits);
      if (!Number.isFinite(cloudSignal) || cloudSignal < 0 || cloudSignal > 1)
        throw new TypeError('Star requires a normalized common projected density signal.');
      stars.push({ ...structuredClone(star), positionUnits, cloudSignal, cloudPartIds: ['all-light'] });
    } catch (error) { unsupported.push({ id: star.id, reason: error instanceof Error ? error.message : String(error) }); }
  }
  if (unsupported.length) throw new TypeError(`Cannot place ${unsupported.length}/${existing.length} catalogue stars in canonical density: ${JSON.stringify(unsupported)}`);
 return stars;
}
