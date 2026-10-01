export default {
  entry: {
    'camera/inspection': 'src/camera/inspection.ts',
    'camera/point-projection': 'src/camera/point-projection.ts',
    'camera/shape-cloud': 'src/camera/shape-cloud.ts',
    'camera/inspection-camera': 'src/camera/inspection-camera.ts',
    'scene/tone-resources': 'src/scene/tone-resources.ts',
    'scene/compiler-viewer': 'src/scene/compiler-viewer.ts',
    'scene/shape-cloud-viewer': 'src/scene/shape-cloud-viewer.ts',
    'scene/joint-fit-viewer': 'src/scene/joint-fit-viewer.ts',
    'scene/cloud-inspection': 'src/scene/cloud-inspection.ts',
    'scene/inspection-banks': 'src/scene/inspection-banks.ts',
    'scene/catalogue-stars': 'src/scene/catalogue-stars.ts',
    'scene/image-plane': 'src/scene/image-plane.ts',
  },
  format: ['esm'],
  external: ['@cssearth/objects'],
  dts: false, // Public subpaths resolve to TypeScript source.
  clean: true,
  target: 'es2022',
};
