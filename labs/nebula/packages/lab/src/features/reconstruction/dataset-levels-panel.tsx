/**
 * Live per-channel Levels/Curves for the displayed image dataset, drawn as inline SVG.
 *
 * One row per channel: the source image histogram against the render histogram on shared axes, the signed
 * render-minus-source delta with its zero line, and the delivered transfer against the identity diagonal.
 * Every number comes from `/__nebula/reconstruction-levels`; nothing is measured here, so the panel and the
 * offline round read the same statistics.
 */
import { useEffect, useState } from 'react';
import type { DatasetLevels, DatasetLevelsChannel } from '../../server/services/dataset-levels.ts';
import './dataset-levels-panel.css';

const WIDTH = 320, HIST = { x: 30, y: 8, w: 284, h: 62 };
const DELTA = { x: 30, y: 90, w: 206, h: 62 }, CURVE = { x: 246, y: 90, w: 68, h: 62 };
const HEIGHT = 160;
const SOURCE_STROKE = '#c9ced9', RENDER_STROKE = '#48c9c0';
const CHANNEL_FILL: Record<string, string> = { R: '#e8594a', G: '#4aa86a', B: '#4a82e8' };
export const LEVELS_TOOLTIP = 'Levels · render against this image';
/** Histogram glyph for the floating Levels tool button. */
export const LevelsIcon = () => <svg viewBox="0 0 18 18" aria-hidden="true">
  <path d="M2 15.5h14" /><path d="M3.5 15.5V11M6.5 15.5V6.5M9.5 15.5V3.5M12.5 15.5V8.5M15 15.5v-3" />
</svg>;
const signed = (value: number, digits = 2) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;

function polyline(points: string[], stroke: string, dash?: string) {
  return points.length > 1
    ? <polyline points={points.join(' ')} fill="none" stroke={stroke} strokeWidth="1.3" strokeLinejoin="round" {...(dash ? { strokeDasharray: dash } : {})} />
    : null;
}
function ChannelRow({ channel, levels, logMax, deltaLog, last }: {
  channel: DatasetLevelsChannel; levels: DatasetLevels; logMax: number; deltaLog: number; last: boolean;
}) {
  const bins = levels.bins;
  const histogram = (counts: number[], box: typeof HIST) => counts.map((count, bin) =>
    `${(box.x + (bin + .5) / bins * box.w).toFixed(1)},${(box.y + box.h - Math.log10(count + 1) / logMax * (box.h - 3)).toFixed(1)}`);
  const delta = channel.renderHistogram.map((count, bin) => count - channel.sourceHistogram[bin]!);
  const deltaPoints = delta.map((value, bin) =>
    `${(DELTA.x + (bin + .5) / bins * DELTA.w).toFixed(1)},${(DELTA.y + DELTA.h / 2 -
      Math.sign(value) * Math.log10(1 + Math.abs(value)) / deltaLog * (DELTA.h / 2 - 2)).toFixed(1)}`);
  const transfer = channel.transfer.flatMap((median, bin) => (median === null ? [] :
    [`${(CURVE.x + Math.min(1, (bin + .5) / channel.transfer.length) * CURVE.w).toFixed(1)},${(CURVE.y + CURVE.h - Math.min(1, median / 255) * CURVE.h).toFixed(1)}`]));
  return <li className="dataset-levels-row" data-channel={channel.name}>
    <svg className="dataset-levels-plot" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img"
      aria-label={`${channel.name}: source and render histograms, signed delta and transfer curve`}>
      <text className="dataset-levels-channel" x="4" y={HIST.y + HIST.h / 2 + 4} fill={CHANNEL_FILL[channel.name]}>{channel.name}</text>
      <rect x={HIST.x} y={HIST.y} width={HIST.w} height={HIST.h} className="dataset-levels-frame" />
      {[.25, .5, .75].map(fraction => <line key={fraction} x1={HIST.x + HIST.w * fraction} y1={HIST.y}
        x2={HIST.x + HIST.w * fraction} y2={HIST.y + HIST.h} className="dataset-levels-grid" />)}
      {polyline(histogram(channel.sourceHistogram, HIST), SOURCE_STROKE)}
      {polyline(histogram(channel.renderHistogram, HIST), RENDER_STROKE)}
      <rect x={DELTA.x} y={DELTA.y} width={DELTA.w} height={DELTA.h} className="dataset-levels-frame" />
      <line x1={DELTA.x} y1={DELTA.y + DELTA.h / 2} x2={DELTA.x + DELTA.w} y2={DELTA.y + DELTA.h / 2} className="dataset-levels-zero" />
      {polyline(deltaPoints, RENDER_STROKE)}
      <rect x={CURVE.x} y={CURVE.y} width={CURVE.w} height={CURVE.h} className="dataset-levels-frame" />
      <line x1={CURVE.x} y1={CURVE.y + CURVE.h} x2={CURVE.x + CURVE.w} y2={CURVE.y} className="dataset-levels-identity" />
      {polyline(transfer, RENDER_STROKE)}
      <text className="dataset-levels-axis" x={HIST.x + 2} y={HIST.y + 9}>log count</text>
      <text className="dataset-levels-axis" x={DELTA.x + 2} y={DELTA.y + 9}>render − source</text>
      <text className="dataset-levels-axis" x={CURVE.x + 2} y={CURVE.y + 9}>transfer</text>
      {last && <>
        {[0, 128, 255].map(value => <text key={value} className="dataset-levels-axis"
          x={HIST.x + value / 255 * HIST.w - (value ? 8 : 0)} y={HIST.y + HIST.h + 8}>{value}</text>)}
        <text className="dataset-levels-axis" x={CURVE.x + 2} y={HEIGHT - 2}>source → ↑ render</text>
      </>}
    </svg>
    <p className="dataset-levels-numbers">
      p50 {channel.sourceP50.toFixed(0)}→{channel.renderP50.toFixed(0)} (×{channel.p50Ratio.toFixed(2)}) ·
      {' '}p90 {channel.sourceP90.toFixed(0)}→{channel.renderP90.toFixed(0)} (×{channel.p90Ratio.toFixed(2)})<br />
      mean {signed(channel.signedMeanDelta)} · |mean| {channel.absoluteMeanDelta.toFixed(2)} DN ·
      {' '}worst {signed(channel.worstBin.footprintPercent, 1)}% px @{channel.worstBin.from}–{channel.worstBin.to}
    </p>
  </li>;
}

