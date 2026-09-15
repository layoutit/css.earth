import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { basename, isAbsolute, resolve, sep } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { prepareKinematicsComparison } from '@cssearth/nebula-reconstruction/methods/kinematics/forward-model';
import { readKinematicParameters, readSlitEvidence, record } from '@cssearth/nebula-reconstruction/methods/kinematics/validation';

export const kinematicsEndpoint = '/__nebula/kinematics';
export async function loadKinematicEvidence(root: string, sourcePath: string) {
  const directory = await realpath(resolve(root, 'labs/nebula/models'));
  if (isAbsolute(sourcePath) || !/^kinematics[^/]*\.json$/.test(basename(sourcePath))) throw new TypeError('Expected a model kinematics recipe.');
  const path = await realpath(resolve(root, sourcePath));
  if (!path.startsWith(directory + sep)) throw new TypeError('Source is outside the model directory.');
  const bytes = await readFile(path);
  if (bytes.byteLength > 262144) throw new TypeError('Slit evidence is too large.');
  return { evidence: readSlitEvidence(JSON.parse(bytes.toString()) as unknown), evidenceSha256: createHash('sha256').update(bytes).digest('hex') };
}
async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []; let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); length += bytes.length;
    if (length > 16384) throw new TypeError('Kinematics request is too large.'); chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString()) as unknown;
}
export function createKinematicsHandler(root: string) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      response.setHeader('cache-control', 'no-store');
      if (request.method !== 'GET' && request.method !== 'POST') { response.statusCode = 405; response.end(); return; }
      const query = new URL(request.url || '/', 'http://localhost').searchParams;
      const body = request.method === 'POST' ? record(await readBody(request)) : null;
      const sourcePath = body ? body.sourcePath : query.get('source');
      if (typeof sourcePath !== 'string') throw new TypeError('Missing slit source.');
      const { evidence, evidenceSha256 } = await loadKinematicEvidence(root, sourcePath);
      if (!body && query.get('figure') === '1') {
        const base = await realpath(resolve(root, '.local/nebula-lab/kinematics'));
        const figurePath = await realpath(resolve(root, evidence.figure.cachePath));
        if (!figurePath.startsWith(base + sep)) throw new TypeError('Figure lies outside the prepared kinematics cache.');
        const bytes = await readFile(figurePath);
        if (createHash('sha256').update(bytes).digest('hex') !== evidence.citation.figureSha256) throw new TypeError('Published figure checksum changed.');
        response.setHeader('content-type', 'image/jpeg'); response.end(bytes); return;
      }
      const parameters = body ? readKinematicParameters(body.parameters) : evidence.defaults;
      if (parameters.radiusArcsec !== evidence.defaults.radiusArcsec) throw new TypeError('This comparison retains its source-pinned projected radius.');
      const prepared = prepareKinematicsComparison(evidence, parameters, evidenceSha256);
      response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(prepared));
    } catch (error) {
      response.statusCode = 400; response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Kinematic comparison unavailable.' }));
    }
  };
}
export function kinematicsPlugin(root: string): Plugin {
  return { name: 'nebula-kinematics', configureServer(server) {
    const handler = createKinematicsHandler(root);
    server.middlewares.use(kinematicsEndpoint, (request, response) => { void handler(request, response); });
  } };
}
