import { jointBeamDepths, jointOutline } from './geometry';
import type { JointControls, JointEvidence, JointFamily, JointFit, JointParameters, JointRecipe, JointVelocityPoint } from './model';

/** Whole pointings in two opposite sky sectors are withheld, including every velocity component. */
export function heldOutPointing(x: number, y: number): boolean {
  const sector = Math.floor((Math.atan2(y, x) + Math.PI) / (Math.PI / 4)) % 8;
  return sector === 1 || sector === 5;
}
const huber = (x: number) => Math.abs(x) <= 1 ? x * x / 2 : Math.abs(x) - .5;
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
interface GeometryEvaluation {
  parameters: JointParameters; outline: [number, number][]; imageResidualArcsec: number; imageLoss: number;
  unrepresentedRidgeFraction: number; depths: number[][];
}
function imageEvaluation(outline: [number, number][], evidence: JointEvidence, recipe: JointRecipe) {
  const points = evidence.ridges.filter((_, i) => i % Math.max(1, Math.ceil(evidence.ridges.length / 600)) === 0);
  if (points.length < 8) throw new TypeError('Not enough supported wall ridges for a joint fit. Lower the ridge threshold.');
  const distances = points.map(p => Math.min(...outline.map(q => Math.hypot(p.x - q[0], p.y - q[1]))));
  const reverse = outline.map(p => Math.min(...points.map(q => Math.hypot(p[0] - q.x, p[1] - q.y))));
  const weights = points.reduce((sum, p) => sum + p.weight, 0);
  const loss = distances.reduce((sum, d, i) => sum + points[i]!.weight * huber(d / recipe.imageToleranceArcsec), 0) / weights;
  return { imageResidualArcsec: Math.sqrt(distances.reduce((sum, d, i) => sum + points[i]!.weight * d * d, 0) / weights),
    imageLoss: .5 * (loss + (mean(reverse.map(d => huber(d / recipe.imageToleranceArcsec))) ?? 0)),
    unrepresentedRidgeFraction: distances.filter(d => d > 2 * recipe.imageToleranceArcsec).length / distances.length };
}
function evaluateGeometry(parameters: JointParameters, evidence: JointEvidence, recipe: JointRecipe): GeometryEvaluation {
  const outline = jointOutline(parameters), depthsByPointing = new Map<string, number[]>();
  return { parameters, outline, ...imageEvaluation(outline, evidence, recipe), depths: evidence.velocities.map(point => {
    let depths = depthsByPointing.get(point.pointingId);
    if (!depths) { depths = jointBeamDepths(point.x, point.y, parameters, evidence.beamFwhmArcsec).map(z => z / parameters.radiusArcsec); depthsByPointing.set(point.pointingId, depths); }
    return depths;
  }) };
}
function score(geometry: GeometryEvaluation, parameters: JointParameters, evidence: JointEvidence, controls: JointControls, recipe: JointRecipe): JointFit {
  const train: number[] = [], held: number[] = []; let missingTraining = 0, missingHeldOut = 0;
  const trainingCount = evidence.velocities.filter(p => !p.heldOut).length, heldOutCount = evidence.velocities.length - trainingCount;
  const losses = new Map<string, number[]>();
  const residuals = evidence.velocities.map((point, index) => {
    const predictions = geometry.depths[index]!.map(z => parameters.systemicLsrKmS + parameters.expansionKmS * z);
    let predicted: number | null = null, error = Infinity;
    for (const candidate of predictions) { const distance = Math.abs(point.velocityLsrKmS - candidate); if (distance < error) { error = distance; predicted = candidate; } }
    if (predicted === null) { error = recipe.missingVelocityPenaltyKmS; if (point.heldOut) missingHeldOut++; else missingTraining++; }
    if (predicted !== null) (point.heldOut ? held : train).push(error * error);
    if (!point.heldOut) { const group = losses.get(point.pointingId) ?? []; group.push(huber(error / recipe.velocityToleranceKmS)); losses.set(point.pointingId, group); }
    return { id: point.id, predictedLsrKmS: predicted, residualKmS: predicted === null ? error : point.velocityLsrKmS - predicted, heldOut: point.heldOut };
  });
  const velocityLoss = mean([...losses.values()].map(group => mean(group)!));
  if (velocityLoss === null || !heldOutCount) throw new TypeError('Joint fitting requires measured training and withheld velocity pointings.');
  const systemicPrior = .05 * ((parameters.systemicLsrKmS - recipe.systemicLsrKmS) / recipe.systemicUncertaintyKmS) ** 2;
  return { parameters, outline: geometry.outline, residuals, metrics: { imageResidualArcsec: geometry.imageResidualArcsec,
    unrepresentedRidgeFraction: geometry.unrepresentedRidgeFraction, trainingRmsKmS: train.length ? Math.sqrt(mean(train)!) : null, heldOutRmsKmS: held.length ? Math.sqrt(mean(held)!) : null,
    trainingCount, heldOutCount, missingTraining, missingHeldOut,
    objective: controls.imageWeight * geometry.imageLoss + controls.velocityWeight * velocityLoss + systemicPrior } };
}
export function evaluateJointModel(parameters: JointParameters, evidence: JointEvidence, controls: JointControls, recipe: JointRecipe): JointFit {
  return score(evaluateGeometry(parameters, evidence, recipe), parameters, evidence, controls, recipe);
}
/** Bounded two-family search. Withheld velocities never enter the objective or model selection. */
export function fitJointModels(evidence: JointEvidence, controls: JointControls, recipe: JointRecipe,
  progress: (message: string) => void = () => {}, signal?: AbortSignal): { fits: JointFit[]; evaluatedModels: number } {
  let evaluatedModels = 0; const fits: JointFit[] = [];
  const systemic = [-1, 0, 1].map(k => recipe.systemicLsrKmS + k * recipe.systemicUncertaintyKmS);
  for (const family of ['ellipsoid', 'bipolar'] as JointFamily[]) {
    let best: JointFit | undefined;
    const visit = (shape: JointParameters, speeds: number[]) => {
      signal?.throwIfAborted(); const geometry = evaluateGeometry(shape, evidence, recipe);
      for (const expansionKmS of speeds) for (const systemicLsrKmS of systemic) {
        const fit = score(geometry, { ...shape, expansionKmS, systemicLsrKmS }, evidence, controls, recipe); evaluatedModels++;
        if (!best || fit.metrics.objective < best.metrics.objective) best = fit;
      }
    };
    for (const radiusArcsec of recipe.radiusSearchArcsec) {
      progress(`Fitting ${family === 'ellipsoid' ? 'shell' : 'waisted lobes'} · radius ${radiusArcsec}″`);
      for (const depthRatio of family === 'ellipsoid' ? [.7, 1, 1.4, 2] : [1.3, 1.8, 2.4]) {
        for (const inclinationDegrees of [-60, -30, 0, 30, 60]) for (const positionAngleDegrees of inclinationDegrees === 0 ? [0] : [0, 45, 90, 135]) {
          visit({ family, radiusArcsec, depthRatio, inclinationDegrees, positionAngleDegrees, expansionKmS: 20, systemicLsrKmS: recipe.systemicLsrKmS }, [12, 20, 28, 36]);
        }
      }
    }
    if (!best) throw new Error('Joint search produced no candidate.');
    for (let round = 0; round < 2; round++) {
      const base: JointParameters = best.parameters, step = round === 0 ? 1 : .5;
      const neighbors = [base];
      for (const sign of [-1, 1]) {
        neighbors.push({ ...base, radiusArcsec: Math.max(50, base.radiusArcsec + sign * 40 * step) },
          { ...base, depthRatio: Math.max(.5, Math.min(3, base.depthRatio + sign * .2 * step)) },
          { ...base, inclinationDegrees: Math.max(-80, Math.min(80, base.inclinationDegrees + sign * 15 * step)) },
          { ...base, positionAngleDegrees: (base.positionAngleDegrees + sign * 15 * step + 180) % 180 });
      }
      for (const next of neighbors) visit(next, [-1, 0, 1].map(k => Math.max(1, base.expansionKmS + k * 4 * step)));
    }
    fits.push(best);
  }
  return { fits: fits.sort((a, b) => a.metrics.objective - b.metrics.objective), evaluatedModels };
}
export function velocityPoint(id: string, pointingId: string, x: number, y: number, velocityLsrKmS: number): JointVelocityPoint {
  if (![x, y, velocityLsrKmS].every(Number.isFinite)) throw new TypeError('Measured molecular coordinates and velocities must be finite.');
  return { id, pointingId, x, y, velocityLsrKmS, heldOut: heldOutPointing(x, y) };
}
