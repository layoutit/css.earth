/** One member of a ZIP archive held in memory, taken with `unzip` as the acquisition plan's `zip-member` step takes it. */
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

export async function zipMember(archive: Buffer, member: string): Promise<Buffer> {
  const scratch = await mkdtemp(join(tmpdir(), 'zip-member-'));
  try {
    await writeFile(join(scratch, 'archive.zip'), archive);
    return (await promisify(execFile)('unzip', ['-p', join(scratch, 'archive.zip'), member], { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 })).stdout;
  } catch (error) { throw new Error(`The archive holds no readable member ${member}: ${(error as Error).message.split('\n')[0]}`); } finally { await rm(scratch, { recursive: true, force: true }); }
}
