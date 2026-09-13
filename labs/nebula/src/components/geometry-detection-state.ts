import { useEffect, useMemo, useRef, useState } from 'react';
import { readGeometryMap, type GeometryMap } from '../alignment/observations-ui/geometry-model';
import type { StructureImage } from '../alignment/observations-ui/structures-model';
import { readDetectionQuality, readDetectionResult, type DetectionQuality, type DetectionResult } from '../reconstruction/geometry/jobs-model';
import { readDetectionSettings, type DetectionSettings } from '../reconstruction/geometry/settings';
import { localFile } from '../viewer/viewer';
import { createDetectionClient, detectionJobActive, DetectionHttpError, type DetectionJob } from './geometry-detection-client';
import { createShapeCloudScheduler, type PreviewTicket } from './shape-cloud-scheduler';

type Pin = NonNullable<StructureImage['geometry']>;
interface SavedDetection {
  settings: DetectionSettings; applied?: Pin; appliedSettings: DetectionSettings; quality: DetectionQuality;
  previous?: Pin; jobId?: string; jobSettings?: DetectionSettings; jobQuality?: DetectionQuality;
}
interface Completed { result: DetectionResult; geometry: GeometryMap }
interface Session { key: string; value: SavedDetection; geometries: Record<string, GeometryMap> }
type Scheduler = ReturnType<typeof createShapeCloudScheduler<DetectionSettings, Completed>>;
const defaults = (): SavedDetection => ({ settings: readDetectionSettings(), appliedSettings: readDetectionSettings(), quality: 'detailed' });
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const message = (reason: unknown) => reason instanceof Error ? reason.message : 'Detector failed.';
const settingsKey = (value: DetectionSettings) => JSON.stringify(value);
const samePin = (a?: Pin, b?: Pin) => a?.file === b?.file && a?.sha256 === b?.sha256;
function readPin(value: unknown): Pin | undefined {
  if (value === undefined) return undefined;
  if (!record(value) || typeof value.file !== 'string' || !/^geometry(?:-[a-f0-9]{8,64})?\.json$/.test(value.file) ||
      typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) throw new Error('Saved geometry pin is invalid.');
  return { file: value.file, sha256: value.sha256 };
}
function checkResult(value: unknown, image: StructureImage, cataloguePath: string): DetectionResult {
  const result = readDetectionResult(value);
  if (result.imageId !== image.id || result.cataloguePath !== cataloguePath || result.sourceSha256 !== image.sourceSha256 ||
      result.mapSha256 !== image.mapSha256 || result.width !== image.width || result.height !== image.height)
    throw new Error('Detected geometry belongs to different source data.');
  return result;
}
function readSaved(value: unknown, image: StructureImage, cataloguePath: string): SavedDetection {
  if (!record(value) || !['cssearth-geometry-session@1', 'cssearth-geometry-session@2'].includes(String(value.schema))) throw new Error('Saved detector session is invalid.');
  if (value.jobId !== undefined && (typeof value.jobId !== 'string' || !/^[a-f0-9-]{36}$/.test(value.jobId))) throw new Error('Saved detector job is invalid.');
  const pending = value.pending === undefined ? undefined : checkResult(value.pending, image, cataloguePath);
  return { settings: readDetectionSettings(value.settings), applied: readPin(value.applied), previous: readPin(value.previous),
    appliedSettings: readDetectionSettings(value.appliedSettings ?? value.settings), quality: readDetectionQuality(value.quality),
    jobId: value.jobId, jobSettings: value.jobSettings === undefined ? pending?.settings : readDetectionSettings(value.jobSettings),
    jobQuality: readDetectionQuality(value.jobQuality) };
}
async function loadGeometry(pin: Pin, owner: StructureImage, signal: AbortSignal) {
  const response = await fetch(`${localFile(`${owner.directory}/${pin.file}`)}?v=${pin.sha256}`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Detector geometry unavailable (${response.status}).`);
  const bytes = await response.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== pin.sha256) throw new Error('Detector geometry identity changed.');
  const raw: unknown = JSON.parse(new TextDecoder().decode(bytes));
  const geometry = readGeometryMap(raw, owner);
  const provenance = record(raw) && record(raw.provenance) ? raw.provenance : undefined;
  const request = provenance && record(provenance.identity) && record(provenance.identity.request) ? provenance.identity.request : undefined;
  const diagnostics = record(raw) && record(raw.diagnostics) ? raw.diagnostics : undefined;
  return { geometry, settings: readDetectionSettings(request?.settings ?? diagnostics?.settings) };
}

/** Sliders own the intent. Durable jobs supply latest-only drafts and a final fit, without changing the viewer. */
export function useGeometryDetection(image: StructureImage | undefined, baseGeometry: GeometryMap | undefined, cataloguePath: string) {
  const key = image ? `nebula:geometry-detection:1:${cataloguePath}:${image.id}:${image.sourceSha256}:${image.mapSha256}` : '';
  const [session, setSession] = useState<Session>({ key: '', value: defaults(), geometries: {} });
  const [loadedKey, setLoadedKey] = useState(''), [error, setError] = useState(''), [storageError, setStorageError] = useState('');
  const [job, setJob] = useState<DetectionJob | null>(null), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
  const current = useRef(session); current.current = session;
  const scheduler = useRef<Scheduler | null>(null), dragging = useRef(false);
  const value = session.key === key ? session.value : defaults();
  function save(next: SavedDetection, geometries = current.current.geometries) {
    const nextSession = { key, value: next, geometries }; current.current = nextSession; setSession(nextSession);
    try { localStorage.setItem(key, JSON.stringify({ schema: 'cssearth-geometry-session@2', ...next })); setStorageError(''); }
    catch { setStorageError('Detector changes are saved for this session only.'); }
  }
  useEffect(() => {
    if (!image) return;
    const owner = image, client = createDetectionClient(image.id);
    let queue: Scheduler | undefined, cancelWanted = false;
    const initial: Session = { key, value: defaults(), geometries: {} };
    current.current = initial; setSession(initial);
    setLoadedKey(''); setError(''); setStorageError(''); setJob(null); setBusy(false);
    async function watch(first: DetectionJob, ticket: Pick<PreviewTicket<DetectionSettings>, 'value' | 'quality'>): Promise<Completed> {
      let next = first;
      while (!client.signal.aborted) {
        setJob(next);
        if (next.status === 'completed') {
          const result = checkResult(next.result, owner, cataloguePath);
          if (settingsKey(ticket.value) !== settingsKey(result.settings) || result.quality !== ticket.quality)
            throw new Error('Detector result does not match its request.');
          const { geometry } = await loadGeometry(result.geometry, owner, client.signal);
          setBusy(false); return { result, geometry };
        }
        if (!detectionJobActive(next)) { setBusy(false); throw new Error(next.error || `Detection ${next.status}.`); }
        if (cancelWanted) { cancelWanted = false; next = await client.cancel(next.id); continue; }
        await client.pause(); next = await client.get(next.id);
      }
      throw new DOMException('Detector observer detached.', 'AbortError');
    }
    async function restore() {
      const raw = localStorage.getItem(key), parsed: unknown = raw === null ? null : JSON.parse(raw);
      const saved = parsed === null ? defaults() : readSaved(parsed, owner, cataloguePath);
      const geometries: Record<string, GeometryMap> = {};
      if (saved.applied) {
        const loaded = await loadGeometry(saved.applied, owner, client.signal); geometries[saved.applied.sha256] = loaded.geometry;
        if (record(parsed) && parsed.schema === 'cssearth-geometry-session@1') saved.appliedSettings = loaded.settings;
      } else if (record(parsed) && parsed.schema === 'cssearth-geometry-session@1') saved.appliedSettings = readDetectionSettings();
      if (client.signal.aborted) return;
      save(saved, geometries);
      let prior: DetectionJob | null = null;
      if (saved.jobId) {
        try { prior = await client.get(saved.jobId); }
        catch (reason) { if (!(reason instanceof DetectionHttpError && reason.status === 404)) throw reason; }
      }
      if (client.signal.aborted) return;
      queue = createShapeCloudScheduler<DetectionSettings, Completed>({ value: current.current.value.settings, key: settingsKey,
        initiallyDragging: dragging.current,
        async run(ticket) {
          setBusy(true); setError(''); cancelWanted = false;
          const requestId = crypto.randomUUID();
          save({ ...current.current.value, jobId: requestId, jobSettings: ticket.value, jobQuality: ticket.quality });
          return watch(await client.start(requestId, { action: 'apply', cataloguePath, imageId: owner.id,
            sourceSha256: owner.sourceSha256, mapSha256: owner.mapSha256, settings: ticket.value, quality: ticket.quality }), ticket);
        },
        cancel() { cancelWanted = true; },
        accept({ result, geometry }) {
          const latest = current.current.value;
          save({ ...latest, applied: result.geometry, appliedSettings: result.settings, quality: result.quality,
            previous: latest.quality === 'detailed' ? latest.applied ?? owner.geometry : latest.previous },
          { ...current.current.geometries, [result.geometry.sha256]: geometry });
          setBusy(false); setError('');
        },
        error(reason) { if (!client.signal.aborted) { setBusy(false); setJob(null); setError(message(reason)); } },
      });
      scheduler.current = queue; setLoadedKey(key);
      if (prior && (detectionJobActive(prior) || prior.status === 'completed') && saved.jobSettings) {
        setBusy(true); queue.resume(saved.jobSettings, saved.jobQuality ?? 'detailed', () => watch(prior!, { value: saved.jobSettings!, quality: saved.jobQuality ?? 'detailed' }));
      } else {
        queue.seed(saved.appliedSettings, saved.quality);
        if (revision === 0 && prior && ['failed', 'interrupted'].includes(prior.status)) { setError(prior.error || `Detection ${prior.status}.`); return; }
        queue.start();
      }
    }
    void restore().catch(reason => { if (!client.signal.aborted) { setLoadedKey(key); setBusy(false); setError(message(reason)); } });
    return () => { queue?.dispose(); scheduler.current = null; client.disconnect(); };
  }, [key, revision]);
  const appliedPin = value.applied ?? image?.geometry;
  const effectiveImage = useMemo(() => image && (value.applied ? { ...image, geometry: value.applied } : image), [image, value.applied]);
  const effectiveGeometry = appliedPin && (session.key === key ? session.geometries[appliedPin.sha256] : undefined) ||
    (samePin(appliedPin, image?.geometry) ? baseGeometry : undefined);
  return { settings: value.settings, quality: value.quality, effectiveImage, effectiveGeometry, appliedPin,
    ready: loadedKey === key, error, storageError, job, active: busy || detectionJobActive(job),
    begin() { dragging.current = true; scheduler.current?.begin(); },
    settle() { dragging.current = false; scheduler.current?.settle(); },
    edit(settings: DetectionSettings) {
      try {
        const next = readDetectionSettings(settings); save({ ...current.current.value, settings: next }); setError('');
        scheduler.current?.edit(next);
      } catch (reason) { setError(message(reason)); }
    },
    // Reconnect the saved ID first: a transport error does not mean the server stopped.
    retry() { setRevision(value => value + 1); },
  };
}
