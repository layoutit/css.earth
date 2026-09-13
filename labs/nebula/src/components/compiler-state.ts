import { useEffect, useRef, useState } from 'react';
import { readCloudJob, activeCloudJob, type CloudJob } from './shape-cloud-client';
import { readCompilerRequest, type CompilerRequest } from '../reconstruction/compiler/model';
import { readCompilerResult, type CompilerResult } from '../reconstruction/compiler/result';
import { loadPublishedCompiler } from './compiler-published';
import { localFile } from '../viewer/viewer';

interface Pointer { id: string; signature: string; request: CompilerRequest }
interface Ledger { active?: Pointer; completed?: Pointer; paused?: string; cancelRequested?: boolean }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const signature = (request: CompilerRequest) => JSON.stringify({ version: 'compiler-session@1', request });
function readPointer(value: unknown): Pointer {
  if (!object(value) || typeof value.id !== 'string' || !/^[a-f0-9-]{36}$/.test(value.id) || typeof value.signature !== 'string') throw new TypeError('Invalid compiler job pointer.');
  const request = readCompilerRequest(value.request);
  if (signature(request) !== value.signature) throw new TypeError('Compiler job pointer does not match its request.');
  return { id: value.id, signature: value.signature, request };
}
function readLedger(key: string): Ledger {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!object(value)) return {};
    return { ...(value.active ? { active: readPointer(value.active) } : {}), ...(value.completed ? { completed: readPointer(value.completed) } : {}),
      ...(typeof value.paused === 'string' ? { paused: value.paused } : {}), ...(value.cancelRequested === true ? { cancelRequested: true } : {}) };
  } catch { return {}; }
}
class CompilerHttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }

