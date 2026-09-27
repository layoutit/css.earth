// Proposed decisions for Photojournal map entries the ledger has not reviewed. Each reason is built from the entry's own
// evidence (what chose it, its instrument, date and largest file), never one sentence copied across rows. Rules suggest a
// scope; they do not replace reading the product before it is used.
export type PhotojournalEntry = {
  post: number; pia: string; title: string; date: string; page: string; target: string; mission: string; instrument: string;
  titleMatch: boolean; captionPhrases: string[]; files: { url: string; mime: string; width: number | null; height: number | null; bytes: number | null }[];
};
export function photojournalEvidence(e: PhotojournalEntry): string {
  const chose = e.captionPhrases.length ? `caption states "${e.captionPhrases.join('", "')}"` : `title names a map ("${e.title}")`;
  const largest = [...e.files].sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))[0];
  const size = largest?.width && largest.height ? `, ${largest.width} × ${largest.height} px` : "";
  return `${e.pia} (${e.date}${e.instrument ? `, ${e.instrument}` : ""}${size}): ${chose}`;
}
export function reviewPhotojournal(e: PhotojournalEntry): { decision: string; reason: string } {
  // The Photojournal tags a body with its parents too ("sun; venus", "enceladus; saturn"); the Sun is named only when it is
  // the only body tagged.
  const tagged = e.target.split("; ").filter(Boolean), bodies = tagged.length > 1 ? tagged.filter((t) => t !== "sun") : tagged;
  const evidence = photojournalEvidence(e), title = e.title.toLowerCase(), target = bodies.join(" / ");
  if (/\b(artist'?s?|artist’s|concept|illustration|rendering|animation)\b/.test(title))
    return { decision: "not-data-input", reason: `Illustration, not an observation. ${evidence}.` };
  if (/\b(rocket|launch|atlas v|centaur|fairing|hoist(?:ed|ing)?|clean room|assembly)\b/.test(title))
    return { decision: "not-data-input", reason: `Launch or spacecraft hardware photograph, not a map of a body. ${evidence}.` };
  if (bodies.length === 1 && bodies[0] === "mars")
    return { decision: "deferred-scope", reason: `Mars is outside this audit's requested scope; retained for future Mars work. ${evidence}.` };
  return { decision: "needs-review", reason: `${evidence}. Not yet compared with ${target || "its target"}'s current inputs.` };
}
