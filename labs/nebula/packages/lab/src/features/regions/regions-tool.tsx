/** **Regions**: closed paths drawn on the object's picture and named, saved to its `source/regions.json` for the bake.
 * Ctrl or ⌘ and click drops a point; a click on the first point closes the path; Backspace takes the last point back
 * and Escape drops the path being drawn. Drag pans and the wheel zooms the picture. */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isRecord } from '@cssearth/core';
import './regions.css';

let enabled = false;
const listeners = new Set<() => void>();
export function setMarking(value: boolean) { if (value !== enabled) { enabled = value; for (const listener of listeners) listener(); } }
export function useMarking(): boolean { return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => enabled); }

type Point = [number, number];
interface Region { name: string; points: Point[] }
/** How near the first point, in screen pixels, a click closes the path. */
const CLOSE_PX = 10;

export function RegionsTool({ object }: { object: string }) {
  const marking = useMarking();
  const [picture, setPicture] = useState<{ image: string; width: number; height: number } | null>(null);
  const [regions, setRegions] = useState<Region[]>([]), [drawing, setDrawing] = useState<Point[]>([]), [status, setStatus] = useState('');
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 }), host = useRef<HTMLDivElement>(null), drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  useEffect(() => {
    if (!marking || !object) return;
    void fetch(`/__nebula/regions?object=${encodeURIComponent(object)}`, { cache: 'no-store' }).then(r => r.json()).then((body: unknown) => {
      if (!isRecord(body) || typeof body.image !== 'string') { setStatus(isRecord(body) && typeof body.error === 'string' ? body.error : 'No picture.'); return; }
      setPicture({ image: body.image, width: Number(body.width), height: Number(body.height) });
      setRegions(Array.isArray(body.regions) ? body.regions as Region[] : []); setDrawing([]); setStatus('');
    });
  }, [marking, object]);
  // The picture fitted to the panel when it first shows.
  useEffect(() => {
    const box = host.current?.getBoundingClientRect(); if (!picture || !box) return;
    const scale = Math.min(box.width / picture.width, box.height / picture.height) * .95; setView({ scale, x: (box.width - picture.width * scale) / 2, y: (box.height - picture.height * scale) / 2 });
  }, [picture]);
  const toPicture = (event: { clientX: number; clientY: number }): Point => { const box = host.current!.getBoundingClientRect(); return [(event.clientX - box.left - view.x) / view.scale, (event.clientY - box.top - view.y) / view.scale]; };
  const close = useCallback(() => {
    if (drawing.length < 3) return;
    const used = new Set(regions.map(region => region.name)); let name = 'skirt', n = 2; while (used.has(name)) name = `skirt-${n++}`;
    setRegions(current => [...current, { name, points: drawing }]); setDrawing([]);
  }, [drawing, regions]);
  useEffect(() => {
    if (!marking) return;
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.tagName === 'INPUT') return;
      if (event.key === 'Escape') { if (drawing.length) { event.preventDefault(); event.stopPropagation(); setDrawing([]); } else setMarking(false); }
      if (event.key === 'Backspace' && drawing.length) { event.preventDefault(); setDrawing(points => points.slice(0, -1)); }
      if (event.key === 'Enter') close();
    };
    window.addEventListener('keydown', key, true); return () => window.removeEventListener('keydown', key, true);
  }, [marking, drawing, close]);
  if (!marking) return null;
  const save = async () => {
    setStatus('Saving…');
    const response = await fetch('/__nebula/regions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ object, regions }) });
    const body: unknown = await response.json(); setStatus(response.ok ? `Saved ${regions.length} region${regions.length === 1 ? '' : 's'}.` : isRecord(body) && typeof body.error === 'string' ? body.error : 'Not saved.');
  };
  const pointer = (event: React.PointerEvent) => {
    // On a Mac, Ctrl-click is the secondary button: either button counts with Ctrl or ⌘.
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const at = toPicture(event), first = drawing[0];
      if (first && drawing.length >= 3 && Math.hypot((at[0] - first[0]) * view.scale, (at[1] - first[1]) * view.scale) < CLOSE_PX) close(); else setDrawing(points => [...points, at]);
      return;
    }
    if (event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y }; (event.target as Element).setPointerCapture?.(event.pointerId);
  };
  const move = (event: React.PointerEvent) => { const start = drag.current; if (start) setView(current => ({ ...current, x: start.vx + event.clientX - start.x, y: start.vy + event.clientY - start.y })); };
  const wheel = (event: React.WheelEvent) => { const box = host.current!.getBoundingClientRect(), cx = event.clientX - box.left, cy = event.clientY - box.top, factor = Math.exp(-event.deltaY * .0015);
    setView(current => ({ scale: current.scale * factor, x: cx - (cx - current.x) * factor, y: cy - (cy - current.y) * factor })); };
  const path = (points: Point[]) => points.map(([x, y]) => `${x * view.scale + view.x},${y * view.scale + view.y}`).join(' ');
  return <section className="regions-tool" aria-label="Regions on the picture">
    <div ref={host} className="regions-canvas" onPointerDown={pointer} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onWheel={wheel} onContextMenu={event => event.preventDefault()}>
      {picture && <img src={picture.image} alt="" draggable={false} style={{ width: picture.width * view.scale, height: picture.height * view.scale, left: view.x, top: view.y }} />}
      <svg aria-hidden="true">
        {regions.map(region => <polygon key={region.name} className="regions-saved" points={path(region.points)} />)}
        {drawing.length > 0 && <polyline className="regions-drawing" points={path(drawing)} />}
        {drawing.length > 0 && <circle className="regions-first" cx={drawing[0]![0] * view.scale + view.x} cy={drawing[0]![1] * view.scale + view.y} r={CLOSE_PX / 2} />}
      </svg>
    </div>
    <aside className="regions-panel">
      <header><strong>Regions</strong><button type="button" onClick={() => setMarking(false)} aria-label="Close regions">×</button></header>
      <p>Ctrl/⌘-click to drop points; click the first point to close. Backspace undoes a point, Esc drops the path. Drag pans, wheel zooms.</p>
      <ul>{regions.map((region, index) => <li key={index}>
        <input value={region.name} aria-label="Region name" onChange={event => { const name = event.target.value.toLowerCase().replace(/[^a-z0-9-]/gu, '-'); setRegions(current => current.map((item, i) => i === index ? { ...item, name } : item)); }} />
        <span>{region.points.length} pts</span>
        <button type="button" aria-label={`Delete ${region.name}`} onClick={() => setRegions(current => current.filter((_, i) => i !== index))}>Delete</button>
      </li>)}</ul>
      <button type="button" className="regions-save" onClick={() => void save()}>Save</button>
      <button type="button" className="regions-save" disabled={!regions.length} onClick={() => { const text = JSON.stringify({ object, regions }); void navigator.clipboard.writeText(text).then(() => setStatus('Copied.'), () => setStatus(text)); }}>Copy</button>
      {status && <p className="regions-status">{status}</p>}
    </aside>
  </section>;
}
