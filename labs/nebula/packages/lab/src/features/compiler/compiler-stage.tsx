import { useOrbitDrag } from '../../ui/use-orbit-drag.ts';
import { bindViewportZoom } from '../../ui/viewport-input.ts';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CompilerResult } from './result.ts';
import { createCompilerViewer, type CompilerMaterial, type CompilerViewer } from '../../adapters/viewer/compiler-viewer';
import { compilerInspectionCamera, type CompilerInspectionFrame } from '@cssearth/volume-viewer/camera/inspection';
import type { CloudView } from '../shape-cloud/shape-cloud-stage';
import '../shape-cloud/shape-cloud.css';

export type { CloudView } from '../shape-cloud/shape-cloud-stage';
export const earthCompilerView: CloudView = { zoom: 1, panX: 0, panY: 0, yaw: 0, pitch: 0, locked: true };
export interface CompilerStageProps {
  result: CompilerResult | null;
  lensId: string | null;
  mode: CompilerMaterial;
  stars: boolean;
  showOriginal: boolean;
  view: CloudView;
  onView(value: CloudView): void;
  fieldOfViewArcsec?: number;
  inspectionFrame?: CompilerInspectionFrame;
}

const localFile = (path: string) => `/@fs${__NEBULA_REPO_ROOT__.replace(/\/$/, '')}/${path}`;
declare const __NEBULA_REPO_ROOT__: string;

