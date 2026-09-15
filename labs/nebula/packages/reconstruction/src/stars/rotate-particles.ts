export function rotateParticles(bytes: Buffer, matrix: number[]) {
  if (matrix.length !== 9 || matrix.some(n => !Number.isFinite(n))) throw new TypeError('Expected a finite rotation matrix.');
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
    const dot = [0, 1, 2].reduce((sum, k) => sum + matrix[3 * a + k] * matrix[3 * b + k], 0);
    if (Math.abs(dot - Number(a === b)) > 1e-6) throw new TypeError('Display rotation must preserve distances.');
  }
  const [a,b,c,d,e,f,g,h,i] = matrix;
  if (Math.abs(a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g)-1) > 1e-6) throw new TypeError('Display rotation must preserve handedness.');
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const p = [bytes.readFloatLE(offset), bytes.readFloatLE(offset + 4), bytes.readFloatLE(offset + 8)];
    for (let axis = 0; axis < 3; axis++) {
      bytes.writeFloatLE(p.reduce((sum, value, k) => sum + value * matrix[3 * axis + k], 0), offset + 4 * axis);
    }
  }
}
