/** CSS pixel bounds relative to the viewport centre; positive y points down. */
export interface LabelScreenRect {
  readonly left: number; readonly top: number; readonly right: number; readonly bottom: number;
}

/** Keep a small gap between the actual laid-out text boxes, including at contact. */
export function labelRectsOverlap(a: LabelScreenRect, b: LabelScreenRect, paddingPx = 3): boolean {
  return a.left <= b.right + paddingPx && a.right + paddingPx >= b.left &&
    a.top <= b.bottom + paddingPx && a.bottom + paddingPx >= b.top;
}
