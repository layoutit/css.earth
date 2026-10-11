/**
 * The eigenvalues and eigenvectors of a small real symmetric matrix as NumPy's `np.linalg.eigh(A)` gives them (UPLO
 * 'L', LAPACK `dsyevd` with JOBZ 'V'), signs included: the lobe occluder's axes (./cloud-points.mts) are the
 * eigenvectors of a covariance, and an eigenvector's sign is whatever the algorithm leaves it, so only the same
 * algorithm gives the same record.
 *
 * Reference LAPACK's path for a matrix of at most 25 rows, ported step by step: the lower triangle reduced to
 * tridiagonal form by Householder reflections (`dsytd2`, with `dlarfg`, `dsymv`, `dsyr2`), the tridiagonal matrix
 * diagonalised by implicit QL or QR iterations from the identity (`dsteqr` with COMPZ 'I', as `dstedc` calls it for small
 * matrices; `dlaev2`, `dlartg`, `dlasr`), its eigenvalues sorted ascending by selection with their vectors, and the
 * reflections applied back (`dormtr`, `dorm2r`). The plane rotations are LAPACK's before 3.10 (`lartg`). The matrix is read from its lower triangle; the caller's is unchanged.
 * Matched against NumPy 2.5.4 with Apple Accelerate on macOS arm64; values agree to rounding (Accelerate may fuse
 * multiply-adds), signs exactly.
 */

const EPS = 2 ** -53, SAFMIN = 2 ** -1022, SMALL = 25;
const sign = (a: number, b: number) => (b >= 0 && !Object.is(b, -0) ? Math.abs(a) : -Math.abs(a));
/** sqrt(x² + y²) without overflow (`dlapy2`). */
const lapy2 = (x: number, y: number) => { const xa = Math.abs(x), ya = Math.abs(y), w = Math.max(xa, ya), z = Math.min(xa, ya); return z === 0 || w > Number.MAX_VALUE ? w : w * Math.sqrt(1 + (z / w) ** 2); };

/** A plane rotation [c, s, r] with c f + s g = r and -s f + c g = 0, as `dlartg` before LAPACK 3.10 makes it (the
 * version Accelerate's `dsyevd` follows: with 3.10's rotation, which keeps c positive, 20% of NumPy's eigenvector signs
 * come out flipped): r = sqrt(f² + g²), and c positive only where |f| > |g|. */
const SAFMN2 = 2 ** -484, SAFMX2 = 1 / SAFMN2;
function lartg(f: number, g: number): [number, number, number] {
  if (g === 0) return [1, 0, f];
  if (f === 0) return [0, 1, g];
  let f1 = f, g1 = g, scale = Math.max(Math.abs(f1), Math.abs(g1)), c: number, s: number, r: number;
  if (scale >= SAFMX2 || scale <= SAFMN2) {
    const by = scale >= SAFMX2 ? SAFMN2 : SAFMX2, back = 1 / by, beyond = (value: number) => by === SAFMN2 ? value >= SAFMX2 : value <= SAFMN2;
    let count = 0; do { count++; f1 *= by; g1 *= by; scale = Math.max(Math.abs(f1), Math.abs(g1)); } while (beyond(scale) && count < 20);
    r = Math.sqrt(f1 ** 2 + g1 ** 2); c = f1 / r; s = g1 / r; for (let i = 0; i < count; i++) r *= back;
  } else { r = Math.sqrt(f1 ** 2 + g1 ** 2); c = f1 / r; s = g1 / r; }
  if (Math.abs(f) > Math.abs(g) && c < 0) { c = -c; s = -s; r = -r; }
  return [c, s, r];
}

/** The eigensystem of [[a, b], [b, c]]: [rt1, rt2, cs1, sn1], rt1 the larger in size, (cs1, sn1) its eigenvector (`dlaev2`). */
function laev2(a: number, b: number, c: number): [number, number, number, number] {
  const sm = a + c, df = a - c, adf = Math.abs(df), tb = b + b, ab = Math.abs(tb);
  const [acmx, acmn] = Math.abs(a) > Math.abs(c) ? [a, c] : [c, a];
  const rt = adf > ab ? adf * Math.sqrt(1 + (ab / adf) ** 2) : adf < ab ? ab * Math.sqrt(1 + (adf / ab) ** 2) : ab * Math.sqrt(2);
  let rt1: number, rt2: number, sgn1: number;
  if (sm < 0) { rt1 = 0.5 * (sm - rt); sgn1 = -1; rt2 = (acmx / rt1) * acmn - (b / rt1) * b; }
  else if (sm > 0) { rt1 = 0.5 * (sm + rt); sgn1 = 1; rt2 = (acmx / rt1) * acmn - (b / rt1) * b; }
  else { rt1 = 0.5 * rt; rt2 = -0.5 * rt; sgn1 = 1; }
  const [cs, sgn2] = df >= 0 ? [df + rt, 1] : [df - rt, -1];
  let cs1: number, sn1: number;
  if (Math.abs(cs) > ab) { const ct = -tb / cs; sn1 = 1 / Math.sqrt(1 + ct * ct); cs1 = ct * sn1; }
  else if (ab === 0) { cs1 = 1; sn1 = 0; }
  else { const tn = -cs / tb; cs1 = 1 / Math.sqrt(1 + tn * tn); sn1 = tn * cs1; }
  if (sgn1 === sgn2) { const tn = cs1; cs1 = -sn1; sn1 = tn; }
  return [rt1, rt2, cs1, sn1];
}

