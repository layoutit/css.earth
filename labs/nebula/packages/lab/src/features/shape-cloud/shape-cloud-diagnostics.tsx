import { bindViewportZoom } from '../../ui/viewport-input.ts';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Matrix } from '../observations/models/model';
import type { ShapeCloudComparison, ShapeCloudPin } from './types.ts';
import { localFile } from '../legacy-viewer/controller';

export type ComparisonChannel = 'luminosity' | 'edges' | 'difference';
export interface ComparisonView { zoom: number; panX: number; panY: number }
export const earthComparisonView: ComparisonView = { zoom: 1, panX: 0, panY: 0 };
interface Props {
  comparison?: ShapeCloudComparison; channel: ComparisonChannel; level: number; matrix: Matrix;
  frame: { width: number; height: number }; view: ComparisonView; onView(value: ComparisonView): void;
}
function imageUrl(pin: ShapeCloudPin): string { return `${localFile(pin.path)}?v=${pin.sha256}`; }

/** Only prepared diagnostic rasters enter this component; no runtime image processing. */
export function ShapeCloudDiagnostics({ comparison, channel, level, ...props }: Props) {
  const selected = comparison?.levels[level];
  const left = selected && imageUrl(channel === 'edges' ? selected.sourceEdges : selected.source);
  const right = selected && imageUrl(channel === 'edges' ? selected.modelEdges : channel === 'difference' ? selected.difference : selected.model);
  const [pair, setPair] = useState<{ left: string; right: string; channel: ComparisonChannel; gain: number } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true; setError('');
    if (!left || !right || !selected) { setPair(null); return; }
    const images = [left, right].map(src => { const image = new Image(); image.src = src; return image; });
    void Promise.all(images.map(image => image.decode())).then(() => {
      if (current) setPair({ left, right, channel, gain: selected.gain });
    }).catch(() => { if (current) setError('Comparison images could not be loaded.'); });
    return () => { current = false; };
  }, [left, right, channel, selected]);
  const ready = Boolean(pair && pair.left === left && pair.right === right);
  return <div className="shape-cloud-stage shape-cloud-diagnostics" data-channel={pair?.channel ?? channel}
    data-gain={pair?.gain ?? ''} data-ready={ready} aria-label="Structure comparison">
    {comparison && pair ? <>
      <ComparisonPane {...props} comparison={comparison} src={pair.left} kind="source"
        label={pair.channel === 'edges' ? 'Source · edges' : 'Source · luminance'} />
      <ComparisonPane {...props} comparison={comparison} src={pair.right} kind="model"
        label={pair.channel === 'edges' ? 'Model · edges' : pair.channel === 'difference' ? 'Difference · missing / excess' : 'Model · luminance'} />
    </> : <p className="shape-cloud-empty" role="status">Preparing structure comparison…</p>}
    {error && <p className="shape-cloud-empty shape-cloud-error" role="alert">{error}</p>}
  </div>;
}

function ComparisonPane({ comparison, src, label, kind, frame, matrix, view, onView }: Omit<Props, 'comparison' | 'channel' | 'level'> & {
  comparison: ShapeCloudComparison; src: string; label: string; kind: 'source' | 'model';
}) {
  const viewport = useRef<HTMLDivElement>(null), viewRef = useRef(view); viewRef.current = view;
  const [extent, setExtent] = useState({ width: 0, height: 0 });
  const scale = Math.min(extent.width / frame.width, extent.height / frame.height) * .94 * view.zoom;
  const scaleRef = useRef(scale); scaleRef.current = scale;
  const drag = useRef<{ id: number; x: number; y: number; view: ComparisonView } | null>(null);
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    return bindViewportZoom(element, viewRef, onView, setExtent);
  }, [onView]);
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view: viewRef.current };
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current; if (!start || event.pointerId !== start.id) return;
    onView({ ...start.view, panX: start.view.panX + (event.clientX - start.x) / Math.max(.001, scaleRef.current),
      panY: start.view.panY + (event.clientY - start.y) / Math.max(.001, scaleRef.current) });
  }
  return <section className="shape-cloud-pane" data-comparison-pane={kind} aria-label={label}>
    <div className="shape-cloud-pane-label">{label}</div>
    <div className="shape-cloud-viewport" ref={viewport} tabIndex={0} onPointerDown={pointerDown} onPointerMove={pointerMove}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      onDoubleClick={() => onView(earthComparisonView)} onKeyDown={event => { if (event.key === 'Home') { event.preventDefault(); onView(earthComparisonView); } }}>
      <div className="shape-cloud-frame" style={{ transform: `translate(${extent.width / 2 + (view.panX - frame.width / 2) * scale}px, ${extent.height / 2 + (view.panY - frame.height / 2) * scale}px) scale(${scale})` }}>
        <div className="shape-cloud-image-plane" data-comparison-frame={kind}
          style={{ width: comparison.width, height: comparison.height, transform: `matrix(${matrix.join(',')})` }}>
          <img className="shape-cloud-source" src={src} alt={label} width={comparison.width} height={comparison.height} draggable={false} />
        </div>
      </div>
    </div>
  </section>;
}
