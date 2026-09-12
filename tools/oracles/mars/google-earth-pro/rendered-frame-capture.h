// Optional, bounded readback of the renderer's own drawable. No scene replay.
#include <memory>
#include <vector>

static std::atomic<double> RasterDeadline{0};
static std::atomic<unsigned> RasterPending{0};
static std::atomic<uint64_t> RasterIndex{0};
static std::atomic<uint64_t> RasterRevision{0};
static std::atomic<double> RasterLastSample{0};
static dispatch_queue_t RasterQueue = nullptr;
struct RasterReadback {
  GLuint buffer = 0, fence = 0;
  bool pending = false;
  uint64_t index = 0, revision = 0, present = 0, input = 0;
  double timestamp = 0, submissionMilliseconds = 0;
};
static RasterReadback RasterSlots[3];
static int RasterWidth = 0, RasterHeight = 0;
static NSOpenGLContext *RasterContext = nil;

static void WriteRenderedPixels(std::shared_ptr<std::vector<uint8_t>> pixels,
                                RasterReadback sample, int width, int height) {
  RasterPending.fetch_add(1);
  NSString *root = [NSString stringWithUTF8String:getenv("CSSEARTH_ORACLE_FRAME_DIRECTORY")];
  dispatch_async(RasterQueue, ^{
    @autoreleasepool {
      const size_t rowBytes = static_cast<size_t>(width) * 4;
      NSMutableData *ppm = [NSMutableData dataWithData:
        [[NSString stringWithFormat:@"P6\n%d %d\n255\n", width, height]
          dataUsingEncoding:NSASCIIStringEncoding]];
      const size_t headerBytes = ppm.length;
      [ppm increaseLengthBy:static_cast<size_t>(width) * height * 3];
      auto output = static_cast<uint8_t *>(ppm.mutableBytes) + headerBytes;
      for (int y = 0; y < height; y++) {
        const auto input = pixels->data() + (height - y - 1) * rowBytes;
        for (int x = 0; x < width; x++) {
          *output++ = input[x * 4 + 2];
          *output++ = input[x * 4 + 1];
          *output++ = input[x * 4];
        }
      }
      NSString *path = [root stringByAppendingPathComponent:
        [NSString stringWithFormat:@"frame_%06llu.ppm", sample.index]];
      BOOL saved = [ppm writeToFile:path atomically:YES];
      AppendEvent(@{ @"event": saved ? @"rendered-frame" : @"rendered-frame-write-failed",
        @"index": @(sample.index), @"revision": @(sample.revision),
        @"presentIndex": @(sample.present), @"inputSerial": @(sample.input),
        @"monotonicSeconds": @(sample.timestamp),
        @"readbackMilliseconds": @(sample.submissionMilliseconds),
        @"width": @(width), @"height": @(height), @"path": path });
      RasterPending.fetch_sub(1);
    }
  });
}

static void ArmRenderedFrames(uint64_t revision, double milliseconds) {
  const char *root = getenv("CSSEARTH_ORACLE_FRAME_DIRECTORY");
  if (root == nullptr || root[0] == '\0' || !isfinite(milliseconds) ||
      milliseconds <= 0 || milliseconds > 8000) return;
  if (RasterQueue == nullptr) RasterQueue = dispatch_queue_create(
    "dev.polycss.rendered-frame-writer", DISPATCH_QUEUE_SERIAL);
  RasterRevision.store(revision);
  RasterDeadline.store([NSProcessInfo processInfo].systemUptime + milliseconds / 1000);
}

static void DrainRenderedFrames(void) {
  RasterDeadline.store(0);
  if (RasterQueue != nullptr) dispatch_sync(RasterQueue, ^{});
}