/** Measures while mounted; the floating Levels tool mounts it only while its panel is open. */
/** `url` measures a site entry instead (`/__nebula/site-levels`), which answers with `resultId` as its identity. */
export function DatasetLevelsPanel({ resultId, url }: { resultId?: string; url?: string }) {
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; levels?: DatasetLevels; error?: string }>({ status: 'idle' });
  useEffect(() => {
    if (!resultId) { setState({ status: 'idle' }); return; }
    const controller = new AbortController();
    setState({ status: 'loading' });
    void (async () => {
      try {
        const response = await fetch(url ?? `/__nebula/reconstruction-levels?resultId=${encodeURIComponent(resultId)}`, { signal: controller.signal });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error ?? `Levels unavailable (HTTP ${response.status}).`);
        if (value.schema !== 'cssearth-nebula-dataset-levels@1' || value.resultId !== resultId || !Array.isArray(value.channels) || value.channels.length !== 3)
          throw new TypeError('Invalid dataset levels measurement.');
        if (!controller.signal.aborted) setState({ status: 'ready', levels: value as DatasetLevels });
      } catch (error) {
        if (!controller.signal.aborted) setState({ status: 'error', error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return () => controller.abort();
  }, [resultId, url]);
  const levels = state.levels;
  const peak = levels ? Math.max(1, ...levels.channels.flatMap(channel => [...channel.sourceHistogram, ...channel.renderHistogram])) : 1;
  const deltaPeak = levels ? Math.max(1, ...levels.channels.flatMap(channel =>
    channel.renderHistogram.map((count, bin) => Math.abs(count - channel.sourceHistogram[bin]!)))) : 1;
  return <div className="dataset-levels-panel" data-dataset-levels-result={levels?.resultId} data-dataset-levels-state={state.status}>
    {state.status === 'error' && <p className="dataset-levels-status" data-error="true">{state.error}</p>}
    {state.status === 'loading' && <p className="dataset-levels-status">Measuring this dataset…</p>}
    {levels && <>
      <p className="dataset-levels-legend">
        <span className="dataset-levels-key" style={{ background: SOURCE_STROKE }} /> source image
        <span className="dataset-levels-key" style={{ background: RENDER_STROKE }} /> render
      </p>
      <p className="dataset-levels-status">
        {levels.imageId} · grid {levels.grid.width}×{levels.grid.height} · footprint {levels.footprintPixels.toLocaleString()} px ·
        {' '}sky pedestal removed {levels.skyPedestal.map(value => value.toFixed(0)).join(',')}<br />
        flux {signed(levels.flux.percent, 1)}% vs source · chroma angle {levels.hueErrorDegrees.toFixed(2)}°
      </p>
      <ul className="dataset-levels-rows">
        {levels.channels.map((channel, index) => <ChannelRow key={channel.name} channel={channel} levels={levels}
          logMax={Math.log10(peak + 1)} deltaLog={Math.log10(1 + deltaPeak)} last={index === levels.channels.length - 1} />)}
      </ul>
      <p className="dataset-levels-note">{levels.note}</p>
    </>}
  </div>;
}
