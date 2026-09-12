import { useEffect, useMemo, useRef, useState } from 'react';
import { readGeometryMap, type GeometryMap } from '../alignment/observations-ui/geometry-model';
import type { StructureImage } from '../alignment/observations-ui/structures-model';
import { readDetectionResult, type DetectionResult } from '../reconstruction/geometry/jobs-model';
import { readDetectionSettings, type DetectionSettings } from '../reconstruction/geometry/settings';
import { localFile } from '../viewer/viewer';
import { createDetectionClient, detectionJobActive, DetectionHttpError, type DetectionJob } from './geometry-detection-client';

type Pin = NonNullable<StructureImage['geometry']>;
interface SavedDetection {
  settings: DetectionSettings; applied?: Pin; previous?: Pin; pending?: DetectionResult;
  preview: boolean; jobId?: string; jobSettings?: DetectionSettings;
}
interface Session { key: string; value: SavedDetection; geometries: Record<string, GeometryMap> }
const defaults = (): DetectionSettings => readDetectionSettings({ sensitivity: 1, minRadiusFraction: .07, maxCandidates: 12, iterations: 24000, seed: 7293 });
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const message = (reason: unknown) => reason instanceof Error ? reason.message : 'Detector failed.';
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
    throw new Error('Detector proposals belong to different source data.');
  return result;
}
function readSaved(value: unknown, image: StructureImage, cataloguePath: string): SavedDetection {
  if (!record(value) || value.schema !== 'cssearth-geometry-session@1' || typeof value.preview !== 'boolean') throw new Error('Saved detector session is invalid.');
  if (value.jobId !== undefined && (typeof value.jobId !== 'string' || !/^[a-f0-9-]{36}$/.test(value.jobId))) throw new Error('Saved detector job is invalid.');
  return { settings: readDetectionSettings(value.settings), applied: readPin(value.applied), previous: readPin(value.previous),
    pending: value.pending === undefined ? undefined : checkResult(value.pending, image, cataloguePath), preview: value.preview,
    jobId: value.jobId, jobSettings: value.jobSettings === undefined ? undefined : readDetectionSettings(value.jobSettings) };
}

