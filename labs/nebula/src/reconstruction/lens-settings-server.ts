/** A local-only, explicit export receipt. Validate again when translating settings into an object recipe. */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

export function lensSettingsHandler(root: string) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store');
    try {
      if (request.method !== 'POST') throw new TypeError('Use Save lens settings in the lab.');
      const chunks: Buffer[] = []; let length = 0;
      for await (const chunk of request) {
        length += chunk.length;
        if (length > 2_000_000) throw new TypeError('Lab settings export exceeds its size limit.');
        chunks.push(Buffer.from(chunk));
      }
      const value = JSON.parse(Buffer.concat(chunks).toString());
      if (value?.schema !== 'cssearth-nebula-lens-settings@1' || !/^[a-z0-9-]+$/.test(value.subjectId) ||
          typeof value.capturedAt !== 'string' || !Number.isFinite(Date.parse(value.capturedAt)) ||
          typeof value.selection?.imageId !== 'string' || !value.storage || typeof value.storage !== 'object' || Array.isArray(value.storage) ||
          Object.entries(value.storage).some(([key, item]) => !key.startsWith('cssearth-nebula-') || typeof item !== 'string'))
        throw new TypeError('Invalid lab settings export.');
      const directory = resolve(root, '.local/nebula-lab/lens-settings'); await mkdir(directory, { recursive: true });
      const bytes = JSON.stringify(value, null, 2) + '\n', identity = `${Date.now()}-${randomUUID()}`;
      await writeFile(resolve(directory, `${identity}.json`), bytes);
      await writeFile(resolve(directory, `${identity}.pending`), bytes);
      await rename(resolve(directory, `${identity}.pending`), resolve(directory, 'latest.json'));
      response.end(JSON.stringify({ saved: true }));
    } catch (error) { response.statusCode = 400; response.end(JSON.stringify({ error: (error as Error).message })); }
  };
}
