import { execFileSync } from 'node:child_process';


export function unzipMember(archive: string, member: string): Uint8Array {
  return execFileSync('unzip', ['-p', archive, member], { maxBuffer: 64 * 1024 * 1024 });
}
