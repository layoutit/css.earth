export function supportRuns(support: Uint32Array) {
  const runs: number[] = [];
  let start = -1, previous = -2;
  for (const pixel of support) {
    if (pixel !== previous + 1) {
      if (start >= 0) runs.push(start, previous - start + 1);
      start = pixel;
    }
    previous = pixel;
  }
  if (start >= 0) runs.push(start, previous - start + 1);
  return runs;
}
