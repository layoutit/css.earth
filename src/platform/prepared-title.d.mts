export function createPreparedTitleLayout(source: {
  readonly viewBox: string;
  readonly width: number;
  readonly height: number;
  readonly baseline: number;
}): {
  readonly renderViewBox: string;
  readonly renderWidth: number;
  readonly renderHeight: number;
  readonly renderPathOffsetY: number;
};
