/**
 * Live radial profile for the displayed image dataset, drawn as inline SVG: does brightness fall off with radius
 * the way the source does?
 *
 * Levels (a histogram) can match p50/p90/p99 exactly while the structure sits in the wrong place; the
 * difference map shows where the error is but not its radial shape. This panel plots azimuthally averaged
 * source and render brightness against radius from the footprint's own centroid, plus their ratio, so a
 * brightness swap between the centre and an annulus — invisible to a histogram — reads as a curve that
 * departs from the render÷source = 1 line. Every number comes from `/__nebula/reconstruction-radial`; nothing
 * is measured here.
 */
import { useEffect, useState } from 'react';
import type { DatasetRadialBin, DatasetRadialProfile } from '../../server/services/dataset-radial.ts';
import './dataset-radial-panel.css';

const WIDTH = 320, HEIGHT = 150;
const PLOT = { x: 34, y: 8, w: 280, h: 74 };
const RATIO = { x: 34, y: 94, w: 280, h: 40 };
const SOURCE_STROKE = '#c9ced9', RENDER_STROKE = '#48c9c0', RATIO_STROKE = '#e0b34a';
export const RADIAL_TOOLTIP = 'Radial profile · brightness vs radius, render against this image';
/** Concentric-rings glyph for the floating Radial profile tool button. */
export const RadialIcon = () => <svg viewBox="0 0 18 18" aria-hidden="true">
  <circle cx="9" cy="9" r="1.6" fill="currentColor" stroke="none" />
  <circle cx="9" cy="9" r="5" /><circle cx="9" cy="9" r="8" />
</svg>;

function polyline(points: string[], stroke: string) {
  return points.length > 1
    ? <polyline points={points.join(' ')} fill="none" stroke={stroke} strokeWidth="1.3" strokeLinejoin="round" /> : null;
}

function RadialPlot({ profile }: { profile: DatasetRadialProfile }) {
  const defined = profile.radialBins.filter((bin): bin is DatasetRadialBin & { sourceMean: number; renderMean: number } =>
    bin.pixels > 0 && bin.sourceMean !== null && bin.renderMean !== null);
  const peak = Math.max(1, ...defined.flatMap(bin => [bin.sourceMean, bin.renderMean]));
  const maxRadius = Math.max(1, profile.maxRadius);
  const at = (radius: number, value: number, box: typeof PLOT) =>
    `${(box.x + radius / maxRadius * box.w).toFixed(1)},${(box.y + box.h - Math.max(0, value) / peak * box.h).toFixed(1)}`;
  const sourceLine = defined.map(bin => at(bin.radius, bin.sourceMean, PLOT));
  const renderLine = defined.map(bin => at(bin.radius, bin.renderMean, PLOT));
  const ratioBins = profile.radialBins.filter((bin): bin is DatasetRadialBin & { ratio: number } => bin.ratio !== null);
  const logRatio = (ratio: number) => Math.log(Math.max(Number.EPSILON, ratio));
  const ratioPeak = Math.max(1, ...ratioBins.map(bin => Math.abs(logRatio(bin.ratio))));
  const ratioLine = ratioBins.map(bin => `${(RATIO.x + bin.radius / maxRadius * RATIO.w).toFixed(1)},` +
    `${(RATIO.y + RATIO.h / 2 - logRatio(bin.ratio) / ratioPeak * (RATIO.h / 2 - 2)).toFixed(1)}`);
  return <svg className="dataset-radial-plot" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img"
    aria-label="Source and render brightness by radius, and their ratio">
    <rect x={PLOT.x} y={PLOT.y} width={PLOT.w} height={PLOT.h} className="dataset-radial-frame" />
    {[.25, .5, .75].map(fraction => <line key={fraction} x1={PLOT.x + PLOT.w * fraction} y1={PLOT.y}
      x2={PLOT.x + PLOT.w * fraction} y2={PLOT.y + PLOT.h} className="dataset-radial-grid" />)}
    {polyline(sourceLine, SOURCE_STROKE)}
    {polyline(renderLine, RENDER_STROKE)}
    <text className="dataset-radial-axis" x={PLOT.x + 2} y={PLOT.y + 9}>brightness</text>
    <rect x={RATIO.x} y={RATIO.y} width={RATIO.w} height={RATIO.h} className="dataset-radial-frame" />
    <line x1={RATIO.x} y1={RATIO.y + RATIO.h / 2} x2={RATIO.x + RATIO.w} y2={RATIO.y + RATIO.h / 2} className="dataset-radial-zero" />
    {polyline(ratioLine, RATIO_STROKE)}
    <text className="dataset-radial-axis" x={RATIO.x + 2} y={RATIO.y + 9}>render ÷ source (log)</text>
    {[0, .5, 1].map(fraction => <text key={fraction} className="dataset-radial-axis"
      x={PLOT.x + fraction * PLOT.w - (fraction ? 10 : 0)} y={RATIO.y + RATIO.h + 10}>{Math.round(fraction * maxRadius)}px</text>)}
  </svg>;
}

