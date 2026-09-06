import { describe, expect, it } from 'vitest'
import {
  FRAME_CAPTURE_RADIUS_MULTIPLIER,
  FRAME_EXIT_BALL_UNITS,
  FrameSnapshot,
  FrameTree,
  fixedFrame,
  type Frame,
} from './frames.js'
import { M_PER_AU, M_PER_KM, M_PER_KPC, M_PER_PC } from './units.js'
import { length, type Vec3 } from './vec3.js'

/**
 * mw (kpc) → ssb (pc) → sun (AU) → earth (km) → a ground station (metres),
 * with Alpha Centauri hanging off the galactic frame. Deliberately spans 19
 * orders of magnitude, which is the whole point. Every hop coarsens going up,
 * which `FrameTree.add` now requires.
 */
const tree = () => {
  const t = new FrameTree()
  t.add(fixedFrame('mw', null, M_PER_KPC))
  t.add(fixedFrame('ssb', 'mw', M_PER_PC))
  t.add(fixedFrame('sun', 'ssb', M_PER_AU))
  t.add({
    id: 'earth',
    parent: 'sun',
    unitM: M_PER_KM,
    radiusM: 0,
    maxOffsetInParent: 1,
    // One AU along +X, ignoring eccentricity — enough to check the arithmetic.
    originInParent: () => [1, 0, 0],
  })
  t.add(fixedFrame('station', 'earth', 1, [6378, 0, 0]))
  // 1.3 pc from the SSB, expressed in the galactic frame's kpc.
  t.add(fixedFrame('alphaCen', 'mw', M_PER_PC, [1.3e-3, 0, 0]))
  return t
}

describe('FrameTree', () => {
  it('finds the common ancestor', () => {
    expect(tree().commonAncestor('station', 'sun')).toBe('sun')
    expect(tree().commonAncestor('station', 'ssb')).toBe('ssb')
  })

  it('resolves a child into its parent unit', () => {
    const d = tree().resolve('earth', { frame: 'station', offset: [0, 0, 0] }, 0)
    expect(d[0]).toBeCloseTo(6378, 9)
  })

  it('resolves the Sun as seen from a ground station, in metres', () => {
    const d = tree().resolve('station', { frame: 'sun', offset: [0, 0, 0] }, 0)
    // The station sits on the +X face, so it is one Earth radius FURTHER
    // from the Sun than Earth's centre is.
    expect(length(d)).toBeCloseTo(M_PER_AU + 6378 * M_PER_KM, 0)
  })

  it('keeps metre precision at parsec distances', () => {
    const t = tree()
    const near = t.resolve('station', { frame: 'alphaCen', offset: [0, 0, 0] }, 0)
    const nudged = t.resolve('station', { frame: 'alphaCen', offset: [0, 0, 1e-9] }, 0)
    // 1e-9 pc is ~30.9 million metres; it must survive the round trip through
    // the parsec-scale ancestor rather than vanish into rounding.
    expect(nudged[2] - near[2]).toBeCloseTo(1e-9 * M_PER_PC, 0)
  })

  it('rejects an unknown parent', () => {
    const t = new FrameTree()
    expect(() => t.add(fixedFrame('moon', 'earth', 1))).toThrow(/unknown parent/)
  })

  it('rejects disconnected trees', () => {
    const t = new FrameTree()
    t.add(fixedFrame('a', null, 1))
    t.add(fixedFrame('b', null, 1))
    expect(() => t.commonAncestor('a', 'b')).toThrow(/disconnected/)
  })

  it('lists a frame\'s children in insertion order', () => {
    expect(tree().childrenOf('mw')).toEqual(['ssb', 'alphaCen'])
    expect(tree().childrenOf('station')).toEqual([])
  })
})

