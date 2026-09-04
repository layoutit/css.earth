#import <Cocoa/Cocoa.h>
#import <CoreGraphics/CoreGraphics.h>
#import <OpenGL/gl.h>
#import <objc/runtime.h>

#include <atomic>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <dlfcn.h>
#include <fcntl.h>
#include <math.h>
#include <mach-o/dyld.h>
#include <mach-o/loader.h>
#include <mach-o/nlist.h>
#include <mach/mach.h>
#include <mach/mach_time.h>
#include <pthread.h>
#include <string>
#include <unistd.h>

static void AppendEvent(NSDictionary *event);

namespace {

static void WriteAll(int descriptor, const void *bytes, size_t byteCount);
using ShaderSourceFunction = void (*)(
  GLuint, GLsizei, const GLchar *const *, const GLint *);
using DlsymFunction = void *(*)(void *, const char *);
using CompileShaderFunction = void (*)(GLuint);
using AttachShaderFunction = void (*)(GLuint, GLuint);
using LinkProgramFunction = void (*)(GLuint);
using GetShaderivFunction = void (*)(GLuint, GLenum, GLint *);
using GetShaderInfoLogFunction = void (*)(GLuint, GLsizei, GLsizei *, GLchar *);
using GetProgramivFunction = void (*)(GLuint, GLenum, GLint *);
using GetProgramInfoLogFunction = void (*)(GLuint, GLsizei, GLsizei *, GLchar *);
using GetUniformLocationFunction = GLint (*)(GLuint, const GLchar *);
static ShaderSourceFunction OriginalShaderSource = nullptr;
static DlsymFunction OriginalDlsym = nullptr;
static CompileShaderFunction OriginalCompileShader = nullptr;
static AttachShaderFunction OriginalAttachShader = nullptr;
static LinkProgramFunction OriginalLinkProgram = nullptr;
static GetShaderivFunction OriginalGetShaderiv = nullptr;
static GetShaderInfoLogFunction OriginalGetShaderInfoLog = nullptr;
static GetProgramivFunction OriginalGetProgramiv = nullptr;
static GetProgramInfoLogFunction OriginalGetProgramInfoLog = nullptr;
static GetUniformLocationFunction OriginalGetUniformLocation = nullptr;

static void AppendCalibrationShaderLog(const char *line) {
  const char *logPath = getenv("CSSMARS_ORACLE_CALIBRATION_SHADER_LOG");
  if (logPath == nullptr || logPath[0] == '\0' || line == nullptr) return;
  const int descriptor = open(logPath, O_WRONLY | O_CREAT | O_APPEND, 0600);
  if (descriptor < 0) return;
  WriteAll(descriptor, line, strlen(line));
  close(descriptor);
}

static std::string ReplaceAll(
    std::string source,
    const std::string &needle,
    const std::string &replacement) {
  size_t offset = 0;
  while ((offset = source.find(needle, offset)) != std::string::npos) {
    source.replace(offset, needle.size(), replacement);
    offset += replacement.size();
  }
  return source;
}

static std::string PatchCalibrationShader(std::string source) {
  if (getenv("CSSMARS_ORACLE_CALIBRATION_SHADER") == nullptr) return source;
  const bool vertex = source.find("attribute vec3 ig_Normal") !=
    std::string::npos;
  const bool fragment = source.find("sampler2D groundTexture") !=
    std::string::npos;
  if (!vertex && !fragment) return source;
  const size_t mainOffset = source.rfind("void main()");
  if (mainOffset == std::string::npos) return source;
  if (vertex) {
    source.insert(
      mainOffset,
      "varying highp vec3 cssmars_calibration_position;\n");
    const size_t patchedMainOffset = source.rfind("void main()");
    const size_t brace = source.find('{', patchedMainOffset);
    if (brace != std::string::npos) {
      source.insert(
        brace + 1,
        "\n  cssmars_calibration_position = igv_Vertex.xyz;\n");
    }
  } else {
    source.insert(
      mainOffset,
      "varying highp vec3 cssmars_calibration_position;\n"
      "uniform sampler2D cssmars_calibration_texture;\n"
      "const highp float cssmars_pi = 3.14159265358979323846;\n"
      "vec2 cssmars_calibration_uv(vec3 input_normal) {\n"
      "  vec3 normal = normalize(input_normal);\n"
      "  float longitude = atan(normal.y, normal.x);\n"
      "  float latitude = asin(clamp(normal.z, -1.0, 1.0));\n"
      "  return vec2(longitude / (2.0 * cssmars_pi) + 0.5, "
      "0.5 - latitude / cssmars_pi);\n"
      "}\n");
    const size_t finalBrace = source.rfind('}');
    if (finalBrace != std::string::npos && finalBrace > mainOffset) {
      source.insert(
        finalBrace,
        "  vec4 cssmars_calibration_color = texture2D(\n"
        "    cssmars_calibration_texture,\n"
        "    cssmars_calibration_uv(cssmars_calibration_position));\n"
        "  gl_FragColor = cssmars_calibration_color;\n");
    }
  }
  return source;
}

extern "C" void CSSMarsCalibrationShaderSource(
    GLuint shader,
    GLsizei count,
    const GLchar *const *strings,
    const GLint *lengths) {
  if (OriginalShaderSource == nullptr || strings == nullptr || count <= 0) {
    return;
  }
  std::string source;
  for (GLsizei index = 0; index < count; index += 1) {
    if (strings[index] == nullptr) continue;
    if (lengths != nullptr && lengths[index] >= 0) {
      source.append(strings[index], static_cast<size_t>(lengths[index]));
    } else {
      source.append(strings[index]);
    }
  }
  const std::string patched = PatchCalibrationShader(source);
  if (patched != source) {
    const char *kind = source.find("attribute vec3 ig_Normal") !=
      std::string::npos ? "vertex" : "fragment";
    char line[256];
    snprintf(
      line,
      sizeof(line),
      "shader=%u\tkind=%s\tsourceBytes=%zu\tpatchedBytes=%zu\n",
      shader,
      kind,
      source.size(),
      patched.size());
    AppendCalibrationShaderLog(line);
  }
  const GLchar *patchedString = patched.c_str();
  const GLint patchedLength = static_cast<GLint>(patched.size());
  OriginalShaderSource(shader, 1, &patchedString, &patchedLength);
}

extern "C" void CSSMarsCalibrationCompileShader(GLuint shader) {
  if (OriginalCompileShader == nullptr) return;
  OriginalCompileShader(shader);
  if (OriginalGetShaderiv == nullptr && OriginalDlsym != nullptr) {
    OriginalGetShaderiv = reinterpret_cast<GetShaderivFunction>(
      OriginalDlsym(RTLD_DEFAULT, "glGetShaderiv"));
  }
  if (OriginalGetShaderInfoLog == nullptr && OriginalDlsym != nullptr) {
    OriginalGetShaderInfoLog = reinterpret_cast<GetShaderInfoLogFunction>(
      OriginalDlsym(RTLD_DEFAULT, "glGetShaderInfoLog"));
  }
  GLint compiled = 0;
  if (OriginalGetShaderiv != nullptr) {
    OriginalGetShaderiv(shader, GL_COMPILE_STATUS, &compiled);
  }
  char message[1024] = {};
  if (!compiled && OriginalGetShaderInfoLog != nullptr) {
    OriginalGetShaderInfoLog(shader, sizeof(message) - 1, nullptr, message);
  }
  char line[1400];
  snprintf(
    line,
    sizeof(line),
    "shader=%u\tkind=compile\tok=%d\tmessage=%s\n",
    shader,
    compiled,
    message);
  AppendCalibrationShaderLog(line);
}

extern "C" void CSSMarsCalibrationAttachShader(GLuint program, GLuint shader) {
  if (OriginalAttachShader == nullptr) return;
  OriginalAttachShader(program, shader);
  char line[256];
  snprintf(
    line,
    sizeof(line),
    "program=%u\tshader=%u\tkind=attach\n",
    program,
    shader);
  AppendCalibrationShaderLog(line);
}

extern "C" void CSSMarsCalibrationLinkProgram(GLuint program) {
  if (OriginalLinkProgram == nullptr) return;
  OriginalLinkProgram(program);
  if (OriginalGetProgramiv == nullptr && OriginalDlsym != nullptr) {
    OriginalGetProgramiv = reinterpret_cast<GetProgramivFunction>(
      OriginalDlsym(RTLD_DEFAULT, "glGetProgramiv"));
  }
  if (OriginalGetProgramInfoLog == nullptr && OriginalDlsym != nullptr) {
    OriginalGetProgramInfoLog = reinterpret_cast<GetProgramInfoLogFunction>(
      OriginalDlsym(RTLD_DEFAULT, "glGetProgramInfoLog"));
  }
  if (OriginalGetUniformLocation == nullptr && OriginalDlsym != nullptr) {
    OriginalGetUniformLocation = reinterpret_cast<GetUniformLocationFunction>(
      OriginalDlsym(RTLD_DEFAULT, "glGetUniformLocation"));
  }
  GLint linked = 0;
  if (OriginalGetProgramiv != nullptr) {
    OriginalGetProgramiv(program, GL_LINK_STATUS, &linked);
  }
  GLint calibrationUniform = -1;
  if (OriginalGetUniformLocation != nullptr) {
    calibrationUniform = OriginalGetUniformLocation(
      program, "cssmars_calibration_texture");
  }
  char message[1024] = {};
  if (!linked && OriginalGetProgramInfoLog != nullptr) {
    OriginalGetProgramInfoLog(program, sizeof(message) - 1, nullptr, message);
  }
  char line[1400];
  snprintf(
    line,
    sizeof(line),
    "program=%u\tkind=link\tok=%d\tcalibrationUniform=%d\tmessage=%s\n",
    program,
    linked,
    calibrationUniform,
    message);
  AppendCalibrationShaderLog(line);
}

extern "C" void *CSSMarsCalibrationDlsym(void *handle, const char *name) {
  if (OriginalDlsym == nullptr) return nullptr;
  void *resolved = OriginalDlsym(handle, name);
  if (getenv("CSSMARS_ORACLE_CALIBRATION_SHADER") == nullptr ||
      name == nullptr || resolved == nullptr) return resolved;
  if (strcmp(name, "glGetShaderiv") == 0) {
    OriginalGetShaderiv = reinterpret_cast<GetShaderivFunction>(resolved);
  } else if (strcmp(name, "glGetShaderInfoLog") == 0) {
    OriginalGetShaderInfoLog =
      reinterpret_cast<GetShaderInfoLogFunction>(resolved);
  } else if (strcmp(name, "glGetProgramiv") == 0) {
    OriginalGetProgramiv = reinterpret_cast<GetProgramivFunction>(resolved);
  } else if (strcmp(name, "glGetProgramInfoLog") == 0) {
    OriginalGetProgramInfoLog =
      reinterpret_cast<GetProgramInfoLogFunction>(resolved);
  } else if (strcmp(name, "glGetUniformLocation") == 0) {
    OriginalGetUniformLocation =
      reinterpret_cast<GetUniformLocationFunction>(resolved);
  } else if (strcmp(name, "glShaderSource") == 0) {
    OriginalShaderSource = reinterpret_cast<ShaderSourceFunction>(resolved);
    AppendCalibrationShaderLog(
      "shader=0\tkind=resolver\tname=glShaderSource\n");
    return reinterpret_cast<void *>(CSSMarsCalibrationShaderSource);
  } else if (strcmp(name, "glCompileShader") == 0) {
    OriginalCompileShader = reinterpret_cast<CompileShaderFunction>(resolved);
    return reinterpret_cast<void *>(CSSMarsCalibrationCompileShader);
  } else if (strcmp(name, "glAttachShader") == 0) {
    OriginalAttachShader = reinterpret_cast<AttachShaderFunction>(resolved);
    return reinterpret_cast<void *>(CSSMarsCalibrationAttachShader);
  } else if (strcmp(name, "glLinkProgram") == 0) {
    OriginalLinkProgram = reinterpret_cast<LinkProgramFunction>(resolved);
    return reinterpret_cast<void *>(CSSMarsCalibrationLinkProgram);
  }
  return resolved;
}

static bool IsIndirectPointerSection(const section_64 *section) {
  const uint32_t type = section->flags & SECTION_TYPE;
  return type == S_LAZY_SYMBOL_POINTERS ||
    type == S_NON_LAZY_SYMBOL_POINTERS;
}

static void InstallCalibrationShaderInterposition() {
  if (getenv("CSSMARS_ORACLE_CALIBRATION_SHADER") == nullptr) return;
  void *openGl = dlopen(
    "/System/Library/Frameworks/OpenGL.framework/Versions/A/OpenGL",
    RTLD_LAZY | RTLD_LOCAL);
  if (openGl == nullptr) return;
  OriginalShaderSource = reinterpret_cast<ShaderSourceFunction>(
    dlsym(openGl, "glShaderSource"));
  if (OriginalShaderSource == nullptr) return;
  for (uint32_t imageIndex = 0;
       imageIndex < _dyld_image_count();
       imageIndex += 1) {
    const char *imageName = _dyld_get_image_name(imageIndex);
    if (imageName == nullptr ||
        strstr(imageName, "libgoogleearth_pro.dylib") == nullptr) continue;
    const auto *header = reinterpret_cast<const mach_header_64 *>(
      _dyld_get_image_header(imageIndex));
    const intptr_t slide = _dyld_get_image_vmaddr_slide(imageIndex);
    const segment_command_64 *linkEdit = nullptr;
    const symtab_command *symtab = nullptr;
    const dysymtab_command *dysymtab = nullptr;
    const uint8_t *commandBytes = reinterpret_cast<const uint8_t *>(header + 1);
    for (uint32_t commandIndex = 0;
         commandIndex < header->ncmds;
         commandIndex += 1) {
      const auto *command = reinterpret_cast<const load_command *>(commandBytes);
      if (command->cmd == LC_SEGMENT_64) {
        const auto *segment = reinterpret_cast<const segment_command_64 *>(
          commandBytes);
        if (strcmp(segment->segname, SEG_LINKEDIT) == 0) linkEdit = segment;
      } else if (command->cmd == LC_SYMTAB) {
        symtab = reinterpret_cast<const symtab_command *>(commandBytes);
      } else if (command->cmd == LC_DYSYMTAB) {
        dysymtab = reinterpret_cast<const dysymtab_command *>(commandBytes);
      }
      commandBytes += command->cmdsize;
    }
    if (linkEdit == nullptr || symtab == nullptr || dysymtab == nullptr) return;
    const uintptr_t linkEditBase = static_cast<uintptr_t>(slide) +
      linkEdit->vmaddr - linkEdit->fileoff;
    const auto *symbols = reinterpret_cast<const nlist_64 *>(
      linkEditBase + symtab->symoff);
    const char *strings = reinterpret_cast<const char *>(
      linkEditBase + symtab->stroff);
    const auto *indirect = reinterpret_cast<const uint32_t *>(
      linkEditBase + dysymtab->indirectsymoff);
    const uint8_t *segments = reinterpret_cast<const uint8_t *>(header + 1);
    for (uint32_t commandIndex = 0;
         commandIndex < header->ncmds;
         commandIndex += 1) {
      const auto *command = reinterpret_cast<const load_command *>(segments);
      if (command->cmd == LC_SEGMENT_64) {
        const auto *segment = reinterpret_cast<const segment_command_64 *>(
          segments);
        const auto *section = reinterpret_cast<const section_64 *>(segment + 1);
        for (uint32_t sectionIndex = 0;
             sectionIndex < segment->nsects;
             sectionIndex += 1) {
          if (!IsIndirectPointerSection(&section[sectionIndex])) continue;
          auto bindings = reinterpret_cast<uintptr_t *>(
            slide + section[sectionIndex].addr);
          const size_t count = section[sectionIndex].size / sizeof(uintptr_t);
          const vm_size_t pageSize = static_cast<vm_size_t>(getpagesize());
          const vm_address_t page =
            reinterpret_cast<uintptr_t>(bindings) & ~(pageSize - 1);
          const vm_size_t length = static_cast<vm_size_t>(
            reinterpret_cast<uintptr_t>(bindings) +
            count * sizeof(uintptr_t) - page + pageSize - 1) & ~(pageSize - 1);
          vm_protect(
            mach_task_self(), page, length, false,
            VM_PROT_READ | VM_PROT_WRITE | VM_PROT_COPY);
          for (size_t bindingIndex = 0; bindingIndex < count; bindingIndex += 1) {
            const uint32_t symbolIndex = indirect[
              section[sectionIndex].reserved1 + bindingIndex];
            if (symbolIndex == INDIRECT_SYMBOL_ABS ||
                symbolIndex == INDIRECT_SYMBOL_LOCAL ||
                symbolIndex == (INDIRECT_SYMBOL_LOCAL | INDIRECT_SYMBOL_ABS)) {
              continue;
            }
            const char *name = strings + symbols[symbolIndex].n_un.n_strx;
            if (strcmp(name, "_glShaderSource") == 0) {
              bindings[bindingIndex] = reinterpret_cast<uintptr_t>(
                CSSMarsCalibrationShaderSource);
            } else if (strcmp(name, "_dlsym") == 0) {
              if (OriginalDlsym == nullptr) {
                OriginalDlsym = reinterpret_cast<DlsymFunction>(
                  bindings[bindingIndex]);
              }
              bindings[bindingIndex] = reinterpret_cast<uintptr_t>(
                CSSMarsCalibrationDlsym);
            }
          }
        }
      }
      segments += command->cmdsize;
    }
  }
}

enum class InputPhase : uint8_t {
  kIdle = 0,
  kMove = 1,
  kDragHeld = 2,
  kPostRelease = 3,
  kWheel = 4,
  kDoubleClick = 5,
};

#pragma pack(push, 1)
struct MotionTraceHeader {
  char magic[8];
  uint32_t version;
  uint32_t headerSize;
  uint32_t recordSize;
  uint32_t flags;
  uint32_t timebaseNumerator;
  uint32_t timebaseDenominator;
  uint64_t ringCapacity;
};

struct MotionFrame {
  uint64_t frameSequence;
  uint64_t inputSerial;
  uint64_t inputRevision;
  uint64_t inputIdentifierHash;
  uint64_t presentStartedTicks;
  uint64_t presentEndedTicks;
  uint64_t instrumentationEndedTicks;
  uint64_t threadId;
  uint64_t context;
  int32_t viewport[4];
  float modelView[16];
  float projection[16];
  uint8_t inputPhase;
  uint8_t currentContext;
  uint8_t matricesCaptured;
  uint8_t reserved;
};
#pragma pack(pop)

static_assert(sizeof(MotionTraceHeader) == 40);
static_assert(sizeof(MotionFrame) == 220);

using FlushBufferFunction = void (*)(id, SEL);

static constexpr size_t kMotionFrameCapacity = 8192;
static MotionFrame MotionFrames[kMotionFrameCapacity] = {};
static pthread_mutex_t MotionFrameLock = PTHREAD_MUTEX_INITIALIZER;
static uint64_t MotionWriteCursor = 0;
static uint64_t MotionReadCursor = 0;
static uint64_t MotionDroppedFrames = 0;
static std::atomic<uint64_t> MotionFrameSequence{0};
static std::atomic<uint64_t> CurrentInputSerial{0};
static std::atomic<uint64_t> CurrentInputRevision{0};
static std::atomic<uint64_t> CurrentInputIdentifierHash{0};
static std::atomic<uint8_t> CurrentInputPhase{
  static_cast<uint8_t>(InputPhase::kIdle)};
static FlushBufferFunction OriginalFlushBuffer = nullptr;
static int MotionTraceDescriptor = -1;
static bool MotionTraceCapturesMatrices = false;
static dispatch_queue_t MotionTraceDrainQueue = nullptr;
static std::atomic<bool> MotionTraceActive{false};

static void WriteAll(int descriptor, const void *bytes, size_t byteCount) {
  const char *cursor = reinterpret_cast<const char *>(bytes);
  size_t remaining = byteCount;
  while (remaining > 0) {
    ssize_t written = write(descriptor, cursor, remaining);
    if (written <= 0) return;
    cursor += written;
    remaining -= static_cast<size_t>(written);
  }
}

static void DrainMotionFrames(void) {
  if (MotionTraceDescriptor < 0) return;
  MotionFrame batch[512];
  while (true) {
    size_t batchCount = 0;
    pthread_mutex_lock(&MotionFrameLock);
    while (MotionReadCursor < MotionWriteCursor &&
           batchCount < sizeof(batch) / sizeof(batch[0])) {
      batch[batchCount++] =
        MotionFrames[MotionReadCursor % kMotionFrameCapacity];
      MotionReadCursor += 1;
    }
    pthread_mutex_unlock(&MotionFrameLock);
    if (batchCount == 0) return;
    WriteAll(MotionTraceDescriptor, batch, batchCount * sizeof(MotionFrame));
  }
}

static void ScheduleMotionFrameDrain(void) {
  if (MotionTraceDrainQueue == nullptr) return;
  dispatch_after(
    dispatch_time(DISPATCH_TIME_NOW, 50 * NSEC_PER_MSEC),
    MotionTraceDrainQueue,
    ^{
      DrainMotionFrames();
      if (MotionTraceActive.load(std::memory_order_acquire)) {
        ScheduleMotionFrameDrain();
      }
    });
}

static void RecordMotionFrame(NSOpenGLContext *context, SEL command) {
  if (!MotionTraceActive.load(std::memory_order_acquire)) {
    OriginalFlushBuffer(context, command);
    return;
  }
  MotionFrame frame = {};
  frame.frameSequence = MotionFrameSequence.fetch_add(
    1, std::memory_order_relaxed) + 1;
  frame.inputSerial = CurrentInputSerial.load(std::memory_order_acquire);
  frame.inputRevision = CurrentInputRevision.load(std::memory_order_acquire);
  frame.inputIdentifierHash =
    CurrentInputIdentifierHash.load(std::memory_order_acquire);
  frame.inputPhase = CurrentInputPhase.load(std::memory_order_acquire);
  frame.presentStartedTicks = mach_continuous_time();
  frame.context = reinterpret_cast<uint64_t>((__bridge void *)context);
  pthread_threadid_np(nullptr, &frame.threadId);
  frame.currentContext = [NSOpenGLContext currentContext] == context;
  frame.matricesCaptured = MotionTraceCapturesMatrices && frame.currentContext;
  if (frame.matricesCaptured) {
    glGetIntegerv(GL_VIEWPORT, frame.viewport);
    glGetFloatv(GL_MODELVIEW_MATRIX, frame.modelView);
    glGetFloatv(GL_PROJECTION_MATRIX, frame.projection);
  }
  frame.instrumentationEndedTicks = mach_continuous_time();
  OriginalFlushBuffer(context, command);
  frame.presentEndedTicks = mach_continuous_time();
  if (!MotionTraceActive.load(std::memory_order_acquire)) return;

  pthread_mutex_lock(&MotionFrameLock);
  if (MotionWriteCursor - MotionReadCursor >= kMotionFrameCapacity) {
    MotionDroppedFrames += 1;
  } else {
    MotionFrames[MotionWriteCursor % kMotionFrameCapacity] = frame;
    MotionWriteCursor += 1;
  }
  pthread_mutex_unlock(&MotionFrameLock);
}

static void StopMotionFrameTrace(void) {
  if (MotionTraceDescriptor < 0) return;
  MotionTraceActive.store(false, std::memory_order_release);
  Method method = class_getInstanceMethod(
    [NSOpenGLContext class], @selector(flushBuffer));
  if (method != nullptr && OriginalFlushBuffer != nullptr) {
    method_setImplementation(method, reinterpret_cast<IMP>(OriginalFlushBuffer));
  }
  if (MotionTraceDrainQueue != nullptr) {
    dispatch_sync(MotionTraceDrainQueue, ^{ DrainMotionFrames(); });
  } else {
    DrainMotionFrames();
  }
  if (MotionTraceDescriptor >= 0) {
    close(MotionTraceDescriptor);
    MotionTraceDescriptor = -1;
  }
}

static BOOL InstallMotionFrameTrace(void) {
  const char *path = getenv("CSSMARS_ORACLE_MOTION_TRACE");
  if (path == nullptr || path[0] == '\0') return NO;
  const char *detail = getenv("CSSMARS_ORACLE_MOTION_TRACE_DETAIL");
  MotionTraceCapturesMatrices =
    detail == nullptr || strcmp(detail, "present-only") != 0;
  MotionTraceDescriptor = open(path, O_CREAT | O_TRUNC | O_WRONLY, 0644);
  if (MotionTraceDescriptor < 0) return NO;
  Method method = class_getInstanceMethod(
    [NSOpenGLContext class], @selector(flushBuffer));
  if (method == nullptr) {
    close(MotionTraceDescriptor);
    MotionTraceDescriptor = -1;
    return NO;
  }
  OriginalFlushBuffer = reinterpret_cast<FlushBufferFunction>(
    method_getImplementation(method));
  method_setImplementation(method, reinterpret_cast<IMP>(RecordMotionFrame));
  mach_timebase_info_data_t timebase = {};
  mach_timebase_info(&timebase);
  MotionTraceHeader header = {
    {'C', 'S', 'M', 'O', 'T', 'N', '2', '\0'},
    2,
    static_cast<uint32_t>(sizeof(MotionTraceHeader)),
    static_cast<uint32_t>(sizeof(MotionFrame)),
    MotionTraceCapturesMatrices ? 1U : 0U,
    timebase.numer,
    timebase.denom,
    kMotionFrameCapacity,
  };
  WriteAll(MotionTraceDescriptor, &header, sizeof(header));
  MotionTraceDrainQueue = dispatch_queue_create(
    "dev.polycss.google-earth-motion-trace", DISPATCH_QUEUE_SERIAL);
  MotionTraceActive.store(true, std::memory_order_release);
  ScheduleMotionFrameDrain();
  atexit(StopMotionFrameTrace);
  return YES;
}

static uint64_t InputIdentifierHash(NSString *identifier) {
  const unsigned char *bytes = reinterpret_cast<const unsigned char *>(
    identifier.UTF8String);
  uint64_t value = 1469598103934665603ULL;
  if (bytes == nullptr) return value;
  while (*bytes != '\0') {
    value ^= *bytes;
    value *= 1099511628211ULL;
    bytes += 1;
  }
  return value;
}

static InputPhase PhaseForInput(NSString *kind, NSEvent *event) {
  if (([kind isEqualToString:@"down"] || [kind isEqualToString:@"up"]) &&
      event.clickCount == 2) {
    return InputPhase::kDoubleClick;
  }
  if ([kind isEqualToString:@"down"] || [kind isEqualToString:@"drag"]) {
    return InputPhase::kDragHeld;
  }
  if ([kind isEqualToString:@"up"]) return InputPhase::kPostRelease;
  if ([kind isEqualToString:@"wheel"]) return InputPhase::kWheel;
  if ([kind isEqualToString:@"move"]) return InputPhase::kMove;
  return InputPhase::kIdle;
}

}  // namespace

