import { useEffect, useRef, useState } from 'react';
import { readCloudJob } from './shape-cloud-client';
import { FUSION_VERSION, readFusionResult, type FusionRequest, type FusionResult } from '../reconstruction/evidence-fusion/jobs-model';
import { localFile } from '../viewer/viewer';

/** One active server-owned preparation and the latest desired edit; refresh reconnects. */
export function useEvidenceFusion(request: FusionRequest, storageKey: string) {
  const [result, setResult] = useState<FusionResult | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(''), [revision, setRevision] = useState(0);
  const desired = useRef(request), queue = useRef<(() => void) | null>(null); desired.current = request;
  useEffect(() => {
    let stopped = false, running = false, timer: ReturnType<typeof setTimeout> | undefined, accepted = '';
    const controller = new AbortController();
    const jobKey = `${storageKey}:job`;
    async function api(path: string, body?: unknown) {
      const response = await fetch(`/__nebula/evidence-jobs${path}`, { cache: 'no-store', signal: controller.signal,
        ...(body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      const json: unknown = await response.json();
      if (!response.ok) throw new Error(`Combined evidence unavailable (${response.status}).`);
      return readCloudJob(json, 'joint-evidence');
    }
    async function observe(id: string) {
      let job = await api(`/${id}`);
      while (['queued', 'running', 'cancelling'].includes(job.status)) {
        if (stopped) throw new DOMException('Detached', 'AbortError');
        setProgress(job.progress?.message ?? 'Combining registered evidence…');
        await new Promise(resolve => setTimeout(resolve, 250)); job = await api(`/${id}`);
      }
      if (job.status !== 'completed') throw new Error(job.error ?? `Combined evidence ${job.status}.`);
      return readFusionResult(job.result);
    }
    async function decode(value: FusionResult) {
      const paths = [value.union, value.colors, value.agreement, ...value.sources.flatMap(s => [s.source, s.evidence])];
      await Promise.all(paths.map(async asset => { const image = new Image(); image.src = `${localFile(asset.path)}?v=${asset.sha256}`; await image.decode(); }));
    }
    async function run() {
      if (running || stopped) return;
      running = true; setBusy(true); setError('');
      try {
        do {
          const current = desired.current, signature = JSON.stringify({ version: FUSION_VERSION, request: current });
          if (signature === accepted) break;
          let saved: { id: string; signature: string } | undefined;
          try {
            const value: unknown = JSON.parse(localStorage.getItem(jobKey) ?? 'null');
            if (value && typeof value === 'object' && 'id' in value && 'signature' in value && typeof value.id === 'string' &&
                /^[a-f0-9-]{36}$/.test(value.id) && typeof value.signature === 'string') saved = { id: value.id, signature: value.signature };
          } catch { /* Malformed job pointers cannot authorize reuse. */ }
          let value: FusionResult;
          if (saved?.signature === signature) value = await observe(saved.id);
          else {
            const id = crypto.randomUUID();
            await api('', { requestId: id, request: current });
            localStorage.setItem(jobKey, JSON.stringify({ id, signature }));
            value = await observe(id);
          }
          if (JSON.stringify(value.settings) !== JSON.stringify(current.settings)) throw new Error('Prepared evidence settings differ from the requested values.');
          await decode(value);
          if (stopped) break;
          accepted = signature; setResult(value); setProgress('');
        } while (accepted !== JSON.stringify({ version: FUSION_VERSION, request: desired.current }));
      } catch (reason) { if (!stopped) setError(reason instanceof Error ? reason.message : 'Combined evidence failed.'); }
      finally { running = false; if (!stopped) setBusy(false); }
    }
    queue.current = () => { clearTimeout(timer); timer = setTimeout(() => { void run(); }, 180); };
    queue.current();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); queue.current = null; };
  }, [storageKey, revision]);
  useEffect(() => { queue.current?.(); }, [request]);
  return { result, error, busy, progress, retry() { localStorage.removeItem(`${storageKey}:job`); setRevision(value => value + 1); } };
}