/** One retained final scene; result and lens replacements become visible only after decoding. */
export function CompilerStage({ result, lensId, mode, stars, showOriginal, view, onView,
  fieldOfViewArcsec, inspectionFrame }: CompilerStageProps) {
  const viewport = useRef<HTMLDivElement>(null), host = useRef<HTMLDivElement>(null);
  const renderer = useRef<CompilerViewer | null>(null), viewRef = useRef(view);
  const selection = useRef({ lensId, mode, stars }); selection.current = { lensId, mode, stars }; viewRef.current = view;
  const dragEvents = useOrbitDrag(viewRef, onView);
  const committedKey = useRef('');
  const [visible, setVisible] = useState<CompilerResult | null>(null), [error, setError] = useState('');
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const scene = result?.scene;
  const inspectionKey = inspectionFrame ? JSON.stringify(inspectionFrame) : fieldOfViewArcsec ?? 'scene';
  const key = scene ? `${scene.neutral.path}:${scene.lenses.map(item => item.volume.path).join(':')}:${inspectionKey}` : '';
  useEffect(() => () => { renderer.current?.destroy(); renderer.current = null; committedKey.current = ''; }, []);
  useEffect(() => {
    if (!result || !scene || !host.current || committedKey.current === key) return;
    const controller = new AbortController(); let disposed = false; setError('');
    void createCompilerViewer({ host: host.current, result: scene, fieldOfViewArcsec, inspectionFrame, deferCommit: true, signal: controller.signal }).then(async next => {
      if (disposed) { next.destroy(); return; }
      try {
        const currentView = viewRef.current, currentSelection = selection.current;
        next.setFraming({ zoom: currentView.zoom, panX: currentView.panX, panY: currentView.panY });
        next.setPose(currentView.yaw, currentView.pitch); next.setStars(currentSelection.stars);
        await next.setMaterial(currentSelection.mode, currentSelection.lensId);
        if (disposed) { next.destroy(); return; }
        next.commit(); const previous = renderer.current; renderer.current = next; committedKey.current = key;
        previous?.destroy(); setVisible(result);
      } catch (reason) { next.destroy(); throw reason; }
    }).catch((reason: unknown) => {
      if (!disposed && !(reason instanceof DOMException && reason.name === 'AbortError'))
        setError(reason instanceof Error ? reason.message : 'Compiled volume could not be loaded.');
    });
    return () => { disposed = true; controller.abort(); };
  // Only a different prepared scene or inspection frame may abort its load lifetime.
  // Equal receipt/frame objects can be recreated by React while the retained viewer still uses this signal.
  }, [key]);
  useEffect(() => { renderer.current?.setPose(view.yaw, view.pitch); }, [view.yaw, view.pitch, visible?.id]);
  useEffect(() => { renderer.current?.setFraming({ zoom: view.zoom, panX: view.panX, panY: view.panY }); },
    [view.zoom, view.panX, view.panY, visible?.id]);
  useEffect(() => { renderer.current?.setStars(stars); }, [stars, visible?.id]);
  useEffect(() => {
    let stale = false;
    void renderer.current?.setMaterial(mode, lensId).catch((reason: unknown) => {
      if (!stale) setError(reason instanceof Error ? reason.message : 'Compiled lens could not be loaded.');
    });
    return () => { stale = true; };
  }, [mode, lensId, visible?.id]);
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    return bindViewportZoom(element, viewRef, onView);
  }, [onView]);
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const observer = new ResizeObserver(() => setViewportSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element); setViewportSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, []);
  const source = visible?.sources.find(item => item.id === lensId);
  const fov = fieldOfViewArcsec ?? visible?.scene.spanArcsec ?? 1;
  const originalStyle = useMemo(() => {
    const yaw = view.yaw * Math.PI / 180, pitch = view.pitch * Math.PI / 180;
    const a = Math.cos(yaw), b = Math.sin(pitch) * Math.sin(yaw), d = Math.cos(pitch);
    const bounds = source?.boundsArcsec ?? visible?.scene.skyBoundsArcsec;
    const origin = visible?.scene.coordinates.localOriginArcsec ?? [0, 0, 0];
    const inspection = inspectionFrame && viewportSize.width > 2 * (inspectionFrame.paddingPixels ?? 18) && viewportSize.height > 2 * (inspectionFrame.paddingPixels ?? 18)
      ? compilerInspectionCamera(inspectionFrame, origin, viewportSize, view, view.yaw, view.pitch) : null;
    const pixelsPerArcsec = inspection?.pixelsPerArcsec ?? Math.min(viewportSize.width, viewportSize.height) * .94 / fov * view.zoom;
    const x = bounds ? (bounds.min[0] + bounds.max[0]) / 2 - origin[0] : 0;
    const y = bounds ? (bounds.min[1] + bounds.max[1]) / 2 - origin[1] : 0;
    const z = -origin[2]; // The registered source is the absolute zAway=0 plane.
    const projected = inspection?.project((bounds?.min[0] ?? 0) + (bounds ? (bounds.max[0] - bounds.min[0]) / 2 : 0),
      (bounds?.min[1] ?? 0) + (bounds ? (bounds.max[1] - bounds.min[1]) / 2 : 0), 0);
    const centerX = viewportSize.width / 2 + (projected?.[0] ?? view.panX + (a * x - Math.sin(yaw) * z) * pixelsPerArcsec);
    const centerY = viewportSize.height / 2 + (projected?.[1] ?? view.panY + (b * x - d * y + Math.sin(pitch) * Math.cos(yaw) * z) * pixelsPerArcsec);
    const width = bounds ? (bounds.max[0] - bounds.min[0]) * pixelsPerArcsec : 0;
    const height = bounds ? (bounds.max[1] - bounds.min[1]) * pixelsPerArcsec : 0;
    return { position: 'absolute' as const, left: `${centerX}px`, top: `${centerY}px`, width: `${width}px`, height: `${height}px`,
      objectFit: 'fill' as const, pointerEvents: 'none' as const, opacity: .42, zIndex: 3,
      transformOrigin: 'center', transform: `translate(-50%,-50%) matrix(${a},${b},0,${d},0,0)` };
  }, [view.yaw, view.pitch, view.panX, view.panY, view.zoom, visible?.scene.skyBoundsArcsec,
    visible?.scene.coordinates.localOriginArcsec, source?.boundsArcsec, viewportSize, fov, inspectionFrame]);
  const ready = Boolean(visible);
  return <section className="shape-cloud-pane shape-cloud-pane-cloud compiler-stage" aria-label="Compiled nebula volume"
    data-compiler-ready={ready} data-compiler-result={visible?.id ?? ''} data-compiler-lens={lensId ?? ''}
    data-compiler-mode={mode} data-compiler-stars={stars} data-compiler-original={showOriginal}
    data-compiler-pose={`${view.yaw},${view.pitch}`} data-compiler-field-of-view={fov}>
    <div className="shape-cloud-pane-label">Compiled cloud</div>
    <div className="shape-cloud-viewport" ref={viewport} tabIndex={0} {...dragEvents}
      onDoubleClick={() => onView(earthCompilerView)} onKeyDown={event => { if (event.key === 'Home') { event.preventDefault(); onView(earthCompilerView); } }}>
      <div className="shape-cloud-render-host" ref={host} data-compiler-host="true" data-compiler-result={visible?.id ?? ''}
        style={{ width: '100%', height: '100%' }} />
      {showOriginal && source && <img src={localFile(source.original.path)} alt="" aria-hidden="true"
        data-compiler-original-source={source.id} style={originalStyle} />}
      {(error || result && !ready) && <p className="shape-cloud-empty" role={error ? 'alert' : 'status'}>{error || 'Preparing compiled cloud…'}</p>}
    </div>
  </section>;
}
