import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "astro/config";
import { SITE_ORIGIN } from "./content/seo.mts";
import { performanceSourceMaps } from "./build/source-maps.mts";
import { packageSources } from "./build/package-sources.mts";
import { inlinePageStylesheets } from "./build/inline-page-stylesheet.mts";
import { searchServer } from './server/search/search-server.mts';
import { prepareContextAvailability } from "./build/prepare/catalog/prepare-context-availability.mts";
import { preparedMotionCss } from "./build/prepared-motion-css.mts";
import { assetOrigin, resolveWorldBillboards } from "./server-assets/asset-origin.mts";
import { cssEarthVersion, finalizeBuildMetadata } from './build/build-metadata.mts';
import { incrementalBuildEnabled, incrementalRenderEnabled, VERSION_TOKEN } from './contracts/build-metadata.mts';
import { sourceRevision } from './content/source-revision.mts';

// Astro resolves relative directories against the working directory, not this file: name them from here, so the
// config builds the same site from any working directory.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

const incremental = incrementalBuildEnabled();

export default defineConfig({
  site: SITE_ORIGIN,
  trailingSlash: "always",
  root,
  srcDir: resolve(root, "site"),
  publicDir: resolve(root, "site/public"),
  outDir: resolve(root, "dist"),
  output: "static",
  ...(incremental ? { cacheDir: resolve(root, 'output/incremental-build/astro-cache'),
    experimental: { incrementalBuild: true }, build: { concurrency: 1 } } : {}),
  devToolbar: { enabled: false },
  integrations: [{ name: 'prepared-context-availability', hooks: {
    'astro:config:setup': async ({ command, logger, updateConfig }) => {
      // Deploy builds only (CSSEARTH_ALLOW_MISSING_ASSETS=1, set by .github/workflows/deploy.yml): tolerate a
      // context package that setup:assets deliberately left missing after a 404 from R2, instead of failing the
      // whole build over one object. CI and local builds never set this flag and stay strict.
      const allowMissing = process.env.CSSEARTH_ALLOW_MISSING_ASSETS === '1';
      // An asset-origin build deliberately leaves site/public/scenes absent. Its tracked manifest is the local,
      // content-addressed contract for previews already published to R2; all prepared package bytes stay strict.
      const { availability, failures } = await prepareContextAvailability({ strict: command === 'build' && !allowMissing,
        publicAssets: assetOrigin() ? 'manifest' : 'local' });
      const renderIncrementally = incrementalRenderEnabled(command);
      updateConfig({ vite: { define: { __CSSEARTH_CONTEXT_AVAILABILITY__: JSON.stringify(availability),
        __CSSEARTH_INCREMENTAL_RENDER__: JSON.stringify(renderIncrementally),
        __CSSEARTH_VERSION__: JSON.stringify(renderIncrementally ? VERSION_TOKEN : cssEarthVersion(root)),
      } } });
      if (failures.length) logger.warn(`Some 3D views are unavailable in this installation:\n${failures.join('\n')}\nPrepare their packages and restart the server to enable them.`);
    },
  } }, { name: 'asset-origin-scenes', hooks: {
    // `site/public/scenes` (1.44 GB) is copied into `dist/scenes` by Astro's publicDir copy regardless
    // of ASSET_ORIGIN; when textures and scene JSON resolve to the published bucket instead, that
    // copy is dead weight the deploy should not ship. the assemble step (`run-implemented-objects.mts assemble`) tolerates its absence.
    'astro:build:done': async ({ dir, logger }) => {
      if (!assetOrigin()) return;
      await rm(new URL('scenes', dir), { recursive: true, force: true });
      logger.info('ASSET_ORIGIN is set: removed dist/scenes (textures and scene JSON resolve to the published bucket).');
    },
  } }, { name: 'inline-page-stylesheet', hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      logger.info(`Inlined the stylesheet of ${await inlinePageStylesheets(fileURLToPath(dir))} pages.`);
    },
  } }, { name: 'incremental-build-metadata', hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      if (!incremental) return;
      const responses = await finalizeBuildMetadata(fileURLToPath(dir), { version: cssEarthVersion(root), revision: sourceRevision(root) });
      logger.info(`Stamped current build metadata into ${responses} HTML/JSON responses.`);
    },
  } }],
  vite: {
    css: { postcss: { plugins: [preparedMotionCss(root)] } },
    plugins: [searchServer(), performanceSourceMaps(), packageSources(),
      // Safari fetches a module a second time when Vite's preload helper links one the import graph already requested
      // (163 KB of 932 on Earth's first visit, 2026-09-30). The client environment owns the browser bundle's setting.
      // The world summary ships as Vite emits it; its billboards take their published addresses (asset-origin.mts).
      { name: 'cssearth-world-billboards', apply: 'build', async generateBundle(_options, bundle) {
        for (const file of Object.values(bundle)) {
          if (file.type !== 'asset' || !file.originalFileNames.some(name => name.endsWith('observable-universe/prepared/world.json'))) continue;
          file.source = await resolveWorldBillboards(typeof file.source === 'string' ? file.source : new TextDecoder().decode(file.source));
        }
      } },
      { name: 'cssearth-no-module-preload', configEnvironment: name => name === 'client' ? { build: { modulePreload: false } } : undefined }],
    // Workers are bundled on their own plugins. They read the objects package from its sources too, so a worker keeps only
    // the object contracts it calls; renderer modules in a worker keep the bundling they had.
    worker: { plugins: () => [packageSources(['@cssearth/objects'])] },
    // Other sessions' worktrees under .claude/ and scratch runs in output/ are not this site: a change there forced a full
    // reload of every module, longer than the module runner's 60 s limit, and froze a bake photographing the site (2026-09-30).
    server: { watch: { ignored: ['**/.claude/**', '**/output/**'] } },
    define: {
      __CSSEARTH_VERSION__: JSON.stringify(cssEarthVersion(root)),
      __CSSEARTH_INCREMENTAL_RENDER__: 'false',
    },
  },
});
