import { CameraModelPanel } from '../../ui/camera-model-panel';
import { InfoTip } from '../../ui/info-tip';
import { shapeCloudPresets } from '../shape-cloud/shape-cloud-presets';
import { validateShapeCloudPreset } from '../../server/workflows/shape-cloud/presets.ts';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { localFile } from '../legacy-viewer/controller';
import { ImageCredit } from '../workspace/image-credit';
import { WorkspaceImagePicker } from '../workspace/workspace-image-picker';
import { GeometryControls, GeometryOverlay } from '../geometry/observation-geometry';
import { ShapeCloudWorkbench } from '../shape-cloud/shape-cloud-workbench';
import { useGeometryDetection } from '../geometry/geometry-detection-state';
import { GeometryDetectionControls } from '../geometry/geometry-detection-controls';
import { readGeometryMap, type GeometryMap } from './models/geometry-model';
import { adjustedMatrix, imageCorners, savedObservationFit, unchanged, type Adjustment, type Matrix } from './models/model';
import { decisions, morphologies, readDecisions, readReviewMap, readStructureCatalogue, reviewStorageKey,
  type Decision, type Morphology, type ReviewMap, type StructureCatalogue, type StructureImage, type StructureLayer } from './models/structures-model';

type Camera = { x: number; y: number; zoom: number };
type Filters = { scale: number; area: number; contrast: number; elongation: number; morphology: Record<Morphology, boolean>; review: string };
const defaults: Filters = { scale: 2, area: 12, contrast: 0, elongation: 1, morphology: { compact: true, elongated: true, diffuse: true }, review: 'all' };
const emptyIds = new Set<string>();
const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const registered = (image: StructureImage) => ({ imageToFrame: image.imageToFrame, source: { width: image.nativeWidth, height: image.nativeHeight } });
const identity = (image: StructureImage) => ({ id: image.id, source: { url: image.sourceUrl } });
const asset = (image: StructureImage, file: string, hash = image.mapSha256) => `${localFile(`${image.directory}/${file}`)}?v=${hash}`;

const StructurePlane = memo(function StructurePlane({ image, map, matrix, active, layer, visibleIds, selectedId, highlights, onSelect, onError,
  geometry, shapes, shapeIds, selectedShapeId, onSelectShape }: {
  image: StructureImage; map: ReviewMap; matrix: Matrix; active: boolean; layer: StructureLayer; visibleIds: Set<string>; selectedId: string;
  highlights: boolean; onSelect(id: string): void; onError(id: string): void;
  geometry?: GeometryMap; shapes: boolean; shapeIds: Set<string>; selectedShapeId: string; onSelectShape(id: string): void;
}) {
  const panel = map.panels.find(item => item.id === layer);
  const sx = image.nativeWidth / image.width, sy = image.nativeHeight / image.height;
  const workingMatrix = [matrix[0] * sx, matrix[1] * sx, matrix[2] * sy, matrix[3] * sy, matrix[4], matrix[5]];
  return <div className="observation-structure-plane" data-structure-image={image.id} aria-hidden={!active}
    style={{ width: image.width, height: image.height, visibility: active ? 'visible' : 'hidden', transform: `matrix(${workingMatrix.join(',')})` }}>
    {panel && <img className="structure-evidence-image" src={asset(image, panel.file)} width={image.width} height={image.height}
      alt={`${image.label}: ${panel.label}. Full registered source frame.`} draggable={false} onError={() => onError(image.id)} />}
    {map.regions.map(region => {
      const atlas = map.atlases[region.atlas.index]; if (!atlas) return null;
      return <button type="button" className="structure-region" key={region.id} data-region-id={region.id} data-selected={selectedId === region.id}
        aria-label={`Select ${region.morphology} region ${region.id}`} aria-pressed={selectedId === region.id} tabIndex={-1}
        hidden={!active || !highlights || !visibleIds.has(region.id)}
        style={{ left: region.bounds.x, top: region.bounds.y, width: region.bounds.width, height: region.bounds.height }}
        onClick={() => onSelect(region.id)}>
        <img src={asset(image, atlas.file, atlas.sha256)} alt="" draggable={false} aria-hidden="true"
          style={{ left: -region.atlas.x, top: -region.atlas.y, width: atlas.width, height: atlas.height }} onError={() => onError(image.id)} />
      </button>;
    })}
    {geometry && <GeometryOverlay geometry={geometry} active={active && shapes} visibleIds={shapeIds} selectedId={selectedShapeId} onSelect={onSelectShape} />}
  </div>;
});