struct QtArrayData {
  int referenceCount;
  int size;
  unsigned int allocation;
  long offset;
};

class QtByteArray {
 public:
  QtArrayData *data;
  ~QtByteArray() {}
};

class QString {
 public:
  void *data;
  ~QString() {}
  QtByteArray toUtf8() const;
};

class QMetaObject {
 public:
  const char *className() const;
};

class QObject {
 public:
  QString objectName() const;
  const QMetaObject *metaObject() const;
};

template <typename Value>
class QtList {
 public:
  struct Data {
    int referenceCount;
    int allocation;
    int begin;
    int end;
    void *values[1];
  };
  Data *data;
  ~QtList() {}
  int size() const { return data == nullptr ? 0 : data->end - data->begin; }
  Value at(int index) const {
    return reinterpret_cast<Value>(data->values[data->begin + index]);
  }
};

class QAction : public QObject {
 public:
  enum ActionEvent { Trigger = 0, Hover = 1 };
  QString text() const;
  bool isEnabled() const;
  bool isChecked() const;
  void activate(ActionEvent event);
};

class QWidget : public QObject {
 public:
  QtList<QAction *> actions() const;
};

class QApplication {
 public:
  static QtList<QWidget *> allWidgets();
};

static NSString *QtString(QString value) {
  QtByteArray utf8 = value.toUtf8();
  if (utf8.data == nullptr || utf8.data->size <= 0) return @"";
  const char *bytes = reinterpret_cast<const char *>(utf8.data) +
    utf8.data->offset;
  return [[NSString alloc] initWithBytes:bytes
                                  length:(NSUInteger)utf8.data->size
                                encoding:NSUTF8StringEncoding] ?: @"";
}

