import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // These suites prepare real objects from their published prepared data and restored sources; the package's own run has
    // neither. `pnpm test:preparation` (packages/bake/cli/test-preparation.mts) runs them after restoring that data, as it did
    // before the compilers joined this package: the presentation suites in Vitest, the others under node:test.
    exclude: [...configDefaults.exclude,
      'src/image-layers/{bulge,disc,foreground}.test.mts',
      'src/astronomy/hosted-eccentric.oracle.test.mts', 'src/astronomy/hosted-orbit-source.test.mts', 'src/photometry/picaso-limb.test.mts',
      'src/asset-publication/check-assets-published.test.mts', 'src/asset-publication/check-deploy-assets.test.mts', 'src/asset-publication/prune-runtime-assets.test.mts', 'src/asset-publication/publish-runtime-assets.test.mts', 'src/asset-publication/restore-object-json.test.mts', 'src/asset-publication/runtime-assets.test.mts', 'src/asset-publication/stage-published-assets.test.mts', 'src/objects/scene/authored-rotation-contract.test.mts', 'src/objects/layers/terrestrial/surface-observations/inspect-osiris-geo.test.mts', 'src/delivery/asset-origin-scenes.test.mts', 'src/delivery/prepared-webp.test.mts', 'src/delivery/publish-verification.test.mts', 'src/delivery/source-acquisition.test.mts', 'src/delivery/surface-asset-records.test.mts', 'src/delivery/write-prepared-set.test.mts', 'src/delivery/write-prepared-text.test.mts', 'src/facility-renders/poses.test.mts', 'src/navigation/marker-recipe.test.mts', 'src/nebula/element-budget.test.ts', 'src/nebula/objects.test.ts', 'src/objects/default-view/fixtures/new-horizons-approach.oracle.test.mts', 'src/astronomy/fixtures/small-kernel.oracle.test.mts', 'src/photometry/disk.test.mts', 'src/photometry/hapke.test.mts', 'src/photometry/isis.oracle.test.mts', 'src/photometry/light-curve.test.mts', 'src/photometry/limb.test.mts', 'src/photometry/model-record.test.mts', 'src/photometry/normalization.test.mts', 'src/photometry/whole-disc-colour.test.mts', 'src/prepare-object/prepare-object.test.mts', 'src/preparation/stale-builds.test.mts', 'src/prepared-presentation/prepared-depth-partitions.test.mts', 'src/prepared-presentation/prepared-interior-fill.test.mts', 'src/prepared-presentation/prepared-visibility-order.test.mts', 'src/presentation/leaf-box.test.mts', 'src/presentation/prepared-activation-groups.test.mts', 'src/presentation/prepared-activation-registry.test.mts', 'src/presentation/prepared-cssom.test.mts', 'src/presentation/prepared-node-tree.test.mts', 'src/presentation/projective-layout.test.mts', 'src/raster/lighting-bank-bake.test.ts', 'src/scene/projective-surface-raster.test.mts', 'src/scene/solid-body-surface.test.mts', 'src/site-assets/scientific-charts.test.mts', 'src/sources/author-source-records.test.mts', 'src/sources/cite-pinned-facts.test.mts', 'src/sources/pdf-image.test.mts', 'src/sources/prepare-object-information.test.mts', 'src/sources/report-investigations.test.mts', 'src/objects/sources/source-manifest-parsers.test.mts', 'src/surface-previews/surface-preview-rasters.test.mts', 'src/scene/scene.test.ts', 'src/presentation/*.test.ts', 'src/volume-leaves/*.test.ts', 'src/stars/*.test.ts', 'src/shell/*.test.ts', 'src/sky/*.test.ts', 'src/density/*.test.ts', 'src/image-layers/*.test.ts', 'src/galaxy-catalog/*.test.ts',
      'src/cluster-catalog/*.test.ts', 'src/world-context/spatial-context.test.ts',
      // The object libraries' node tests run under `pnpm test:bake-objects` (.github/scripts/checks/test-bake-objects.mts).
      'src/objects/**/*.test.ts', 'src/objects/**/*.test.mts',
      'src/delivery/operations-assemble.test.ts', 'src/delivery/public-runtime-assets.test.ts',
      'src/delivery/publication*.test.mts', 'src/presentation/emissive-plates.test.mts',
      'src/scene/leaf-raster-scale.test.ts',
      'src/raster/raster-pages.test.mts',
      // The authoring pipelines' node tests run under `pnpm test:node` and `pnpm test:bake-objects`; they use
      // `node:test`, not Vitest.
      'authoring/**/*.test.mts'],
  },
});
