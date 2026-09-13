/** Shared by preparation and the card: dataset identity is separate from UI categories and explanatory copy. */
export interface DatasetText { readonly id: string; readonly title?: string; readonly label?: string; readonly summary?: string; }
export function validateDatasetText(lens: DatasetText) {
  const title = lens.title?.trim();
  const summary = lens.summary?.trim();
  if (!title || title.length > 120 || /[\r\n]/u.test(title)
      || title.toLocaleLowerCase() === lens.label?.trim().toLocaleLowerCase() || title === summary) {
    throw new TypeError(`${lens.id}: provide a specific dataset title, separate from its category and summary.`);
  }
  if (!summary) throw new TypeError(`${lens.id}: provide a dataset summary.`);
  return { title, summary };
}
