import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { JointVolumeResult } from '../../server/workflows/joint-fit/volume.ts';
import { createJointFitViewer, type JointFitViewer } from '../../adapters/viewer/joint-fit-viewer';
import type { CloudView } from '../shape-cloud/shape-cloud-stage';
import '../shape-cloud/shape-cloud.css';

export type { CloudView } from '../shape-cloud/shape-cloud-stage';
export const earthJointFitView: CloudView = { zoom: 1, panX: 0, panY: 0, yaw: 0, pitch: 0, locked: true };
export interface JointFitStageProps {
  result: JointVolumeResult | null;
  fieldOfViewArcsec?: number;
  view: CloudView;
  onView(value: CloudView): void;
}

/** Retains the decoded scene while a replacement result loads and validates. */
export function JointFitStage({ result, fieldOfViewArcsec, view, onView }: JointFitStageProps) {
  const viewport = useRef<HTMLDivElement>(null), host = useRef<HTMLDivElement>(null);
  const renderer = useRef<JointFitViewer | null>(null), viewRef = useRef(view);
  const committedPin = useRef('');
  const [visibleId, setVisibleId] = useState(''), [error, setError] = useState('');
  const drag = useRef<{ id: number; x: number; y: number; view: CloudView; pan: boolean } | null>(null);
  viewRef.current = view;
  useEffect(() => () => { renderer.current?.destroy(); renderer.current = null; committedPin.current = ''; }, []);
  useEffect(() => {
    const key = result ? `${result.volume.path}:${fieldOfViewArcsec ?? 'bounds'}` : '';
    if (!result || !host.current || committedPin.current === key) return;
    const controller = new AbortController(); let disposed = false; setError('');
    void createJointFitViewer({ host: host.current, result, fieldOfViewArcsec, deferCommit: true, signal: controller.signal }).then(scene => {
      if (disposed) { scene.destroy(); return; }
      try {
        const current = viewRef.current;
        scene.setFraming({ zoom: current.zoom, panX: current.panX, panY: current.panY });
        scene.setPose(current.yaw, current.pitch); scene.commit();
        const previous = renderer.current; renderer.current = scene; committedPin.current = key;
        previous?.destroy(); setVisibleId(result.id);
      } catch (reason) { scene.destroy(); throw reason; }
    }).catch((reason: unknown) => { if (!disposed && !(reason instanceof DOMException && reason.name === 'AbortError'))
      setError(reason instanceof Error ? reason.message : 'Joint-fit volume could not be loaded.'); });
    return () => { disposed = true; controller.abort(); };
  }, [result, fieldOfViewArcsec]);
  useEffect(() => { renderer.current?.setPose(view.yaw, view.pitch); }, [view.yaw, view.pitch, visibleId]);
  useEffect(() => { renderer.current?.setFraming({ zoom: view.zoom, panX: view.panX, panY: view.panY }); },
    [view.zoom, view.panX, view.panY, visibleId]);
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const wheel = (event: WheelEvent) => { event.preventDefault(); const current = viewRef.current;
      onView({ ...current, zoom: Math.max(.15, Math.min(12, current.zoom * Math.exp(-event.deltaY * .0015))) }); };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [onView]);
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view: viewRef.current,
      pan: viewRef.current.locked || event.shiftKey };
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current; if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    onView(start.pan ? { ...start.view, panX: start.view.panX + dx, panY: start.view.panY + dy } :
      { ...start.view, yaw: start.view.yaw + dx * .35, pitch: Math.max(-89, Math.min(89, start.view.pitch - dy * .35)) });
  }
  const ready = Boolean(visibleId);
  return <section className="shape-cloud-pane shape-cloud-pane-cloud joint-fit-stage" aria-label="Joint analytic fit volume"
    data-joint-fit-ready={ready} data-joint-fit-result={visibleId} data-joint-fit-pose={`${view.yaw},${view.pitch}`}
    data-joint-fit-field-of-view={fieldOfViewArcsec ?? 'bounds'}>
    <div className="shape-cloud-pane-label">Joint analytic fit</div>
    <div className="shape-cloud-viewport" ref={viewport} tabIndex={0} onPointerDown={pointerDown} onPointerMove={pointerMove}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      onDoubleClick={() => onView(earthJointFitView)} onKeyDown={event => {
        if (event.key === 'Home') { event.preventDefault(); onView(earthJointFitView); }
      }}>
      <div className="shape-cloud-render-host" ref={host} data-joint-fit-host="true" data-joint-fit-result={visibleId}
        style={{ width: '100%', height: '100%' }} />
      {(error || !ready) && <p className="shape-cloud-empty" role={error ? 'alert' : 'status'}>{error || 'Preparing joint fit…'}</p>}
    </div>
  </section>;
}
