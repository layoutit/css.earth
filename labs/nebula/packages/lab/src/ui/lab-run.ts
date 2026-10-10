/** Starts a lab CLI command for one object (`research`, `model`, `stars`) through the lab server, and waits for its
 * end in the object's progress file: the same process and record an agent's run makes. */
import { isRecord } from '@cssearth/core';

export type LabRun = { command: 'research' | 'stars'; object: string } | { command: 'model'; object: string; method: 'paper-surfaces' | 'symmetry' | 'kinematic' };
interface Job { object: string; step: string; state: string; startedAt: string; error?: string }

/** Runs the command and resolves when its job ends: done, or a rejection with the job's error. */
export async function runLabCommand(run: LabRun, signal?: AbortSignal): Promise<void> {
  const step = run.command === 'model' ? `model ${run.method}` : run.command, since = new Date(Date.now() - 2000).toISOString();
  const response = await fetch('/__nebula/lab-run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run), signal });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok && response.status !== 409) throw new Error(isRecord(body) && typeof body.error === 'string' ? body.error : `lab-run failed (${response.status}).`);
  const started = Date.now();
  let seen = false;
  while (!signal?.aborted) {
    await new Promise(accept => setTimeout(accept, 700));
    const progress: unknown = await fetch('/__nebula/lab-progress', { cache: 'no-store', signal }).then(answer => answer.json()).catch(() => null);
    const jobs = isRecord(progress) && Array.isArray(progress.jobs) ? progress.jobs as Job[] : [];
    const job = jobs.filter(item => item.object === run.object && item.step === step && item.startedAt >= since).at(-1);
    if (job) seen = true;
    if (job && job.state === 'done') return;
    if (job && job.state !== 'running') throw new Error(job.error ?? `${step} ${job.state}`);
    // A job that ended before a poll saw it running leaves the list after a few seconds: the caller re-reads its result.
    if (!job && seen) return;
    if (!seen && Date.now() - started > 20000) throw new Error(`${step} did not start.`);
  }
  throw new DOMException('Cancelled', 'AbortError');
}
