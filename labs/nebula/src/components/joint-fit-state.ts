import { useEffect, useRef, useState } from 'react';
import { readCloudJob } from './shape-cloud-client';
import type { JointRequest } from '../reconstruction/joint-fit/model';
import { readJointResult, type JointResult } from '../reconstruction/joint-fit/result';
import { localFile } from '../viewer/viewer';

/** Server work survives browser detachment; only the latest desired edit follows an active fit. */
export function useJointFit(request: JointRequest, storageKey: string) {
  const [result, setResult] = useState<JointResult | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(''), [revision, setRevision] = useState(0);
  const desired = useRef(request), queue = useRef<(() => void) | null>(null); desired.current = request;
  useEffect(() => {
    let stopped = false, running = false, accepted = '', timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController(), jobKey = `${storageKey}:job`;
    const signature = (r: JointRequest) => JSON.stringify({ version: 'molecular-wall-joint-fit@1', request: r });
    async function api(path: string, body?: unknown) {
      const response = await fetch(`/__nebula/joint-fit-jobs${path}`, { cache: 'no-store', signal: controller.signal,
        ...(body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      const json: unknown = await response.json(); if (!response.ok) throw new Error(`Joint fit unavailable (${response.status}).`);
      return readCloudJob(json, 'joint-fit');
    }
    async function observe(id: string) {
      let job = await api(`/${id}`);
      while (['queued', 'running', 'cancelling'].includes(job.status)) {
        if (stopped) throw new DOMException('Detached', 'AbortError');
        setProgress(job.progress?.message ?? 'Fitting candidate shapes…');
        await new Promise(resolve => setTimeout(resolve, 300)); job = await api(`/${id}`);
      }
      if (job.status !== 'completed') throw new Error(job.error ?? `Joint fit ${job.status}.`);
      return readJointResult(job.result);
    }
    async function run() {
      if (running || stopped) return; running = true; setBusy(true); setError('');
      try {
        do {
          const current = desired.current, key = signature(current); if (accepted === key) break;
          let saved: { id: string; signature: string } | undefined;
          try { const v: unknown = JSON.parse(localStorage.getItem(jobKey) ?? 'null');
            if (v && typeof v === 'object' && 'id' in v && 'signature' in v && typeof v.id === 'string' && /^[a-f0-9-]{36}$/.test(v.id) && typeof v.signature === 'string') saved = { id: v.id, signature: v.signature };
          } catch { /* Corrupt pointers cannot select results. */ }
          let next: JointResult;
          if (saved?.signature === key) next = await observe(saved.id);
          else { const id = crypto.randomUUID(); await api('', { requestId: id, request: current }); localStorage.setItem(jobKey, JSON.stringify({ id, signature: key })); next = await observe(id); }
          if (JSON.stringify(next.controls) !== JSON.stringify(current.controls)) throw new Error('Prepared fit controls do not match the requested values.');
          await Promise.all(next.sources.map(async source => { const image = new Image(); image.src = `${localFile(source.image.path)}?v=${source.image.sha256}`; await image.decode(); }));
          if (stopped) break; accepted = key; setResult(next); setProgress('');
        } while (accepted !== signature(desired.current));
      } catch (cause) { if (!stopped) setError(cause instanceof Error ? cause.message : 'Joint fit failed.'); }
      finally { running = false; if (!stopped) setBusy(false); }
    }
    queue.current = () => { clearTimeout(timer); timer = setTimeout(() => { void run(); }, 220); }; queue.current();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); queue.current = null; };
  }, [storageKey, revision]);
  useEffect(() => { queue.current?.(); }, [request]);
  return { result, error, busy, progress, retry() { localStorage.removeItem(`${storageKey}:job`); setRevision(v => v + 1); } };
}
