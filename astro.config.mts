import { execSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { defineConfig } from "astro/config";
import { SITE_ORIGIN } from "./site/seo.mts";
import { performanceSourceMaps } from "./site/build/source-maps.mts";
import { packageSources } from "./site/build/package-sources.mts";
import { inlinePageStylesheets } from "./site/build/inline-page-stylesheet.mts";
import { searchServer } from './site/server/search-server.mts';
import { prepareContextAvailability } from "./site/build/prepare/prepare-context-availability.mts";
import { preparedMotionCss } from "./site/build/prepared-motion-css.mts";
import { assetOrigin, resolveWorldBillboards } from "./site/asset-origin.mts";

function cssEarthVersion() {
  try {
    const commitCount = execSync("git rev-list --count HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return `0.${commitCount}`;
  } catch {
    return "0.0";
  }
}

export default defineConfig({
  site: SITE_ORIGIN,
  trailingSlash: "always",
  srcDir: "./site",
  publicDir: "./public",
  outDir: "./dist",
  output: "static",
  devToolbar: { enabled: false },
  integrations: [{ name: 'prepared-context-availability', hooks: {
    'astro:config:setup': async ({ command, logger, updateConfig }) => {
      // Deploy builds only (CSSEARTH_ALLOW_MISSING_ASSETS=1, set by .github/workflows/deploy.yml): tolerate a
      // context package that setup:assets deliberately left missing after a 404 from R2, instead of failing the
      // whole build over one object. CI and local builds never set this flag and stay strict.
      const allowMissing = process.env.CSSEARTH_ALLOW_MISSING_ASSETS === '1';
      // An asset-origin build deliberately leaves public/scenes absent. Its tracked manifest is the local,
      // content-addressed contract for previews already published to R2; all prepared package bytes stay strict.
      const { availability, failures } = await prepareContextAvailability({ strict: command === 'build' && !allowMissing,
        publicAssets: assetOrigin() ? 'manifest' : 'local' });
      updateConfig({ vite: { define: { __CSSEARTH_CONTEXT_AVAILABILITY__: JSON.stringify(availability) } } });
      if (failures.length) logger.warn(`Some 3D views are unavailable in this installation:\n${failures.join('\n')}\nPrepare their packages and restart the server to enable them.`);
    },
  } }, { name: 'asset-origin-scenes', hooks: {
    // `public/scenes` (1.44 GB) is copied into `dist/scenes` by Astro's publicDir copy regardless
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
  } }],
  vite: {
    css: { postcss: { plugins: [preparedMotionCss(process.cwd())] } },
    plugins: [searchServer(), performanceSourceMaps(), packageSources(),
      // Safari fetches a module a second time when Vite's preload helper links one the import graph already requested
      // (163 KB of 932 on Earth's first visit, 2026-09-30). The client environment owns the browser bundle's setting.
      // The world summary ships as Vite emits it; its billboards take their published addresses (asset-origin.mts).
      { name: 'cssearth-world-billboards', apply: 'build', async generateBundle(_options, bundle) {
        for (const file of Object.values(bundle)) {
          if (file.type !== 'asset' || !file.originalFileNames.some(name => name.endsWith('world-context-summary.json'))) continue;
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
      __CSSEARTH_VERSION__: JSON.stringify(cssEarthVersion()),
    },
  },
});
