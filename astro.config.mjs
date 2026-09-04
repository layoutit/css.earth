import { execSync } from "node:child_process";

import { defineConfig } from "astro/config";

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
  srcDir: "./site",
  publicDir: "./public",
  outDir: "./dist",
  output: "static",
  devToolbar: { enabled: false },
  vite: {
    define: {
      __CSSEARTH_VERSION__: JSON.stringify(cssEarthVersion()),
    },
  },
});
