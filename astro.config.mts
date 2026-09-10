import { execSync } from "node:child_process";

import { defineConfig } from "astro/config";
import { SITE_ORIGIN } from "./site/seo.mts";
import { wmtsLocalMirror } from "./tools/objects/geographic-pages/operations/wmts-local-server.mts";

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
  vite: {
    plugins: [wmtsLocalMirror({objectId:"earth"})],
    define: {
      __CSSEARTH_VERSION__: JSON.stringify(cssEarthVersion()),
    },
  },
});
