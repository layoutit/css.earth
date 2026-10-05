/** Child entry for the real preview's arbitrary-dist API; CLI has no dist option. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const checkout = process.argv[4];
if (!checkout) throw new Error('Expected preview checkout');
const module: unknown = await import(pathToFileURL(resolve(checkout, 'site/server/preview.mts')).href);
if (!module || typeof module !== 'object' || !('previewSite' in module) || typeof module.previewSite !== 'function')
  throw new Error('Checkout does not export previewSite');
const port = Number(process.argv[2]), outDir = process.argv[3];
if (!Number.isInteger(port) || port < 1 || port > 65535 || !outDir) throw new Error('Expected port and dist');
const server: unknown = await module.previewSite({ port, outDir, root: checkout });
if (!server || typeof server !== 'object' || !('printUrls' in server) || typeof server.printUrls !== 'function'
  || !('close' in server) || typeof server.close !== 'function') throw new Error('Invalid preview server');
const close = server.close.bind(server);
server.printUrls();
process.once('disconnect', async () => { await close(); process.exit(0); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, async () => {
  await close(); process.exit(0);
});