/** Explicit first compile; subsequent edits are latest-only. Detachment never cancels server work. */
export function useCompiler(request: CompilerRequest, storageKey: string, inputsReady = true, publishedPath?: string) {
  const [result, setResult] = useState<CompilerResult | null>(null), [job, setJob] = useState<CloudJob | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState(''), [storageError, setStorageError] = useState('');
  const [status, setStatus] = useState('Ready to compile');
  const desired = useRef(request); desired.current = request;
  const ready = useRef(inputsReady); ready.current = inputsReady;
  const published = useRef(publishedPath); published.current = publishedPath;
  const actions = useRef<{ compile(): void; cancel(): void; changed(): void } | null>(null);
  useEffect(() => {
    let stopped = false, running = false, booting = true, cancelWanted = false, cancelSent = false, manualWanted = false, publishedBaseline = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController(), jobKey = `${storageKey}:jobs`;
    let ledger = readLedger(jobKey), accepted = '';
    const sameScope = (pointer: Pointer | undefined) => !pointer || (pointer.request.recipePath === desired.current.recipePath && pointer.request.cataloguePath === desired.current.cataloguePath);
    if (!sameScope(ledger.active) || !sameScope(ledger.completed)) ledger = {};
    function save() {
      try { localStorage.setItem(jobKey, JSON.stringify(ledger)); if (!stopped) setStorageError(''); }
      catch { if (!stopped) setStorageError('Session only · job storage unavailable'); }
    }
    async function api(path: string, body?: unknown): Promise<CloudJob> {
      const response = await fetch(`/__nebula/compiler-jobs${path}`, { cache: 'no-store', signal: controller.signal,
        ...(body !== undefined ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      const value: unknown = await response.json();
      if (!response.ok) throw new CompilerHttpError(response.status, object(value) && typeof value.error === 'string' ? value.error : `Compiler unavailable (${response.status}).`);
      return readCloudJob(value, 'compiler');
    }
    const pause = () => new Promise<void>((resolve, reject) => {
      const finish = () => { controller.signal.removeEventListener('abort', abort); resolve(); };
      const id = setTimeout(finish, 300);
      const abort = () => { clearTimeout(id); controller.signal.removeEventListener('abort', abort); reject(new DOMException('Compiler observer detached.', 'AbortError')); };
      controller.signal.addEventListener('abort', abort, { once: true });
    });
    async function observe(pointer: Pointer, first?: CloudJob): Promise<CompilerResult | null> {
      let current = first ?? await api(`/${pointer.id}`);
      while (!stopped) {
        setJob(current);
        setStatus(current.progress?.message ?? (current.status === 'queued' ? 'Compile queued…' : current.status === 'cancelling' ? 'Cancelling…' : 'Compiling nebula…'));
        if (current.status === 'completed') {
          const prepared = readCompilerResult(current.result);
          if (JSON.stringify(prepared.controls) !== JSON.stringify(pointer.request.controls)) throw new Error('Completed cloud does not match the requested controls.');
          return prepared;
        }
        if (!activeCloudJob(current)) {
          if (current.status === 'cancelled') { setStatus('Compile cancelled'); return null; }
          throw new Error(current.error || `Compile ${current.status}.`);
        }
        if (cancelWanted && !cancelSent) { cancelSent = true; current = await api(`/${pointer.id}/cancel`, {}); continue; }
        await pause(); current = await api(`/${pointer.id}`);
      }
      return null;
    }
    async function run() {
      if (stopped || running || booting || !ready.current) return;
      const initialKey = signature(desired.current);
      if (!manualWanted && !ledger.active && ((!ledger.completed && !publishedBaseline) || ledger.paused === initialKey || accepted === initialKey)) { setBusy(false); return; }
      running = true; cancelWanted = Boolean(ledger.active && ledger.cancelRequested); cancelSent = false; setBusy(true); setError('');
      try {
        do {
          const current = desired.current, key = signature(current);
          if (!manualWanted && !ledger.active && accepted === key) break;
          const userInitiated = manualWanted;
          manualWanted = false;
          let pointer = ledger.active;
          let first: CloudJob | undefined;
          if (pointer) {
            try { first = await api(`/${pointer.id}`); }
            catch (reason) { if (!(reason instanceof CompilerHttpError && reason.status === 404)) throw reason; }
            if (first && !activeCloudJob(first) && first.status !== 'completed') {
              if (!userInitiated) {
                setJob(first); ledger = { ...ledger, active: undefined, paused: key }; save();
                if (first.status === 'cancelled') { setStatus('Compile cancelled'); break; }
                throw new Error(first.error || `Compile ${first.status}.`);
              }
              ledger = { ...ledger, active: undefined }; pointer = undefined; first = undefined; save();
            }
          }
          if (!pointer) {
            pointer = { id: crypto.randomUUID(), request: current, signature: key };
            ledger = { ...ledger, active: pointer, paused: undefined, cancelRequested: undefined }; save();
          }
          if (!first) {
            try { first = await api('', { requestId: pointer.id, request: pointer.request }); }
            catch (reason) {
              if (reason instanceof CompilerHttpError && reason.status >= 400 && reason.status < 500) { ledger = { ...ledger, active: undefined }; save(); }
              throw reason;
            }
          }
          const prepared = await observe(pointer, first);
          if (stopped) break;
          if (!prepared) { ledger = { ...ledger, active: undefined, paused: signature(desired.current), cancelRequested: undefined }; save(); break; }
          accepted = pointer.signature; ledger = { completed: pointer, ...(cancelWanted ? { paused: signature(desired.current) } : {}) }; save();
          setResult(prepared); setStatus('Nebula ready');
        } while (!cancelWanted && accepted !== signature(desired.current));
      } catch (reason) {
        if (!stopped) { ledger = { ...ledger, paused: signature(desired.current) }; save(); setError(reason instanceof Error ? reason.message : 'Compile failed.'); setStatus('Compile needs attention'); }
      } finally { running = false; if (!stopped) setBusy(false); }
    }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { void run(); }, 240); };
    actions.current = {
      compile() { manualWanted = true; ledger = { ...ledger, paused: undefined, cancelRequested: undefined }; save(); schedule(); },
      cancel() { cancelWanted = true; manualWanted = false; ledger = { ...ledger, paused: signature(desired.current), cancelRequested: true }; save(); setStatus('Cancelling…'); },
      changed: schedule,
    };
    void (async () => {
      try {
        if (ledger.completed) {
          const completed = await api(`/${ledger.completed.id}`);
          if (completed.status === 'completed') {
            const prepared = readCompilerResult(completed.result);
            if (JSON.stringify(prepared.controls) !== JSON.stringify(ledger.completed.request.controls)) throw new Error('Saved cloud controls changed.');
            accepted = ledger.completed.signature; setResult(prepared); setStatus('Nebula ready');
          }
        } else if (published.current) {
          while (!ready.current && !stopped) await pause();
          if (stopped || !published.current) return;
          const prepared = await loadPublishedCompiler(published.current, desired.current.recipePath,
            async path => {
              if (path.endsWith('.ts')) {
                const module: unknown = await import(/* @vite-ignore */ `${localFile(path)}?raw&revision=${Date.now()}`);
                if (!object(module) || typeof module.default !== 'string') throw new Error('Compiler source is unavailable for verification.');
                return new Response(module.default);
              }
              return fetch(localFile(path), { cache: 'no-store', signal: controller.signal });
            });
          if (!stopped && published.current && prepared && (ledger.active || ledger.paused || JSON.stringify(prepared.controls) === JSON.stringify(desired.current.controls))) {
            publishedBaseline = true; accepted = signature({ ...desired.current, controls: prepared.controls }); setResult(prepared);
            setStatus(ledger.paused ? 'Previous prepared nebula · compile paused' : 'Prepared nebula ready');
          }
        }
      } catch (reason) {
        if (!stopped && !(reason instanceof CompilerHttpError && reason.status === 404)) setError(reason instanceof Error ? reason.message : 'Saved cloud unavailable.');
      } finally {
        booting = false;
        if (!stopped) {
          // Restoring the previous cloud must not briefly advertise an active saved job as ready.
          setBusy(Boolean(ledger.active || manualWanted || !ready.current));
          if (ledger.active || manualWanted || (ledger.completed && accepted !== signature(desired.current) && ledger.paused !== signature(desired.current))) schedule();
        }
      }
    })();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); actions.current = null; };
  }, [storageKey]);
  useEffect(() => { actions.current?.changed(); }, [request, inputsReady]);
  return { result, job, busy, error, storageError, status, compile: () => actions.current?.compile(),
    cancel: () => actions.current?.cancel(), retry: () => actions.current?.compile() };
}
