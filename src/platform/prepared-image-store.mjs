export async function decodePreparedImage(image, selectedUrl) {
  if (typeof selectedUrl !== "string" || !selectedUrl || typeof image?.decode !== "function") {
    throw new TypeError("Prepared image decoding requires an image and selected URL.");
  }
  try {
    image.src = selectedUrl;
    await image.decode();
    if (!(image.naturalWidth > 0 && image.naturalHeight > 0)) {
      throw new Error("Decoded image has no pixels.");
    }
    return image;
  } catch (cause) {
    // The owner may have reused this image slot. Never clear it here.
    throw new Error(`Prepared image did not decode: ${selectedUrl}.`, { cause });
  }
}

export function releasePreparedImage(image) {
  // Test doubles and old image-like owners may not expose removeAttribute.
  if (typeof image.removeAttribute !== "function") { image.src = ""; return; }
  const errors = [];
  for (const attribute of ["srcset", "src"]) {
    try { image.removeAttribute(attribute); } catch (error) { errors.push(error); }
  }
  if (errors.length) throw new AggregateError(errors, "Prepared image release failed.");
}

export function createPreparedImageStore({ createImage = () => new Image(), decoding = "async" } = {}) {
  const entries = new Map();
  let destroyed = false;
  function retire(url, entry) {
    if (entries.get(url) !== entry) return false;
    entries.delete(url);
    entry.retired = true;
    releasePreparedImage(entry.image);
    return true;
  }
  return Object.freeze({
    load(url) {
      if (destroyed) return Promise.resolve(null);
      if (typeof url !== "string" || !url) return Promise.reject(new TypeError("Prepared image URL is missing."));
      const existing = entries.get(url);
      if (existing) return existing.promise;
      let image;
      try {
        image = createImage();
        image.decoding = decoding;
      } catch (error) { return Promise.reject(error); }
      const entry = { image, promise: null, retained: false, retired: false };
      entries.set(url, entry);
      entry.promise = decodePreparedImage(image, url).then((decoded) => {
        if (entry.retired || entries.get(url) !== entry) return null;
        entry.retained = true;
        return decoded;
      }, (error) => {
        if (entry.retired || entries.get(url) !== entry) return null;
        try { retire(url, entry); } catch (cleanupError) {
          throw new AggregateError([error, cleanupError], error.message, { cause: error });
        }
        throw error;
      });
      return entry.promise;
    },
    release(url) {
      const entry = entries.get(url);
      return entry ? retire(url, entry) : false;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      const errors = [];
      for (const [url, entry] of entries) {
        try { retire(url, entry); } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, "Prepared image cleanup failed.");
    },
    stats() {
      let retainedCount = 0;
      for (const entry of entries.values()) if (entry.retained) retainedCount += 1;
      return Object.freeze({ retainedCount, pendingCount: entries.size - retainedCount });
    },
  });
}