static NSString *NormalizedActionTitle(NSString *title) {
  return [[title stringByReplacingOccurrencesOfString:@"&" withString:@""]
    stringByTrimmingCharactersInSet:
      [NSCharacterSet whitespaceAndNewlineCharacterSet]];
}

static NSArray *QtActions(void) {
  NSMutableArray *result = [NSMutableArray array];
  NSMutableSet *seen = [NSMutableSet set];
  QtList<QWidget *> widgets = QApplication::allWidgets();
  for (int widgetIndex = 0; widgetIndex < widgets.size(); widgetIndex += 1) {
    QWidget *widget = widgets.at(widgetIndex);
    if (widget == nullptr) continue;
    QtList<QAction *> actions = widget->actions();
    for (int actionIndex = 0; actionIndex < actions.size(); actionIndex += 1) {
      QAction *action = actions.at(actionIndex);
      if (action == nullptr) continue;
      NSString *pointer = [NSString stringWithFormat:@"%p", action];
      if ([seen containsObject:pointer]) continue;
      [seen addObject:pointer];
      NSString *title = QtString(action->text());
      NSString *objectName = QtString(action->objectName());
      const QMetaObject *metaObject = action->metaObject();
      NSString *className = metaObject == nullptr
        ? @""
        : [NSString stringWithUTF8String:metaObject->className()] ?: @"";
      [result addObject:@{
        @"pointer": pointer,
        @"title": title,
        @"normalizedTitle": NormalizedActionTitle(title),
        @"objectName": objectName,
        @"className": className,
        @"enabled": @(action->isEnabled()),
        @"checked": @(action->isChecked()),
        @"nativePointer": [NSValue valueWithPointer:action],
      }];
    }
  }
  return result;
}

