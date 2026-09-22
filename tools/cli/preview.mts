import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { preview } from "vite";
import { wmtsLocalMirror } from "../objects/geographic-pages/operations/wmts-local-server.mts";
import { searchServer } from './search-server.mts';

// Astro static preview discards user Vite plugins. Use Vite's static preview
// directly so the same prepared-pack middleware works in dev and preview.
export function previewSite({ root = new URL("../../", import.meta.url).pathname,
  outDir = "dist", host = "127.0.0.1", port = 4210, geometryDirectory }: {root?: string; outDir?: string; host?: string; port?: number; geometryDirectory?: string | URL} = {}) {
  return preview({ root, configFile: false, appType: "mpa", publicDir: false,
    build: { outDir }, plugins: [searchServer(), wmtsLocalMirror({objectId:"earth", directory: geometryDirectory })],
    preview: { host, port, strictPort: true } });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: {
    host: { type: "string", default: "127.0.0.1" },
    port: { type: "string", default: "4210" },
  } });
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid preview port.");
  const server = await previewSite({ host: values.host, port });
  server.printUrls();
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => {
    await server.close(); process.exit(0);
  });
}
