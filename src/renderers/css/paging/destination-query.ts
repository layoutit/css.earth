// Search only prepared labels. Geometry and source normalization are prepared
// by the supplying object; the shell owns input, ranking and retained results.
export function normalizeDestinationQuery(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