/** Measures while mounted; the floating Radial profile tool mounts it only while its panel is open. */
export function DatasetRadialPanel({ resultId }: { resultId?: string }) {
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; profile?: DatasetRadialProfile; error?: string }>({ status: 'idle' });
  useEffect(() => {
    if (!resultId) { setState({ status: 'idle' }); return; }
    const controller = new AbortController();
    setState({ status: 'loading' });
    void (async () => {
      try {
        const response = await fetch(`/__nebula/reconstruction-radial?resultId=${encodeURIComponent(resultId)}`, { signal: controller.signal });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error ?? `Radial profile unavailable (HTTP ${response.status}).`);
        if (value.schema !== 'cssearth-nebula-dataset-radial@1' || value.resultId !== resultId || !Array.isArray(value.radialBins))
          throw new TypeError('Invalid radial profile measurement.');
        if (!controller.signal.aborted) setState({ status: 'ready', profile: value as DatasetRadialProfile });
      } catch (error) {
        if (!controller.signal.aborted) setState({ status: 'error', error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return () => controller.abort();
  }, [resultId]);
  const profile = state.profile;
  return <div className="dataset-radial-panel" data-dataset-radial-result={profile?.resultId} data-dataset-radial-state={state.status}>
    {state.status === 'error' && <p className="dataset-radial-status" data-error="true">{state.error}</p>}
    {state.status === 'loading' && <p className="dataset-radial-status">Measuring this dataset…</p>}
    {profile && <>
      <p className="dataset-radial-legend">
        <span className="dataset-radial-key" style={{ background: SOURCE_STROKE }} /> source image
        <span className="dataset-radial-key" style={{ background: RENDER_STROKE }} /> render
        <span className="dataset-radial-key" style={{ background: RATIO_STROKE }} /> ratio
      </p>
      <RadialPlot profile={profile} />
      <p className="dataset-radial-numbers">
        half-light radius {profile.halfLightRadiusSource?.toFixed(1) ?? '—'}px → {profile.halfLightRadiusRender?.toFixed(1) ?? '—'}px
        {' '}(×{profile.halfLightRadiusRatio?.toFixed(2) ?? '—'})<br />
        rms log ratio {profile.rmsLogRatio?.toFixed(2) ?? '—'} ·
        {' '}worst {profile.worstBin ? `×${profile.worstBin.ratio.toFixed(2)} @${profile.worstBin.radius.toFixed(0)}px` : '—'}
      </p>
      <p className="dataset-radial-status">
        {profile.imageId} · grid {profile.grid.width}×{profile.grid.height} · footprint {profile.footprintPixels.toLocaleString()} px ·
        {' '}{profile.bins} bins to {profile.maxRadius.toFixed(0)}px
      </p>
      <p className="dataset-radial-note">{profile.note}</p>
    </>}
  </div>;
}