export function useGeometryDetection(image: StructureImage | undefined, baseGeometry: GeometryMap | undefined, cataloguePath: string) {
  const key = image ? `nebula:geometry-detection:1:${cataloguePath}:${image.id}:${image.sourceSha256}:${image.mapSha256}` : '';
  const [session, setSession] = useState<Session>({ key: '', value: { settings: defaults(), preview: false }, geometries: {} });
  const [loadedKey, setLoadedKey] = useState(''), [error, setError] = useState(''), [storageError, setStorageError] = useState('');
  const [job, setJob] = useState<DetectionJob | null>(null), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
  const current = useRef(session); current.current = session;
  const client = useRef<ReturnType<typeof createDetectionClient> | null>(null), cancelWanted = useRef(false), observing = useRef(false);
  const value = session.key === key ? session.value : { settings: defaults(), preview: false };
  function save(next: SavedDetection, geometries = current.current.geometries) {
    const nextSession = { key, value: next, geometries }; current.current = nextSession; setSession(nextSession);
    try { localStorage.setItem(key, JSON.stringify({ schema: 'cssearth-geometry-session@1', ...next })); setStorageError(''); }
    catch { setStorageError('Detector changes are saved for this session only.'); }
  }
  async function loadGeometry(pin: Pin, owner: StructureImage, signal: AbortSignal) {
    const response = await fetch(`${localFile(`${owner.directory}/${pin.file}`)}?v=${pin.sha256}`, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Detector geometry unavailable (${response.status}).`);
    const bytes = await response.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== pin.sha256) throw new Error('Detector geometry identity changed.');
    return readGeometryMap(JSON.parse(new TextDecoder().decode(bytes)), owner);
  }
  async function watch(first: DetectionJob, activeClient: ReturnType<typeof createDetectionClient>, owner: StructureImage) {
    let next = first; observing.current = true;
    try {
      while (!activeClient.signal.aborted) {
        setJob(next); setBusy(false);
        if (next.status === 'completed') {
          const result = checkResult(next.result, owner, cataloguePath), saved = current.current.value;
          if (saved.jobSettings && JSON.stringify(saved.jobSettings) !== JSON.stringify(result.settings)) throw new Error('Detector result does not match the requested settings.');
          const geometry = await loadGeometry(result.geometry, owner, activeClient.signal);
          if (activeClient.signal.aborted) return;
          save({ ...current.current.value, pending: result, preview: true }, { ...current.current.geometries, [result.geometry.sha256]: geometry });
          return;
        }
        if (!detectionJobActive(next)) {
          if (next.status !== 'cancelled') setError(next.error || `Detection ${next.status}.`);
          return;
        }
        if (cancelWanted.current) { cancelWanted.current = false; next = await activeClient.cancel(next.id); continue; }
        await activeClient.pause(); next = await activeClient.get(next.id);
      }
    } finally { if (!activeClient.signal.aborted) observing.current = false; }
  }
  useEffect(() => {
    if (!image) return;
    const activeClient = createDetectionClient(image.id); client.current = activeClient;
    const initial: Session = { key, value: { settings: defaults(), preview: false }, geometries: {} };
    current.current = initial; setSession(initial);
    setLoadedKey(''); setError(''); setStorageError(''); setJob(null); setBusy(false); cancelWanted.current = false; observing.current = false;
    async function restore() {
      const raw = localStorage.getItem(key);
      const saved = raw === null ? { settings: defaults(), preview: false } : readSaved(JSON.parse(raw), image!, cataloguePath);
      const pins = [saved.applied, saved.previous, saved.pending?.geometry].filter((pin): pin is Pin => Boolean(pin));
      const geometries: Record<string, GeometryMap> = {};
      await Promise.all(pins.map(async pin => { geometries[pin.sha256] = await loadGeometry(pin, image!, activeClient.signal); }));
      if (activeClient.signal.aborted) return;
      const restored = { key, value: saved, geometries }; current.current = restored; setSession(restored); setLoadedKey(key);
      if (saved.jobId) await watch(await activeClient.get(saved.jobId), activeClient, image!);
    }
    void restore().catch(reason => { if (!activeClient.signal.aborted) { setLoadedKey(key); setBusy(false); setError(message(reason)); } });
    return () => { activeClient.disconnect(); if (client.current === activeClient) client.current = null; };
  }, [key, revision]);
  const appliedPin = value.applied ?? image?.geometry;
  const effectiveImage = useMemo(() => image && (value.applied ? { ...image, geometry: value.applied } : image), [image, value.applied]);
  const effectiveGeometry = appliedPin && (session.key === key ? session.geometries[appliedPin.sha256] : undefined) ||
    (samePin(appliedPin, image?.geometry) ? baseGeometry : undefined);
  const pendingGeometry = value.pending && session.key === key ? session.geometries[value.pending.geometry.sha256] : undefined;
  async function detect() {
    const activeClient = client.current; if (!image || !activeClient || busy || observing.current) return;
    setError(''); setBusy(true); cancelWanted.current = false;
    try {
      // A failed HTTP observation may hide a still-running job. Reconnect before starting another.
      if (current.current.value.jobId) {
        try {
          const prior = await activeClient.get(current.current.value.jobId);
          if (detectionJobActive(prior)) { await watch(prior, activeClient, image); return; }
        } catch (reason) { if (!(reason instanceof DetectionHttpError && reason.status === 404)) throw reason; }
      }
      const settings = readDetectionSettings(current.current.value.settings), requestId = crypto.randomUUID();
      save({ ...current.current.value, pending: undefined, preview: false, jobId: requestId, jobSettings: settings });
      await watch(await activeClient.start(requestId, { action: 'apply', cataloguePath, imageId: image.id,
        sourceSha256: image.sourceSha256, mapSha256: image.mapSha256, settings }), activeClient, image);
    } catch (reason) { if (!activeClient.signal.aborted) { setJob(null); setError(message(reason)); } }
    finally { if (!activeClient.signal.aborted) setBusy(false); }
  }
  function apply() {
    if (!value.pending || !pendingGeometry || samePin(appliedPin, value.pending.geometry)) return;
    save({ ...value, applied: value.pending.geometry, previous: appliedPin, pending: undefined, preview: false, jobId: undefined, jobSettings: undefined });
    setJob(null); setError('');
  }
  return { settings: value.settings, effectiveImage, effectiveGeometry, appliedPin, pending: value.pending, pendingGeometry,
    preview: Boolean(value.preview && pendingGeometry), ready: loadedKey === key, error, storageError, job,
    showPreview() { save({ ...value, preview: true }); },
    showCloud() { save({ ...value, preview: false }); },
    active: busy || detectionJobActive(job), canRestore: Boolean(value.previous), detect, apply,
    edit(settings: DetectionSettings) { try { save({ ...value, settings: readDetectionSettings(settings) }); } catch (reason) { setError(message(reason)); } },
    cancel() { cancelWanted.current = true; },
    discard() { save({ ...value, pending: undefined, preview: false, jobId: undefined, jobSettings: undefined }); setJob(null); setError(''); },
    restorePrevious() {
      if (!value.previous) return;
      save({ ...value, applied: value.previous, previous: appliedPin, pending: undefined, preview: false, jobId: undefined, jobSettings: undefined }); setJob(null); setError('');
    },
    retry() { setRevision(value => value + 1); },
  };
}
