import { useEffect, useRef, useState } from 'react';
import type { GeometryMap } from '../alignment/observations-ui/geometry-model';
import type { StructureImage } from '../alignment/observations-ui/structures-model';
import { initializeShapeCloud, readShapeCloudSettings } from '../reconstruction/shape-cloud/model';
import { readShapeCloudResult } from '../reconstruction/shape-cloud/result';
import type { ShapeCloudComponent, ShapeCloudResult, ShapeCloudSettings } from '../reconstruction/shape-cloud/types';

export type EditScope = 'all' | 'group' | 'selected';
export type NumericField = 'x' | 'y' | 'radiusX' | 'radiusY' | 'rotationDegrees' | 'weight' | 'thickness' | 'softness' | 'depth';
export function componentScope(components: ShapeCloudComponent[], selected: ShapeCloudComponent, scope: EditScope) {
  return components.filter(item => scope === 'all' || (scope === 'group' ? item.groupId === selected.groupId : item.id === selected.id));
}
/** Translations remain relative and resizing is proportional, even when editing a whole group. */
export function editShapeComponents(settings: ShapeCloudSettings, selected: ShapeCloudComponent, scope: EditScope, field: NumericField, value: number): ShapeCloudSettings {
  const ids = new Set(componentScope(settings.components, selected, scope).map(item => item.id));
  return { ...settings, components: settings.components.map(item => {
    if (!ids.has(item.id)) return item;
    const next = field === 'x' || field === 'y' || field === 'rotationDegrees' ? item[field] + value - selected[field] :
      field === 'radiusX' || field === 'radiusY' ? item[field] * value / selected[field] : value;
    return { ...item, [field]: next };
  }) };
}
interface Job { id: string; imageId: string; status: string; progress?: { current: number; total: number; message: string }; error?: string; result?: unknown }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const activeStates = ['queued', 'running', 'cancelling'];
function readJob(value: unknown, imageId: string): Job {
  if (!object(value) || !object(value.job)) throw new Error('Invalid cloud job response.');
  const job = value.job;
  if (typeof job.id !== 'string' || !/^[a-f0-9-]{36}$/.test(job.id) || job.imageId !== imageId ||
      typeof job.status !== 'string' || ![...activeStates, 'completed', 'cancelled', 'failed', 'interrupted'].includes(job.status)) throw new Error('Cloud job does not match this image.');
  let progress: Job['progress'];
  if (job.progress !== undefined) {
    const p = job.progress;
    if (!object(p) || typeof p.current !== 'number' || !Number.isFinite(p.current) || typeof p.total !== 'number' || !Number.isFinite(p.total) ||
        p.current < 0 || p.total <= 0 || typeof p.message !== 'string') throw new Error('Invalid cloud job progress.');
    progress = { current: p.current, total: p.total, message: p.message };
  }
  if (job.error !== undefined && typeof job.error !== 'string') throw new Error('Invalid cloud job error.');
  return { id: job.id, imageId, status: job.status, progress, error: job.error, result: job.result };
}
const message = (error: unknown) => error instanceof Error ? error.message : 'Cloud preview failed.';
const api = '/__nebula/shape-cloud-jobs';
async function fetchJob(path: string, imageId: string, options?: RequestInit) {
  const response = await fetch(`${api}${path}`, { cache: 'no-store', ...options });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(object(body) && typeof body.error === 'string' ? body.error : `Cloud job unavailable (${response.status}).`);
  return readJob(body, imageId);
}

