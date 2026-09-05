import { add, length, scale, sub, ZERO, type Vec3 } from './vec3.js'

/**
 * Radius, in a frame's OWN units, of the ball outside which a camera anchored
 * to that frame must be evicted to its parent — Λ_hi in the anchoring rule
 * (`packages/engine/src/camera/cameraRig.ts`).
 *
 * It lives here, not in the engine, because `FrameTree.add` enforces the
 * structural invariant that makes eviction terminating and capture a descent
 * rather than a scan:
 *
 *     maxOffsetInParent + Λ_hi · (child.unitM / parent.unitM) ≤ Λ_hi
 *
 * i.e. a child's exit ball, mapped into its parent's coordinates, lies inside
 * the parent's own exit ball. A tree that satisfies this can always answer
 * "climb until the offset is small again" in finitely many hops.
 */
export const FRAME_EXIT_BALL_UNITS = 1e6

/**
 * Λ_lo — capture radius, in a frame's OWN units, below which that frame
 * becomes eligible to capture the camera. Mirrors `CameraRig.LAMBDA_LO`; it
 * lives here too because `FrameTree.add` needs it to check that every frame's
 * capture ball fits inside its own eviction ball (below).
 */
export const FRAME_CAPTURE_BALL_UNITS = 1e3

/**
 * C — how many body radii of altitude before a body's own frame captures the
 * camera, regardless of how that compares to `FRAME_CAPTURE_BALL_UNITS · u_F`.
 * At one radius of altitude the body dominates the view and must own the
 * coordinate frame: `R_in(F) = max(Λ_lo·u_F, C·radiusM_F)`.
 */
export const FRAME_CAPTURE_RADIUS_MULTIPLIER = 2

/**
 * A reference frame: an origin that moves inside a parent frame, plus the unit
 * its local coordinates are measured in.
 *
 * Frames are translation-only and share the ICRF axes. Orientation is a
 * separate concern handled by the renderer (a body's spin does not move its
 * frame origin), so nothing here needs a rotation matrix.
 */
export interface Frame {
  readonly id: string
  /** `null` for the root frame only. */
  readonly parent: string | null
  /** Size of one unit of this frame's local coordinates, in metres. */
  readonly unitM: number
  /**
   * Physical radius of the body this frame is centred on, in metres. `0` for
   * a point frame (a barycentre, a coordinate convention with no surface),
   * for which the capture radius below reduces to `Λ_lo · u_F` exactly as if
   * radius played no part.
   *
   * `FrameTree.add` checks `max(Λ_lo·u_F, C·radiusM) ≤ Λ_hi·u_F` for every
   * frame — a body whose declared radius does not fit inside its own eviction
   * ball is rejected at construction time, rather than silently evicting a
   * camera standing on its surface.
   */
  readonly radiusM: number
  /**
   * Supremum over all epochs of `|originInParent(epochJd)|`, in the PARENT's
   * unit. A fixed frame's is exactly its origin's length; an orbiting frame's
   * is its apoapsis (Phase 2 needs the same number to size its own bounds).
   *
   * `FrameTree.add` checks the exit-ball containment above against this, so it
   * must be an upper bound — understating it silently breaks the anchoring
   * rule's termination argument.
   */
  readonly maxOffsetInParent: number
  /**
   * Position of this frame's origin inside its parent, expressed in the
   * PARENT's unit. Time-dependent so that orbiting frames (planets, moons,
   * spacecraft) work without special-casing.
   *
   * Called only from `FrameTree.snapshot`, once per frame per simulation
   * tick. The hot path reads the snapshot, never this.
   */
  originInParent(epochJd: number): Vec3
}

/** A frame-relative position: an offset, in that frame's unit. */
export interface FramePosition {
  readonly frame: string
  readonly offset: Vec3
}

/** Convenience for frames whose origin does not move inside their parent. */
export const fixedFrame = (
  id: string,
  parent: string | null,
  unitM: number,
  originInParent: Vec3 = ZERO,
  radiusM = 0,
): Frame => ({
  id,
  parent,
  unitM,
  radiusM,
  maxOffsetInParent: length(originInParent),
  originInParent: () => originInParent,
})

