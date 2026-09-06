// Asset-specific coordinates end here. Runtime receives one ordered phase
// lookup, a numeric light basis, and already prepared neighboring resources.
const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const normalize = v => v.map(x => x / Math.hypot(...v));
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);

export function prepareLightBasis(from, to) {
  from = normalize(from); to = normalize(to);
  const v = [from[1]*to[2]-from[2]*to[1], from[2]*to[0]-from[0]*to[2], from[0]*to[1]-from[1]*to[0]];
  const c = dot(from, to);
  if (c < -1 + 1e-10) throw new TypeError("Opposite light references need an explicit prepared basis.");
  const k = [0,-v[2],v[1],v[2],0,-v[0],-v[1],v[0],0];
  return identity.map((x, i) => x + k[i] + [0,1,2].reduce((sum, j) => sum + k[Math.floor(i/3)*3+j]*k[j*3+i%3], 0)/(1+c));
}

export function prepareFrameLookup(count, frameAtPhase) {
  const ascending = frameAtPhase(1) >= frameAtPhase(-1);
  const first = frameAtPhase(-1), last = frameAtPhase(1);
  const indices = [first], thresholds = [];
  for (let frame = first; frame !== last;) {
    const next = frame + (ascending ? 1 : -1);
    let low = -1, high = 1;
    for (let i = 0; i < 55; i++) {
      const middle = (low + high)/2;
      if (ascending ? frameAtPhase(middle) >= next : frameAtPhase(middle) <= next) high = middle;
      else low = middle;
    }
    thresholds.push(high); indices.push(next); frame = next;
  }
  return { count, thresholds, indices, lightBasis: [...identity] };
}

function remap(value, mapping) {
  if (!mapping) return value;
  const [a,b] = mapping.lowerTransition, [c,d] = mapping.plateau, [e,f] = mapping.upperTransition;
  if (value <= a || value >= f) return value;
  if (value < b) { const t=(value-a)/(b-a); return value*(1-t)+mapping.plateauViewZ*t; }
  if (value >= c && value <= d) return mapping.plateauViewZ;
  const t=(value-e)/(f-e); return mapping.plateauViewZ*(1-t)+value*t;
}

export function prepareMaterialTracks(plan) {
  const reference = plan.sun?.referenceViewDirection?.map((x, i) => i ? -x : x) ?? plan.sky.sun?.initialViewDirection;
  return plan.materials.map(track => {
    const source = track.frame;
    let frame;
    if (source.samples) {
      const samples = source.samples.map((direction, index) => ({ phase: direction[2], index })).sort((a,b) => a.phase-b.phase);
      frame = { count: source.count, indices: samples.map(sample => sample.index),
        thresholds: samples.slice(1).map((sample, i) => (sample.phase+samples[i].phase)/2),
        lightBasis: prepareLightBasis(reference, source.samples[track.demand.defaultFrame]) };
    } else {
      if (!["sun-z", "prepared-light-z", "reference-sun-z"].includes(source.source)) throw new TypeError("Prepare material phase samples from the source lighting.");
      frame = prepareFrameLookup(source.count, phase => {
        const value = remap(source.source === "reference-sun-z" ? reference[2]-phase : phase, source.remap);
        return Math.round(Math.max(0, Math.min(source.maximumFrame ?? source.count-1,
          source.baseFrame + (value-source.minimum)/(source.maximum-source.minimum)*(source.span ?? source.count-1))));
      });
    }
    const banks = track.banks.map(bank => ({ ...bank,
      frames: bank.frames.map(address => {
        const rows = [...(bank.rows ?? [])].sort((a,b) => Math.abs(a.row-address.row)-Math.abs(b.row-address.row) || a.row-b.row);
        return { ...address, prewarm: address.row === null ? [] : rows.filter(row => row.resource !== address.resource)
          .slice(0, Math.max(0, track.demand.capacity-1)).map(row => row.resource) };
      }),
    }));
    const { demand, rotation, ...rest } = track;
    const { source: rotationSource, ...preparedRotation } = rotation ?? {};
    return { ...rest, frame, banks, defaultFrame: demand.defaultFrame,
      rotation: rotation === null ? null : preparedRotation };
  });
}