static NSArray *SerializableQtActions(void) {
  NSMutableArray *result = [NSMutableArray array];
  for (NSDictionary *entry in QtActions()) {
    [result addObject:@{
      @"pointer": entry[@"pointer"],
      @"title": entry[@"title"],
      @"normalizedTitle": entry[@"normalizedTitle"],
      @"objectName": entry[@"objectName"],
      @"className": entry[@"className"],
      @"enabled": entry[@"enabled"],
      @"checked": entry[@"checked"],
    }];
  }
  return result;
}

static NSDictionary *FindQtAction(NSString *title) {
  for (NSDictionary *entry in QtActions()) {
    if ([entry[@"normalizedTitle"] isEqualToString:title]) return entry;
  }
  return nil;
}

static BOOL InvokeQtAction(NSString *title) {
  NSDictionary *entry = FindQtAction(title);
  QAction *action = (QAction *)[entry[@"nativePointer"] pointerValue];
  if (entry == nil || action == nullptr || !action->isEnabled()) return NO;
  BOOL before = action->isChecked();
  action->activate(QAction::Trigger);
  AppendEvent(@{
    @"event": @"qt-action",
    @"title": title,
    @"objectName": entry[@"objectName"],
    @"className": entry[@"className"],
    @"beforeChecked": @(before),
    @"afterChecked": @(action->isChecked()),
  });
  return YES;
}

