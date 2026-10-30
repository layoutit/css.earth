/** A preview may restore an interrupted predecessor, but must never race a still-running restoration. */
import { open, readFile, rm } from 'node:fs/promises';
import { need } from '../inputs.mts';
const absent = (e: unknown) => e !== null && typeof e === 'object' && 'code' in e && e.code === 'ENOENT';
async function owner(path: string): Promise<number | null> {
  try { const pid = Number(await readFile(path, 'utf8')); need(Number.isSafeInteger(pid) && pid > 0, 'Invalid preview lease; inspect it before recovery'); return pid; } catch (e) { if (absent(e)) return null; throw e; }
}
function alive(pid: number) { try { process.kill(pid, 0); return true; } catch (e) { if (e && typeof e === 'object' && 'code' in e && e.code === 'ESRCH') return false; return true; } }
export async function withPreviewLease<T>(path: string, work: () => Promise<T>): Promise<T> {
  const gatePath = path + '.activation', gate = await open(gatePath, 'wx').catch(() => { throw Error('A preview activation is in progress; do not overlap bank transactions'); });
  try {
    const pid = await owner(path); need(pid === null || !alive(pid), 'Another preview is still running or restoring its bank');
    if (pid !== null) await rm(path);
    const lease = await open(path, 'wx'); try { await lease.writeFile(String(process.pid)); } finally { await lease.close(); }
  } finally { await gate.close(); await rm(gatePath); }
  try { return await work(); } finally { need(await owner(path) === process.pid, 'The preview lease changed ownership'); await rm(path); }
}
