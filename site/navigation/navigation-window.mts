/** Rows a tree branch shows at once, on the server and when the client materializes a branch.
 *
 * Measured on the iPad (2026-09-29): a star page rendered the Stars section open with all 1,422 rows (4,738 elements,
 * 710 KB of HTML), and opening the object browser there cost a 165 ms restyle frame and a 330 ms composite frame.
 * 48 keeps Saturn's 46 moons whole; only Stars and the Solar System's asteroids exceed it, and their category pills
 * list the rest. */
export const TREE_WINDOW = 48;

export interface TreeWindow<T> { rows: T[]; hidden: number }

/** The branch's rows around `centre` (an index, or -1 for the start), in the branch's own order. */
export function windowRows<T>(children: readonly T[], centre: number): TreeWindow<T> {
  if (children.length <= TREE_WINDOW) return { rows: [...children], hidden: 0 };
  const start = Math.min(Math.max(0, centre - Math.floor(TREE_WINDOW / 2)), children.length - TREE_WINDOW);
  return { rows: children.slice(start, start + TREE_WINDOW), hidden: children.length - TREE_WINDOW };
}

/** The row that stands for the rows a window leaves out. */
export const moreLabel = (hidden: number): string => `${hidden.toLocaleString('en')} more`;