/** Human review of prepared 2D support. Filters and decisions never start processing. */
export function ObservationStructures({ cataloguePath, observationManifest }: { cataloguePath: string; observationManifest?: string }) {
  const [data, setData] = useState<StructureCatalogue | null>(null), [error, setError] = useState('');
  const [maps, setMaps] = useState<Record<string, ReviewMap>>({}), [mapErrors, setMapErrors] = useState<Record<string, string>>({});
  const [geometries, setGeometries] = useState<Record<string, GeometryMap>>({}), [geometryErrors, setGeometryErrors] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<'shapes' | 'regions'>('shapes'), [shapeId, setShapeId] = useState('');
  const [cloudEditor, setCloudEditor] = useState(true);
  const [presetId, setPresetId] = useState(() => new URLSearchParams(location.search).get('fit') ?? '');
  const preset = shapeCloudPresets.find(item => item.id === presetId && item.cataloguePath === cataloguePath);
  const [shapeScore, setShapeScore] = useState(0), [showAllShapes, setShowAllShapes] = useState(true);
  const [selected, setSelected] = useState(''), [layer, setLayer] = useState<StructureLayer>('source'), [regionId, setRegionId] = useState('');
  const [filters, setFilters] = useState<Filters>(defaults), [highlights, setHighlights] = useState(true);
  const [fits, setFits] = useState<Record<string, Adjustment>>({}), [reviews, setReviews] = useState<Record<string, Record<string, Decision>>>({});
  const [storageError, setStorageError] = useState(''), [host, setHost] = useState<Element | null>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 }), cameraRef = useRef(camera), initialFit = useRef(false);
  const [extent, setExtent] = useState({ width: 0, height: 0 });
  const viewport = useRef<HTMLDivElement>(null), drag = useRef<{ id: number; x: number; y: number; camera: Camera; regionId?: string; shapeId?: string } | null>(null);
  cameraRef.current = camera;
  useEffect(() => { setHost(document.querySelector('.workspace-content')); }, []);
  useEffect(() => {
    const controller = new AbortController(); initialFit.current = false;
    setData(null); setMaps({}); setMapErrors({}); setError(''); setRegionId('');
    setGeometries({}); setGeometryErrors({}); setShapeId(''); setMode('shapes');
    void fetch(localFile(cataloguePath), { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error(`Structures unavailable (${response.status}).`);
      const next = readStructureCatalogue(await response.json()); if (controller.signal.aborted) return;
      setFits(Object.fromEntries(next.images.map(image => [image.id, observationManifest ? savedObservationFit(observationManifest, identity(image)) : { ...unchanged }])));
      setReviews(Object.fromEntries(next.images.map(image => {
        try { return [image.id, readDecisions(JSON.parse(localStorage.getItem(reviewStorageKey(cataloguePath, image)) ?? 'null'))]; }
        catch { return [image.id, {}]; }
      })));
      setSelected(next.images.find(item => item.id === preset?.imageId)?.id ?? next.images[0]?.id ?? ''); setData(next);
      for (const image of next.images) {
        if (image.geometry) void fetch(asset(image, image.geometry.file, image.geometry.sha256), { signal: controller.signal, cache: 'no-store' }).then(async result => {
          if (!result.ok) throw new Error(`Prepared shapes unavailable (${result.status}).`);
          const bytes = await result.arrayBuffer();
          const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
          if (digest !== image.geometry?.sha256) throw new Error('Prepared shape identity changed; reload the catalogue.');
          const geometry = readGeometryMap(JSON.parse(new TextDecoder().decode(bytes)), image);
          if (!controller.signal.aborted) setGeometries(current => ({ ...current, [image.id]: geometry }));
        }).catch((reason: unknown) => { if (!controller.signal.aborted) setGeometryErrors(current => ({ ...current, [image.id]: reason instanceof Error ? reason.message : 'Prepared shapes unavailable.' })); });
        void fetch(asset(image, 'map.json'), { signal: controller.signal, cache: 'no-store' }).then(async result => {
        if (!result.ok) throw new Error(`Prepared map unavailable (${result.status}).`);
        const bytes = await result.arrayBuffer();
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
        if (digest !== image.mapSha256) throw new Error('Prepared map identity changed; reload the catalogue.');
        const map = readReviewMap(JSON.parse(new TextDecoder().decode(bytes)), image);
        if (!controller.signal.aborted) setMaps(current => ({ ...current, [image.id]: map }));
      }).catch((reason: unknown) => { if (!controller.signal.aborted) setMapErrors(current => ({ ...current, [image.id]: reason instanceof Error ? reason.message : 'Prepared map unavailable.' })); });
      }
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Structures unavailable.'); });
    return () => controller.abort();
  }, [cataloguePath, observationManifest]);
  const matrices = useMemo(() => Object.fromEntries(data?.images.map(image => [image.id, adjustedMatrix(registered(image), data.frame, fits[image.id] ?? unchanged)]) ?? []), [data, fits]);
  const fitAll = useCallback(() => {
    if (!data || extent.width <= 40 || extent.height <= 40) return;
    const corners = data.images.flatMap(image => imageCorners(registered(image), matrices[image.id] ?? image.imageToFrame));
    const xs = corners.map(point => point[0]), ys = corners.map(point => point[1]);
    const left = Math.min(...xs), top = Math.min(...ys), width = Math.max(...xs) - left, height = Math.max(...ys) - top;
    const zoom = Math.min((extent.width - 36) / width, (extent.height - 36) / height);
    setCamera({ zoom, x: extent.width / 2 - (left + width / 2) * zoom, y: extent.height / 2 - (top + height / 2) * zoom });
  }, [data, extent, matrices]);
  useEffect(() => { if (data && extent.width > 40 && extent.height > 40 && !initialFit.current) { fitAll(); initialFit.current = true; } }, [data, extent, fitAll]);
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setExtent({ width: entry.contentRect.width, height: entry.contentRect.height }); });
    observer.observe(element);
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); const bounds = element.getBoundingClientRect(), old = cameraRef.current;
      const zoom = Math.min(12, Math.max(.015, old.zoom * Math.exp(-event.deltaY * .0015)));
      const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
      setCamera({ zoom, x: x - (x - old.x) * zoom / old.zoom, y: y - (y - old.y) * zoom / old.zoom });
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => { observer.disconnect(); element.removeEventListener('wheel', wheel); };
  }, [host]);
  const image = data?.images.find(item => item.id === selected), map = maps[selected], review = reviews[selected];
  const detector = useGeometryDetection(preset ? undefined : image, geometries[selected], cataloguePath);
  const geometry = preset ? geometries[selected] : detector.effectiveGeometry;
  const effectiveImage = preset ? image : detector.effectiveImage;
  const presetError = useMemo(() => {
    if (!preset || !image || !geometry) return '';
    try { validateShapeCloudPreset(preset, image, geometry); return ''; }
    catch (reason) { return reason instanceof Error ? reason.message : 'Saved fit unavailable.'; }
  }, [preset, image, geometry]);
  function selectPreset(id: string) {
    setPresetId(id); setCloudEditor(true);
    const url = new URL(location.href); if (id) url.searchParams.set('fit', id); else url.searchParams.delete('fit');
    history.replaceState(history.state, '', url);
  }
  const shapes = mode === 'shapes' && Boolean(image);
  const cloudMounted = Boolean(shapes && (preset || detector.ready) && geometry && effectiveImage && !presetError);
  const cloudActive = Boolean(cloudMounted && cloudEditor);
  const candidateShapes = useMemo(() => geometry?.candidates.filter(candidate => candidate.score >= shapeScore) ?? [], [geometry, shapeScore]);
  const selectedShape = candidateShapes.find(candidate => candidate.id === shapeId) ?? candidateShapes[0];
  const shapeIds = useMemo(() => new Set((showAllShapes ? candidateShapes : selectedShape ? [selectedShape] : []).map(candidate => candidate.id)), [candidateShapes, selectedShape, showAllShapes]);
  const visibleRegions = useMemo(() => map?.regions.filter(region => filters.morphology[region.morphology] && (filters.scale < 0 || region.scale === filters.scale) &&
    region.areaPixels >= filters.area && region.contrast >= filters.contrast && region.elongation >= filters.elongation &&
    (filters.review === 'all' || (review?.[region.id] ?? 'unreviewed') === filters.review)) ?? [], [map, filters, review]);
  const visibleIds = useMemo(() => new Set(visibleRegions.map(region => region.id)), [visibleRegions]);
  const selectedRegion = visibleRegions.find(region => region.id === regionId) ?? visibleRegions[0];
  const selectedIndex = selectedRegion ? visibleRegions.indexOf(selectedRegion) : -1;
  const scales = useMemo(() => [...new Set(map?.regions.map(region => region.scale) ?? [])].sort((a, b) => a - b), [map]);
  const elongationLimit = useMemo(() => {
    let maximum = 32;
    for (const prepared of Object.values(maps)) for (const region of prepared.regions) maximum = Math.max(maximum, region.elongation + 1);
    return Math.ceil(Math.log2(maximum));
  }, [maps]);
  const imageError = useCallback((id: string) => setMapErrors(current => current[id] ? current : { ...current, [id]: 'Prepared image or support atlas unavailable.' }), []);
  function decide(value: Decision | 'unreviewed') {
    if (!image || !selectedRegion) return;
    const next = { ...review }; if (value === 'unreviewed') delete next[selectedRegion.id]; else next[selectedRegion.id] = value;
    setReviews(current => ({ ...current, [image.id]: next }));
    try { localStorage.setItem(reviewStorageKey(cataloguePath, image), JSON.stringify(next)); setStorageError(''); } catch { setStorageError('Review saved for this session only.'); }
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId);
    const region = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-region-id]') : null;
    const shape = event.target instanceof Element ? event.target.closest('[data-shape-id]') : null;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, camera: cameraRef.current, regionId: region?.dataset.regionId, shapeId: shape?.getAttribute('data-shape-id') ?? undefined };
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current; if (start?.id === event.pointerId) setCamera({ ...start.camera, x: start.camera.x + event.clientX - start.x, y: start.camera.y + event.clientY - start.y });
  }
  const fit = fits[selected] ?? unchanged, manuallyAdjusted = fit.x !== 0 || fit.y !== 0 || fit.rotation !== 0 || fit.scale !== 1;
  const status = error || mapErrors[selected] || (shapes ? geometryErrors[selected] : '') || (!data ? 'Loading structure catalogue…' : !map ? 'Loading prepared support…' : shapes && !geometry ? 'Loading detected shapes…' : '');
  return <fieldset className="observation-structures">
    <legend>Structure review</legend>
    <WorkspaceImagePicker><label className="visually-hidden" htmlFor="structure-image">Image</label>
    <select id="structure-image" disabled={!data} value={selected} onChange={event => { selectPreset(''); setSelected(event.target.value); setRegionId(''); setShapeId(''); }}>
      {data?.images.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select></WorkspaceImagePicker>
    <ImageCredit credit={image?.credit} />
    {image && shapeCloudPresets.some(item => item.cataloguePath === cataloguePath && item.imageId === image.id) && <>
      <label className="field-label" htmlFor="shape-cloud-fit">Fit</label>
      <select id="shape-cloud-fit" value={preset?.id ?? ''} onChange={event => selectPreset(event.target.value)}>
        <option value="">Automatic · my edits</option>
        {shapeCloudPresets.filter(item => item.cataloguePath === cataloguePath && item.imageId === image.id).map(item =>
          <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      {presetError && <p className="shape-cloud-error" role="alert">{presetError}</p>}
    </>}
    <div className="emission-layer-buttons" role="group" aria-label="Structure layer" hidden={cloudActive}>
      {map?.panels.map(panel => <InfoTip key={panel.id} content={panel.description}><button type="button" aria-pressed={layer === panel.id} onClick={() => setLayer(panel.id)}>{panel.label}</button></InfoTip>)}
    </div>
    {image && <div className="emission-layer-buttons" role="group" aria-label="Structure inspection mode">
      <InfoTip content={'Inspect projected shape hypotheses and their inferred cloud preview.'}><button type="button" aria-pressed={shapes} onClick={() => setMode('shapes')}>Shapes</button></InfoTip>
      <InfoTip content={'Inspect and review detected image regions without assigning depth.'}><button type="button" aria-pressed={!shapes} onClick={() => setMode('regions')}>Regions</button></InfoTip>
    </div>}
    <p className="interaction-hint emission-structure-status" style={{ minHeight: '1.4em' }} role={error || mapErrors[selected] || (shapes && geometryErrors[selected]) ? 'alert' : 'status'} data-error={Boolean(error || mapErrors[selected] || (shapes && geometryErrors[selected]))}>{status || storageError}</p>
    {cloudMounted && effectiveImage && geometry && image && data && <ShapeCloudWorkbench visible={cloudActive}
      modelTools={!preset && <GeometryDetectionControls detector={detector} image={image} />}
      image={effectiveImage} geometry={geometry} preset={preset} initialQuality={preset ? 'detailed' : detector.quality} cataloguePath={cataloguePath} host={host}
      matrix={matrices[image.id] ?? image.imageToFrame} frame={data.frame} onDetected={() => setCloudEditor(false)} />}
    {map && <p className="interaction-hint" title={`Maximum additive reconstruction error ${map.metrics.reconstructionMaxError}. Unassigned signal and imperfect star-removal residuals remain. Decisions indicate human review, never depth or physical membership.`}>
      {map.metrics.reconstructionMaxError < 1e-5 ? 'All input accounted for' : 'Inspect accounting error'} · {(map.metrics.unassignedFraction * 100).toFixed(1)}% unassigned</p>}

    {host && createPortal(<section className="observation-structures-workspace" aria-label="Registered structure inspection" data-cloud-active={cloudActive}>
      <div ref={viewport} className="observation-sky" aria-label="Structure inspection sky" tabIndex={0} onPointerDown={pointerDown} onPointerMove={pointerMove}
        onPointerUp={event => { const start = drag.current; drag.current = null;
          if (start?.id === event.pointerId && start.regionId && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4) setRegionId(start.regionId);
          if (start?.id === event.pointerId && start.shapeId && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4) setShapeId(start.shapeId);
        }} onPointerCancel={() => { drag.current = null; }} onDoubleClick={fitAll}
        onKeyDown={event => { if (event.key === 'Home' || event.key === '0') { event.preventDefault(); fitAll(); } }}>
        <div className="observation-structure-frame" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
          {data?.images.map(item => { const prepared = maps[item.id], matrix = matrices[item.id]; return prepared && matrix ? <StructurePlane key={item.id} image={item} map={prepared} matrix={matrix}
            active={item.id === selected} layer={layer} visibleIds={item.id === selected ? visibleIds : emptyIds} selectedId={item.id === selected ? selectedRegion?.id ?? '' : ''}
            highlights={highlights && !shapes} onSelect={setRegionId} onError={imageError}
            geometry={item.id === selected ? geometry : geometries[item.id]} shapes={shapes} shapeIds={item.id === selected ? shapeIds : emptyIds}
            selectedShapeId={item.id === selected ? selectedShape?.id ?? '' : ''} onSelectShape={setShapeId} /> : null; })}
        </div>
        <div className="observation-compass">N ↑ · E ←</div>
      </div>
      <CameraModelPanel className="observation-camera" camera={{ fit: data ? { onActivate: fitAll, description: 'Fit all full native image footprints in the common sky frame.' } : 'The registered images are loading.' }}
        unavailableReason="Structure inspection uses a fixed north-up 2D sky projection."
        cameraHint={<><p>Drag to pan · scroll to zoom</p><p>Full field · north up · 2D</p><p>{manuallyAdjusted ? 'Manual inspection adjustment' : 'Registered positioning'}</p></>}>
    {shapes && !cloudActive && image && !preset && <GeometryDetectionControls detector={detector} image={image} />}
    <div hidden={!shapes || cloudActive}><GeometryControls geometry={geometry} candidates={candidateShapes} selected={selectedShape} score={shapeScore}
      showAll={showAllShapes} onScore={setShapeScore} onShowAll={setShowAllShapes} onSelect={setShapeId} /></div>
    {shapes && !cloudEditor && <button type="button" onClick={() => setCloudEditor(true)}>Cloud preview</button>}
    <div hidden={shapes}>
    <div className="structure-morphologies" role="group" aria-label="Morphology filters">{morphologies.map(kind => <label key={kind}>
      <input type="checkbox" checked={filters.morphology[kind]} onChange={event => setFilters(current => ({ ...current, morphology: { ...current.morphology, [kind]: event.target.checked } }))} />{title(kind)}
    </label>)}</div>
    <div className="structure-slider"><label htmlFor="structure-scale">Scale</label>
      <output htmlFor="structure-scale">{filters.scale < 0 ? 'All' : filters.scale + 1}</output>
      <input id="structure-scale" type="range" min={-1} max={Math.max(2, ...scales)} step={1} value={filters.scale} disabled={!map}
        aria-valuetext={filters.scale < 0 ? 'All scales' : `Scale ${filters.scale + 1}`}
        onChange={event => setFilters(current => ({ ...current, scale: event.target.valueAsNumber }))} />
    </div>
    {([{ key: 'area', label: 'Area ≥', max: 20, value: Math.log2(filters.area + 1), read: (value: number) => Math.round(2 ** value - 1),
        display: `${filters.area.toLocaleString()} px²`, tip: 'Support area in the working image. Logarithmic slider for fine control of small regions; not physical size.' },
      { key: 'contrast', label: 'Contrast ≥', max: 1, value: Math.sqrt(filters.contrast), read: (value: number) => value ** 2,
        display: filters.contrast.toPrecision(3), tip: 'Prepared wavelet contrast. Finer control near zero; no image processing.' },
      { key: 'elongation', label: 'Elongation ≥', max: elongationLimit, value: Math.log2(filters.elongation), read: (value: number) => 2 ** value,
        display: `${filters.elongation.toFixed(2)}×`, tip: 'Major/minor axis ratio. Logarithmic slider; not a coherence measurement.' }] as const).map(control =>
      <div className="structure-slider" key={control.key}><label htmlFor={`structure-${control.key}`} title={control.tip}>{control.label}</label>
        <output htmlFor={`structure-${control.key}`}>{control.display}</output>
        <input id={`structure-${control.key}`} type="range" min={0} max={control.max} step={control.key === 'contrast' ? .001 : .01}
          value={control.value} aria-valuetext={control.display} disabled={!map}
          onChange={event => setFilters(current => ({ ...current, [control.key]: control.read(event.target.valueAsNumber) }))} />
      </div>)}
    <div className="structure-filter"><label htmlFor="structure-review-filter">Review</label><select id="structure-review-filter" value={filters.review} onChange={event => setFilters(current => ({ ...current, review: event.target.value }))}>
      {['all', 'unreviewed', ...decisions].map(value => <option key={value} value={value}>{title(value)}</option>)}
    </select></div>
    <label className="observation-check"><input type="checkbox" checked={highlights} onChange={event => setHighlights(event.target.checked)} /> Show filtered support</label>
    <p className="interaction-hint" role="status">{visibleRegions.length.toLocaleString()} / {map?.regions.length.toLocaleString() ?? '—'} regions</p>
    <section className="structure-selection" aria-label="Selected region">
      <div className="structure-review-navigation"><button type="button" disabled={selectedIndex <= 0} onClick={() => setRegionId(visibleRegions[selectedIndex - 1]?.id ?? '')}>Previous region</button>
        <button type="button" disabled={selectedIndex < 0 || selectedIndex >= visibleRegions.length - 1} onClick={() => setRegionId(visibleRegions[selectedIndex + 1]?.id ?? '')}>Next region</button></div>
      {selectedRegion ? <>
        <p className="interaction-hint" data-selected-region={selectedRegion.id}>{selectedRegion.id} · {title(selectedRegion.morphology)} · scale {selectedRegion.scale + 1}</p>
        <p className="interaction-hint">{selectedRegion.areaPixels} px² · contrast {selectedRegion.contrast.toPrecision(3)} · elongation {selectedRegion.elongation.toFixed(1)}×</p>
        <div className="structure-decisions" role="group" aria-label="Region decision">{decisions.map(value => <button type="button" key={value} aria-pressed={review?.[selectedRegion.id] === value} onClick={() => decide(value)}>{title(value)}</button>)}</div>
        <button type="button" className="text-button" disabled={!review?.[selectedRegion.id]} onClick={() => decide('unreviewed')}>Reset to unreviewed</button>
      </> : <p className="interaction-hint">No regions match these filters.</p>}
    </section>
    </div>
      </CameraModelPanel>
    </section>, host)}
  </fieldset>;
}
