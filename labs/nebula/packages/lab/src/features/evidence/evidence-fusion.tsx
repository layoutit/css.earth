import { InfoTip } from '../../ui/info-tip';
import { CameraModelPanel } from '../../ui/camera-model-panel';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { readStructureCatalogue, type StructureCatalogue } from '../observations/models/structures-model';
import { catalogueMatrices } from '../observations/models/catalogue-matrices';
import { localFile } from '../legacy-viewer/controller';
import { ImageCredit } from '../workspace/image-credit';
import { WorkspaceImagePicker } from '../workspace/workspace-image-picker';
import { readFusionSettings, type FusionRequest } from '../evidence-fusion/jobs-model.ts';
import { useEvidenceFusion } from './evidence-fusion-state';
import './evidence-fusion.css';

export function EvidenceFusion({ cataloguePath, observationManifest }: { cataloguePath: string; observationManifest?: string }) {
  const [data, setData] = useState<StructureCatalogue | null>(null), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch(localFile(cataloguePath), { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error(`Registered evidence unavailable (${response.status}).`);
      setData(readStructureCatalogue(await response.json()));
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Evidence unavailable.'); });
    return () => controller.abort();
  }, [cataloguePath]);
  if (!data) return <p className="interaction-hint" role={error ? 'alert' : 'status'}>{error || 'Loading registered observations…'}</p>;
  return <FusionSession key={cataloguePath} catalogue={data} cataloguePath={cataloguePath} observationManifest={observationManifest} />;
}
function FusionSession({ catalogue, cataloguePath, observationManifest }: { catalogue: StructureCatalogue; cataloguePath: string; observationManifest?: string }) {
  const matrices = useMemo(() => catalogueMatrices(catalogue, observationManifest), [catalogue, observationManifest]);
  const key = `nebula:joint-evidence:1:${cataloguePath}:${JSON.stringify(catalogue.images.map(image => [image.id,image.sourceSha256,image.mapSha256,matrices[image.id]]))}`;
  const defaults: FusionRequest['settings'] = { channel: 'ridges', weights: catalogue.images.map(() => 1), sensitivity: 1 };
  const [settings, setSettings] = useState(() => { try { return readFusionSettings(JSON.parse(localStorage.getItem(key) ?? 'null')); } catch { return defaults; } });
  const request = useMemo<FusionRequest>(() => ({ action: 'apply', imageId: 'joint-evidence', cataloguePath, imageToFrame: matrices, settings }), [cataloguePath, matrices, settings]);
  const state = useEvidenceFusion(request, key), { result } = state;
  const [host, setHost] = useState<Element | null>(null), [background, setBackground] = useState(catalogue.images[0]!.id);
  const [showImage, setShowImage] = useState(true), [opacity, setOpacity] = useState(.75), [display, setDisplay] = useState<'union'|'colors'|'agreement'>('colors');
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 }), current = useRef(view), viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; view: typeof view } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 }), initialFit = useRef(false);
  const [sample, setSample] = useState<{ x: number; y: number; sources: { id: string; value: number | null }[] } | null>(null);
  const [sampleError, setSampleError] = useState(''); current.current = view;
  useEffect(() => { setHost(document.querySelector('.workspace-content')); }, []);
  function update(next: typeof settings) { setSettings(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch { setSampleError('Settings are available for this session only.'); } }
  const fit = useCallback(() => {
    if (!result || size.width < 30 || size.height < 30) return;
    const zoom = Math.min((size.width - 32) / result.width, (size.height - 32) / result.height);
    setView({ zoom, x: (size.width - result.width * zoom) / 2, y: (size.height - result.height * zoom) / 2 });
  }, [size, result?.width, result?.height]);
  useEffect(() => { if (!initialFit.current && result && size.width > 30) { fit(); initialFit.current = true; } }, [fit, result, size]);
  useEffect(() => {
    const el = viewport.current; if (!el) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height }); }); observer.observe(el);
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); const bounds = el.getBoundingClientRect(), old = current.current;
      const zoom = Math.min(12, Math.max(.05, old.zoom * Math.exp(-event.deltaY * .0015))), x = event.clientX - bounds.left, y = event.clientY - bounds.top;
      setView({ zoom, x: x - (x - old.x) * zoom / old.zoom, y: y - (y - old.y) * zoom / old.zoom });
    };
    el.addEventListener('wheel', wheel, { passive: false }); return () => { observer.disconnect(); el.removeEventListener('wheel', wheel); };
  }, [host]);
  useEffect(() => { setSample(null); }, [result?.id]);
  async function inspect(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current; drag.current = null;
    if (!start || !result || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return;
    const rect = event.currentTarget.getBoundingClientRect(), x = Math.floor((event.clientX - rect.left - view.x) / view.zoom), y = Math.floor((event.clientY - rect.top - view.y) / view.zoom);
    if (x < 0 || y < 0 || x >= result.width || y >= result.height) return;
    try {
      const response = await fetch(`/__nebula/evidence-sample?id=${result.id}&x=${x}&y=${y}`); const v: unknown = await response.json();
      if (!response.ok || !v || typeof v !== 'object' || !('sources' in v) || !Array.isArray(v.sources)) throw new Error('Evidence sample unavailable.');
      const sources = v.sources.map((s: unknown) => {
        if (!s || typeof s !== 'object' || !('id' in s) || typeof s.id !== 'string' || !('value' in s) ||
            !(s.value === null || typeof s.value === 'number' && Number.isFinite(s.value) && s.value >= 0 && s.value <= 1)) throw new Error('Invalid sample.');
        return { id: s.id, value: s.value };
      });
      setSample({ x, y, sources }); setSampleError('');
    } catch (reason) { setSampleError(reason instanceof Error ? reason.message : 'Sample failed.'); }
  }
  const bg = result?.sources.find(s => s.id === background), chosen = result?.[display];
  const imageUrl = (asset: { path: string; sha256: string }) => `${localFile(asset.path)}?v=${asset.sha256}`;
  return <fieldset className="evidence-fusion-controls" data-result-id={result?.id ?? ''} data-busy={state.busy}>
    <legend>Image and appearance</legend>
    <div className="emission-layer-buttons" role="group" aria-label="Evidence display">
      {([['union','Signal','Strongest supported feature; single-image evidence is retained.'],['colors','Sources','Each color identifies its source; overlaps combine colors.'],['agreement','Shared','Compatible evidence supported by at least two observations; not a probability.']] as const).map(([id,label,title]) =>
        <InfoTip key={id} content={title}><button type="button" aria-pressed={display === id} onClick={() => setDisplay(id)}>{label}</button></InfoTip>)}
    </div>
    <div className="fusion-status" role={state.error ? 'alert' : 'status'}>{state.error || (state.busy ? state.progress || 'Preparing evidence…' : 'Up to date')}{state.error && <button type="button" onClick={state.retry}>Retry</button>}</div>
    <label className="observation-check"><input type="checkbox" checked={showImage} onChange={event => setShowImage(event.target.checked)} />Image background</label>
    <WorkspaceImagePicker><label className="visually-hidden" htmlFor="fusion-background">Image</label>
    <select id="fusion-background" value={background} onChange={event => setBackground(event.target.value)}>{catalogue.images.map(image => <option key={image.id} value={image.id}>{image.label}</option>)}</select></WorkspaceImagePicker>
    <ImageCredit credit={catalogue.images.find(image => image.id === background)?.credit} />
    <div className="structure-slider"><label htmlFor="fusion-opacity">Overlay</label><input id="fusion-opacity" type="range" min="0" max="1" step=".05" value={opacity} onChange={event => setOpacity(event.target.valueAsNumber)} /><output>{Math.round(opacity * 100)}%</output></div>
    <section className="fusion-inspect" aria-label="Feature contributors"><p className="interaction-hint">{sample ? `Sample ${sample.x}, ${sample.y}` : 'Click a feature to inspect its sources.'}</p>
      {sample?.sources.map(s => <p key={s.id}><span style={{ color: result?.sources.find(source => source.id === s.id)?.color }}>{catalogue.images.find(source => source.id === s.id)?.label}</span><output>{s.value === null ? (settings.weights[catalogue.images.findIndex(source => source.id === s.id)] === 0 ? 'Excluded' : 'No support') : s.value.toFixed(2)}</output></p>)}
      {sampleError && <p role="alert">{sampleError}</p>}
    </section>
    <p className="interaction-hint" title="Noise-normalized image evidence, not calibrated flux, gas density or physical membership. Matching traces in different bands may still overlap only in projection. Working rasters limit detail; star-removal artifacts can remain.">Projected evidence · depth unknown ⓘ</p>
    {host && createPortal(<CameraModelPanel camera={{ fit: { onActivate: fit, description: 'Fit all registered evidence in the shared sky frame.' } }}
      unavailableReason="Combined evidence is a fixed 2D sky projection." cameraHint="Drag to pan · scroll to zoom">
    <div className="emission-layer-buttons" role="group" aria-label="Evidence scale">
      {([['all','All'],['broad','Broad'],['ridges','Ridges'],['compact','Knots']] as const).map(([channel,label]) => <button key={channel} type="button" aria-pressed={settings.channel === channel} onClick={() => update({ ...settings, channel })}>{label}</button>)}
    </div>
    <div className="structure-slider"><label htmlFor="fusion-sensitivity">Sensitivity</label><input id="fusion-sensitivity" type="range" min=".25" max="4" step=".05" value={settings.sensitivity} onChange={event => update({ ...settings, sensitivity: event.target.valueAsNumber })} /><output>{settings.sensitivity.toFixed(2)}×</output></div>
    {catalogue.images.map((source,index) => <div className="structure-slider fusion-source" key={source.id}>
      <label htmlFor={`fusion-${source.id}`} title={source.label} style={{ color: result?.sources[index]?.color }}>{source.label.replace(/^ESO[ ·]+/, '').replace(/\s*·.*$/, '')}</label>
      <input id={`fusion-${source.id}`} type="range" min="0" max="1" step=".05" value={settings.weights[index] ?? 1} onChange={event => update({ ...settings, weights: settings.weights.map((weight,i) => i === index ? event.target.valueAsNumber : weight) })} />
      <output>{Math.round((settings.weights[index] ?? 1) * 100)}%</output>
    </div>)}
      </CameraModelPanel>, host)}
    {host && createPortal(<section className="evidence-fusion-workspace" aria-label="Combined registered evidence">
      <div className="fusion-viewport" ref={viewport} tabIndex={0} aria-label="Combined evidence sky" onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view }; }}
        onPointerMove={event => { const start = drag.current; if (start?.id === event.pointerId) setView({ ...start.view, x: start.view.x + event.clientX - start.x, y: start.view.y + event.clientY - start.y }); }}
        onPointerUp={event => { void inspect(event); }} onPointerCancel={() => { drag.current = null; }} onDoubleClick={fit}
        onKeyDown={event => { if (event.key === 'Home' || event.key === '0') fit(); }}>
        {result && <div className="fusion-frame" data-frame-width={result.width} style={{ width: result.width, height: result.height, transform: `translate(${view.x}px,${view.y}px) scale(${view.zoom})` }}>
          {bg && <img className="fusion-background" src={imageUrl(bg.source)} alt={`${bg.label} in the common sky frame`} draggable={false} style={{ visibility: showImage ? 'visible' : 'hidden' }} />}
          {chosen && <img className="fusion-map" src={imageUrl(chosen)} alt={`${settings.channel} combined evidence`} draggable={false} style={{ opacity }} />}
          {sample && <span className="fusion-crosshair" style={{ left: sample.x, top: sample.y }} />}
        </div>}
        <div className="fusion-caption">N ↑ · E ← · drag to pan · scroll to zoom</div>
      </div>
    </section>, host)}
  </fieldset>;
}
