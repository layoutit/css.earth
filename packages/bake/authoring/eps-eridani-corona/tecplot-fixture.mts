/** A small Tecplot binary file for tests: version 112, one zone of bricks, block packed, single precision, as preplot
 * writes a BATS-R-US solution. `values` holds one list of node values a variable; a brick names its eight nodes from zero. */
export function tecplotBytes(input: { title?: string; variables: readonly string[]; values: readonly (readonly number[])[]; bricks: readonly (readonly number[])[] }): Buffer {
  const parts: Buffer[] = [];
  const i32 = (value: number) => { const b = Buffer.alloc(4); b.writeInt32LE(value); parts.push(b); };
  const f32 = (value: number) => { const b = Buffer.alloc(4); b.writeFloatLE(value); parts.push(b); };
  const f64 = (value: number) => { const b = Buffer.alloc(8); b.writeDoubleLE(value); parts.push(b); };
  const text = (value: string) => { for (const character of value) i32(character.codePointAt(0)!); i32(0); };
  const points = input.values[0]!.length;
  parts.push(Buffer.from('#!TDV112', 'latin1')); i32(1); i32(0);
  text(input.title ?? 'test'); i32(input.variables.length); for (const name of input.variables) text(name);
  // Zone header: name, parent, strand, solution time, unused, type 5 (brick), all nodal, no face neighbours, counts, no auxiliary data.
  f32(299); text('zone'); i32(-1); i32(-1); f64(0); i32(-1); i32(5); i32(0); i32(0); i32(0); i32(points); i32(input.bricks.length); i32(0); i32(0); i32(0); i32(0);
  f32(357);
  // Zone data: formats, no passive or shared variables, own connectivity, the range of each variable, then the values and bricks.
  f32(299); for (let i = 0; i < input.variables.length; i++) i32(1); i32(0); i32(0); i32(-1);
  for (const values of input.values) { f64(Math.min(...values)); f64(Math.max(...values)); }
  for (const values of input.values) for (const value of values) f32(value);
  for (const brick of input.bricks) for (const node of brick) i32(node);
  return Buffer.concat(parts);
}

/** Two bricks side by side along x, filling the cube of ±4: twelve nodes on the planes x = -4, 0 and 4, whose density is
 * `planes[0..2]` and whose field is (3, 4, 0) gauss everywhere. */
export function twoBrickSolution(planes: readonly [number, number, number]): Buffer {
  const x: number[] = [], y: number[] = [], z: number[] = [], rho: number[] = [];
  for (const [plane, px] of [-4, 0, 4].entries()) for (const [py, pz] of [[-4, -4], [4, -4], [4, 4], [-4, 4]] as const) { x.push(px); y.push(py); z.push(pz); rho.push(planes[plane]!); }
  const constant = (value: number) => x.map(() => value);
  return tecplotBytes({ variables: ['X [R]', 'Y [R]', 'Z [R]', '`r [g/cm^3]', 'B_x [Gauss]', 'B_y [Gauss]', 'B_z [Gauss]'],
    values: [x, y, z, rho, constant(3), constant(4), constant(0)], bricks: [[0, 1, 2, 3, 4, 5, 6, 7], [4, 5, 6, 7, 8, 9, 10, 11]] });
}