static void CaptureRenderedFrame(NSOpenGLContext *context, uint64_t presentIndex,
                                uint64_t inputSerial) {
  const double deadline = RasterDeadline.load();
  if (deadline == 0 || [NSOpenGLContext currentContext] != context) return;
  const double timestamp = [NSProcessInfo processInfo].systemUptime;
  if (timestamp > deadline + 0.5) return;
  double last = RasterLastSample.load();
  if (timestamp - last < 1.0 / 60) return;
  GLint viewport[4] = {};
  glGetIntegerv(GL_VIEWPORT, viewport);
  int width = viewport[2], height = viewport[3];
  const char *crop = getenv("CSSEARTH_ORACLE_FRAME_CROP");
  if (crop != nullptr) {
    int x = 0, y = 0, w = 0, h = 0;
    if (sscanf(crop, "%d,%d,%d,%d", &x, &y, &w, &h) != 4 ||
        x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > width || y + h > height) return;
    viewport[0] += x; viewport[1] += height - y - h;
    width = w; height = h;
  }
  if (width < 320 || height < 200 || width > 2048 || height > 2048) return;
  if (!RasterLastSample.compare_exchange_strong(last, timestamp)) return;
  if (RasterContext != nil && (context != RasterContext || width != RasterWidth || height != RasterHeight)) {
    AppendEvent(@{ @"event": @"rendered-frame-invalid-drawable" });
    RasterDeadline.store(0);
    return;
  }
  const size_t rowBytes = static_cast<size_t>(width) * 4;
  GLint alignment = 0, rowLength = 0, skipRows = 0, skipPixels = 0, packBuffer = 0;
  glGetIntegerv(GL_PACK_ALIGNMENT, &alignment);
  glGetIntegerv(GL_PACK_ROW_LENGTH, &rowLength);
  glGetIntegerv(GL_PACK_SKIP_ROWS, &skipRows);
  glGetIntegerv(GL_PACK_SKIP_PIXELS, &skipPixels);
  glGetIntegerv(GL_PIXEL_PACK_BUFFER_BINDING, &packBuffer);
  if (RasterContext == nil) {
    RasterContext = context; RasterWidth = width; RasterHeight = height;
    for (auto &slot : RasterSlots) {
      glGenBuffers(1, &slot.buffer); glGenFencesAPPLE(1, &slot.fence);
      glBindBuffer(GL_PIXEL_PACK_BUFFER, slot.buffer);
      glBufferData(GL_PIXEL_PACK_BUFFER, rowBytes * height, nullptr, GL_STREAM_READ);
    }
  }
  const double mapStarted = [NSProcessInfo processInfo].systemUptime;
  for (auto &slot : RasterSlots) {
    if (!slot.pending || RasterPending.load() >= 3 || !glTestFenceAPPLE(slot.fence)) continue;
    glBindBuffer(GL_PIXEL_PACK_BUFFER, slot.buffer);
    auto pixels = std::make_shared<std::vector<uint8_t>>(rowBytes * height);
    glGetBufferSubData(GL_PIXEL_PACK_BUFFER, 0, pixels->size(), pixels->data());
    WriteRenderedPixels(pixels, slot, width, height);
    slot.pending = false;
  }
  glBindBuffer(GL_PIXEL_PACK_BUFFER, packBuffer);
  const double mapEnded = [NSProcessInfo processInfo].systemUptime;
  if (timestamp > deadline) return;
  const uint64_t index = RasterIndex.fetch_add(1);
  const uint64_t revision = RasterRevision.load();
  RasterReadback *available = nullptr;
  for (auto &slot : RasterSlots) if (!slot.pending) { available = &slot; break; }
  if (available == nullptr) {
    AppendEvent(@{ @"event": @"rendered-frame-dropped", @"index": @(index),
      @"revision": @(revision), @"monotonicSeconds": @(timestamp) });
    return;
  }
  glBindBuffer(GL_PIXEL_PACK_BUFFER, available->buffer);
  glPixelStorei(GL_PACK_ALIGNMENT, 1);
  glPixelStorei(GL_PACK_ROW_LENGTH, 0);
  glPixelStorei(GL_PACK_SKIP_ROWS, 0);
  glPixelStorei(GL_PACK_SKIP_PIXELS, 0);
  glReadPixels(viewport[0], viewport[1], width, height,
    GL_BGRA, GL_UNSIGNED_INT_8_8_8_8_REV, nullptr);
  glSetFenceAPPLE(available->fence);
  glPixelStorei(GL_PACK_ALIGNMENT, alignment);
  glPixelStorei(GL_PACK_ROW_LENGTH, rowLength);
  glPixelStorei(GL_PACK_SKIP_ROWS, skipRows);
  glPixelStorei(GL_PACK_SKIP_PIXELS, skipPixels);
  glBindBuffer(GL_PIXEL_PACK_BUFFER, packBuffer);
  const double readbackEnded = [NSProcessInfo processInfo].systemUptime;
  AppendEvent(@{ @"event": @"rendered-readback-cost", @"index": @(index),
    @"mapMilliseconds": @((mapEnded - mapStarted) * 1000),
    @"submitMilliseconds": @((readbackEnded - mapEnded) * 1000) });
  available->pending = true;
  available->index = index; available->revision = revision;
  available->present = presentIndex; available->input = inputSerial;
  available->timestamp = timestamp;
  available->submissionMilliseconds = (readbackEnded - timestamp) * 1000;
  // An offline input-step capture must retain the last drawable even if the
  // renderer stops presenting. Read this same submitted buffer before return;
  // do not create another render or move the context to another thread.
  if (getenv("CSSEARTH_ORACLE_SYNCHRONOUS_FRAMES") != nullptr) {
    glBindBuffer(GL_PIXEL_PACK_BUFFER, available->buffer);
    auto pixels = std::make_shared<std::vector<uint8_t>>(rowBytes * height);
    glGetBufferSubData(GL_PIXEL_PACK_BUFFER, 0, pixels->size(), pixels->data());
    glBindBuffer(GL_PIXEL_PACK_BUFFER, packBuffer);
    available->submissionMilliseconds =
      ([NSProcessInfo processInfo].systemUptime - timestamp) * 1000;
    WriteRenderedPixels(pixels, *available, width, height);
    available->pending = false;
  }
}

