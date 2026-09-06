import { createServer } from "node:https";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { createHash, X509Certificate } from "node:crypto";

// Test-only HTTPS origin with normal browser caching. No request interception,
// development middleware, geometry mirror or application-byte rewriting.
export async function serveBuiltFixture(directory) {
  const root = resolve(directory), certificate = await mkdtemp(join(tmpdir(), "cssearth-built-cert-"));
  const key = join(certificate, "key.pem"), cert = join(certificate, "cert.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert,
    "-days", "1", "-subj", "/CN=css.earth", "-addext", "subjectAltName=DNS:css.earth"], { stdio: "ignore" });
  const requests = [], types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
  const server = createServer({ key: await readFile(key), cert: await readFile(cert) }, async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, "https://css.earth").pathname);
    const row = { path, method: req.method }; requests.push(row);
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
      let file = resolve(root, `.${path}`);
      if (!file.startsWith(`${root}${sep}`) && file !== root) throw new Error("Outside fixture root.");
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      const info = await stat(file);
      row.bytes = info.size; row.status = 200;
      if (file.endsWith(".js")) row.sha256 = createHash("sha256").update(await readFile(file)).digest("hex");
      res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "content-length": info.size,
        "cache-control": file.endsWith(".html") ? "no-cache" : "public,max-age=3600" });
      if (req.method === "HEAD") res.end(); else createReadStream(file).pipe(res);
    } catch { row.status = 404; res.writeHead(404).end(); }
  });
  await new Promise((accept, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", accept); });
  const publicKey = new X509Certificate(await readFile(cert)).publicKey.export({ type: "spki", format: "der" });
  const spki = createHash("sha256").update(publicKey).digest("base64");
  return { root, requests, url: "https://css.earth",
    launchArgs: [`--host-resolver-rules=MAP css.earth 127.0.0.1:${server.address().port}`, `--ignore-certificate-errors-spki-list=${spki}`],
    async close() { server.closeAllConnections(); await new Promise(accept => server.close(accept)); await rm(certificate, { recursive: true, force: true }); } };
}
