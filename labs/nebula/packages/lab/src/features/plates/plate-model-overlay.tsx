import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { localFile } from '../legacy-viewer/controller';
import { photographOutlines, speedPoints, speedTable, type PlateRecipe, type SpeedPoint } from './plates-model.ts';

type Measured = { points: SpeedPoint[]; rows: number; stride: number; maxKmS: number } | { error: string } | null;
const APPROACH = '#5aaaff', RECEDE = '#ff6e5a';

/** The model drawn on the original-image plane in the viewport: the outlines of the published geometry seen from the
 * Sun and the measured speeds the bake places features with, colored by depth. It is drawn in the photograph's own
 * pixels inside the registered plane, so it follows the plane exactly. */
export function usePlateModel(recipe: PlateRecipe | null, raw: unknown, object: string, shown: boolean) {
  const outlines = useMemo(() => recipe && !recipe.cropped ? photographOutlines(recipe, raw) : [], [recipe, raw]);
  const table = useMemo(() => recipe && !recipe.cropped ? speedTable(raw) : null, [recipe, raw]);
  const [measured, setMeasured] = useState<Measured>(null);
  useEffect(() => {
    if (!shown || !table || !recipe) return;
    const controller = new AbortController();
    void fetch(localFile(`${object}/source/${table.path}`), { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(`${table.path} is unavailable (${response.status}).`); return response.text(); })
      .then(text => setMeasured(speedPoints(recipe, table, text)))
      .catch((reason: unknown) => { if (!controller.signal.aborted) setMeasured({ error: reason instanceof Error ? reason.message : String(reason) }); });
    return () => controller.abort();
  }, [shown, table, recipe, object]);
  return { outlines, table, measured };
}

export function PlateModelOverlay({ recipe, plane, model }: { recipe: PlateRecipe; plane: HTMLElement; model: ReturnType<typeof usePlateModel> }) {
  const { photograph } = recipe, size = Math.max(photograph.width, photograph.height), points = model.measured && 'points' in model.measured ? model.measured : null;
  return createPortal(<svg className="plate-model-overlay" viewBox={`0 0 ${photograph.width} ${photograph.height}`} aria-hidden="true"
    data-model-outlines={model.outlines.length} data-model-points={points?.points.length ?? 0}
    style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
    {points?.points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={size / 650}
      fill={point.kmS < 0 ? APPROACH : RECEDE} fillOpacity={.35 + .65 * Math.min(1, Math.abs(point.kmS) / (points.maxKmS || 1))} />)}
    {model.outlines.map(o => <ellipse key={o.id} data-plate={o.id} cx={o.cx} cy={o.cy} rx={o.rx} ry={o.ry} transform={`rotate(${o.rotationDeg} ${o.cx} ${o.cy})`}
      fill="none" stroke={o.id === 'disc' ? '#9fd3e6' : '#f0c27a'} strokeWidth={size / 260} strokeDasharray={`${size / 90} ${size / 160}`} />)}
  </svg>, plane);
}
