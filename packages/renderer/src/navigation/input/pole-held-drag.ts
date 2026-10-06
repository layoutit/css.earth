// A drag on a body held to its pole (engine pole-drag.ts), stepped as CesiumJS steps its globe: one turn a frame by that
// frame's whole pointer movement, a pan while the pointer is on the body, a turn by viewport share from the first frame
// it is not until release, and Cesium's inertia after a short press. labs/experiments/drag-oracle replays the same
// pointer stream on Cesium and compares.
import { polePanTurn, poleViewportTurn, poleTurnRotation, rotateVector } from "@cssearth/engine";
import type { Vector3 } from "@cssearth/engine";
import type { TrackballMetrics, Quaternion } from '../types.js';

/** The pointer's movement within one frame. */
export interface FrameMovement { startX: number; startY: number; endX: number; endY: number; }
/** The body's pole and +x axis as the drag has turned them, and whether the drag has left the body. */
export interface PoleHold { pole: Vector3; meridian: Vector3; rotating: boolean; }
/** Cesium's inertia (ScreenSpaceCameraController maintainInertia): each frame replays half the movement of the frame
 * before the last, decayed since the release, from where that movement began. */
export interface PoleCoast { readonly startX: number; readonly startY: number; readonly motionX: number; readonly motionY: number;
  readonly releasedAt: number; readonly trackball: TrackballMetrics; readonly hold: PoleHold; }
// Cesium's values: only a press shorter than 0.4 s coasts, by exp(-2.5 t), until the replayed movement is under half a pixel.
export const POLE_COAST = Object.freeze({ maximumPressMilliseconds: 400, decayPerSecond: 2.5, stopPixels: .5 });

/** The hold a press starts with, where the trackball publishes a pole, its meridian, the drawn body and the viewport. */
export function poleHoldFor({ pole, meridian, grabSphere, viewportHeight }: TrackballMetrics): PoleHold | null {
  return pole && meridian && grabSphere && viewportHeight ? { pole, meridian, rotating: false } : null;
}

/** A pointer sample joins the open frame's movement, or opens the next frame's from where the pointer was. */
export function recordFrameMovement(press: { x: number; y: number; movement: FrameMovement | null; lastMovement: FrameMovement | null; movementOpen: boolean },
  x: number, y: number): void {
  if (press.movementOpen && press.movement) { press.movement.endX = x; press.movement.endY = y; return; }
  press.lastMovement = press.movement;
  press.movement = { startX: press.x, startY: press.y, endX: x, endY: y };
  press.movementOpen = true;
}

/** One frame's turn, applied to the hold. The pan is not the same in two steps as in one, so a frame's samples turn the
 * body once, by the movement from the first to the last. */
export function turnPoleHeld(hold: PoleHold, trackball: TrackballMetrics, { startX, startY, endX, endY }: FrameMovement): Quaternion {
  const { grabSphere, viewportWidth, viewportHeight } = trackball;
  if (!grabSphere || !viewportHeight) throw new TypeError('Pole-held drag needs the drawn body and the viewport.');
  const pointer = { previousX: startX, previousY: startY, currentX: endX, currentY: endY };
  const pan = hold.rotating ? null : polePanTurn(pointer, grabSphere, hold.pole);
  if (pan === null) hold.rotating = true;
  const rotation = poleTurnRotation(pan ?? poleViewportTurn(pointer, grabSphere, { width: viewportWidth, height: viewportHeight }, hold.pole),
    hold.pole, hold.meridian);
  hold.pole = rotateVector(rotation, hold.pole);
  hold.meridian = rotateVector(rotation, hold.meridian);
  return rotation;
}

/** The coast a release starts, or null: a press of 0.4 s or more, or one with no movement before its last frame's, stops
 * where it is. Cesium times the press in whole milliseconds. */
export function planPoleCoast({ pressedAt, releasedAt, lastMovement, trackball, hold }: { pressedAt: number; releasedAt: number;
  lastMovement: FrameMovement | null; trackball: TrackballMetrics; hold: PoleHold }): PoleCoast | null {
  if (lastMovement === null || Math.floor(releasedAt) - Math.floor(pressedAt) >= POLE_COAST.maximumPressMilliseconds ||
      (lastMovement.startX === lastMovement.endX && lastMovement.startY === lastMovement.endY)) return null;
  return { startX: lastMovement.startX, startY: lastMovement.startY, motionX: (lastMovement.endX - lastMovement.startX) / 2,
    motionY: (lastMovement.endY - lastMovement.startY) / 2, releasedAt, trackball, hold };
}

/** The movement a coast replays at `timestamp`, or null once it is under POLE_COAST.stopPixels. */
export function poleCoastMovement({ startX, startY, motionX, motionY, releasedAt }: PoleCoast, timestamp: number): FrameMovement | null {
  const decay = Math.exp(-POLE_COAST.decayPerSecond * Math.max(0, Math.floor(timestamp) - Math.floor(releasedAt)) / 1000);
  if (Math.hypot(motionX, motionY) * decay < POLE_COAST.stopPixels) return null;
  return { startX, startY, endX: startX + motionX * decay, endY: startY + motionY * decay };
}
