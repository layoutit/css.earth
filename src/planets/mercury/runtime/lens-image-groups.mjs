import { decodePreparedImage, releasePreparedImage } from "../../../platform/prepared-image-store.mjs";

// Mercury keeps only its active lens group. Images belong to the group before
// any decode can settle, so a partial failure also retires pending siblings.
export function createMercuryLensImageGroups({ createImage = () => new Image() } = {}) {
  const groups = new Map();
  let destroyed = false;
  function release(id, entry) {
    if (groups.get(id) !== entry) return;
    groups.delete(id);
    entry.retired = true;
    const errors = [];
    for (const image of entry.images.splice(0)) {
      try { releasePreparedImage(image); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Mercury lens image cleanup failed.");
  }
  return Object.freeze({
    load(id, urls) {
      if (destroyed) return Promise.resolve(null);
      const previous = groups.get(id);
      if (previous) return previous.promise;
      const entry = { images: [], retired: false, promise: null };
      groups.set(id, entry);
      try {
        for (const url of urls) {
          const image = createImage();
          image.decoding = "sync";
          entry.images.push(image);
        }
        entry.promise = Promise.all(entry.images.map((image, index) =>
          decodePreparedImage(image, urls[index]))).then((images) =>
          entry.retired ? null : images, (error) => {
          if (entry.retired) return null;
          try { release(id, entry); } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], error.message, { cause: error });
          }
          throw error;
        });
      } catch (error) {
        try { release(id, entry); } catch (cleanupError) {
          return Promise.reject(new AggregateError([error, cleanupError], error.message, { cause: error }));
        }
        return Promise.reject(error);
      }
      return entry.promise;
    },
    retainOnly(ids) {
      const wanted = new Set(ids);
      const errors = [];
      for (const [id, entry] of groups) {
        if (wanted.has(id)) continue;
        try { release(id, entry); } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, "Mercury inactive lens cleanup failed.");
    },
    stats() {
      return Object.freeze({ retainedImageCount: [...groups.values()]
        .reduce((count, entry) => count + entry.images.length, 0) });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      const errors = [];
      for (const [id, entry] of groups) {
        try { release(id, entry); } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, "Mercury lens group cleanup failed.");
    },
  });
}
