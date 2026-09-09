export interface ZoomLensSelection {
  readonly nearLens: string;
  readonly farLens: string;
  /** Zoom relative to the object's responsive opening framing. */
  readonly farBelowRatio: number;
  readonly nearAboveRatio: number;
}

/** Crossings select ordinary datasets; manual choices survive until the next crossing. */
export function createZoomLensSelector(plan: ZoomLensSelection) {
  let side: 'near' | 'far' | null = null;
  return (ratio: number, desiredLens: string | null): string | null => {
    if (!Number.isFinite(ratio) || ratio <= 0) return null;
    const next = ratio <= plan.farBelowRatio ? 'far'
      : ratio >= plan.nearAboveRatio ? 'near' : null;
    if (next === null || next === side) return null;
    side = next;
    if (desiredLens !== plan.nearLens && desiredLens !== plan.farLens) return null;
    const target = next === 'near' ? plan.nearLens : plan.farLens;
    return target === desiredLens ? null : target;
  };
}
