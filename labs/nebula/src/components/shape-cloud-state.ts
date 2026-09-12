import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeometryMap } from '../alignment/observations-ui/geometry-model';
import type { StructureImage } from '../alignment/observations-ui/structures-model';
import { initializeShapeCloud, readShapeCloudSettings } from '../reconstruction/shape-cloud/model';
import { createShapeCloudScheduler, type PreviewQuality } from './shape-cloud-scheduler';
import { createShapeCloudClient, activeCloudJob, type CloudJob } from './shape-cloud-client';
import { readShapeCloudResult } from '../reconstruction/shape-cloud/result';
import { SHAPE_CLOUD_PREPARATION_VERSION } from '../reconstruction/shape-cloud/quality';
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
const message = (error: unknown) => error instanceof Error ? error.message : 'Cloud preview failed.';
type Scheduler = ReturnType<typeof createShapeCloudScheduler<ShapeCloudSettings, ShapeCloudResult>>;
const settingsKey = (value: ShapeCloudSettings) => JSON.stringify(value);
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Input schedules bounded drafts; release schedules a detailed result. Mount only observes a saved job before deciding whether work is needed. */
export function useShapeCloudState(image: StructureImage, geometry: GeometryMap, cataloguePath: string, initialQuality: PreviewQuality = 'detailed') {
  const key = `nebula:shape-cloud:1:${cataloguePath}:${image.id}:${image.sourceSha256}:${image.mapSha256}:${image.geometry?.sha256}`;
  const initial = useMemo(() => initializeShapeCloud(geometry), [geometry]);
  const [settings, setSettings] = useState(initial), [storageError, setStorageError] = useState('');
  const [job, setJob] = useState<CloudJob | null>(null), [result, setResult] = useState<ShapeCloudResult | null>(null);
  const [error, setError] = useState(''), [starting, setStarting] = useState(false), [loaded, setLoaded] = useState(false), [revision, setRevision] = useState(0);
  const currentSettings = useRef(settings), scheduler = useRef<Scheduler | null>(null), dragging = useRef(false);
  const target = useRef({ key, imageId: image.id }); target.current = { key, imageId: image.id };
  useEffect(() => {
    let disposed = false; setError(''); setStarting(false); setLoaded(false);
    let valid = initial;
    try { const raw = localStorage.getItem(key); if (raw !== null) valid = readShapeCloudSettings(JSON.parse(raw), image.width, image.height); }
    catch (reason) { setStorageError(`Saved edits could not be loaded: ${message(reason)} Use Reset to detected to replace them.`); return; }
    currentSettings.current = valid; setSettings(valid);
    function checkResult(value: unknown) {
      const completed = readShapeCloudResult(value);
      if (completed.imageId !== image.id || completed.sourceSha256 !== image.sourceSha256 || completed.mapSha256 !== image.mapSha256 ||
          completed.geometrySha256 !== image.geometry?.sha256 || completed.width !== image.width || completed.height !== image.height)
        throw new Error('Saved cloud result belongs to different source data.');
      return completed;
    }
    const client = createShapeCloudClient({ request: { action: 'apply', imageId: image.id, width: image.width, height: image.height,
      cataloguePath, geometrySha256: image.geometry?.sha256 ?? '', geometryFile: image.geometry?.file },
      onJob(next) { if (!disposed) { setStarting(false); setJob(next); } },
      save(id, ticket) {
        try {
          localStorage.setItem(`${key}:job`, id);
          localStorage.setItem(`${key}:request`, JSON.stringify({ id, settings: ticket.value, quality: ticket.quality }));
        } catch { if (!disposed) setStorageError('Automatic preview works, but job reconnect could not be saved.'); }
      },
    });
    async function connect() {
      let saved: CloudJob | null = null;
      const id = localStorage.getItem(`${key}:job`);
      if (id) {
        if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Saved cloud job identity is invalid.');
        saved = await client.get(id);
      }
      if (disposed) return;
      const queue = createShapeCloudScheduler<ShapeCloudSettings, ShapeCloudResult>({ value: currentSettings.current, key: settingsKey,
        initiallyDragging: dragging.current || initialQuality === 'draft',
        run(ticket) { setStarting(true); setError(''); return client.start(ticket); },
        cancel() { client.cancel(); },
        accept(value, ticket) {
          const completed = checkResult(value), actualKey = settingsKey(completed.settings);
          // Old manual jobs did not store request metadata. Use their actual receipt, never invent matching settings.
          const changed = actualKey !== ticket.key || completed.quality !== ticket.quality;
          if (changed) queue.seed(completed.settings, completed.quality);
          if (completed.quality === 'draft' || actualKey === settingsKey(currentSettings.current)) setResult(completed);
          setStarting(false); setError('');
          return !changed;
        },
        error(reason) { if (!disposed) { setStarting(false); setError(message(reason)); } },
      });
      scheduler.current = queue; setLoaded(true);
      if (saved?.status === 'completed') {
        const completed = checkResult(saved.result); setResult(completed); setJob(saved);
        // Keep the previous scene visible while refreshing old sampling, without discarding authored settings.
        if (completed.preparationVersion === SHAPE_CLOUD_PREPARATION_VERSION) queue.seed(completed.settings, completed.quality);
      } else if (saved && activeCloudJob(saved)) {
        let priorSettings = currentSettings.current, quality: PreviewQuality = 'detailed';
        const raw = localStorage.getItem(`${key}:request`);
        if (raw !== null) {
          const prior: unknown = JSON.parse(raw);
          if (!object(prior) || prior.id !== saved.id || !['draft', 'detailed'].includes(String(prior.quality))) throw new Error('Saved preview request does not match its job.');
          priorSettings = readShapeCloudSettings(prior.settings, image.width, image.height); quality = prior.quality === 'draft' ? 'draft' : 'detailed';
        }
        setJob(saved); queue.resume(priorSettings, quality, () => client.resume(saved!)); return;
      } else if (saved && ['failed', 'interrupted'].includes(saved.status)) {
        setJob(saved); throw new Error(saved.error || `Cloud preview ${saved.status}.`);
      }
      queue.start();
    }
    void connect().catch(reason => { if (!disposed) { setLoaded(true); setError(message(reason)); } });
    return () => {
      disposed = true; scheduler.current?.dispose(); scheduler.current = null;
      if (target.current.key !== key && target.current.imageId === image.id) client.supersede(); else client.disconnect();
    };
  }, [key, image, revision, initialQuality]);
  function edit(next: ShapeCloudSettings, immediate = false) {
    try {
      const valid = readShapeCloudSettings(next, image.width, image.height); currentSettings.current = valid; setSettings(valid); setError('');
      try { localStorage.setItem(key, JSON.stringify(valid)); setStorageError(''); } catch { setStorageError('Edits saved for this session only.'); }
      if (scheduler.current) scheduler.current.edit(valid, immediate);
      else if (loaded || storageError) setRevision(value => value + 1);
    } catch (reason) { setError(message(reason)); }
  }
  function retry() {
    setError(''); if (scheduler.current) scheduler.current.retry(); else {
      // Reconnect errors keep their ID visible until this explicit retry; retries launch a fresh current preview.
      try { localStorage.removeItem(`${key}:job`); localStorage.removeItem(`${key}:request`); } catch { /* The session can still retry. */ }
      setRevision(value => value + 1);
    }
  }
  return { settings, edit, reset: () => edit(initial, true), result, job, error, storageError, loaded, retry,
    begin() { dragging.current = true; scheduler.current?.begin(); },
    settle() { dragging.current = false; scheduler.current?.settle(); },
    active: starting || activeCloudJob(job), dirty: Boolean(result && (result.geometrySha256 !== image.geometry?.sha256 || settingsKey(result.settings) !== settingsKey(settings))),
  };
}
