export function prepareLensLabels<
  T extends { id: string; label: string; title?: string },
>(
  lenses: { controls: T[] },
  labels: Record<string, string>,
): { controls: Array<T & { label: string }> };
