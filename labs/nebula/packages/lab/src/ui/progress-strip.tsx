/** The lab's live progress: one small pill per job at the bottom left (step and percent, or its result), whether the
 * CLI or a button started it; hovering a pill shows the object, the stage and any error. The lab server tails each
 * object's `.local/lab/progress.jsonl`. */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { isRecord } from '@cssearth/core';
import { InfoTip } from './info-tip';
import './progress-strip.css';

interface Job { job: string; object: string; step: string; stage: string; percent: number; state: 'running' | 'done' | 'failed' | 'cancelled'; error?: string; updatedAt?: string }
const POLL_MS = 600;
const readJobs = (value: unknown): Job[] => isRecord(value) && Array.isArray(value.jobs) ? value.jobs.filter((job): job is Job => isRecord(job) && typeof job.job === 'string') : [];

/** `onBaked`: called once for each bake that finishes after the page loaded, with its object, so the view shows it. */
export function ProgressStrip({ onBaked }: { onBaked?: (object: string) => void } = {}) {
  const [jobs, setJobs] = useState<Job[]>([]), loadedAt = useRef(Date.now()), handled = useRef(new Set<string>()), baked = useRef(onBaked);
  baked.current = onBaked;
  useEffect(() => { for (const job of jobs) if (job.step === 'bake' && job.state === 'done' && !handled.current.has(job.job) && Date.parse(job.updatedAt ?? '') > loadedAt.current) { handled.current.add(job.job); baked.current?.(job.object); } }, [jobs]);
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
    {jobs.map(job => { const result = job.state === 'running' ? `${job.percent}%` : job.state === 'done' ? '✓' : job.state === 'failed' ? '✗' : '–';
      const detail = `${job.object} · ${job.step} · ${job.state === 'failed' ? job.error ?? 'failed' : job.stage}${job.state === 'running' ? ` · ${job.percent}%` : ` · ${job.state}`}`;
      return <InfoTip key={job.job} content={detail}>
        <span className="lab-progress-pill" tabIndex={0} data-progress-state={job.state} data-progress-object={job.object} data-progress-step={job.step}
          style={{ '--progress': `${job.percent}%` } as CSSProperties}>
          <span className="lab-progress-ring" aria-hidden="true" />
          <span className="lab-progress-step">{job.step}</span>
          <span className="lab-progress-result">{result}</span>
        </span>
      </InfoTip>; })}
  </div>;
}
