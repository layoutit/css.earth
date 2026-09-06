import { open, readFile, stat } from "node:fs/promises";

const { delivery } = JSON.parse(await readFile(new URL("../source/city/manifest.json", import.meta.url), "utf8"));

// A local mirror is optional. A fresh checkout reads the same immutable
// ranges from the published release; the browser still checks each block.
export function wmtsLocalMirror({ directory = new URL("../../../../.local/wmts-global/", import.meta.url),
  assetOrigin = delivery.assetOrigin, fetcher = fetch } = {}) {
  const install = server => { server.middlewares.use(async (req, res, next) => {
    const match = /^\/scenes\/earth\/wmts-([a-f0-9]{16})\/((?:5|8)-\d+-\d+\.pack)$/u.exec(req.url ?? "");
    if (!match) return next();
    if (!["GET", "HEAD"].includes(req.method)) { res.statusCode = 405; res.end(); return; }
    const range = /^bytes=(\d+)-(\d+)$/u.exec(req.headers.range ?? "");
    const start = Number(range?.[1]), end = Number(range?.[2]), length = end - start + 1;
    if (!range || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
        start < 0 || length < 1 || length > 2 * 1024 * 1024) {
      res.statusCode = 416; res.end("A bounded prepared range is required."); return;
    }
    const controller = new AbortController();
    res.once("close", () => controller.abort());
    let handle;
    try {
      const path = new URL(`${match[1]}/${match[2]}`, directory);
      let info;
      try { info = await stat(path); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      let bytes, contentRange;
      if (info) {
        if (end >= info.size) { res.statusCode = 416; res.end(); return; }
        contentRange = `bytes ${start}-${end}/${info.size}`;
        if (req.method !== "HEAD") {
          handle = await open(path);
          bytes = Buffer.alloc(length);
          if ((await handle.read(bytes, 0, length, start)).bytesRead !== length) {
            throw new Error("Incomplete local prepared range.");
          }
        }
      } else {
        const response = await fetcher(new URL(req.url, assetOrigin), {
          method: req.method, headers: { Range: req.headers.range, "Accept-Encoding": "identity" },
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
        });
        contentRange = response.headers.get("content-range");
        const returned = /^bytes (\d+)-(\d+)\/(\d+)$/u.exec(contentRange ?? "");
        if (response.status !== 206 || !returned || Number(returned[1]) !== start ||
            Number(returned[2]) !== end || Number(returned[3]) <= end) {
          await response.body?.cancel();
          res.statusCode = response.status === 404 ? 404 : 502;
          res.end("Published geometry range is unavailable."); return;
        }
        if (req.method !== "HEAD") {
          const chunks = [];
          let received = 0;
          for await (const chunk of response.body) {
            received += chunk.length;
            if (received > length) throw new Error("Published range exceeds its requested size.");
            chunks.push(chunk);
          }
          if (received !== length) throw new Error("Incomplete published prepared range.");
          bytes = Buffer.concat(chunks);
        }
      }
      res.statusCode = 206;
      res.setHeader("Content-Range", contentRange);
      res.setHeader("Content-Length", length);
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public,max-age=31536000,immutable");
      res.end(bytes);
    } catch {
      res.statusCode = 502; res.end("Prepared geometry is unavailable.");
    } finally { await handle?.close(); }
  }); };
  return { name: "earth-prepared-geometry-mirror", configureServer: install, configurePreviewServer: install };
}