/**
 * Every frame's `originInParent` for one epoch, evaluated once and stored flat.
 *
 * Hoisting ephemeris evaluation out of the resolution walk is what makes
 * `FrameTree.resolveInto` call no user code at all: re-entrancy into the
 * tree's scratch buffers becomes unexpressible rather than merely unlikely,
 * every object resolved in a tick sees the same frame positions, and the
 * ephemeris cost drops from O(objects × depth) to O(frames) per tick.
 */
export class FrameSnapshot {
  /** `3N` float64s, frame `i`'s origin at `[3i, 3i+1, 3i+2]`, in its parent's unit. */
  readonly origins: Float64Array
  epochJd = Number.NaN
  /**
   * How many frames have been evaluated. Reads past this throw: during
   * `snapshot` it catches a frame whose origin depends on a frame that has
   * not been evaluated yet (a definitional cycle, or a forward reference in
   * an order that cannot be topological); afterwards it is `N` and never
   * fires.
   */
  filled = 0
  /**
   * Which `FrameTree` (by its private `#id` token) this snapshot was last
   * refreshed against — stamped by `refreshSnapshot`, not compared by size:
   * two unrelated trees can easily hold the same frame count, and a
   * size-only check would let one tree refresh another tree's snapshot
   * silently. `undefined` means "never refreshed against any tree".
   */
  treeId: symbol | undefined = undefined

  constructor(frameCount: number) {
    this.origins = new Float64Array(frameCount * 3)
  }
}

/**
 * The frame hierarchy. Its whole purpose is that an absolute world coordinate
 * is never computed: every position is resolved directly from one frame into
 * another, so the numbers involved stay within a few orders of magnitude of
 * each other and float64 never runs out of digits.
 */
export class FrameTree {
  readonly #frames = new Map<string, Frame>()
  /** Insertion order, which `add`'s parent-must-exist rule makes topological. */
  readonly #order: Frame[] = []
  readonly #indexOf = new Map<string, number>()
  readonly #parentIndex: number[] = []
  /** `frame.unitM / parent.unitM`, precomputed; `1` for the root. */
  readonly #unitRatio: number[] = []
  readonly #depth: number[] = []
  readonly #children: string[][] = []
  /**
   * This tree's identity, stamped onto every `FrameSnapshot` it refreshes —
   * see `FrameSnapshot.treeId`. Two different trees can easily have the same
   * frame count at the same time, but never the same `#id`.
   */
  readonly #id = Symbol('FrameTree')

  // Scratch storage for `resolveInto` only — never touched by the
  // tuple-returning path. Safe to reuse across calls because JS is
  // single-threaded and, since `resolveInto` calls no user code, nothing can
  // re-enter it.
  readonly #scratchTarget = new Float64Array(3)
  readonly #scratchObserver = new Float64Array(3)

