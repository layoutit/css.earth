import { bindImageZoom } from '../../ui/viewport-input.ts';
import { CameraModelPanel } from '../../ui/camera-model-panel';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { localFile } from '../legacy-viewer/controller';
import { ImageCredit } from '../workspace/image-credit';
import { ObservationSources } from './observation-sources';
import { readSourceDossier, selectObservationCandidates, type SourceDossier } from './models/source-dossier';
import { adjustedMatrix, imageCorners, observationFitStorageKey, savedObservationFit, readAdjustment, readObservations, transform, unchanged,
  type Adjustment, type LayerId, type Observation, type Observations } from './models/model';

type Camera = { x: number; y: number; zoom: number };
const layers = [{ id: 'original', label: 'Original', symbol: '▧' }, { id: 'diffuse', label: 'Without stars', symbol: '☁' }, { id: 'stars', label: 'Residual', symbol: '✧' }] as const;

/** Common astrometric canvas. Inspection never launches image processing. */
export function ObservationAlignment({ manifestPath, dossierPath, onOpenCompiler }: { manifestPath: string; dossierPath?: string; onOpenCompiler?(): void }) {
  const [data, setData] = useState<Observations | null>(null), [error, setError] = useState('');
  const [dossier, setDossier] = useState<SourceDossier | null>(null);
  const [selected, setSelected] = useState('');
  const [layer, setLayer] = useState<LayerId>('original');
  const [showMatches, setShowMatches] = useState(false);
  const [fits, setFits] = useState<Record<string, Adjustment>>({}), [copyStatus, setCopyStatus] = useState(''), [storageError, setStorageError] = useState('');
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 }), cameraRef = useRef(camera);
  const [extent, setExtent] = useState({ width: 1000, height: 700 });
  const viewport = useRef<HTMLDivElement>(null), drag = useRef<{ id: number; x: number; y: number; camera: Camera } | null>(null);
  const initialFit = useRef(false), sourceRevision = useRef(0);
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
  const [reload, setReload] = useState(0), [loading, setLoading] = useState(true), loadedPath = useRef(''), loadedManifest = useRef<Observations | null>(null);
  cameraRef.current = camera;
  useEffect(() => {
    const controller = new AbortController(), refreshing = loadedPath.current === manifestPath;
    sourceRevision.current++; setLoading(true); setError(''); setImageErrors({}); setCopyStatus('');
    if (!refreshing) { initialFit.current = false; setData(null); setDossier(null); setStorageError(''); }
    const readJson = async (path: string) => {
      const response = await fetch(localFile(path), { signal: controller.signal });
      if (!response.ok) throw new Error(`Alignment inputs unavailable (${response.status}).`);
      return response.json() as Promise<unknown>;
    };
    void Promise.all([readJson(manifestPath), dossierPath ? readJson(dossierPath) : Promise.resolve(null)]).then(([raw, sourceInfo]) => {
      const info = sourceInfo === null ? null : readSourceDossier(sourceInfo);
      const next = selectObservationCandidates(readObservations(raw), info?.selection);
      if (controller.signal.aborted) return;
      const prior = loadedManifest.current;
      setFits(previous => Object.fromEntries(next.images.map(image => [image.id,
        refreshing && prior?.images.some(old => old.id === image.id && old.source.url === image.source.url)
          ? previous[image.id] ?? savedObservationFit(manifestPath, image) : savedObservationFit(manifestPath, image)])));
      setSelected(refreshing && next.images.some(item => item.id === selected) ? selected : next.images[0]!.id);
      if (!refreshing) setLayer('original');
      loadedPath.current = manifestPath; loadedManifest.current = next; setData(next); setDossier(info);
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Aligned images unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); sourceRevision.current++; };
  }, [manifestPath, dossierPath, reload]);
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setExtent({ width: entry.contentRect.width, height: entry.contentRect.height }); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  function fitImages(onlySelected = false) {
    if (!data) return;
    const corners = data.images.filter(image => !onlySelected || image.id === selected).flatMap(image => imageCorners(image, adjustedMatrix(image, data.frame, fits[image.id] ?? unchanged)));
    const xs = corners.map(p => p[0]), ys = corners.map(p => p[1]);
    const left = Math.min(...xs), top = Math.min(...ys), width = Math.max(...xs) - left, height = Math.max(...ys) - top;
    const zoom = Math.min((extent.width - 36) / width, (extent.height - 36) / height);
    setCamera({ zoom, x: extent.width / 2 - (left + width / 2) * zoom, y: extent.height / 2 - (top + height / 2) * zoom });
  }
  useEffect(() => { if (data && extent.width > 40 && extent.height > 40 && !initialFit.current) { fitImages(true); initialFit.current = true; } }, [data, extent]);
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    return bindImageZoom(element, cameraRef, setCamera);
  }, []);
  const image = data?.images.find(item => item.id === selected), fit = fits[selected] ?? unchanged;
  const visible = (item: Observation) => item.id === selected;
  function changeFit(partial: Partial<Adjustment>) {
    if (!image) return; const next = readAdjustment({ ...fit, ...partial }); setFits(previous => ({ ...previous, [image.id]: next })); setCopyStatus('');
    try { localStorage.setItem(observationFitStorageKey(manifestPath, image), JSON.stringify(next)); setStorageError(''); } catch { setStorageError('Fit saved for this session only.'); }
  }
  async function copyFit() {
    if (!data || !image) return; const revision = sourceRevision.current, imageId = image.id;
    try {
      await navigator.clipboard.writeText(JSON.stringify({ schema: 'cssearth-nebula-observation-fit@1', subjectId: data.id, manifest: manifestPath,
        imageId, sourceUrl: image.source.url, adjustment: fit, imageToFrame: adjustedMatrix(image, data.frame, fit) }, null, 2));
      if (revision === sourceRevision.current) setCopyStatus('Copied');
    } catch { if (revision === sourceRevision.current) setCopyStatus('Copy failed'); }
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, camera: cameraRef.current };
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current; if (!start || event.pointerId !== start.id) return;
    setCamera({ ...start.camera, x: start.camera.x + event.clientX - start.x, y: start.camera.y + event.clientY - start.y });
  }
  const missingLayer = data?.images.filter(visible).filter(item => !item.layers[layer]) ?? [];
  const fitted = fit.x !== 0 || fit.y !== 0 || fit.rotation !== 0 || fit.scale !== 1;
  return <section className="observation-alignment" aria-label="Observation alignment">
    <div ref={viewport} className="observation-sky" aria-label="Aligned sky images" tabIndex={0} onPointerDown={pointerDown} onPointerMove={pointerMove}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onDoubleClick={() => fitImages()}
      onKeyDown={event => { if (event.key === 'Home' || event.key === '0') { event.preventDefault(); fitImages(); } }}>
      <div className="observation-frame" data-frame-width={data?.frame.width} data-frame-height={data?.frame.height}
        style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
        {data && data.images.map(item => {
          const matrix = adjustedMatrix(item, data.frame, fits[item.id] ?? unchanged), prepared = item.layers[layer];
          return <img key={item.id} data-observation={item.id} data-layer={layer} src={localFile((prepared ?? item.layers.original).path)} alt={item.label} aria-hidden={!visible(item)} draggable={false}
            style={{ width: item.source.width, height: item.source.height, transform: `matrix(${matrix.join(',')})`,
              visibility: visible(item) && prepared ? 'visible' : 'hidden' }}
            onLoad={() => setImageErrors(current => { if (!current[item.id]) return current; const next = { ...current }; delete next[item.id]; return next; })}
            onError={() => setImageErrors(current => ({ ...current, [item.id]: `${item.label}: image unavailable.` }))} />;
        })}
        {data && image && showMatches && image.registration.matches.map((match, index) => {
          const predicted = transform(adjustedMatrix(image, data.frame, fit), match.source), size = 10 / camera.zoom;
          return <span key={index}>
            <i className="observation-star reference-star" style={{ left: match.frame[0], top: match.frame[1], width: size, height: size }} />
            <i className="observation-star overlay-star" style={{ left: predicted[0], top: predicted[1], width: size * 1.5, height: size * 1.5 }} />
          </span>;
        })}
      </div>
      <div className="observation-compass" title="Common sky orientation: celestial north up, east left.">N ↑ · E ←</div>
      {!data && <div className="observation-loading" role={error ? 'alert' : 'status'}>{error || 'Loading aligned images…'}
        {error && <p><button type="button" disabled={loading} onPointerDown={event => event.stopPropagation()} onClick={() => setReload(value => value + 1)}>Reload aligned images</button></p>}
        {error && onOpenCompiler && <p><button type="button" onPointerDown={event => event.stopPropagation()} onClick={onOpenCompiler} title="Compile restores the configured source images and validates their alignment before reconstruction.">Open nebula compiler</button></p>}
      </div>}
    </div>
    <CameraModelPanel className="observation-camera" busy={!data} camera={{
      earth: { onActivate: () => fitImages(), description: 'Fit every full image edge in the common north-up sky frame.' },
      fit: { onActivate: () => fitImages(true), description: 'Fit the selected image at its true sky orientation.' },
    }} unavailableReason="Alignment uses a fixed north-up 2D sky projection."
      cameraHint={<>Drag to pan · scroll to zoom<p>{data?.frame.fieldArcminutes.join(' × ')}′ sky frame</p></>}
      modelReason="Registered sky frame · no volume in Alignment" />
    <aside className="image-overlay-panel observation-images" aria-label="Observation images">
      <fieldset disabled={!data}><legend className="visually-hidden">Image adjustments</legend>
        <ImageCredit credit={image?.source.credit} />
        <label className="visually-hidden" htmlFor="observation-image">Image</label>
        <select id="observation-image" value={selected} title="Switch aligned images without moving the camera or changing their sky scale." onChange={event => {
          const id = event.target.value;
          if (!data?.images.find(item => item.id === id)?.layers[layer]) setLayer('original');
          setSelected(id); setCopyStatus('');
        }}>
          {data?.images.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}
        </select>
        {dossier?.selection && data && <p className="overlay-detail" title={dossier.selection.reason}>{data.images.length} images · {data.images.filter(item => item.registration.status === 'verified').length} star-verified</p>}
        <div className="image-layer-buttons observation-layers" role="group" aria-label="Observation image layer">{layers.map(item => {
          const missing = data?.images.filter(visible).filter(candidate => !candidate.layers[item.id]) ?? [];
          return <button type="button" key={item.id} aria-label={item.label} aria-pressed={layer === item.id} disabled={!data || missing.length > 0}
            title={missing.length ? `Not prepared: ${missing.map(candidate => candidate.label).join(', ')}` : `${item.label} · prepared inspection only`}
            onClick={() => setLayer(item.id)}><span aria-hidden="true">{item.symbol}</span><span>{item.label}</span></button>;
        })}</div>
        {image && <>
          <p className="overlay-detail" role="status" title="RMS is measured in common-frame pixels on held-out original stars. For a shared-grid transfer, residuals describe the reference bridge; no stellar residual is measured in this band.">{image.registration.status === 'verified' ? `${image.registration.matchedStars} matched stars · ${image.registration.rmsPixels.toFixed(2)} frame px RMS` : image.registration.status === 'transferred' ? `Shared grid via ${image.registration.referenceId} · ${image.registration.bridgeMatchedStars} bridge stars · ${image.registration.rmsPixels.toFixed(2)} frame px bridge RMS` : image.source.coordinateOrigin === 'authored-bright-star-seed' ? 'Initial star placement · not star-verified' : 'Publisher coordinates · not star-verified'}{fitted ? ' · manual adjustment' : ''}</p>
          {image.registration.matches.length > 0 && <label className="observation-check" title="White: reference star. Amber: this image’s predicted star; the circles should share a center."><input type="checkbox" checked={showMatches} onChange={event => setShowMatches(event.target.checked)} /> Matched stars</label>}
          <section className="overlay-placement"><p className="placement-hint" title="Changes are saved locally per source and applied after the measured registration. Reset restores it.">Fine adjustment · saved locally</p>
            {([{ key: 'x', label: 'East–west (′)', min: -10, max: 10, step: .01 }, { key: 'y', label: 'North (′)', min: -10, max: 10, step: .01 },
              { key: 'rotation', label: 'Rotation (°)', min: -180, max: 180, step: .01 }, { key: 'scale', label: 'Size (%)', min: 50, max: 150, step: .01 }] as const).map(spec => {
              const value = spec.key === 'scale' ? fit.scale * 100 : fit[spec.key];
              function publish(value: number) { if (Number.isFinite(value) && (spec.key !== 'scale' || value > 0)) changeFit({ [spec.key]: spec.key === 'scale' ? value / 100 : value }); }
              return <div className="placement-control" key={spec.key}><label htmlFor={`observation-fit-${spec.key}`}>{spec.label}</label>
                <input type="range" aria-label={`${spec.label} slider`} min={spec.min} max={spec.max} step={spec.step} value={Math.min(spec.max, Math.max(spec.min, value))} onChange={event => publish(event.target.valueAsNumber)} />
                <input id={`observation-fit-${spec.key}`} type="number" aria-label={spec.label} step={spec.step} value={Number(value.toFixed(4))} onChange={event => publish(event.target.valueAsNumber)} />
              </div>;
            })}
            <div className="placement-actions"><button className="text-button" type="button" onClick={() => changeFit(unchanged)}>Reset alignment</button><button className="text-button" type="button" onClick={() => void copyFit()}>{copyStatus || 'Copy positioning'}</button></div>
          </section>
          <p className="overlay-detail" title="Full-resolution source treatment runs offline. Preserved maps retain compact emission and any foreground stars; their residual is zero.">{image.source.stellarTreatment === 'preserve' ? (image.layers.diffuse && image.layers.stars ? 'Compact structure preserved · removal not applicable' : 'Native preservation not prepared') : image.layers.diffuse && image.layers.stars ? 'Native star removal prepared' : 'Star removal not prepared'}</p>
          <div className="placement-actions"><button className="text-button" type="button" disabled={loading} onClick={() => setReload(value => value + 1)} title="Read newly completed star-removal layers without moving the camera or changing the alignment.">{loading ? 'Reloading…' : 'Reload prepared layers'}</button>
          </div>
          {dossier && <ObservationSources data={dossier} image={image} />}
        </>}
        {(storageError || missingLayer.length > 0) && <p className="overlay-detail" role="status">{storageError || `Not prepared: ${missingLayer.map(item => item.label).join(', ')}`}</p>}
        {Object.values(imageErrors).map(message => <p className="overlay-detail" role="alert" key={message}>{message}</p>)}
        {data && error && <p className="overlay-detail" role="alert">{error}</p>}
      </fieldset>
    </aside>
  </section>;
}