/** Columns from..from+count-1 of z rotated by the plane rotations (c, s) (`dlasr` with SIDE 'R', PIVOT 'V'; forward or backward). */
function lasr(forward: boolean, z: number[][], from: number, count: number, c: number[], s: number[]) {
  const n = z.length, apply = (j: number) => {
    const ct = c[j]!, st = s[j]!; if (ct === 1 && st === 0) return;
    for (let i = 0; i < n; i++) { const temp = z[i]![from + j + 1]!; z[i]![from + j + 1] = ct * temp - st * z[i]![from + j]!; z[i]![from + j] = st * temp + ct * z[i]![from + j]!; }
  };
  if (forward) for (let j = 0; j < count - 1; j++) apply(j); else for (let j = count - 2; j >= 0; j--) apply(j);
}

/** Eigenvalues (ascending) and eigenvectors (columns of `vectors`, vectors[row][column]) of a symmetric matrix, as `np.linalg.eigh`. */
export function symmetricEigen(matrix: readonly (readonly number[])[]): { values: number[]; vectors: number[][] } {
  const n = matrix.length;
  if (!n || n > SMALL || matrix.some(row => row.length !== n || row.some(value => !Number.isFinite(value)))) throw new TypeError(`symmetricEigen: expected a square finite matrix of 1 to ${SMALL} rows.`);
  const a = matrix.map(row => [...row]);
  if (n === 1) return { values: [a[0]![0]!], vectors: [[1]] };
  // dsyevd: scale a matrix too small or too large.
  const smlnum = SAFMIN / (2 * EPS), rmin = Math.sqrt(smlnum), rmax = Math.sqrt(1 / smlnum);
  let anrm = 0; for (let j = 0; j < n; j++) for (let i = j; i < n; i++) anrm = Math.max(anrm, Math.abs(a[i]![j]!));
  const sigma = anrm > 0 && anrm < rmin ? rmin / anrm : anrm > rmax ? rmax / anrm : 1;
  if (sigma !== 1) for (let j = 0; j < n; j++) for (let i = j; i < n; i++) a[i]![j] = a[i]![j]! * sigma;
  // dsytd2, lower: Q' A Q = T, reflectors stored below the subdiagonal.
  const d = new Array<number>(n).fill(0), e = new Array<number>(n - 1).fill(0), tau = new Array<number>(n - 1).fill(0);
  for (let i = 0; i < n - 1; i++) {
    // dlarfg on alpha = A(i+1, i), x = A(i+2.., i).
    const m = n - i - 1; let alpha = a[i + 1]![i]!, taui = 0;
    if (m > 1) {
      let xnorm = 0; { let scale = 0, ssq = 1; for (let k = i + 2; k < n; k++) { const v = a[k]![i]!; if (v !== 0) { const ab = Math.abs(v); if (scale < ab) { ssq = 1 + ssq * (scale / ab) ** 2; scale = ab; } else ssq += (ab / scale) ** 2; } } xnorm = scale * Math.sqrt(ssq); }
      if (xnorm !== 0) {
        const beta = -sign(lapy2(alpha, xnorm), alpha);
        taui = (beta - alpha) / beta; const f = 1 / (alpha - beta); for (let k = i + 2; k < n; k++) a[k]![i] = a[k]![i]! * f; alpha = beta;
      }
    }
    a[i + 1]![i] = alpha; e[i] = alpha;
    if (taui !== 0) {
      a[i + 1]![i] = 1;
      const v = Array.from({ length: m }, (_, k) => a[i + 1 + k]![i]!), y = new Array<number>(m).fill(0);
      // dsymv, lower: y = taui A(i+1.., i+1..) v.
      for (let j = 0; j < m; j++) { const t1 = taui * v[j]!; let t2 = 0; y[j] = y[j]! + t1 * a[i + 1 + j]![i + 1 + j]!; for (let k = j + 1; k < m; k++) { y[k] = y[k]! + t1 * a[i + 1 + k]![i + 1 + j]!; t2 += a[i + 1 + k]![i + 1 + j]! * v[k]!; } y[j] = y[j]! + taui * t2; }
      let dot = 0; for (let k = 0; k < m; k++) dot += y[k]! * v[k]!;
      const alpha2 = -0.5 * taui * dot; for (let k = 0; k < m; k++) y[k] = y[k]! + alpha2 * v[k]!;
      // dsyr2, lower: A -= v y' + y v'.
      for (let j = 0; j < m; j++) if (v[j] !== 0 || y[j] !== 0) { const t1 = -1 * y[j]!, t2 = -1 * v[j]!; for (let k = j; k < m; k++) a[i + 1 + k]![i + 1 + j] = a[i + 1 + k]![i + 1 + j]! + v[k]! * t1 + y[k]! * t2; }
      a[i + 1]![i] = e[i]!;
    }
    d[i] = a[i]![i]!; tau[i] = taui;
  }
  d[n - 1] = a[n - 1]![n - 1]!;
  const z = steqr(d, e);
  // dormtr ('L', 'L', 'N') = dorm2r backward on the rows below the first: H(i) = I - tau v v', v = [1, A(i+2.., i)].
  for (let i = n - 2; i >= 0; i--) {
    const t = tau[i]!; if (t === 0) continue;
    const v = [1, ...Array.from({ length: n - i - 2 }, (_, k) => a[i + 2 + k]![i]!)];
    for (let col = 0; col < n; col++) { let w = 0; for (let k = 0; k < v.length; k++) w += z[i + 1 + k]![col]! * v[k]!; const temp = -t * w; for (let k = 0; k < v.length; k++) z[i + 1 + k]![col] = z[i + 1 + k]![col]! + v[k]! * temp; }
  }
  return { values: d.map(value => sigma === 1 ? value : value * (1 / sigma)), vectors: z };
}