describe('FrameTree.add exit-ball containment (the invariant re-anchoring rests on)', () => {
  it('rejects a child whose unit is not strictly finer than its parent\'s', () => {
    const t = new FrameTree()
    t.add(fixedFrame('root', null, 1e6))
    expect(() => t.add(fixedFrame('same', 'root', 1e6))).toThrow(/strictly finer/)
    expect(() => t.add(fixedFrame('coarser', 'root', 1e9))).toThrow(/strictly finer/)
  })

  it('rejects a child whose exit ball escapes its parent\'s', () => {
    const t = new FrameTree()
    t.add(fixedFrame('root', null, 1e6))
    // ratio 1e-3 → the child's own exit ball costs 1e3 parent units, leaving
    // 999_000 for the origin offset. 999_001 is one unit too far.
    expect(() => t.add(fixedFrame('far', 'root', 1e3, [999_001, 0, 0]))).toThrow(/exit ball escapes/)
    expect(() => t.add(fixedFrame('ok', 'root', 1e3, [998_999, 0, 0]))).not.toThrow()
  })

  it('makes the containment exact at the boundary', () => {
    const t = new FrameTree()
    t.add(fixedFrame('root', null, 1e6))
    const ratio = 1e3 / 1e6
    const exact = FRAME_EXIT_BALL_UNITS - FRAME_EXIT_BALL_UNITS * ratio
    expect(() => t.add(fixedFrame('edge', 'root', 1e3, [exact, 0, 0]))).not.toThrow()
  })

  it('rejects a frame that understates maxOffsetInParent as negative or non-finite', () => {
    const t = new FrameTree()
    t.add(fixedFrame('root', null, 1e6))
    const bad: Frame = { id: 'bad', parent: 'root', unitM: 1e3, radiusM: 0, maxOffsetInParent: Number.NaN, originInParent: () => [0, 0, 0] }
    expect(() => t.add(bad)).toThrow(/finite non-negative/)
  })

  it('rejects a frame with a negative or non-finite radiusM', () => {
    const t = new FrameTree()
    t.add(fixedFrame('root', null, 1e6))
    const bad: Frame = { id: 'bad', parent: 'root', unitM: 1e3, radiusM: Number.NaN, maxOffsetInParent: 0, originInParent: () => [0, 0, 0] }
    expect(() => t.add(bad)).toThrow(/radiusM/)
    const negative: Frame = { id: 'negative', parent: 'root', unitM: 1e3, radiusM: -1, maxOffsetInParent: 0, originInParent: () => [0, 0, 0] }
    expect(() => t.add(negative)).toThrow(/radiusM/)
  })

  it('rejects a frame whose capture ball would exceed its own eviction ball — the general form of the Earth metre/km bug', () => {
    const t = new FrameTree()
    t.add(fixedFrame('root', null, 1e6))
    // unitM=1 m, so R_out = Λ_hi·1 = 1e6 m and R_in = max(Λ_lo·1, C·radiusM) =
    // max(1e3, 2·radiusM). At radiusM = 5e5, C·radiusM is exactly 1e6 — the
    // boundary; one metre more pushes it over.
    const boundaryRadiusM = FRAME_EXIT_BALL_UNITS / FRAME_CAPTURE_RADIUS_MULTIPLIER
    expect(() => t.add(fixedFrame('tooLargeBody', 'root', 1, [0, 0, 0], boundaryRadiusM + 1))).toThrow(/capture ball/)
    expect(() => t.add(fixedFrame('okBody', 'root', 1, [0, 0, 0], boundaryRadiusM))).not.toThrow()
  })
})

/** A frame whose origin genuinely moves with the epoch, so a snapshot is not a constant. */
const orbitingFrame = (id: string, parent: string, unitM: number, radius: number): Frame => ({
  id,
  parent,
  unitM,
  radiusM: 0,
  maxOffsetInParent: radius,
  originInParent: (epochJd: number) => [radius * Math.cos(epochJd), radius * Math.sin(epochJd), 0],
})

describe('FrameTree.snapshot', () => {
  it('evaluates every frame once and records the epoch', () => {
    const t = tree()
    const snapshot = t.snapshot(2451545.0)
    expect(snapshot.epochJd).toBe(2451545.0)
    expect(snapshot.filled).toBe(t.frameCount)
    expect(snapshot.origins.length).toBe(t.frameCount * 3)
  })

  it('reuses the caller\'s buffer instead of allocating a new one per tick', () => {
    const t = tree()
    const first = t.snapshot(0)
    const second = t.snapshot(1, first)
    expect(second).toBe(first)
    expect(second.epochJd).toBe(1)
  })

  it('actually depends on the epoch — a time-dependent frame moves between ticks', () => {
    // Without this, `resolveInto` could ignore its epoch entirely and the
    // whole suite would stay green (every other fixture frame is fixed).
    const t = new FrameTree()
    t.add(fixedFrame('root', null, M_PER_PC))
    t.add(orbitingFrame('orbiter', 'root', M_PER_AU, 3))

    const a = t.snapshot(0)
    expect(a.origins[3]!).toBeCloseTo(3, 12)
    expect(a.origins[4]!).toBeCloseTo(0, 12)
    const b = t.snapshot(Math.PI / 2)
    expect(b.origins[3]!).toBeCloseTo(0, 12)
    expect(b.origins[4]!).toBeCloseTo(3, 12)

    const out = new Float64Array(3)
    t.resolveInto(out, 'root', { frame: 'orbiter', offset: [0, 0, 0] }, t.snapshot(0))
    const atZero = out[0]!
    t.resolveInto(out, 'root', { frame: 'orbiter', offset: [0, 0, 0] }, t.snapshot(Math.PI / 2))
    expect(out[0]!).not.toBe(atZero)
    expect(out[1]!).toBeCloseTo(3, 12)
  })

  it('throws when a frame\'s origin depends on a frame not yet evaluated this tick', () => {
    // The cycle detector: `early`'s origin reaches back into the tree for
    // `late`, which sits after it in topological order and so has no value
    // yet. A genuine definitional cycle always has one such forward edge.
    const t = new FrameTree()
    t.add(fixedFrame('root', null, M_PER_PC))
    const out = new Float64Array(3)
    let live: FrameSnapshot | null = null
    t.add({
      id: 'early',
      parent: 'root',
      unitM: M_PER_AU,
      radiusM: 0,
      maxOffsetInParent: 0,
      originInParent: () => {
        if (live) t.readOriginInParent(out, 'late', live)
        return [0, 0, 0]
      },
    })
    t.add(fixedFrame('late', 'root', M_PER_AU, [1, 0, 0]))

    live = new FrameSnapshot(t.frameCount)
    expect(() => t.snapshot(0, live!)).toThrow(/read before it was evaluated/)
  })
})

