import { bindViewportZoom } from '../../ui/viewport-input.ts';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Matrix } from '../observations/models/model';
import type { ShapeCloudComponent, ShapeCloudMode, ShapeCloudResult } from './types.ts';
import { createShapeCloudViewer } from '../../adapters/viewer/shape-cloud-viewer';
import { shapeCloudPhotoPose } from './shape-cloud-photo-pose';
import { ellipseArcPath } from '../observations/models/geometry-model';
import { ShapeCloudOrientation } from './shape-cloud-orientation';

export interface CloudView { zoom: number; panX: number; panY: number; yaw: number; pitch: number; locked: boolean }
export const earthCloudView: CloudView = { zoom: 1, panX: 0, panY: 0, yaw: 0, pitch: 0, locked: true };
type Renderer = Awaited<ReturnType<typeof createShapeCloudViewer>>;
export interface CloudStageProps {
  mode: ShapeCloudMode; result: ShapeCloudResult | null; source: string; width: number; height: number; matrix: Matrix;
  frame: { width: number; height: number }; components: ShapeCloudComponent[]; selectedId: string;
  hoveredId?: string;
  outlines: boolean; overlayOpacity: number; view: CloudView; onView(value: CloudView): void; onSelect(id: string): void;
}
function CloudPane({ kind, ...props }: CloudStageProps & { kind: 'source' | 'cloud' }) {
  const { mode, result, source, width, height, matrix, frame, components, selectedId, hoveredId, outlines, overlayOpacity, view, onView, onSelect } = props;
  const viewport = useRef<HTMLDivElement>(null), host = useRef<HTMLDivElement>(null), renderer = useRef<Renderer | null>(null);
  const [extent, setExtent] = useState({ width: 0, height: 0 }), [error, setError] = useState(''), [ready, setReady] = useState(false);
  const [visibleResult, setVisibleResult] = useState<ShapeCloudResult | null>(null);
  const committedId = useRef<string | null>(null);
  const viewRef = useRef(view); viewRef.current = view;
  const modeRef = useRef(mode); modeRef.current = mode;
  const sourceVisible = kind === 'source' || mode === 'overlay';
  const scale = Math.min(extent.width / frame.width, extent.height / frame.height) * .94 * view.zoom;
  const scaleRef = useRef(scale); scaleRef.current = scale;
  const photoPose = `matrix(${shapeCloudPhotoPose(width, height, view.yaw, view.pitch).join(',')})`;
  const photoStyle = { position: 'absolute' as const, inset: 0, width, height, transform: photoPose, transformOrigin: '0 0' };
  const drag = useRef<{ id: number; x: number; y: number; view: CloudView; pan: boolean; component?: string } | null>(null);
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    return bindViewportZoom(element, viewRef, onView, setExtent);
  }, [onView]);
  useEffect(() => {
    return () => { renderer.current?.destroy(); renderer.current = null; committedId.current = null; };
  }, []);
  useEffect(() => {
    if (kind !== 'cloud' || !host.current) return;
    if (!result) {
      renderer.current?.destroy(); renderer.current = null; committedId.current = null;
      setVisibleResult(null); setReady(false); setError(''); return;
    }
    if (committedId.current === result.id) return;
    const controller = new AbortController(); let disposed = false; setError('');
    // The current scene remains visible while the next prepared materials decode.
    void createShapeCloudViewer({ host: host.current, result, deferCommit: true, signal: controller.signal }).then(scene => {
      if (disposed) { scene.destroy(); return; }
      try {
        scene.setFraming({ zoom: 1 / .94, panX: 0, panY: 0 });
        scene.setPose(viewRef.current.yaw, viewRef.current.pitch);
        scene.setMaterial(modeRef.current === 'textured' ? 'textured' : 'neutral');
        scene.commit();
        const previous = renderer.current; renderer.current = scene; committedId.current = result.id;
        previous?.destroy(); setVisibleResult(result); setReady(true);
      } catch (reason) { scene.destroy(); throw reason; }
    }).catch((reason: unknown) => { if (!disposed) setError(reason instanceof Error ? reason.message : 'Cloud could not be loaded.'); });
    return () => { disposed = true; controller.abort(); };
  }, [kind, result]);
  useEffect(() => { renderer.current?.setMaterial(mode === 'textured' ? 'textured' : 'neutral'); }, [mode, ready]);
  useEffect(() => { renderer.current?.setPose(view.yaw, view.pitch); }, [view.yaw, view.pitch, ready]);
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target instanceof Element ? event.target.closest('[data-cloud-component]') : null;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view: viewRef.current,
      pan: viewRef.current.locked || event.shiftKey, component: target?.getAttribute('data-cloud-component') ?? undefined };
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current; if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    onView(start.pan ? { ...start.view, panX: start.view.panX + dx / Math.max(.001, scaleRef.current), panY: start.view.panY + dy / Math.max(.001, scaleRef.current) } :
      { ...start.view, yaw: start.view.yaw + dx * .35, pitch: Math.max(-89, Math.min(89, start.view.pitch - dy * .35)) });
  }
  const showGuides = outlines && (kind === 'source' || view.locked);
  return <section className={`shape-cloud-pane shape-cloud-pane-${kind}`} aria-label={kind === 'source' ? 'Source with shape guides' : 'Reconstructed shape cloud'}>
    <div className="shape-cloud-pane-label">{kind === 'source' ? 'Source + guides' : mode === 'textured' ? 'Textured cloud' : 'Untextured cloud'}</div>
    <div className="shape-cloud-viewport" ref={viewport} tabIndex={0} onPointerDown={pointerDown} onPointerMove={pointerMove}
      onPointerUp={event => { const start = drag.current; drag.current = null;
        if (start?.id === event.pointerId && start.component && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4) onSelect(start.component);
      }} onPointerCancel={() => { drag.current = null; }} onDoubleClick={() => onView(earthCloudView)}
      onKeyDown={event => { if (event.key === 'Home') { event.preventDefault(); onView(earthCloudView); } }}>
      <div className="shape-cloud-frame" style={{ transform: `translate(${extent.width / 2 + (view.panX - frame.width / 2) * scale}px, ${extent.height / 2 + (view.panY - frame.height / 2) * scale}px) scale(${scale})` }}>
        <div className="shape-cloud-image-plane" data-cloud-source-frame={kind} style={{ width, height, transform: `matrix(${matrix.join(',')})` }}>
          <div className="shape-cloud-photo-pose" data-photo-pose={`${view.yaw},${view.pitch}`} style={{ ...photoStyle, pointerEvents: 'none' }}>
            <img className="shape-cloud-source" src={source} alt="Registered source without stars" width={width} height={height}
              style={{ visibility: sourceVisible ? 'visible' : 'hidden' }} draggable={false} onError={() => setError('Source image could not be loaded.')} />
          </div>
          {kind === 'cloud' && <div className="shape-cloud-render-host" data-cloud-result={visibleResult?.id ?? ''}
            data-cloud-quality={visibleResult?.quality ?? ''} ref={host}
            style={{ width, height, opacity: mode === 'overlay' ? overlayOpacity : 1 }} />}
          <div className="shape-cloud-guide-pose" style={{ ...photoStyle, pointerEvents: 'none' }}><svg className="shape-cloud-guides" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
            aria-label="Editable shape cloud guides" style={{ visibility: showGuides ? 'visible' : 'hidden' }}>
            {components.map(component => <g key={component.id} data-cloud-component={component.id} data-selected={component.id === selectedId} data-hovered={component.id === hoveredId}
              data-enabled={component.enabled} transform={`translate(${component.x} ${component.y}) rotate(${component.rotationDegrees})`}>
              <title>{component.label} · click to select · weight {component.weight.toFixed(2)}{component.enabled ? '' : ' · disabled'}</title>
              {component.shape === 'ring' && (component.arcSweepDegrees ?? 360) < 360 ? <>
                <path className="cloud-guide-line" d={ellipseArcPath([component.radiusX, component.radiusY],
                  ((component.arcCenterDegrees ?? 0) - component.arcSweepDegrees! / 2) * Math.PI / 180,
                  ((component.arcCenterDegrees ?? 0) + component.arcSweepDegrees! / 2) * Math.PI / 180)} vectorEffect="non-scaling-stroke" />
                <path className="cloud-guide-hit" d={ellipseArcPath([component.radiusX, component.radiusY],
                  ((component.arcCenterDegrees ?? 0) - component.arcSweepDegrees! / 2) * Math.PI / 180,
                  ((component.arcCenterDegrees ?? 0) + component.arcSweepDegrees! / 2) * Math.PI / 180)} vectorEffect="non-scaling-stroke" style={{ pointerEvents: showGuides ? 'stroke' : 'none' }} />
              </> : <>
                <ellipse className="cloud-guide-line" rx={component.radiusX} ry={component.radiusY} vectorEffect="non-scaling-stroke" />
                <ellipse className="cloud-guide-hit" rx={component.radiusX} ry={component.radiusY} vectorEffect="non-scaling-stroke" style={{ pointerEvents: showGuides ? 'stroke' : 'none' }} />
              </> }
            </g>)}
          </svg></div>
        </div>
      </div>
      {kind === 'cloud' && (error || !ready || visibleResult?.empty) && <p className="shape-cloud-empty" role={error ? 'alert' : 'status'}>
        {error || (visibleResult?.empty ? 'Adjust components to add emission.' : 'Preparing cloud…')}
      </p>}
      {kind === 'source' && error && <p className="shape-cloud-empty" role="alert">{error}</p>}
    </div>
    <ShapeCloudOrientation yaw={view.yaw} pitch={view.pitch} matrix={matrix} />
  </section>;
}
export function ShapeCloudStage(props: CloudStageProps) {
  return <div className="shape-cloud-stage" data-mode={props.mode} data-camera-locked={props.view.locked}>
    <div className="shape-cloud-source-slot" hidden={props.mode !== 'compare'}><CloudPane {...props} kind="source" /></div>
    <div className="shape-cloud-output-slot"><CloudPane {...props} kind="cloud" /></div>
  </div>;
}
