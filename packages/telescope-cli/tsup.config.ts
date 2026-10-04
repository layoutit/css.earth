import { defineConfig } from 'tsup';

/** The sphere owner is compiled during package build, with workspace entries external. */
export default defineConfig({
  entry: { 'sphere-lane': 'src/sphere/sphere-lane.mts' },
  format: ['esm', 'cjs'],
  external: ['sharp', 'linkedom'],
  // Source-only renderer/native-scroll subpaths must be bundled; package builds stay external.
  noExternal: [/^@cssearth\/renderer\//, /^@cssearth\/telescope-cli\/sphere\/native-scroll\//],
  dts: process.env.CSSEARTH_SKIP_DECLARATIONS !== '1' && { compilerOptions: { types: ['node'], typeRoots: ['./node_modules/@types'] } },
  clean: false,
  target: 'node22',
  removeNodeProtocol: false,
});