  add(frame: Frame): this {
    if (this.#frames.has(frame.id)) throw new Error(`frame already registered: ${frame.id}`)

    let parentIndex = -1
    let unitRatio = 1
    let depth = 0
    if (frame.parent !== null) {
      const parentIdx = this.#indexOf.get(frame.parent)
      if (parentIdx === undefined) {
        throw new Error(`frame ${frame.id} references unknown parent ${frame.parent}`)
      }
      const parent = this.#order[parentIdx]!
      parentIndex = parentIdx
      unitRatio = frame.unitM / parent.unitM
      depth = this.#depth[parentIdx]! + 1

      if (!(unitRatio < 1)) {
        throw new Error(
          `frame ${frame.id}: unitM (${frame.unitM}) must be strictly finer than its parent ${frame.parent}'s (${parent.unitM}). ` +
            'Same-unit or coarsening nesting has no exit ball inside its parent\'s, so re-anchoring could not terminate.',
        )
      }
      if (!(frame.maxOffsetInParent >= 0) || !Number.isFinite(frame.maxOffsetInParent)) {
        throw new Error(`frame ${frame.id}: maxOffsetInParent must be a finite non-negative number`)
      }
      const budget = frame.maxOffsetInParent + FRAME_EXIT_BALL_UNITS * unitRatio
      if (budget > FRAME_EXIT_BALL_UNITS) {
        throw new Error(
          `frame ${frame.id}: exit ball escapes its parent ${frame.parent}'s — ` +
            `maxOffsetInParent (${frame.maxOffsetInParent}) + ${FRAME_EXIT_BALL_UNITS} × ${unitRatio} = ${budget} > ${FRAME_EXIT_BALL_UNITS}`,
        )
      }
    }

    if (!(frame.radiusM >= 0) || !Number.isFinite(frame.radiusM)) {
      throw new Error(`frame ${frame.id}: radiusM must be a finite non-negative number`)
    }
    // The general statement of the metre/km bug this exists to prevent: a
    // frame's own capture ball, R_in(F) = max(Λ_lo·u_F, C·radiusM), must fit
    // inside its own eviction ball, R_out(F) = Λ_hi·u_F. A body whose radius
    // is too large for its unit (e.g. Earth declared in metres, radius
    // 6.371e6 m) would otherwise be uncapturable from its own surface.
    const captureRadiusM = Math.max(FRAME_CAPTURE_BALL_UNITS * frame.unitM, FRAME_CAPTURE_RADIUS_MULTIPLIER * frame.radiusM)
    const evictionRadiusM = FRAME_EXIT_BALL_UNITS * frame.unitM
    if (captureRadiusM > evictionRadiusM) {
      throw new Error(
        `frame ${frame.id}: capture ball (${captureRadiusM} m, from radiusM ${frame.radiusM}) exceeds its own eviction ball ` +
          `(${evictionRadiusM} m) — radiusM is too large for unitM (${frame.unitM}); use a finer unit or a smaller declared radius`,
      )
    }

    const index = this.#order.length
    this.#frames.set(frame.id, frame)
    this.#order.push(frame)
    this.#indexOf.set(frame.id, index)
    this.#parentIndex.push(parentIndex)
    this.#unitRatio.push(unitRatio)
    this.#depth.push(depth)
    this.#children.push([])
    if (parentIndex >= 0) this.#children[parentIndex]!.push(frame.id)
    return this
  }

  // @noalloc
  get(id: string): Frame {
    const frame = this.#frames.get(id)
    if (!frame) throw new Error(`unknown frame: ${id}`)
    return frame
  }

  get frameCount(): number {
    return this.#order.length
  }

  /** Ids of `id`'s direct children, in insertion order. The returned array is live; do not mutate it. */
  // @noalloc
  childrenOf(id: string): readonly string[] {
    return this.#children[this.#requireIndex(id)]!
  }

  /** Frame ids from `id` up to the root, inclusive at both ends. */
  chainToRoot(id: string): string[] {
    const chain: string[] = []
    let cursor: string | null = id
    while (cursor !== null) {
      chain.push(cursor)
      cursor = this.get(cursor).parent
    }
    return chain
  }

  commonAncestor(a: string, b: string): string {
    const ancestorsOfA = new Set(this.chainToRoot(a))
    for (const id of this.chainToRoot(b)) if (ancestorsOfA.has(id)) return id
    throw new Error(`frames ${a} and ${b} are in disconnected trees`)
  }

  /**
   * Every frame's origin at `epochJd`, evaluated once, in topological order.
   * Run this once per simulation tick and hand the result to `resolveInto`.
   *
   * `reuse` is written into and returned when it is the right size, so the
   * per-tick call allocates nothing.
   */
  snapshot(epochJd: number, reuse?: FrameSnapshot): FrameSnapshot {
    const count = this.#order.length
    const snapshot = reuse && reuse.origins.length === count * 3 ? reuse : new FrameSnapshot(count)
    this.refreshSnapshot(snapshot, epochJd)
    return snapshot
  }

  /**
   * Re-evaluate an existing snapshot in place. This is the frame-loop form:
   * it cannot allocate, so it needs no "was `reuse` the right size" branch —
   * a wrong-sized snapshot is a caller bug and throws, rather than silently
   * allocating a replacement in the hot path and returning it to a caller that
   * kept the old one.
   *
   * It is NOT `@noalloc`: it calls `Frame.originInParent`, which is user code
   * and which returns a tuple. That is the deliberate shape — the whole point
   * of a snapshot is that this happens O(frames) once per tick instead of
   * O(objects × depth) inside `resolveInto`, which calls no user code at all.
   *
   * Stamps `snapshot.treeId` with this tree's identity on success so a
   * foreign snapshot is rejected even when both trees have the same frame
   * count.
   */
  refreshSnapshot(snapshot: FrameSnapshot, epochJd: number): void {
    const count = this.#order.length
    const foreignTree = snapshot.treeId !== undefined && snapshot.treeId !== this.#id
    if (foreignTree || snapshot.origins.length !== count * 3) {
      throw new Error(
        `snapshot holds ${snapshot.origins.length / 3} frames, this tree has ${count} — it belongs to a different tree`,
      )
    }
    snapshot.filled = 0
    snapshot.epochJd = epochJd
    for (let i = 0; i < count; i++) {
      const origin = this.#order[i]!.originInParent(epochJd)
      const base = i * 3
      snapshot.origins[base] = origin[0]
      snapshot.origins[base + 1] = origin[1]
      snapshot.origins[base + 2] = origin[2]
      snapshot.filled = i + 1
    }
    // A plain field write, not an allocation — see `FrameSnapshot.treeId`.
    snapshot.treeId = this.#id
  }

  /** Frame `frameId`'s snapshotted origin, in its parent's unit, written into `out`. Root frames read as zero. */
  // @noalloc
  readOriginInParent(out: Float64Array, frameId: string, snapshot: FrameSnapshot): void {
    const index = this.#requireIndex(frameId)
    this.#requireEvaluated(index, snapshot)
    const base = index * 3
    out[0] = snapshot.origins[base]!
    out[1] = snapshot.origins[base + 1]!
    out[2] = snapshot.origins[base + 2]!
  }

  /**
   * Re-express `position` in the coordinates of `ancestor`, which must be on
   * the chain from `position.frame` to the root.
   */
  liftToAncestor(position: FramePosition, ancestor: string, epochJd: number): Vec3 {
    let offset = position.offset
    let cursor = position.frame
    while (cursor !== ancestor) {
      const frame = this.get(cursor)
      if (frame.parent === null) throw new Error(`${ancestor} is not an ancestor of ${position.frame}`)
      const parent = this.get(frame.parent)
      offset = add(scale(offset, frame.unitM / parent.unitM), frame.originInParent(epochJd))
      cursor = frame.parent
    }
    return offset
  }

  /**
   * Where `position` sits as seen from `observerFrame`, in the observer's unit.
   *
   * Walks both chains up to their common ancestor and differences there, so
   * the subtraction happens between two numbers of comparable size — never
   * between two huge absolute coordinates whose difference would be pure
   * rounding noise.
   *
   * This is the tuple API: it allocates on purpose and evaluates ephemerides
   * inline. Correct for catalogue ingestion, the pipeline, one-shot camera
   * moves and tests; the render loop uses `resolveInto` against a snapshot.
   */
  resolve(observerFrame: string, position: FramePosition, epochJd: number): Vec3 {
    if (observerFrame === position.frame) return position.offset
    const ancestor = this.commonAncestor(observerFrame, position.frame)
    const target = this.liftToAncestor(position, ancestor, epochJd)
    const observer = this.liftToAncestor({ frame: observerFrame, offset: ZERO }, ancestor, epochJd)
    return scale(sub(target, observer), this.get(ancestor).unitM / this.get(observerFrame).unitM)
  }

  /**
   * Same contract and same arithmetic as `resolve` — same operand order at
   * every step, so results are bit-identical, not merely close (proven in
   * `frames.test.ts`) — but written into `out` instead of allocating, and
   * reading frame origins from `snapshot` instead of calling
   * `Frame.originInParent`.
   *
   * Because it calls no user code it cannot be re-entered, which is what
   * makes the two shared scratch buffers above safe with no guard, no
   * scratch stack and no `try/finally`.
   *
   * `out` must have length >= 3; only indices 0..2 are written.
   */
  // @noalloc
  resolveInto(out: Float64Array, observerFrame: string, position: FramePosition, snapshot: FrameSnapshot): void {
    const observerIndex = this.#requireIndex(observerFrame)
    const targetIndex = this.#requireIndex(position.frame)
    if (observerIndex === targetIndex) {
      out[0] = position.offset[0]
      out[1] = position.offset[1]
      out[2] = position.offset[2]
      return
    }
    const ancestor = this.#commonAncestorIndex(observerIndex, targetIndex)
    this.#liftInto(this.#scratchTarget, targetIndex, position.offset[0], position.offset[1], position.offset[2], ancestor, snapshot)
    this.#liftInto(this.#scratchObserver, observerIndex, 0, 0, 0, ancestor, snapshot)
    const scaleFactor = this.#order[ancestor]!.unitM / this.#order[observerIndex]!.unitM
    out[0] = (this.#scratchTarget[0]! - this.#scratchObserver[0]!) * scaleFactor
    out[1] = (this.#scratchTarget[1]! - this.#scratchObserver[1]!) * scaleFactor
    out[2] = (this.#scratchTarget[2]! - this.#scratchObserver[2]!) * scaleFactor
  }

  // @noalloc
  #requireIndex(id: string): number {
    const index = this.#indexOf.get(id)
    if (index === undefined) throw new Error(`unknown frame: ${id}`)
    return index
  }

  // @noalloc
  #requireEvaluated(index: number, snapshot: FrameSnapshot): void {
    if (index >= snapshot.filled) {
      throw new Error(
        `frame ${this.#order[index]!.id} was read before it was evaluated in this snapshot — a definitional cycle, or a snapshot from a different tree`,
      )
    }
  }

  /**
   * Least common ancestor by index: walk both up to matching depth, then up
   * together. Depths are precomputed at `add` time, so this is a pair of
   * pointer-chases with no `Set` and no array.
   */
  // @noalloc
  #commonAncestorIndex(a: number, b: number): number {
    let curA = a
    let curB = b
    let depthA = this.#depth[a]!
    let depthB = this.#depth[b]!
    while (depthA > depthB) {
      curA = this.#parentIndex[curA]!
      depthA--
    }
    while (depthB > depthA) {
      curB = this.#parentIndex[curB]!
      depthB--
    }
    while (curA !== curB) {
      const nextA = this.#parentIndex[curA]!
      const nextB = this.#parentIndex[curB]!
      if (nextA < 0 || nextB < 0) {
        throw new Error(`frames ${this.#order[a]!.id} and ${this.#order[b]!.id} are in disconnected trees`)
      }
      curA = nextA
      curB = nextB
    }
    return curA
  }

  /**
   * Same arithmetic as `liftToAncestor`, mutating `out` at each step and
   * reading origins from the snapshot. Takes the offset as three numbers so
   * callers never allocate a wrapper just to make this call.
   */
  // @noalloc
  #liftInto(out: Float64Array, frameIndex: number, offX: number, offY: number, offZ: number, ancestor: number, snapshot: FrameSnapshot): void {
    out[0] = offX
    out[1] = offY
    out[2] = offZ
    let cursor = frameIndex
    while (cursor !== ancestor) {
      const parent = this.#parentIndex[cursor]!
      if (parent < 0) {
        throw new Error(`${this.#order[ancestor]!.id} is not an ancestor of ${this.#order[frameIndex]!.id}`)
      }
      this.#requireEvaluated(cursor, snapshot)
      const k = this.#unitRatio[cursor]!
      const base = cursor * 3
      out[0] = out[0]! * k + snapshot.origins[base]!
      out[1] = out[1]! * k + snapshot.origins[base + 1]!
      out[2] = out[2]! * k + snapshot.origins[base + 2]!
      cursor = parent
    }
  }
}