static void SetQtToggle(NSString *title, BOOL desired) {
  NSDictionary *entry = FindQtAction(title);
  QAction *action = (QAction *)[entry[@"nativePointer"] pointerValue];
  if (entry == nil || action == nullptr) {
    AppendEvent(@{
      @"event": @"qt-toggle-unavailable",
      @"title": title,
      @"desired": @(desired),
    });
    return;
  }
  BOOL before = action->isChecked();
  if (before != desired && action->isEnabled()) {
    action->activate(QAction::Trigger);
  }
  AppendEvent(@{
    @"event": @"qt-toggle",
    @"title": title,
    @"objectName": entry[@"objectName"],
    @"desired": @(desired),
    @"before": @(before),
    @"after": @(action->isChecked()),
  });
}

typedef id (*WindowInitializer)(id, SEL, NSRect, NSWindowStyleMask,
                                NSBackingStoreType, BOOL);
typedef void (*WindowAlphaSetter)(id, SEL, CGFloat);

static WindowInitializer OriginalWindowInitializer = NULL;
static WindowAlphaSetter OriginalWindowAlphaSetter = NULL;

static id HeadlessWindowInitializer(id window, SEL command, NSRect rect,
                                    NSWindowStyleMask style,
                                    NSBackingStoreType backing,
                                    BOOL deferCreation) {
  id result = OriginalWindowInitializer(
    window, command, rect, style, backing, deferCreation);
  if (result != nil) {
    OriginalWindowAlphaSetter(result, @selector(setAlphaValue:), 0);
  }
  return result;
}

static void HeadlessWindowAlphaSetter(id window, SEL command,
                                      __unused CGFloat requestedAlpha) {
  OriginalWindowAlphaSetter(window, command, 0);
}

static void SuppressWindowOrderWithSender(__unused id window,
                                          __unused SEL command,
                                          __unused id sender) {
}

static void SuppressWindowOrderRegardless(__unused id window,
                                          __unused SEL command) {
}

static void SuppressWindowOrderRelative(__unused id window,
                                        __unused SEL command,
                                        __unused NSWindowOrderingMode place,
                                        __unused NSInteger otherWindowNumber) {
}

static void SuppressApplicationActivation(__unused id application,
                                          __unused SEL command,
                                          __unused BOOL flag) {
}

static void SuppressApplicationUnhide(__unused id application,
                                      __unused SEL command,
                                      __unused id sender) {
}

static void SuppressWindowFocus(__unused id window, __unused SEL command) {
}

static BOOL SuppressRunningApplicationActivation(
    __unused id application,
    __unused SEL command,
    __unused NSApplicationActivationOptions options) {
  return NO;
}

static void ReplaceWindowMethod(SEL selector, IMP replacement) {
  Method method = class_getInstanceMethod([NSWindow class], selector);
  if (method != NULL) method_setImplementation(method, replacement);
}

static void InstallWindowSuppression(void) {
  Method initializer = class_getInstanceMethod(
    [NSWindow class],
    @selector(initWithContentRect:styleMask:backing:defer:));
  OriginalWindowInitializer = (WindowInitializer)method_getImplementation(
    initializer);
  method_setImplementation(initializer, (IMP)HeadlessWindowInitializer);
  Method alphaSetter = class_getInstanceMethod(
    [NSWindow class],
    @selector(setAlphaValue:));
  OriginalWindowAlphaSetter = (WindowAlphaSetter)method_getImplementation(
    alphaSetter);
  method_setImplementation(alphaSetter, (IMP)HeadlessWindowAlphaSetter);
  ReplaceWindowMethod(
    @selector(orderFront:),
    (IMP)SuppressWindowOrderWithSender);
  ReplaceWindowMethod(
    @selector(makeKeyAndOrderFront:),
    (IMP)SuppressWindowOrderWithSender);
  ReplaceWindowMethod(
    @selector(orderFrontRegardless),
    (IMP)SuppressWindowOrderRegardless);
  ReplaceWindowMethod(
    @selector(orderWindow:relativeTo:),
    (IMP)SuppressWindowOrderRelative);
  ReplaceWindowMethod(
    @selector(makeKeyWindow),
    (IMP)SuppressWindowFocus);
  ReplaceWindowMethod(
    @selector(makeMainWindow),
    (IMP)SuppressWindowFocus);
  Method activate = class_getInstanceMethod(
    [NSApplication class],
    @selector(activateIgnoringOtherApps:));
  method_setImplementation(activate, (IMP)SuppressApplicationActivation);
  Method unhide = class_getInstanceMethod(
    [NSApplication class],
    @selector(unhide:));
  method_setImplementation(unhide, (IMP)SuppressApplicationUnhide);
  Method runningActivate = class_getInstanceMethod(
    [NSRunningApplication class],
    @selector(activateWithOptions:));
  method_setImplementation(
    runningActivate,
    (IMP)SuppressRunningApplicationActivation);
}

static NSString *EventLogPath(void) {
  const char *value = getenv("CSSMARS_ORACLE_EVENT_LOG");
  if (value == NULL || value[0] == '\0') return nil;
  return [NSString stringWithUTF8String:value];
}

static void AppendEvent(NSDictionary *event) {
  NSString *path = EventLogPath();
  if (path == nil) return;
  NSMutableDictionary *record = [event mutableCopy];
  record[@"timestamp"] = @([[NSDate date] timeIntervalSince1970]);
  record[@"processId"] = @([[NSProcessInfo processInfo] processIdentifier]);
  NSError *error = nil;
  NSData *json = [NSJSONSerialization dataWithJSONObject:record options:0 error:&error];
  if (json == nil) return;
  NSMutableData *line = [json mutableCopy];
  [line appendData:[@"\n" dataUsingEncoding:NSUTF8StringEncoding]];
  NSFileManager *manager = [NSFileManager defaultManager];
  if (![manager fileExistsAtPath:path]) {
    [manager createFileAtPath:path contents:nil attributes:nil];
  }
  NSFileHandle *handle = [NSFileHandle fileHandleForWritingAtPath:path];
  [handle seekToEndOfFile];
  [handle writeData:line];
  [handle closeFile];
}

static NSString *InputControlPath(void) {
  const char *value = getenv("CSSMARS_ORACLE_INPUT_FILE");
  if (value == NULL || value[0] == '\0') return nil;
  return [NSString stringWithUTF8String:value];
}

static NSTimeInterval MonotonicSeconds(void) {
  return [[NSProcessInfo processInfo] systemUptime];
}

static char InputRevisionAssociation;
static char InputIdentifierAssociation;
static char InputKindAssociation;
static char InputAcceptedAssociation;
static IMP OriginalMouseMoved = nullptr;
static IMP OriginalMouseDown = nullptr;
static IMP OriginalMouseDragged = nullptr;
static IMP OriginalMouseUp = nullptr;
static IMP OriginalScrollWheel = nullptr;
static NSUInteger AcceptedInputSerial = 0;