/** Job observers detach on unmount. Only the explicit Cancel action stops server processing. */
export function useShapeCloudState(image: StructureImage, geometry: GeometryMap, cataloguePath: string) {
  const key = `nebula:shape-cloud:1:${cataloguePath}:${image.id}:${image.sourceSha256}:${image.mapSha256}:${image.geometry?.sha256}`;
  const initial = useRef(initializeShapeCloud(geometry));
  const [settings, setSettings] = useState(initial.current), [storageError, setStorageError] = useState('');
  const [jobId, setJobId] = useState(''), [job, setJob] = useState<Job | null>(null), [result, setResult] = useState<ShapeCloudResult | null>(null);
  const [error, setError] = useState(''), [starting, setStarting] = useState(false), [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  const mounted = useRef(true), requestSettings = useRef(settings); requestSettings.current = settings;
  useEffect(() => {
    mounted.current = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setSettings(readShapeCloudSettings(JSON.parse(raw), image.width, image.height));
    } catch (reason) { setStorageError(`Saved edits could not be loaded: ${message(reason)} Use Reset to detected to replace them.`); }
    try {
      const id = localStorage.getItem(`${key}:job`);
      if (id && !/^[a-f0-9-]{36}$/.test(id)) throw new Error('Saved cloud job identity is invalid.');
      if (id) setJobId(id);
    } catch (reason) { setError(message(reason)); }
    setLoaded(true);
    return () => { mounted.current = false; };
  }, [key, image.width, image.height]);
  useEffect(() => {
    if (!jobId) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const next = await fetchJob(`/${jobId}`, image.id, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setJob(next);
        if (next.status === 'completed') {
          const completed = readShapeCloudResult(next.result);
          if (completed.imageId !== image.id || completed.sourceSha256 !== image.sourceSha256 || completed.mapSha256 !== image.mapSha256 ||
              completed.geometrySha256 !== image.geometry?.sha256 || completed.width !== image.width || completed.height !== image.height)
            throw new Error('Saved cloud result belongs to different source data.');
          setResult(completed); setError('');
        } else if (['failed', 'interrupted'].includes(next.status)) setError(next.error || `Cloud preview ${next.status}.`);
        if (activeStates.includes(next.status)) timer = setTimeout(() => void poll(), 650);
      } catch (reason) { if (!controller.signal.aborted) setError(message(reason)); }
    }
    void poll(); return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [jobId, image, revision]);
  function edit(next: ShapeCloudSettings) {
    try {
      const valid = readShapeCloudSettings(next, image.width, image.height); setSettings(valid); setError('');
      try { localStorage.setItem(key, JSON.stringify(valid)); setStorageError(''); } catch { setStorageError('Edits saved for this session only.'); }
    } catch (reason) { setError(message(reason)); }
  }
  async function preview() {
    if (starting || (job && activeStates.includes(job.status))) return;
    setStarting(true); setError('');
    const requestId = crypto.randomUUID();
    // The server uses the supplied UUID as the job ID. Save before POST so an immediate refresh can reconnect.
    try { localStorage.setItem(`${key}:job`, requestId); } catch { setStorageError('Job reconnect could not be saved. Keep this tab open.'); }
    try {
      const next = await fetchJob('', image.id, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        requestId, request: { action: 'apply', imageId: image.id, width: image.width, height: image.height, cataloguePath, geometrySha256: image.geometry?.sha256, settings: requestSettings.current },
      }) });
      // Persist even if navigation detached this observer while its POST was in flight.
      try { localStorage.setItem(`${key}:job`, next.id); } catch { if (mounted.current) setStorageError('Job started, but reconnect could not be saved. Keep this tab open.'); }
      if (mounted.current) { setJob(next); setJobId(next.id); }
    } catch (reason) { if (mounted.current) setError(message(reason)); }
    finally { if (mounted.current) setStarting(false); }
  }
  async function cancel() {
    if (!job) return;
    try { const next = await fetchJob(`/${job.id}/cancel`, image.id, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); if (mounted.current) setJob(next); }
    catch (reason) { if (mounted.current) setError(message(reason)); }
  }
  const active = starting || Boolean(job && activeStates.includes(job.status));
  return { settings, edit, reset: () => edit(initial.current), result, job, preview, cancel, error, storageError, active, loaded,
    reconnect: () => { setError(''); setRevision(value => value + 1); },
    dirty: Boolean(result && JSON.stringify(result.settings) !== JSON.stringify(settings)) };
}
