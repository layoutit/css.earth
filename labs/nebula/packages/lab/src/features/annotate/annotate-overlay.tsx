import { useCallback, useEffect, useRef, useState } from 'react';
import type { LabControlsProps } from '../../state/use-lab-controller';
import { annotationText, quadMetrics, skyOffset, type AnnotatedPatch, type Vector3 } from './annotate-model.ts';
import { setAnnotating, useAnnotating } from './annotate-store.ts';
import './annotate.css';

type Context = NonNullable<ReturnType<NonNullable<LabControlsProps['controller']['current']>['annotationContext']>>;
interface Selected extends AnnotatedPatch { element: HTMLElement }
/** A pointer that moves farther than this between press and release orbited the camera; it selects nothing. */
const CLICK_SLOP_PX = 4;
const STRETCHED = 4;

/** The drawn quad's four screen corners, read from the browser's own projection: a zero-size probe at each corner of
 * the leaf's box, measured and removed in the same task. */
function screenCorners(element: HTMLElement): [number, number][] {
  const width = element.offsetWidth, height = element.offsetHeight;
  return ([[0, 0], [width, 0], [width, height], [0, height]] as const).map(([x, y]) => {
    const probe = element.ownerDocument.createElement('i');
    probe.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;margin:0;padding:0;border:0`;
    element.append(probe);
    const rect = probe.getBoundingClientRect(); probe.remove();
    return [rect.left, rect.top];
  });
}
function bankName(directory: string) { return directory.split('/').filter(Boolean).at(-1) ?? directory; }
function describe(context: Context, element: HTMLElement): Selected | null {
  for (const bank of context.banks) {
    const leaf = bank.leaves.find(item => item.nodes.includes(element));
    if (!leaf) continue;
    const record = context.payload.stacks.find(stack => stack.axis === bank.axis)?.leaves.find(item => item.id === leaf.id);
    const center = record?.centerUnits as Vector3 | undefined;
    return { element, bank: bankName(context.directory), layer: bank.axis, leaf: leaf.id,
      sky: center ? skyOffset(context.payload.frame, center) : null, ...quadMetrics(screenCorners(element)) };
  }
  return null;
}
/** The leaf under the pointer in the most visible stack. Leaves ignore the pointer while drawn; they take it only for
 * this one hit test. */
function leafAt(context: Context, host: HTMLElement, x: number, y: number): HTMLElement | null {
  host.dataset.annotateHit = 'true';
  const hits = host.ownerDocument.elementsFromPoint(x, y).filter((node): node is HTMLElement => node instanceof HTMLElement && node.tagName === 'S' && host.contains(node));
  delete host.dataset.annotateHit;
  const owner = (node: HTMLElement) => context.banks.find(bank => bank.leaves.some(leaf => leaf.nodes.includes(node)));
  const weight = (node: HTMLElement) => Number(owner(node)?.root.style.opacity || 0);
  const best = Math.max(0, ...hits.map(weight));
  return hits.find(node => owner(node) && weight(node) === best) ?? null;
}
function cameraOf(context: Context) {
  const { pose, rotation, rotX, rotY, distance } = context.camera, r = (value: number) => Math.round(value * 1e4) / 1e4;
  return { pose, rotX: r(rotX), rotY: r(rotY), distance: r(distance),
    rotation: [rotation.m11, rotation.m12, rotation.m13, rotation.m21, rotation.m22, rotation.m23, rotation.m31, rotation.m32, rotation.m33].map(r) };
}

/** Annotate: click patches in the viewport to collect them, then copy one JSON line for chat. */
export function AnnotateOverlay({ shell, controller }: LabControlsProps) {
  const annotating = useAnnotating();
  const [selected, setSelected] = useState<Selected[]>([]), [copied, setCopied] = useState('');
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const clear = useCallback(() => { for (const item of selectedRef.current) delete item.element.dataset.annotated; setSelected([]); setCopied(''); }, []);
  // A different object or bank replaces every leaf.
  useEffect(() => clear, [shell.subjectId, shell.objectId, clear]);
  useEffect(() => () => setAnnotating(false), []);
  useEffect(() => {
    const host = document.getElementById('viewer');
    if (!annotating || !host) return;
    host.dataset.annotating = 'true';
    let down: { x: number; y: number; id: number } | null = null;
    const press = (event: PointerEvent) => { down = event.button === 0 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null; };
    const release = (event: PointerEvent) => {
      const start = down; down = null;
      if (!start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) return;
      const context = controller.current?.annotationContext();
      if (!context) return;
      const element = leafAt(context, host, event.clientX, event.clientY);
      if (!element) return;
      const current = selectedRef.current.filter(item => item.element.isConnected), already = current.some(item => item.element === element);
      let next: Selected[];
      if (already) next = current.filter(item => item.element !== element);
      else { const item = describe(context, element); if (!item) return; next = event.shiftKey ? [...current, item] : [item]; }
      for (const item of selectedRef.current) if (!next.includes(item)) delete item.element.dataset.annotated;
      for (const item of next) item.element.dataset.annotated = 'true';
      setSelected(next); setCopied('');
    };
    host.addEventListener('pointerdown', press); host.addEventListener('pointerup', release);
    return () => { delete host.dataset.annotating; host.removeEventListener('pointerdown', press); host.removeEventListener('pointerup', release); };
  }, [annotating, controller]);
  const copy = async () => {
    const context = controller.current?.annotationContext(), host = document.getElementById('viewer');
    if (!context || !host) return;
    // The camera may have moved since a patch was picked: its on-screen size is read again now.
    const fresh = selected.filter(item => item.element.isConnected).map(item => ({ ...item, ...quadMetrics(screenCorners(item.element)) }));
    setSelected(fresh);
    const text = annotationText({ object: context.subjectId, dataset: host.dataset.bankDataset || 'default', bank: bankName(context.directory),
      camera: cameraOf(context), url: location.href }, fresh);
    setCopied(text);
    try { await navigator.clipboard.writeText(text); } catch { /* The text stays shown below to copy by hand. */ }
  };
  if (!annotating && selected.length === 0) return null;
  const f = (value: number) => value.toFixed(1);
  return <aside className="annotate-overlay" aria-label="Annotated patches" data-annotate-count={selected.length} data-annotation-text={copied || undefined}>
    <header><strong>Annotate · {selected.length} patch{selected.length === 1 ? '' : 'es'}</strong>
      <button type="button" disabled={!selected.length} onClick={() => void copy()}>Copy</button>
      <button type="button" disabled={!selected.length} onClick={clear}>Clear</button></header>
    {selected.length === 0 ? <p>Click a patch to select it; shift-click adds; drag still orbits.</p> : <table>
      <thead><tr><th>Bank · leaf</th><th title="Arcsec east, north of the frame origin">E, N ″</th><th title="Arcsec along the sight line, + farther">Depth ″</th>
        <th title="Projected quad, CSS px">Screen px</th><th title="Projected aspect: longer / shorter edge">Stretch</th></tr></thead>
      <tbody>{selected.map(item => <tr key={`${item.layer}/${item.leaf}`} data-annotated-leaf={item.leaf}>
        <td title={item.bank}>{item.layer} · {item.leaf}</td>
        <td>{item.sky ? `${f(item.sky.eastArcsec)}, ${f(item.sky.northArcsec)}` : '—'}</td><td>{item.sky ? f(item.sky.depthArcsec) : '—'}</td>
        <td>{Math.round(item.screenPx[0])}×{Math.round(item.screenPx[1])}</td>
        <td data-stretched={item.stretch >= STRETCHED}>{Number.isFinite(item.stretch) ? item.stretch.toFixed(2) : '∞'}</td></tr>)}</tbody></table>}
    {copied && <textarea readOnly rows={2} value={copied} aria-label="Copied annotation" onFocus={event => event.currentTarget.select()} />}
  </aside>;
}
