/**
 * The difference-map tool: a round toggle under Levels that lays the server's prepared render-minus-source
 * map over the Earth view, and its compact legend. Every number and colour comes from
 * `/__nebula/reconstruction-difference`; nothing is measured or coloured here.
 */
import { useEffect, useState } from 'react';
import type { LensDifference } from '../../server/services/lens-difference.ts';
import type { DifferenceOverlayState } from '../legacy-viewer/difference-plane';
import type { WorkspaceToggleTool } from '../workspace/workspace-tools';
import './difference-map.css';

export const DIFFERENCE_TOOLTIP = 'Difference map · render − image, blue too dark, red too bright';
const HIDDEN_TOOLTIP = 'Difference map · hidden: it compares the Earth view, and the camera is orbited. Return to the Earth view to show it.';

/** Split-circle glyph: one half filled, one outlined. */
const DifferenceIcon = () => <svg viewBox="0 0 18 18" aria-hidden="true">
  <circle cx="9" cy="9" r="6.5" /><path d="M9 2.5v13" /><path d="M9 2.5a6.5 6.5 0 0 0 0 13z" fill="currentColor" stroke="none" />
</svg>;

type Legend = { status: 'loading' } | { status: 'ready'; value: LensDifference } | { status: 'error'; error: string };
function parse(value: unknown, resultId: string): LensDifference {
  const summary = value as Partial<LensDifference> | null;
  if (!summary || summary.schema !== 'cssearth-nebula-lens-difference@1' || summary.resultId !== resultId ||
      !Number.isFinite(summary.rangeLevels) || !Number.isFinite(summary.toleranceLevels) || !Array.isArray(summary.swatches) ||
      !summary.swatches.every(item => Number.isFinite(item?.levels) && typeof item?.rgba === 'string' && /^rgba\([\d.,]+\)$/.test(item.rgba)))
    throw new TypeError('Invalid difference map legend.');
  return summary as LensDifference;
}

function DifferenceLegend({ resultId, state, onOpacity }: { resultId: string; state: DifferenceOverlayState; onOpacity(value: number): void }) {
  const [legend, setLegend] = useState<Legend>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController(); setLegend({ status: 'loading' });
    void (async () => {
      try {
        const response = await fetch(`/__nebula/reconstruction-difference?resultId=${encodeURIComponent(resultId)}`, { signal: controller.signal });
        const value = await response.json();
        if (!response.ok) throw new Error(value?.error ?? `Difference map unavailable (HTTP ${response.status}).`);
        setLegend({ status: 'ready', value: parse(value, resultId) });
      } catch (error) { if (!controller.signal.aborted) setLegend({ status: 'error', error: error instanceof Error ? error.message : String(error) }); }
    })();
    return () => controller.abort();
  }, [resultId]);
  if (!state.earthFacing) return <p className="difference-legend-note" data-difference-hidden="orbit">Hidden while orbited · return to the Earth view.</p>;
  if (legend.status !== 'ready') return <p className="difference-legend-note" data-error={legend.status === 'error'}>
    {legend.status === 'error' ? legend.error : 'Preparing the difference map…'}</p>;
  const { value } = legend;
  return <div className="difference-legend" data-difference-legend={resultId}>
    <p className="difference-legend-title">Render − image, luminance levels</p>
    <ol className="difference-legend-scale" aria-label="Colour scale">
      {value.swatches.map(item => <li key={item.levels} data-levels={item.levels}>
        <span className="difference-legend-swatch" style={{ background: item.levels === 0 ? 'transparent' : item.rgba }} />
        <span>{item.levels > 0 ? `+${item.levels}` : item.levels === 0 ? `±${value.toleranceLevels}` : item.levels}</span>
      </li>)}
    </ol>
    <p className="difference-legend-note">
      <span className="difference-legend-key" data-side="dark">too dark {value.tooDarkPercent}%</span> ·{' '}
      <span className="difference-legend-key" data-side="bright">too bright {value.tooBrightPercent}%</span> · clear {value.agreePercent}%
    </p>
    <p className="difference-legend-note">Render ÷ {value.deliveryFactor.toFixed(3)} for delivery loss.</p>
    <label className="difference-legend-opacity">Opacity
      <input type="range" min="0.2" max="1" step="0.05" value={state.opacity} onChange={event => onOpacity(Number(event.target.value))} />
    </label>
  </div>;
}

/** The tool entry, or none when there is no baked lens to compare (the unpainted density, or an unbaked image). */
export function differenceTool(resultId: string | undefined, state: DifferenceOverlayState | undefined,
  onChange: ((enabled: boolean, opacity: number) => void) | undefined): WorkspaceToggleTool[] {
  if (!resultId || !state?.available || !onChange) return [];
  const hidden = state.enabled && !state.earthFacing;
  return [{ id: 'difference', label: 'Difference map', icon: <DifferenceIcon />,
    tooltip: !state.earthFacing ? HIDDEN_TOOLTIP : DIFFERENCE_TOOLTIP,
    pressed: state.enabled, onToggle: () => onChange(!state.enabled, state.opacity),
    aside: state.enabled ? <div className="difference-aside" data-difference-hidden={hidden}>
      <DifferenceLegend resultId={resultId} state={state} onOpacity={value => onChange(true, value)} />
    </div> : undefined }];
}
