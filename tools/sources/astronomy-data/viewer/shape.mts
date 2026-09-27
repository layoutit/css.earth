// What the viewer server sends the page. Rows carry list fields only; the page fetches a row's retained record when it
// is opened, so the first load stays small.
export type ViewerRow = {
  key: string;
  source: string;
  id: string;
  title: string;
  target: string;
  bodies: string[];
  instrument: string;
  count: number;
  decision: string;
  reason: string;
  url: string;
  proposals: string[];
  thumbnail: string;
  size: string;
  date: string;
};
export type ViewerProposal = {
  id: string;
  title: string;
  status: string;
  priority: number;
  nextStep: string;
  blocker: string;
  prUrl: string;
  updatedAt: string;
  bodies: string[];
  writeup: string;
  rows: number;
};
export type ViewerSource = { id: string; label: string };
export type ViewerData = {
  rows: ViewerRow[];
  proposals: ViewerProposal[];
  sources: ViewerSource[];
  labels: Record<string, string>;
};