static void RecordAcceptedInput(id receiver, SEL selector, NSEvent *event) {
  NSString *identifier = objc_getAssociatedObject(
    event, &InputIdentifierAssociation);
  if (identifier == nil) return;
  if (objc_getAssociatedObject(event, &InputAcceptedAssociation) != nil) {
    return;
  }
  objc_setAssociatedObject(
    event, &InputAcceptedAssociation, @YES,
    OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  NSNumber *revision = objc_getAssociatedObject(
    event, &InputRevisionAssociation);
  NSString *kind = objc_getAssociatedObject(event, &InputKindAssociation);
  AcceptedInputSerial += 1;
  CurrentInputRevision.store(
    revision == nil ? 0 : revision.unsignedLongLongValue,
    std::memory_order_release);
  CurrentInputIdentifierHash.store(
    InputIdentifierHash(identifier), std::memory_order_release);
  CurrentInputPhase.store(
    static_cast<uint8_t>(PhaseForInput(kind, event)),
    std::memory_order_release);
  CurrentInputSerial.store(AcceptedInputSerial, std::memory_order_release);
  AppendEvent(@{
    @"event": @"native-input-accepted",
    @"acceptedInputSerial": @(AcceptedInputSerial),
    @"revision": revision ?: @0,
    @"id": identifier,
    @"kind": kind ?: @"",
    @"acceptedMonotonicSeconds": @(MonotonicSeconds()),
    @"targetNSViewClass": NSStringFromClass([receiver class]) ?: @"",
    @"handler": NSStringFromSelector(selector) ?: @"",
    @"windowNumber": @(event.windowNumber),
  });
}

static void ForwardAcceptedInput(
    id receiver, SEL selector, NSEvent *event, IMP implementation) {
  RecordAcceptedInput(receiver, selector, event);
  if (implementation != nullptr) {
    reinterpret_cast<void (*)(id, SEL, NSEvent *)>(implementation)(
      receiver, selector, event);
  }
}

static void AuditMouseMoved(id receiver, SEL selector, NSEvent *event) {
  ForwardAcceptedInput(receiver, selector, event, OriginalMouseMoved);
}

static void AuditMouseDown(id receiver, SEL selector, NSEvent *event) {
  ForwardAcceptedInput(receiver, selector, event, OriginalMouseDown);
}

static void AuditMouseDragged(id receiver, SEL selector, NSEvent *event) {
  ForwardAcceptedInput(receiver, selector, event, OriginalMouseDragged);
}

static void AuditMouseUp(id receiver, SEL selector, NSEvent *event) {
  ForwardAcceptedInput(receiver, selector, event, OriginalMouseUp);
}

static void AuditScrollWheel(id receiver, SEL selector, NSEvent *event) {
  ForwardAcceptedInput(receiver, selector, event, OriginalScrollWheel);
}

static BOOL InstallInputAuditMethod(
    Class targetClass, SEL selector, IMP replacement, IMP *original) {
  Method inherited = class_getInstanceMethod(targetClass, selector);
  if (inherited == nullptr) return NO;
  *original = method_getImplementation(inherited);
  const char *types = method_getTypeEncoding(inherited);
  if (!class_addMethod(targetClass, selector, replacement, types)) {
    Method method = class_getInstanceMethod(targetClass, selector);
    method_setImplementation(method, replacement);
  }
  return YES;
}

static BOOL InstallQNSViewInputAudit(void) {
  Class targetClass = NSClassFromString(@"QNSView");
  if (targetClass == Nil) return NO;
  return InstallInputAuditMethod(
           targetClass, @selector(mouseMoved:),
           reinterpret_cast<IMP>(AuditMouseMoved), &OriginalMouseMoved) &&
    InstallInputAuditMethod(
           targetClass, @selector(mouseDown:),
           reinterpret_cast<IMP>(AuditMouseDown), &OriginalMouseDown) &&
    InstallInputAuditMethod(
           targetClass, @selector(mouseDragged:),
           reinterpret_cast<IMP>(AuditMouseDragged), &OriginalMouseDragged) &&
    InstallInputAuditMethod(
           targetClass, @selector(mouseUp:),
           reinterpret_cast<IMP>(AuditMouseUp), &OriginalMouseUp) &&
    InstallInputAuditMethod(
           targetClass, @selector(scrollWheel:),
           reinterpret_cast<IMP>(AuditScrollWheel), &OriginalScrollWheel);
}

static NSWindow *LargestOracleWindow(void) {
  NSWindow *selected = nil;
  CGFloat selectedArea = 0;
  for (NSWindow *window in NSApp.windows) {
    NSView *content = window.contentView;
    if (content == nil) continue;
    NSRect bounds = content.bounds;
    CGFloat area = NSWidth(bounds) * NSHeight(bounds);
    if (area <= selectedArea) continue;
    selected = window;
    selectedArea = area;
  }
  return selected;
}

static void FindLargestViewOfClass(NSView *view, Class targetClass,
                                   NSView **selected,
                                   CGFloat *selectedArea) {
  if ([view isKindOfClass:targetClass]) {
    NSRect bounds = view.bounds;
    CGFloat area = NSWidth(bounds) * NSHeight(bounds);
    if (area > *selectedArea) {
      *selected = view;
      *selectedArea = area;
    }
  }
  for (NSView *subview in view.subviews) {
    FindLargestViewOfClass(subview, targetClass, selected, selectedArea);
  }
}

static NSView *LargestOracleRenderView(NSWindow *window) {
  Class qnsViewClass = NSClassFromString(@"QNSView");
  if (window == nil || qnsViewClass == Nil) return nil;
  NSView *selected = nil;
  CGFloat selectedArea = 0;
  FindLargestViewOfClass(
    window.contentView, qnsViewClass, &selected, &selectedArea);
  return selected;
}

static void ConfigureOracleContentSize(void) {
  const char *widthValue = getenv("CSSMARS_ORACLE_CONTENT_WIDTH");
  const char *heightValue = getenv("CSSMARS_ORACLE_CONTENT_HEIGHT");
  if (widthValue == NULL || heightValue == NULL) return;
  double width = strtod(widthValue, nullptr);
  double height = strtod(heightValue, nullptr);
  NSWindow *window = LargestOracleWindow();
  if (window == nil || !isfinite(width) || !isfinite(height) ||
      width <= 0 || height <= 0) return;
  [window setContentSize:NSMakeSize(width, height)];
}

static BOOL IsFiniteNumber(id value) {
  return [value isKindOfClass:[NSNumber class]] &&
    isfinite([(NSNumber *)value doubleValue]);
}

static BOOL DeliverInputEventToQNSView(
    NSView *target, NSString *kind, NSEvent *event) {
  Class qnsViewClass = NSClassFromString(@"QNSView");
  if (qnsViewClass == Nil || ![target isKindOfClass:qnsViewClass]) return NO;
  if ([kind isEqualToString:@"move"]) {
    [target mouseMoved:event];
  } else if ([kind isEqualToString:@"down"]) {
    [target mouseDown:event];
  } else if ([kind isEqualToString:@"drag"]) {
    [target mouseDragged:event];
  } else if ([kind isEqualToString:@"up"]) {
    [target mouseUp:event];
  } else if ([kind isEqualToString:@"wheel"]) {
    [target scrollWheel:event];
  } else {
    return NO;
  }
  return YES;
}

static void DispatchInputEvent(NSDictionary *specification,
                               NSUInteger revision,
                               NSTimeInterval sourceTimestamp) {
  NSString *identifier = specification[@"id"];
  NSString *kind = specification[@"kind"];
  NSNumber *normalizedX = specification[@"x"];
  NSNumber *normalizedY = specification[@"y"];
  if (![identifier isKindOfClass:[NSString class]] ||
      ![kind isKindOfClass:[NSString class]] ||
      !IsFiniteNumber(normalizedX) || !IsFiniteNumber(normalizedY)) {
    AppendEvent(@{
      @"event": @"native-input-rejected",
      @"revision": @(revision),
      @"reason": @"invalid event identity or coordinates",
    });
    return;
  }
  double x = normalizedX.doubleValue;
  double y = normalizedY.doubleValue;
  if (x < 0 || x > 1 || y < 0 || y > 1) {
    AppendEvent(@{
      @"event": @"native-input-rejected",
      @"revision": @(revision),
      @"id": identifier,
      @"reason": @"coordinates outside normalized content bounds",
    });
    return;
  }
  NSWindow *window = LargestOracleWindow();
  NSView *target = LargestOracleRenderView(window);
  if (window == nil || target == nil) {
    AppendEvent(@{
      @"event": @"native-input-rejected",
      @"revision": @(revision),
      @"id": identifier,
      @"reason": @"oracle content window unavailable",
    });
    return;
  }
  NSRect bounds = target.bounds;
  NSPoint targetPoint = NSMakePoint(
    NSMinX(bounds) + x * NSWidth(bounds),
    NSMinY(bounds) + (1 - y) * NSHeight(bounds));
  NSPoint windowPoint = [target convertPoint:targetPoint toView:nil];
  NSTimeInterval dispatchedAt = MonotonicSeconds();
  NSEvent *event = nil;
  if ([kind isEqualToString:@"move"] ||
      [kind isEqualToString:@"down"] ||
      [kind isEqualToString:@"drag"] ||
      [kind isEqualToString:@"up"]) {
    NSInteger clickCount = [specification[@"clickCount"] integerValue];
    if (clickCount < 1 || clickCount > 2) clickCount = 1;
    NSEventType type = [kind isEqualToString:@"move"]
      ? NSEventTypeMouseMoved
      : [kind isEqualToString:@"down"]
        ? NSEventTypeLeftMouseDown
        : [kind isEqualToString:@"drag"]
          ? NSEventTypeLeftMouseDragged
          : NSEventTypeLeftMouseUp;
    event = [NSEvent mouseEventWithType:type
                              location:windowPoint
                         modifierFlags:0
                            timestamp:sourceTimestamp
                          windowNumber:window.windowNumber
                               context:nil
                           eventNumber:0
                            clickCount:clickCount
                              pressure:[kind isEqualToString:@"up"] ? 0 : 1];
  } else if ([kind isEqualToString:@"wheel"] &&
             IsFiniteNumber(specification[@"deltaY"])) {
    double deltaY = [specification[@"deltaY"] doubleValue];
    CGEventRef scrollEvent = CGEventCreateScrollWheelEvent(
      NULL,
      kCGScrollEventUnitPixel,
      1,
      (int32_t)llround(deltaY));
    if (scrollEvent != NULL) {
      CGEventSetTimestamp(
        scrollEvent,
        (CGEventTimestamp)llround(sourceTimestamp * NSEC_PER_SEC));
      CGEventSetDoubleValueField(
        scrollEvent,
        kCGScrollWheelEventFixedPtDeltaAxis1,
        deltaY);
      CGEventSetIntegerValueField(
        scrollEvent,
        kCGScrollWheelEventPointDeltaAxis1,
        (int64_t)llround(deltaY));
      CGEventSetIntegerValueField(
        scrollEvent,
        kCGScrollWheelEventIsContinuous,
        1);
      event = [NSEvent eventWithCGEvent:scrollEvent];
      CFRelease(scrollEvent);
      @try {
        [event setValue:@(window.windowNumber) forKey:@"windowNumber"];
        [event setValue:[NSValue valueWithPoint:windowPoint]
                 forKey:@"location"];
      } @catch (NSException *exception) {
        AppendEvent(@{
          @"event": @"native-input-rejected",
          @"revision": @(revision),
          @"id": identifier,
          @"kind": kind,
          @"reason": @"could not bind wheel event to oracle window",
          @"exception": exception.reason ?: @"",
        });
        return;
      }
    }
  }
  if (event == nil) {
    AppendEvent(@{
      @"event": @"native-input-rejected",
      @"revision": @(revision),
      @"id": identifier,
      @"kind": kind,
      @"reason": @"unsupported event",
    });
    return;
  }
  objc_setAssociatedObject(
    event, &InputRevisionAssociation, @(revision),
    OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  objc_setAssociatedObject(
    event, &InputIdentifierAssociation, identifier,
    OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  objc_setAssociatedObject(
    event, &InputKindAssociation, kind,
    OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  NSUInteger acceptedBefore = AcceptedInputSerial;
  BOOL dispatched = DeliverInputEventToQNSView(target, kind, event);
  BOOL delivered = dispatched && AcceptedInputSerial > acceptedBefore;
  AppendEvent(@{
    @"event": @"native-input-posted",
    @"revision": @(revision),
    @"id": identifier,
    @"kind": kind,
    @"requestedMilliseconds": specification[@"atMilliseconds"] ?: @0,
    @"sourceMonotonicSeconds": @(sourceTimestamp),
    @"postedMonotonicSeconds": @(dispatchedAt),
    @"returnedMonotonicSeconds": @(MonotonicSeconds()),
    @"delivered": @(delivered),
    @"dispatchFamily": @"direct-AppKit-QNSView-handler",
    @"normalizedX": @(x),
    @"normalizedY": @(y),
    @"contentWidth": @(NSWidth(bounds)),
    @"contentHeight": @(NSHeight(bounds)),
    @"windowNumber": @(window.windowNumber),
    @"targetNSViewClass": NSStringFromClass(target.class) ?: @"",
  });
}

static NSUInteger LastInputRevision = 0;
static BOOL InputPollingStarted = NO;

static void PollInputControl(void) {
  NSString *path = InputControlPath();
  if (path == nil) return;
  NSData *data = [NSData dataWithContentsOfFile:path];
  if (data != nil) {
    NSError *error = nil;
    id decoded = [NSJSONSerialization JSONObjectWithData:data
                                                  options:0
                                                    error:&error];
    NSDictionary *control = [decoded isKindOfClass:[NSDictionary class]]
      ? decoded
      : nil;
    NSNumber *revisionValue = control[@"revision"];
    NSArray *events = control[@"events"];
    NSUInteger revision = [revisionValue unsignedIntegerValue];
    if (error == nil && control != nil &&
        [revisionValue isKindOfClass:[NSNumber class]] &&
        [events isKindOfClass:[NSArray class]] &&
        revision > LastInputRevision && events.count <= 256) {
      LastInputRevision = revision;
      NSTimeInterval acceptedAt = MonotonicSeconds();
      AppendEvent(@{
        @"event": @"native-input-batch-accepted",
        @"revision": @(revision),
        @"eventCount": @(events.count),
        @"acceptedMonotonicSeconds": @(acceptedAt),
      });
      for (id candidate in events) {
        if (![candidate isKindOfClass:[NSDictionary class]]) continue;
        NSDictionary *specification = candidate;
        NSNumber *delayValue = specification[@"atMilliseconds"];
        double delay = IsFiniteNumber(delayValue)
          ? delayValue.doubleValue
          : 0;
        if (delay < 0 || delay > 30000) {
          AppendEvent(@{
            @"event": @"native-input-rejected",
            @"revision": @(revision),
            @"id": specification[@"id"] ?: @"",
            @"reason": @"event delay outside bounded interval",
          });
          continue;
        }
        NSTimer *timer = [NSTimer
          timerWithTimeInterval:MAX(delay / 1000.0, 0.000001)
                         repeats:NO
                         block:^(__unused NSTimer *firedTimer) {
          DispatchInputEvent(
            specification, revision, acceptedAt + delay / 1000.0);
        }];
        [[NSRunLoop mainRunLoop] addTimer:timer
                                  forMode:NSRunLoopCommonModes];
      }
      if ([control[@"terminate"] boolValue]) {
        AppendEvent(@{
          @"event": @"native-termination-request-accepted",
          @"revision": @(revision),
        });
        dispatch_after(
          dispatch_time(DISPATCH_TIME_NOW, 500 * NSEC_PER_MSEC),
          dispatch_get_main_queue(),
          ^{
            StopMotionFrameTrace();
            AppendEvent(@{
              @"event": @"native-termination-started",
              @"revision": @(revision),
            });
            [NSApp terminate:nil];
          });
      }
    }
  }
  dispatch_after(
    dispatch_time(DISPATCH_TIME_NOW, 10 * NSEC_PER_MSEC),
    dispatch_get_main_queue(),
    ^{ PollInputControl(); });
}

static void StartInputPolling(void) {
  if (InputPollingStarted || InputControlPath() == nil) return;
  InputPollingStarted = YES;
  BOOL qnsViewInputAuditInstalled = InstallQNSViewInputAudit();
  AppendEvent(@{
    @"event": @"native-input-control-ready",
    @"path": InputControlPath(),
    @"qnsViewInputAuditInstalled": @(qnsViewInputAuditInstalled),
  });
  PollInputControl();
}

static NSMenuItem *FindMenuItem(NSMenu *menu, NSString *title) {
  for (NSMenuItem *item in menu.itemArray) {
    if ([item.title isEqualToString:title]) return item;
    if (item.submenu != nil) {
      NSMenuItem *nested = FindMenuItem(item.submenu, title);
      if (nested != nil) return nested;
    }
  }
  return nil;
}

static void CollectMenuItems(NSMenu *menu, NSString *prefix,
                             NSMutableArray *output) {
  for (NSMenuItem *item in menu.itemArray) {
    NSString *path = prefix.length == 0
      ? item.title
      : [NSString stringWithFormat:@"%@/%@", prefix, item.title];
    [output addObject:@{
      @"path": path ?: @"",
      @"enabled": @(item.enabled),
      @"hidden": @(item.hidden),
      @"state": @(item.state),
      @"action": item.action == NULL
        ? @""
        : NSStringFromSelector(item.action),
      @"targetClass": item.target == nil
        ? @""
        : NSStringFromClass([item.target class]),
    }];
    if (item.submenu != nil) CollectMenuItems(item.submenu, path, output);
  }
}

static void RecordRuntimeState(NSString *stage) {
  NSMutableArray *menus = [NSMutableArray array];
  CollectMenuItems(NSApp.mainMenu, @"", menus);
  NSMutableArray *windows = [NSMutableArray array];
  for (NSWindow *window in NSApp.windows) {
    NSRect frame = window.frame;
    [windows addObject:@{
      @"title": window.title ?: @"",
      @"visible": @(window.visible),
      @"level": @(window.level),
      @"frame": @{
        @"x": @(frame.origin.x),
        @"y": @(frame.origin.y),
        @"width": @(frame.size.width),
        @"height": @(frame.size.height),
      },
    }];
  }
  AppendEvent(@{
    @"event": @"runtime-state",
    @"stage": stage,
    @"activationPolicy": @(NSApp.activationPolicy),
    @"menus": menus,
    @"qtActions": SerializableQtActions(),
    @"windows": windows,
  });
}

static BOOL InvokeMenuItem(NSString *title) {
  NSMenuItem *item = FindMenuItem(NSApp.mainMenu, title);
  if (item == nil || item.action == NULL || !item.enabled) {
    AppendEvent(@{
      @"event": @"menu-action-unavailable",
      @"title": title,
      @"found": @(item != nil),
      @"enabled": item == nil ? @NO : @(item.enabled),
    });
    return NO;
  }
  NSInteger beforeState = item.state;
  BOOL sent = [NSApp sendAction:item.action to:item.target from:item];
  AppendEvent(@{
    @"event": @"menu-action",
    @"title": title,
    @"action": NSStringFromSelector(item.action),
    @"targetClass": item.target == nil
      ? @""
      : NSStringFromClass([item.target class]),
    @"beforeState": @(beforeState),
    @"afterState": @(item.state),
    @"sent": @(sent),
  });
  return sent;
}

static void SetToggle(NSString *title, BOOL desired) {
  NSMenuItem *item = FindMenuItem(NSApp.mainMenu, title);
  if (item == nil) {
    AppendEvent(@{
      @"event": @"toggle-unavailable",
      @"title": title,
      @"desired": @(desired),
    });
    return;
  }
  BOOL before = item.state == NSControlStateValueOn;
  BOOL sent = NO;
  if (before != desired && item.enabled && item.action != NULL) {
    sent = [NSApp sendAction:item.action to:item.target from:item];
  }
  AppendEvent(@{
    @"event": @"toggle",
    @"title": title,
    @"desired": @(desired),
    @"before": @(before),
    @"after": @(item.state == NSControlStateValueOn),
    @"sent": @(sent),
  });
}

static BOOL DesiredToggle(const char *name, BOOL fallback) {
  const char *value = getenv(name);
  if (value == NULL) return fallback;
  return strcmp(value, "1") == 0 || strcasecmp(value, "on") == 0 ||
    strcasecmp(value, "true") == 0;
}

static void CompleteConfiguration(void) {
  BOOL atmosphere = DesiredToggle("CSSMARS_ORACLE_ATMOSPHERE", YES);
  BOOL sun = DesiredToggle("CSSMARS_ORACLE_SUN", NO);
  if (FindMenuItem(NSApp.mainMenu, @"Atmosphere") != nil) {
    SetToggle(@"Atmosphere", atmosphere);
  } else {
    SetQtToggle(@"Atmosphere", atmosphere);
  }
  if (FindMenuItem(NSApp.mainMenu, @"Sun") != nil) {
    SetToggle(@"Sun", sun);
  } else {
    SetQtToggle(@"Sun", sun);
  }
  ConfigureOracleContentSize();
  RecordRuntimeState(@"configured");
  [NSApp hide:nil];
  AppendEvent(@{
    @"event": @"ready",
    @"headless": @YES,
    @"database": @"mars",
  });
  StartInputPolling();
}

static void ConfigureMars(NSUInteger attempt) {
  NSMenuItem *mars = FindMenuItem(NSApp.mainMenu, @"Mars");
  BOOL invoked = mars != nil && mars.enabled && mars.action != NULL
    ? InvokeMenuItem(@"Mars")
    : InvokeQtAction(@"Mars");
  if (!invoked) {
    if (attempt < 120) {
      dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, 500 * NSEC_PER_MSEC),
        dispatch_get_main_queue(),
        ^{ ConfigureMars(attempt + 1); });
    } else {
      RecordRuntimeState(@"mars-unavailable");
      AppendEvent(@{
        @"event": @"fatal",
        @"reason": @"Mars action did not become available",
      });
    }
    return;
  }
  RecordRuntimeState(@"before-mars");
  dispatch_after(
    dispatch_time(DISPATCH_TIME_NOW, 3 * NSEC_PER_SEC),
    dispatch_get_main_queue(),
    ^{ CompleteConfiguration(); });
}

static BOOL ConfigurationStarted = NO;

static void StartConfiguration(void) {
  if (ConfigurationStarted) return;
  ConfigurationStarted = YES;
  AppendEvent(@{
    @"event": @"configuration-started",
  });
  [NSApp setActivationPolicy:NSApplicationActivationPolicyProhibited];
  [NSApp hide:nil];
  ConfigureMars(0);
}

__attribute__((constructor)) static void InstallHeadlessMarsOracle(void) {
  @autoreleasepool {
    InstallCalibrationShaderInterposition();
    InstallWindowSuppression();
    BOOL motionFrameTraceInstalled = InstallMotionFrameTrace();
    AppendEvent(@{
      @"event": @"injected",
      @"library": @"cssmars-google-earth-pro-headless-oracle",
      @"windowOrderingSuppressed": @YES,
      @"motionFrameTraceInstalled": @(motionFrameTraceInstalled),
      @"motionFrameTraceCapturesMatrices":
        @(motionFrameTraceInstalled && MotionTraceCapturesMatrices),
    });
    [[NSNotificationCenter defaultCenter]
      addObserverForName:NSApplicationDidFinishLaunchingNotification
                  object:nil
                   queue:[NSOperationQueue mainQueue]
              usingBlock:^(__unused NSNotification *notification) {
        dispatch_after(
          dispatch_time(DISPATCH_TIME_NOW, 500 * NSEC_PER_MSEC),
          dispatch_get_main_queue(),
          ^{ StartConfiguration(); });
      }];
    dispatch_after(
      dispatch_time(DISPATCH_TIME_NOW, 2 * NSEC_PER_SEC),
      dispatch_get_main_queue(),
      ^{ StartConfiguration(); });
  }
}
