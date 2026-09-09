import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry } from '@layoutit/polycss';

export function prepareRingLeaves(config, texture, majorRadiusKm, onGeometry) {
  const { segments, innerRadiusKm, outerRadiusKm } = config.ring, scale = config.displayRadius / majorRadiusKm;
  const point = (radius, angle) => [radius * scale * Math.cos(angle), radius * scale * Math.sin(angle), 0];
  return Array.from({ length: segments }, (_, i) => {
    const a = i / segments * 2 * Math.PI, z = (i + 1) / segments * 2 * Math.PI;
    const polygon = { vertices: [point(innerRadiusKm, a), point(innerRadiusKm, z), point(outerRadiusKm, z), point(outerRadiusKm, a)],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], texture: texture.url, color: '#777777',
      textureImageSource: { ...texture, sourceRect: { x: i * texture.width / segments, y: 0, width: texture.width / segments, height: texture.height } },
      texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' } };
    const plan = computeTextureAtlasPlanPublic(polygon, i, { tileSize: 50, layerElevation: 50, textureLighting: 'baked', seamBleed: 0 });
    const g = plan && resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective' });
    if (!g) throw new TypeError(`Ring quad ${i} could not be prepared.`);
    onGeometry?.(g);
    return { tag: 's', className: 'shape-model-ring-quad', style: `transform:matrix3d(${g.matrix});backface-visibility:visible;--polycss-atlas-width:${g.leafWidth}px;--polycss-atlas-height:${g.leafHeight}px;background-image:url("${texture.url}");background-position:${g.backgroundPosition.map(x => `${x}px`).join(' ')};background-size:${g.backgroundSize.map(x => `${x}px`).join(' ')};background-repeat:no-repeat` };
  });
}
