import { execSync } from "node:child_process";
import { rm } from "node:fs/promises";

import { defineConfig } from "astro/config";
import { SITE_ORIGIN } from "./site/seo.mts";
import { wmtsLocalMirror } from "./tools/objects/geographic-pages/operations/wmts-local-server.mts";
import { performanceSourceMaps } from "./tools/performance/source-maps.mts";
import { searchServer } from './tools/cli/search-server.mts';
import { prepareContextAvailability } from "./tools/prepare/prepare-context-availability.mts";
import { assetOrigin } from "./site/asset-origin.mts";

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
    // copy is dead weight the deploy should not ship. `assemble:planets` tolerates its absence.
    'astro:build:done': async ({ dir, logger }) => {
      if (!assetOrigin()) return;
      await rm(new URL('scenes', dir), { recursive: true, force: true });
      logger.info('ASSET_ORIGIN is set: removed dist/scenes (textures and scene JSON resolve to the published bucket).');
    },
  } }],
  vite: {
    plugins: [searchServer(), wmtsLocalMirror({objectId:"earth"}), performanceSourceMaps()],
    define: {
      __CSSEARTH_VERSION__: JSON.stringify(cssEarthVersion()),
    },
  },
});
