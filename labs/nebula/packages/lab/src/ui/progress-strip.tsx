/** The lab's live progress: one compact row per job (object · step · stage · % · result), whether the CLI or a button
 * started it. The lab server tails each object's `.local/lab/progress.jsonl`. */
import { useEffect, useState } from 'react';
import { isRecord } from '@cssearth/core';
import './progress-strip.css';

interface Job { job: string; object: string; step: string; stage: string; percent: number; state: 'running' | 'done' | 'failed' | 'cancelled'; error?: string }
const POLL_MS = 600;
const readJobs = (value: unknown): Job[] => isRecord(value) && Array.isArray(value.jobs) ? value.jobs.filter((job): job is Job => isRecord(job) && typeof job.job === 'string') : [];

export function ProgressStrip() {
  const [jobs, setJobs] = useState<Job[]>([]);
  useEffect(() => {
    let stopped = false, timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try { const response = await fetch('/__nebula/lab-progress', { cache: 'no-store' }); if (response.ok && !stopped) setJobs(readJobs(await response.json())); }
      catch { /* The next poll retries. */ }
      if (!stopped) timer = setTimeout(() => void poll(), POLL_MS);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, []);
  if (!jobs.length) return null;
  return <div className="lab-progress-strip" role="status" aria-label="Running jobs">
    {jobs.map(job => <div key={job.job} className="lab-progress-row" data-progress-state={job.state} data-progress-object={job.object} data-progress-step={job.step}
      title={job.error ?? undefined}>
      <span className="lab-progress-object">{job.object}</span>
      <span className="lab-progress-step">{job.step}</span>
      <span className="lab-progress-stage">{job.state === 'running' ? job.stage : job.state === 'failed' ? job.error ?? 'failed' : job.stage}</span>
      <progress max={100} value={job.percent} />
      <span className="lab-progress-percent">{job.percent}%</span>
      <span className="lab-progress-result">{job.state === 'running' ? '…' : job.state === 'done' ? '✓ done' : job.state === 'failed' ? '✗ failed' : 'cancelled'}</span>
    </div>)}
  </div>;
}
