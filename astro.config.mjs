import { execSync } from "node:child_process";

import { defineConfig } from "astro/config";
import { SITE_ORIGIN } from "./site/seo.mjs";
import { wmtsLocalMirror } from "./src/planets/earth/tools/wmts-local-server.mjs";

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
    plugins: [wmtsLocalMirror()],
    define: {
      __CSSEARTH_VERSION__: JSON.stringify(cssEarthVersion()),
    },
  },
});