describe('FrameTree.resolveInto', () => {
  it('matches resolve() bit-for-bit across every frame pair, offset and epoch swept', () => {
    // `resolveInto` is a second, allocation-free implementation of the same
    // walk `resolve` does (index arithmetic instead of a `Set`, a mutated
    // `Float64Array` instead of a fresh `Vec3` per step, snapshot reads
    // instead of `originInParent` calls). The two must never drift — `toBe`,
    // not `toBeCloseTo`, at every combination. One frame here genuinely moves
    // with the epoch, so an implementation that ignored the epoch would fail.
    const t = tree()
    t.add(orbitingFrame('comet', 'sun', M_PER_KM, 0.3))
    const frameIds = ['station', 'earth', 'sun', 'ssb', 'mw', 'alphaCen', 'comet']
    const offsets: Vec3[] = [
      [0, 0, 0],
      [1, -2, 3],
      [1e-9, 4.5, -1e6],
      [123.456, -0.001, 999999.999],
    ]
    const epochs = [0, 2451545.0, -12345.6789, 1_000_000]
    const out = new Float64Array(3)

    for (const epochJd of epochs) {
      const snapshot = t.snapshot(epochJd)
      for (const observerFrame of frameIds) {
        for (const frame of frameIds) {
          for (const offset of offsets) {
            const position = { frame, offset }
            const expected = t.resolve(observerFrame, position, epochJd)
            t.resolveInto(out, observerFrame, position, snapshot)
            const label = `${observerFrame}<-${frame} offset=${offset} epoch=${epochJd}`
            expect(out[0], label).toBe(expected[0])
            expect(out[1], label).toBe(expected[1])
            expect(out[2], label).toBe(expected[2])
          }
        }
      }
    }
  })
})

describe('FrameTree.refreshSnapshot ownership', () => {
  it('preserves the throw for a genuinely mismatched snapshot handed to refreshSnapshot (different frame count)', () => {
    const a = tree()
    const b = new FrameTree()
    b.add(fixedFrame('lonely', null, 1e6))
    const snapshotFromA = a.snapshot(0)
    expect(() => b.refreshSnapshot(snapshotFromA, 0)).toThrow(/belongs to a different tree/)
  })

  it('throws when a snapshot from this tree goes stale after growth', () => {
    // The token alone cannot catch this — it still matches (it is the same
    // tree). Only the size check does. `refreshSnapshot` is documented as
    // the non-growing form; it must not silently write past — or short of —
    // the array it already has.
    const t = tree()
    const snapshot = t.snapshot(0)
    t.add(orbitingFrame('comet', 'sun', M_PER_KM, 0.3))
    expect(() => t.refreshSnapshot(snapshot, 1)).toThrow(/belongs to a different tree/)
  })

  it('throws on a foreign snapshot with the same frame count', () => {
    const a = new FrameTree()
    a.add(fixedFrame('root', null, 1e6))
    a.add(fixedFrame('child', 'root', 1e3, [7, 0, 0]))
    const b = new FrameTree()
    b.add(fixedFrame('other-root', null, 1e6))
    b.add(fixedFrame('other-child', 'other-root', 1e3, [99, 0, 0]))
    expect(a.frameCount).toBe(b.frameCount)

    const snapshotFromA = a.snapshot(0)
    expect(() => b.refreshSnapshot(snapshotFromA, 0)).toThrow(/belongs to a different tree/)

    // The rejected refresh leaves `a`'s snapshot untouched; aliasing would
    // show up here as `b`'s 99 instead of `a`'s 7.
    expect(Array.from(snapshotFromA.origins.slice(3, 6))).toEqual([7, 0, 0])
  })
})
