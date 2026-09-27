// What the viewer server sends the page: list fields only, not each row's retained record.
export type ViewerRow = {
  source: string;
  id: string;
  title: string;
  target: string;
  bodies: string[];
  instrument: string;
  decision: string;
  reason: string;
  url: string;
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
  bodies: string[];
  writeup: string;
};
export type ViewerSource = { id: string; label: string };
export type ViewerData = {
  rows: ViewerRow[];
  proposals: ViewerProposal[];
  sources: ViewerSource[];
  labels: Record<string, string>;
  // Per body token: its kind and parent body from packages/astronomy, and its src/objects package id if cssEarth has one.
  catalogue: Record<string, { kind: string; parent: string; object: string }>;
};
