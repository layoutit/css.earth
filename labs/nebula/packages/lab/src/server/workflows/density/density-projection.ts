import { prepareDensityProjection as project, densityPlacementTransform, type DensityPlacement } from '@cssearth/bake/volume';
import { sampleEncoded, type VolumeSource, channelDensity } from '@cssearth/bake/volume/node';
export function prepareDensityProjection(source: VolumeSource, distance: number, width = 256, placement?: DensityPlacement) {
  const encoded: [number, number, number, number] = [0, 0, 0, 0];
  const transform = placement ? densityPlacementTransform(placement) : undefined;
  return project({ bounds: transform?.bounds(source.recipe.grid.bounds) ?? source.recipe.grid.bounds,
    depth: source.depth, exposureGain: source.recipe.material.exposureGain / (placement?.scale ?? 1),
    densityAt(x, y, z) {
      const point = transform?.inverse([x, y, z]) ?? [x, y, z];
      sampleEncoded(source, point[0]!, point[1]!, point[2]!, encoded);
      return channelDensity(encoded[3], source.recipe.grid.encoding);
    } }, distance, width);
}
