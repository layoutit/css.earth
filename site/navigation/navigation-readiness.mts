/** Resolve the data a selection needs without letting an older load start a later flight. */
export function createNavigationReadiness<Context>({ context, knownObject, loadObject, systemViewLoaded, loadSystemView }: {
  context(): Promise<Context>;
  knownObject(context: Context, id: string): boolean;
  loadObject(context: Context, id: string): Promise<boolean>;
  systemViewLoaded(context: Context, id: string): boolean;
  loadSystemView(context: Context, id: string): Promise<void>;
}) {
  let latest = 0;
  return {
    async prepare(id: string, needsSystemView: boolean): Promise<Context | null> {
      const intent = ++latest;
      const current = () => intent === latest;
      try {
        const ready = await context();
        if (!current()) return null;
        if (!knownObject(ready, id)) {
          const loaded = await loadObject(ready, id);
          if (!current() || !loaded) return null;
        }
        if (needsSystemView && !systemViewLoaded(ready, id)) {
          await loadSystemView(ready, id);
          if (!current()) return null;
        }
        return ready;
      } catch (error) {
        // A superseded request must not report a failure after its successor starts.
        if (!current()) return null;
        throw error;
      }
    },
    invalidate() { latest++; },
  };
}
