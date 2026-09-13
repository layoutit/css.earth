import { memo } from 'react';
import { ellipseArcPath, type GeometryCandidate, type GeometryMap } from '../alignment/observations-ui/geometry-model';

export const GeometryOverlay = memo(function GeometryOverlay({ geometry, active, visibleIds, selectedId, onSelect }: {
  geometry: GeometryMap; active: boolean; visibleIds: Set<string>; selectedId: string; onSelect(id: string): void;
}) {
  return <svg className="structure-geometry" width={geometry.width} height={geometry.height} viewBox={`0 0 ${geometry.width} ${geometry.height}`}
    aria-label="Detected two-dimensional ellipse hypotheses" style={{ display: active ? undefined : 'none' }}>
    {geometry.candidates.map(candidate => {
      const selected = candidate.id === selectedId;
      return <g key={candidate.id} data-shape-id={candidate.id} data-selected={selected} data-visible={active && visibleIds.has(candidate.id)}
        style={{ display: visibleIds.has(candidate.id) ? undefined : 'none' }}
        transform={`translate(${candidate.center.join(' ')}) rotate(${candidate.angleRadians * 180 / Math.PI})`}
        onClick={() => onSelect(candidate.id)}>
        <title>{candidate.id}: {(candidate.coverage * 100).toFixed(0)}% angular support. A fitted 2D hypothesis, not measured depth.</title>
        <ellipse className="geometry-gap" rx={candidate.radii[0]} ry={candidate.radii[1]} vectorEffect="non-scaling-stroke" />
        <ellipse className="geometry-hit" rx={candidate.radii[0]} ry={candidate.radii[1]} vectorEffect="non-scaling-stroke" />
        {candidate.supportedArcs.map((arc, index) => <path key={index} className="geometry-support" vectorEffect="non-scaling-stroke"
          d={ellipseArcPath(candidate.radii, arc.startRadians, arc.endRadians)} />)}
        <g className="geometry-axes" style={{ display: selected ? undefined : 'none' }}>
          <line x1={-candidate.radii[0]} x2={candidate.radii[0]} vectorEffect="non-scaling-stroke" />
          <line y1={-candidate.radii[1]} y2={candidate.radii[1]} vectorEffect="non-scaling-stroke" />
          <circle r={2} vectorEffect="non-scaling-stroke" />
        </g>
      </g>;
    })}
  </svg>;
});

export function GeometryControls({ geometry, candidates, selected, score, showAll, onScore, onShowAll, onSelect }: {
  geometry?: GeometryMap; candidates: GeometryCandidate[]; selected?: GeometryCandidate; score: number; showAll: boolean;
  onScore(value: number): void; onShowAll(value: boolean): void; onSelect(id: string): void;
}) {
  const index = selected ? candidates.indexOf(selected) : -1;
  const group = geometry?.groups.find(item => item.id === selected?.groupId);
  return <section className="geometry-controls" aria-label="Detected shapes">
    <div className="structure-slider"><label htmlFor="structure-shape-score" title="Minimum prepared fitting score. This filters hypotheses without processing the image.">Score ≥</label>
      <output htmlFor="structure-shape-score">{score.toFixed(2)}</output>
      <input id="structure-shape-score" type="range" min={0} max={1} step={.01} value={score} disabled={!geometry}
        onChange={event => onScore(event.target.valueAsNumber)} />
    </div>
    <label className="observation-check"><input type="checkbox" checked={showAll} onChange={event => onShowAll(event.target.checked)} /> Show all shapes</label>
    <p className="interaction-hint" role="status">{candidates.length} / {geometry?.candidates.length ?? '—'} shapes</p>
    <div className="structure-review-navigation">
      <button type="button" disabled={index <= 0} onClick={() => onSelect(candidates[index - 1]?.id ?? '')}>Previous shape</button>
      <button type="button" disabled={index < 0 || index >= candidates.length - 1} onClick={() => onSelect(candidates[index + 1]?.id ?? '')}>Next shape</button>
    </div>
    {selected ? <>
      <p className="interaction-hint" data-selected-shape={selected.id}>{selected.id} · score {selected.score.toFixed(2)} · {(selected.coverage * 100).toFixed(0)}% support</p>
      {group && <p className="interaction-hint" title="Automatically grouped ellipses with a compatible projected center. This does not establish their three-dimensional relationship.">Shared center · {group.members.length} shapes</p>}
    </> : geometry && <p className="interaction-hint">No shapes match this score.</p>}
    <p className="interaction-hint" title="Solid lines follow detected support; dashed sections complete the fitted ellipse without image support. Centers and axes describe only its 2D projection. Multiple 3D structures may explain it.">Solid: supported · dashed: inferred</p>
  </section>;
}