/** Eigenvalues (d, in place) and eigenvectors (returned) of the symmetric tridiagonal matrix with diagonal d and off-diagonal e, from the identity (`dsteqr`, COMPZ 'I'). */
function steqr(d: number[], e: number[]): number[][] {
  const n = d.length, z = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0)), work = new Array<number>(2 * n).fill(0);
  const eps = EPS, eps2 = eps * eps, safmax = 1 / SAFMIN, ssfmax = Math.sqrt(safmax) / 3, ssfmin = Math.sqrt(SAFMIN) / eps2, nmaxit = n * 30;
  // 1-based views: D(k) = d[k-1], E(k) = e[k-1], WORK(k) = work[k-1], column k of z.
  const D = (k: number) => d[k - 1]!, E = (k: number) => e[k - 1]!;
  let jtot = 0, l1 = 1;
  const scale = (from: number, to: number, count: number, lo: number, rows: number) => { const f = to / from; for (let k = 0; k < rows; k++) d[lo - 1 + k] = d[lo - 1 + k]! * f; for (let k = 0; k < count; k++) e[lo - 1 + k] = e[lo - 1 + k]! * f; };
  outer: while (l1 <= n) {
    if (l1 > 1) e[l1 - 2] = 0;
    let m = n;
    for (let mm = l1; mm <= n - 1; mm++) { const tst = Math.abs(E(mm)); if (tst === 0) { m = mm; break; } if (tst <= Math.sqrt(Math.abs(D(mm))) * Math.sqrt(Math.abs(D(mm + 1))) * eps) { e[mm - 1] = 0; m = mm; break; } }
    let l = l1; const lsv = l; let lend = m; const lendsv = lend; l1 = m + 1;
    if (lend === l) continue;
    let anorm = 0; for (let k = l; k <= lend; k++) anorm = Math.max(anorm, Math.abs(D(k))); for (let k = l; k < lend; k++) anorm = Math.max(anorm, Math.abs(E(k)));
    if (anorm === 0) continue;
    let iscale = 0;
    if (anorm > ssfmax) { iscale = 1; scale(anorm, ssfmax, lend - l, l, lend - l + 1); } else if (anorm < ssfmin) { iscale = 2; scale(anorm, ssfmin, lend - l, l, lend - l + 1); }
    if (Math.abs(D(lend)) < Math.abs(D(l))) { lend = lsv; l = lendsv; }
    if (lend > l) {
      // QL iteration.
      for (;;) {
        let mm = lend;
        if (l !== lend) for (let k = l; k <= lend - 1; k++) { const tst = Math.abs(E(k)) ** 2; if (tst <= eps2 * Math.abs(D(k)) * Math.abs(D(k + 1)) + SAFMIN) { mm = k; break; } }
        m = mm; if (m < lend) e[m - 1] = 0;
        let p = D(l);
        if (m === l) { d[l - 1] = p; l++; if (l <= lend) continue; break; }
        if (m === l + 1) {
          const [rt1, rt2, c, s] = laev2(D(l), E(l), D(l + 1)); work[l - 1] = c; work[n - 1 + l - 1] = s;
          lasr(false, z, l - 1, 2, work.slice(l - 1), work.slice(n - 1 + l - 1));
          d[l - 1] = rt1; d[l] = rt2; e[l - 1] = 0; l += 2; if (l <= lend) continue; break;
        }
        if (jtot === nmaxit) break;
        jtot++;
        let g = (D(l + 1) - p) / (2 * E(l)), r = lapy2(g, 1);
        g = D(m) - p + E(l) / (g + sign(r, g));
        let s = 1, c = 1; p = 0;
        for (let i = m - 1; i >= l; i--) {
          const f = s * E(i), b = c * E(i); [c, s, r] = lartg(g, f);
          if (i !== m - 1) e[i] = r;
          g = D(i + 1) - p; r = (D(i) - g) * s + 2 * c * b; p = s * r; d[i] = g + p; g = c * r - b;
          work[i - 1] = c; work[n - 1 + i - 1] = -s;
        }
        lasr(false, z, l - 1, m - l + 1, work.slice(l - 1), work.slice(n - 1 + l - 1));
        d[l - 1] = D(l) - p; e[l - 1] = g;
      }
    } else {
      // QR iteration.
      for (;;) {
        let mm = lend;
        if (l !== lend) for (let k = l; k >= lend + 1; k--) { const tst = Math.abs(E(k - 1)) ** 2; if (tst <= eps2 * Math.abs(D(k)) * Math.abs(D(k - 1)) + SAFMIN) { mm = k; break; } }
        m = mm; if (m > lend) e[m - 2] = 0;
        let p = D(l);
        if (m === l) { d[l - 1] = p; l--; if (l >= lend) continue; break; }
        if (m === l - 1) {
          const [rt1, rt2, c, s] = laev2(D(l - 1), E(l - 1), D(l)); work[m - 1] = c; work[n - 1 + m - 1] = s;
          lasr(true, z, l - 2, 2, work.slice(m - 1), work.slice(n - 1 + m - 1));
          d[l - 2] = rt1; d[l - 1] = rt2; e[l - 2] = 0; l -= 2; if (l >= lend) continue; break;
        }
        if (jtot === nmaxit) break;
        jtot++;
        let g = (D(l - 1) - p) / (2 * E(l - 1)), r = lapy2(g, 1);
        g = D(m) - p + E(l - 1) / (g + sign(r, g));
        let s = 1, c = 1; p = 0;
        for (let i = m; i <= l - 1; i++) {
          const f = s * E(i), b = c * E(i); [c, s, r] = lartg(g, f);
          if (i !== m) e[i - 2] = r;
          g = D(i) - p; r = (D(i + 1) - g) * s + 2 * c * b; p = s * r; d[i - 1] = g + p; g = c * r - b;
          work[i - 1] = c; work[n - 1 + i - 1] = s;
        }
        lasr(true, z, m - 1, l - m + 1, work.slice(m - 1), work.slice(n - 1 + m - 1));
        d[l - 1] = D(l) - p; e[l - 2] = g;
      }
    }
    if (iscale === 1) scale(ssfmax, anorm, lendsv - lsv, lsv, lendsv - lsv + 1); else if (iscale === 2) scale(ssfmin, anorm, lendsv - lsv, lsv, lendsv - lsv + 1);
    if (jtot >= nmaxit) { if (e.some(value => value !== 0)) throw new RangeError('symmetricEigen: the QL/QR iteration did not converge.'); break outer; }
  }
  // Selection sort, ascending, swapping the vectors with the values.
  for (let i = 0; i < n - 1; i++) {
    let k = i, p = d[i]!; for (let j = i + 1; j < n; j++) if (d[j]! < p) { k = j; p = d[j]!; }
    if (k !== i) { d[k] = d[i]!; d[i] = p; for (const row of z) { const t = row[i]!; row[i] = row[k]!; row[k] = t; } }
  }
  return z;
}
