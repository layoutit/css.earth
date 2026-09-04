import assert from "node:assert/strict";
import test from "node:test";
import { createMercuryLensImageGroups } from "../runtime/lens-image-groups.mjs";

function fixture() {
  const images = [];
  const groups = createMercuryLensImageGroups({ createImage() {
    const image = {
      src: "", naturalWidth: 1, naturalHeight: 1,
      decode() { return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); },
      removeAttribute(name) {
        if (name !== "src") return;
        this.releaseAttempts = (this.releaseAttempts ?? 0) + 1;
        if (this.failRelease) throw new Error("release failed");
        this.src = "";
      },
    };
    images.push(image);
    return image;
  } });
  return { images, groups };
}

test("Mercury partial lens failure releases all siblings and retries with independent identity", async () => {
  const { images, groups } = fixture();
  const first = groups.load("interior", ["/outer", "/core", "/section"]);
  assert.equal(groups.load("interior", ["/outer"]), first);
  assert.equal(groups.stats().retainedImageCount, 3);
  images[0].resolve();
  images[1].reject(new Error("core failed"));
  await assert.rejects(first, /Prepared image did not decode: \/core/u);
  assert.ok(images.every(({ src }) => src === ""));
  assert.equal(groups.stats().retainedImageCount, 0);
  const retry = groups.load("interior", ["/outer", "/core", "/section"]);
  images[2].reject(new Error("retired sibling"));
  for (const image of images.slice(3)) image.resolve();
  assert.equal((await retry).length, 3);
  assert.equal(groups.stats().retainedImageCount, 3);
  groups.destroy();
});

test("Mercury retirement and disposal release pending images before late native settlement", async () => {
  const { images, groups } = fixture();
  const first = groups.load("a", ["/a"]);
  groups.retainOnly([]);
  const replacement = groups.load("a", ["/a"]);
  images[0].resolve();
  assert.equal(await first, null);
  assert.equal(images[1].src, "/a");
  groups.destroy();
  assert.equal(images[1].src, "");
  images[1].reject(new Error("destroyed replacement"));
  assert.equal(await replacement, null);
  assert.equal(await groups.load("b", ["/b"]), null);
  assert.equal(images.length, 2);
});

for (const operation of ["retainOnly", "destroy"]) {
  test(`Mercury ${operation} releases all image groups even when one native release throws`, async () => {
    const { images, groups } = fixture();
    const first = groups.load("a", ["/a-1", "/a-2"]);
    const second = groups.load("b", ["/b"]);
    images[0].failRelease = true;
    assert.throws(() => groups[operation]([]), AggregateError);
    assert.ok(images.every((image) => image.releaseAttempts === 1));
    assert.ok(images.slice(1).every((image) => image.src === ""));
    assert.equal(groups.stats().retainedImageCount, 0);
    images.forEach((image) => image.reject(new Error("late decode")));
    assert.deepEqual(await Promise.all([first, second]), [null, null]);
    groups.destroy();
  });
}

test("Mercury partial decode and cleanup failure preserve the primary error and release siblings", async () => {
  const { images, groups } = fixture();
  const first = groups.load("a", ["/a-1", "/a-2"]);
  images[0].failRelease = true;
  images[0].reject(new Error("primary decode failure"));
  await assert.rejects(first, (error) => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.message, /Prepared image did not decode/u);
    assert.equal(error.cause, error.errors[0]);
    return true;
  });
  assert.ok(images.every((image) => image.releaseAttempts === 1));
  images[1].reject(new Error("late sibling"));
  groups.destroy();
});
