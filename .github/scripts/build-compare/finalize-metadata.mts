/** Bind module observations to the complete dist after Vite and Astro finish rewriting output. */
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {array,files,record,string} from './records.mts';
export async function finalizeMetadata(output: string, dist: string): Promise<void> {
  const emitted = new Set(await files(dist));
  for (const path of await files(join(output, 'metadata'))) {
    if (!path.endsWith('.json')) continue;
    const file=join(output,'metadata',path), environment=record(JSON.parse(await readFile(file,'utf8')));
    for (const raw of array(environment.chunks)) {
      const chunk=record(raw), name=string(chunk.fileName);
      if (!emitted.has(name)) continue; // Deleted prerender chunks retain their bundle observation.
      const bytes=await readFile(join(dist,name));
      // Mutate the validated underlying JSON record, not record()'s defensive copy.
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid chunk');
      Object.assign(raw,{emittedDigest:createHash('md5').update(bytes).digest('hex')});
    }
    environment.emittedDigestStage='final-dist';
    await writeFile(file,JSON.stringify(environment));
  }
}
