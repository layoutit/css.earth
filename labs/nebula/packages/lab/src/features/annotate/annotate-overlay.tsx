import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
/** A leaf's box in CSS pixels, as its style declares it (its layout size can read 0 while its run is joining). */
const boxOf = (element: HTMLElement) => [parseFloat(element.style.width) || element.offsetWidth, parseFloat(element.style.height) || element.offsetHeight] as const;
function screenCorners(element: HTMLElement): [number, number][] {
  const [width, height] = boxOf(element);
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
/** A leaf's texture alpha, read from its atlas: the atlas images decoded once into canvases. */
const atlases = new Map<string, { width: number; height: number; alpha: Uint8ClampedArray } | null>();
function atlasOf(element: HTMLElement) {
  const match = /url\("?([^")]+)"?\)/u.exec(getComputedStyle(element).backgroundImage), url = match?.[1];
  if (!url) return null;
  if (!atlases.has(url)) {
    atlases.set(url, null);
    const image = new Image(); image.crossOrigin = 'anonymous';
    image.onload = () => { const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; const draw = canvas.getContext('2d', { willReadFrequently: true });
      if (!draw) return; draw.drawImage(image, 0, 0); atlases.set(url, { width: canvas.width, height: canvas.height, alpha: draw.getImageData(0, 0, canvas.width, canvas.height).data }); };
    image.src = url;
  }
  return atlases.get(url) ?? null;
}
/** Where a screen point falls on a leaf, as shares of its box across and down (the projective map of its four screen
 * corners onto the unit square), or null outside it. */
function onLeaf(corners: readonly (readonly [number, number])[], x: number, y: number): [number, number] | null {
  // The homography from the unit square to the screen quad (Heckbert 1989), inverted at the point.
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners as [[number, number], [number, number], [number, number], [number, number]];
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3, det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-9) return null;
  const g = (sx * dy2 - dx2 * sy) / det, h = (dx1 * sy - sx * dy1) / det;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  // Solve [a b c; d e f; g h 1] (s, t, 1) ~ (x, y, 1).
  const A = a - g * x, B = b - h * x, C = c - x, D = d - g * y, E = e - h * y, F = f - y, q = A * E - B * D;
  if (Math.abs(q) < 1e-12) return null;
  const s = (B * F - C * E) / q, t = (C * D - A * F) / q;
  return s >= 0 && s <= 1 && t >= 0 && t <= 1 ? [s, t] : null;
}
/** A leaf's texture alpha at shares (s, t) of its box: its atlas texel, through its background size and position. */
function alphaAt(element: HTMLElement, s: number, t: number): number | null {
  const atlas = atlasOf(element); if (!atlas) return null;
  const style = getComputedStyle(element), size = style.backgroundSize.split(' ').map(parseFloat), position = style.backgroundPosition.split(' ').map(parseFloat);
  const scale = (size[0] ?? atlas.width) / atlas.width, [boxWidth, boxHeight] = boxOf(element), x = Math.floor((-(position[0] ?? 0) + s * boxWidth) / scale), y = Math.floor((-(position[1] ?? 0) + t * boxHeight) / scale);
  if (x < 0 || y < 0 || x >= atlas.width || y >= atlas.height) return 0;
  return atlas.alpha[4 * (y * atlas.width + x) + 3]!;
}
/** The leaf drawn under the pointer: the topmost whose texture is opaque there, so a leaf's clear part (a mesh
 * triangle's other half of its box) never takes the click. Leaves ignore the pointer while drawn; they take it only for
 * this one hit test. */
function leafAt(context: Context, host: HTMLElement, x: number, y: number): HTMLElement | null {
  host.dataset.annotateHit = 'true';
  const hits = host.ownerDocument.elementsFromPoint(x, y).filter((node): node is HTMLElement => node instanceof HTMLElement && node.tagName === 'S' && host.contains(node));
  delete host.dataset.annotateHit;
  const owner = (node: HTMLElement) => context.banks.find(bank => bank.leaves.some(leaf => leaf.nodes.includes(node)));
  const drawn = hits.filter(node => owner(node) && Number(owner(node)!.root.style.opacity || 0) > 0);
  for (const node of drawn) { const at = onLeaf(screenCorners(node), x, y); if (!at) continue; const alpha = alphaAt(node, at[0], at[1]); if (alpha === null || alpha > 32) return node; }
  return drawn[0] ?? null;
}
/** The outline a leaf draws: its triangle where the far corner of its box is clear (a mesh triangle), else its quad. */
function outlineOf(element: HTMLElement): [number, number][] {
  const corners = screenCorners(element), far = alphaAt(element, .92, .92);
  return far !== null && far < 16 ? [corners[0]!, corners[1]!, corners[3]!] : corners;
}
function cameraOf(context: Context) {
  const { pose, rotation, rotX, rotY, distance } = context.camera, r = (value: number) => Math.round(value * 1e4) / 1e4;
  return { pose, rotX: r(rotX), rotY: r(rotY), distance: r(distance),
    rotation: [rotation.m11, rotation.m12, rotation.m13, rotation.m21, rotation.m22, rotation.m23, rotation.m31, rotation.m32, rotation.m33].map(r) };
}

/** The current view as one JSON line for chat: the object, the bank and the camera's turn and distance. */
export async function copyView(controller: LabControlsProps['controller']): Promise<string | null> {
  const context = controller.current?.annotationContext(), host = document.getElementById('viewer');
  if (!context || !host) return null;
  const text = JSON.stringify({ object: context.subjectId, dataset: host.dataset.bankDataset || 'default', bank: bankName(context.directory), camera: cameraOf(context), url: location.href });
  try { await navigator.clipboard.writeText(text); } catch { /* The caller shows the text to copy by hand. */ }
  return text;
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
    // The atlases are read ahead, so the first click already tests a leaf's texture.
    for (const node of host.querySelectorAll<HTMLElement>('s[data-image-layer-leaf]')) atlasOf(node);
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
  // The selected leaves' outlines, drawn over the view and kept in place as the camera moves.
  const [outlines, setOutlines] = useState<string[]>([]);
  useEffect(() => {
    if (!selected.length) { setOutlines([]); return; }
    let frame = 0; const draw = () => { const host = document.getElementById('viewer'), box = host?.getBoundingClientRect();
      if (box) setOutlines(selected.filter(item => item.element.isConnected).map(item => outlineOf(item.element).map(([x, y]) => `${(x - box.left).toFixed(1)},${(y - box.top).toFixed(1)}`).join(' ')));
      frame = requestAnimationFrame(draw); };
    draw(); return () => cancelAnimationFrame(frame);
  }, [selected]);
  if (!annotating && selected.length === 0) return null;
  const f = (value: number) => value.toFixed(1);
  const viewer = document.getElementById('viewer');
  return <>{viewer && outlines.length > 0 && createPortal(<svg className="annotate-outlines" aria-hidden="true">{outlines.map((points, index) => <polygon key={index} points={points} />)}</svg>, viewer)}
  <aside className="annotate-overlay" aria-label="Annotated patches" data-annotate-count={selected.length} data-annotation-text={copied || undefined}>
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
  </aside></>;
}
