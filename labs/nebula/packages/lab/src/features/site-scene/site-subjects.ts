/** Which lab subject a page's shown bank belongs to: the subject whose plate or site-volume object is that bank, keeping
 * the current one when it is; else the current subject when it shows the page's object, else the first that does. */
export interface SiteSubjectRecord { id: string; plates?: { object: string }; siteVolume?: { object: string }; app?: { object: string } }
export function siteSubjectFor<T extends SiteSubjectRecord>(subjects: readonly T[], pageObjectId: string, bankId: string | null, current: T): T {
  const owns = (subject: T) => bankId !== null && (subject.plates?.object ?? subject.siteVolume?.object) === `src/objects/${bankId}`;
  if (owns(current)) return current;
  const owner = subjects.find(owns);
  if (owner) return owner;
  if (current.app?.object === pageObjectId) return current;
  return subjects.find(subject => subject.app?.object === pageObjectId) ?? current;
}
