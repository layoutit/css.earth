#include <OpenGL/gl.h>

#include <dispatch/dispatch.h>
#include <dlfcn.h>
#include <fcntl.h>
#include <mach-o/dyld.h>
#include <mach-o/loader.h>
#include <mach-o/nlist.h>
#include <mach/mach.h>
#include <mach/mach_time.h>
#include <sys/mman.h>
#include <unistd.h>

#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iomanip>
#include <sstream>
#include <string>

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

class QWidget;

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

class QApplication {
 public:
  static QtList<QWidget *> allWidgets();
};

namespace {

struct QPoint {
  int x;
  int y;
};

struct QPointF {
  double x;
  double y;
};

using NotifyInternalFunction = bool (*)(QObject *, void *);
using LegacyWheelConstructor = void (*)(
  void *, const QPointF &, int, int, int, int);
using PixelWheelConstructor = void (*)(
  void *, const QPointF &, const QPointF &, QPoint, QPoint, int, int, int, int,
  int);
using WheelDestructor = void (*)(void *);
using DrawArraysFunction = void (*)(GLenum, GLint, GLsizei);
using GetIntegervFunction = void (*)(GLenum, GLint *);
using GetUniformLocationFunction = GLint (*)(GLuint, const GLchar *);
using GetUniformfvFunction = void (*)(GLuint, GLint, GLfloat *);
using CurrentContextFunction = void *(*)();

struct Functions {
  NotifyInternalFunction notifyInternal;
  LegacyWheelConstructor legacyWheelConstructor;
  PixelWheelConstructor pixelWheelConstructor;
  WheelDestructor wheelDestructor;
  DrawArraysFunction nextDrawArrays;
  GetIntegervFunction getIntegerv;
  GetUniformLocationFunction getUniformLocation;
  GetUniformfvFunction getUniformfv;
  CurrentContextFunction currentContext;
};

static Functions Api = {};
static uint32_t LastCommandRevision = 0;
static uint64_t FrameIndex = 0;

static uint64_t MonotonicNanoseconds() {
  static mach_timebase_info_data_t timebase = {};
  if (timebase.denom == 0) mach_timebase_info(&timebase);
  const uint64_t ticks = mach_continuous_time();
  return ticks * timebase.numer / timebase.denom;
}

static void AppendLine(const char *environmentName, const std::string &line) {
  const char *path = getenv(environmentName);
  if (path == nullptr || path[0] == '\0') return;
  const int descriptor = open(path, O_WRONLY | O_CREAT | O_APPEND, 0600);
  if (descriptor < 0) return;
  write(descriptor, line.data(), line.size());
  write(descriptor, "\n", 1);
  close(descriptor);
}

static std::string JsonString(const char *value) {
  std::ostringstream stream;
  stream << '"';
  if (value != nullptr) {
    for (const unsigned char character : std::string(value)) {
      if (character == '"' || character == '\\') {
        stream << '\\' << character;
      } else if (character >= 0x20) {
        stream << character;
      }
    }
  }
  stream << '"';
  return stream.str();
}

static std::string QtString(QString value) {
  QtByteArray utf8 = value.toUtf8();
  if (utf8.data == nullptr || utf8.data->size <= 0) return "";
  const char *bytes = reinterpret_cast<const char *>(utf8.data) +
    utf8.data->offset;
  return std::string(bytes, static_cast<size_t>(utf8.data->size));
}

static const char *WidgetClass(QWidget *widget) {
  if (widget == nullptr) return "";
  const QMetaObject *meta = reinterpret_cast<QObject *>(widget)->metaObject();
  return meta == nullptr ? "" : meta->className();
}

static QWidget *FindTargetWidget(std::string *selectedClass) {
  const char *requested = getenv("CSSEARTH_GOOGLE_EARTH_ZOOM_WIDGET_CLASS");
  const std::string needle = requested == nullptr ? "" : requested;
  QtList<QWidget *> widgets = QApplication::allWidgets();
  QWidget *fallback = nullptr;
  for (int index = 0; index < widgets.size(); index += 1) {
    QWidget *widget = widgets.at(index);
    const char *className = WidgetClass(widget);
    if (fallback == nullptr && (
        strstr(className, "Render") != nullptr ||
        strstr(className, "GLWidget") != nullptr ||
        strstr(className, "Earth") != nullptr)) {
      fallback = widget;
    }
    if (!needle.empty() && needle == className) {
      *selectedClass = className;
      return widget;
    }
  }
  if (fallback != nullptr) *selectedClass = WidgetClass(fallback);
  return fallback;
}

static void RecordWidgetInventory() {
  QtList<QWidget *> widgets = QApplication::allWidgets();
  for (int index = 0; index < widgets.size(); index += 1) {
    QWidget *widget = widgets.at(index);
    QObject *object = reinterpret_cast<QObject *>(widget);
    std::ostringstream line;
    line << "{\"event\":\"widget\",\"monotonicNanoseconds\":"
         << MonotonicNanoseconds()
         << ",\"index\":" << index
         << ",\"pointer\":\"0x" << std::hex
         << reinterpret_cast<uintptr_t>(widget) << std::dec << '"'
         << ",\"className\":" << JsonString(WidgetClass(widget))
         << ",\"objectName\":" << JsonString(QtString(object->objectName()).c_str())
         << '}';
    AppendLine("CSSEARTH_GOOGLE_EARTH_ZOOM_EVENT_LOG", line.str());
  }
  std::ostringstream summary;
  summary << "{\"event\":\"widget-inventory-complete\","
          << "\"monotonicNanoseconds\":" << MonotonicNanoseconds()
          << ",\"count\":" << widgets.size() << '}';
  AppendLine("CSSEARTH_GOOGLE_EARTH_ZOOM_EVENT_LOG", summary.str());
}

static bool ReadCommand(
    uint32_t *revision,
    char family[16],
    int *delta,
    int *pixelY,
    int *angleY,
    double *x,
    double *y,
    int *phase) {
  const char *path = getenv("CSSEARTH_GOOGLE_EARTH_ZOOM_COMMAND");
  if (path == nullptr || path[0] == '\0') return false;
  FILE *file = fopen(path, "r");
  if (file == nullptr) return false;
  const int matched = fscanf(
    file,
    "%u %15s %d %d %d %lf %lf %d",
    revision,
    family,
    delta,
    pixelY,
    angleY,
    x,
    y,
    phase);
  fclose(file);
  return matched == 8;
}

static void InjectCommand() {
  uint32_t revision = 0;
  char family[16] = {};
  int delta = 0;
  int pixelY = 0;
  int angleY = 0;
  double x = 0;
  double y = 0;
  int phase = 0;
  if (!ReadCommand(
      &revision, family, &delta, &pixelY, &angleY, &x, &y, &phase) ||
      revision == 0 || revision == LastCommandRevision) {
    return;
  }
  LastCommandRevision = revision;
  std::string targetClass;
  QWidget *widget = FindTargetWidget(&targetClass);
  const bool isTrackpad = strcmp(family, "trackpad") == 0;
  bool delivered = false;
  if (widget != nullptr && Api.notifyInternal != nullptr &&
      Api.wheelDestructor != nullptr &&
      ((!isTrackpad && Api.legacyWheelConstructor != nullptr) ||
       (isTrackpad && Api.pixelWheelConstructor != nullptr))) {
    alignas(16) unsigned char storage[512] = {};
    QPointF position = { x, y };
    if (isTrackpad) {
      const QPointF globalPosition = position;
      const QPoint pixelDelta = { 0, pixelY };
      const QPoint angleDelta = { 0, angleY };
      Api.pixelWheelConstructor(
        storage,
        position,
        globalPosition,
        pixelDelta,
        angleDelta,
        delta,
        2,
        0,
        0,
        phase);
    } else {
      Api.legacyWheelConstructor(storage, position, delta, 0, 0, 2);
    }
    delivered = Api.notifyInternal(
      reinterpret_cast<QObject *>(widget), storage);
    Api.wheelDestructor(storage);
  }
  std::ostringstream line;
  line << "{\"event\":\"input\",\"monotonicNanoseconds\":"
       << MonotonicNanoseconds()
       << ",\"revision\":" << revision
       << ",\"family\":" << JsonString(family)
       << ",\"delta\":" << delta
       << ",\"pixelY\":" << pixelY
       << ",\"angleY\":" << angleY
       << ",\"phase\":" << phase
       << ",\"x\":" << x << ",\"y\":" << y
       << ",\"targetClass\":" << JsonString(targetClass.c_str())
       << ",\"delivered\":" << (delivered ? "true" : "false") << '}';
  AppendLine("CSSEARTH_GOOGLE_EARTH_ZOOM_EVENT_LOG", line.str());
}

static void MonitorCommands() {
  InjectCommand();
  dispatch_after(
    dispatch_time(DISPATCH_TIME_NOW, 4 * NSEC_PER_MSEC),
    dispatch_get_main_queue(),
    ^{ MonitorCommands(); });
}

static void ResolveFunctions() {
  Api.notifyInternal = reinterpret_cast<NotifyInternalFunction>(dlsym(
    RTLD_DEFAULT,
    "_ZN16QCoreApplication14notifyInternalEP7QObjectP6QEvent"));
  Api.legacyWheelConstructor = reinterpret_cast<LegacyWheelConstructor>(dlsym(
    RTLD_DEFAULT,
    "_ZN11QWheelEventC1ERK7QPointFi6QFlagsIN2Qt11MouseButtonEES3_INS4_16KeyboardModifierEENS4_11OrientationE"));
  Api.pixelWheelConstructor = reinterpret_cast<PixelWheelConstructor>(dlsym(
    RTLD_DEFAULT,
    "_ZN11QWheelEventC1ERK7QPointFS2_6QPointS3_iN2Qt11OrientationE6QFlagsINS4_11MouseButtonEES6_INS4_16KeyboardModifierEENS4_11ScrollPhaseE"));
  Api.wheelDestructor = reinterpret_cast<WheelDestructor>(dlsym(
    RTLD_DEFAULT, "_ZN11QWheelEventD1Ev"));
  void *openGl = dlopen(
    "/System/Library/Frameworks/OpenGL.framework/Versions/A/OpenGL",
    RTLD_LAZY | RTLD_LOCAL);
  Api.getIntegerv = reinterpret_cast<GetIntegervFunction>(dlsym(
    openGl, "glGetIntegerv"));
  Api.getUniformLocation = reinterpret_cast<GetUniformLocationFunction>(dlsym(
    openGl, "glGetUniformLocation"));
  Api.getUniformfv = reinterpret_cast<GetUniformfvFunction>(dlsym(
    openGl, "glGetUniformfv"));
  Api.currentContext = reinterpret_cast<CurrentContextFunction>(dlsym(
    openGl, "CGLGetCurrentContext"));
}

static void RecordFrame(GLenum primitive, GLsizei count) {
  if (primitive != GL_POINTS || count != 5000 ||
      Api.getIntegerv == nullptr || Api.getUniformLocation == nullptr ||
      Api.getUniformfv == nullptr) {
    return;
  }
  GLint programValue = 0;
  Api.getIntegerv(GL_CURRENT_PROGRAM, &programValue);
  if (programValue <= 0) return;
  const GLuint program = static_cast<GLuint>(programValue);
  const GLint matrixLocation = Api.getUniformLocation(
    program, "ig_ModelViewProjectionMatrix");
  const GLint spriteLocation = Api.getUniformLocation(program, "t_tex0");
  if (matrixLocation < 0 || spriteLocation < 0) return;
  GLfloat matrix[16] = {};
  GLint viewport[4] = {};
  Api.getUniformfv(program, matrixLocation, matrix);
  Api.getIntegerv(GL_VIEWPORT, viewport);
  std::ostringstream line;
  line << "{\"event\":\"frame\",\"monotonicNanoseconds\":"
       << MonotonicNanoseconds()
       << ",\"frameIndex\":" << ++FrameIndex
       << ",\"context\":\"0x" << std::hex
       << reinterpret_cast<uintptr_t>(
            Api.currentContext == nullptr ? nullptr : Api.currentContext())
       << std::dec << '"'
       << ",\"program\":" << program
       << ",\"viewport\":[" << viewport[0] << ',' << viewport[1] << ','
       << viewport[2] << ',' << viewport[3] << "]"
       << ",\"matrix\":[" << std::setprecision(9);
  for (size_t index = 0; index < 16; index += 1) {
    if (index != 0) line << ',';
    line << matrix[index];
  }
  line << "]}";
  AppendLine("CSSEARTH_GOOGLE_EARTH_ZOOM_FRAME_LOG", line.str());
}

}  // namespace

extern "C" void CSSEarthGoogleEarthZoomDrawArrays(
    GLenum mode,
    GLint first,
    GLsizei count) {
  RecordFrame(mode, count);
  if (Api.nextDrawArrays != nullptr) Api.nextDrawArrays(mode, first, count);
}

namespace {

static bool IsPointerSection(const section_64 *section) {
  const uint32_t type = section->flags & SECTION_TYPE;
  return type == S_LAZY_SYMBOL_POINTERS ||
    type == S_NON_LAZY_SYMBOL_POINTERS;
}

static void MakeWritable(uintptr_t address, size_t byteCount) {
  const vm_size_t pageSize = static_cast<vm_size_t>(getpagesize());
  const vm_address_t page = static_cast<vm_address_t>(address) & ~(pageSize - 1);
  const vm_size_t length = static_cast<vm_size_t>(
    address + byteCount - page + pageSize - 1) & ~(pageSize - 1);
  vm_protect(
    mach_task_self(), page, length, false,
    VM_PROT_READ | VM_PROT_WRITE | VM_PROT_COPY);
}

static int RebindGoogleEarthDrawArrays() {
  int rebound = 0;
  const uint32_t imageCount = _dyld_image_count();
  for (uint32_t imageIndex = 0; imageIndex < imageCount; imageIndex += 1) {
    const char *imageName = _dyld_get_image_name(imageIndex);
    if (imageName == nullptr ||
        strstr(imageName, "/libgoogleearth_pro.dylib") == nullptr) {
      continue;
    }
    const auto *header = reinterpret_cast<const mach_header_64 *>(
      _dyld_get_image_header(imageIndex));
    const intptr_t slide = _dyld_get_image_vmaddr_slide(imageIndex);
    const segment_command_64 *linkEdit = nullptr;
    const symtab_command *symtab = nullptr;
    const dysymtab_command *dysymtab = nullptr;
    const uint8_t *commands = reinterpret_cast<const uint8_t *>(header + 1);
    for (uint32_t index = 0; index < header->ncmds; index += 1) {
      const auto *command = reinterpret_cast<const load_command *>(commands);
      if (command->cmd == LC_SEGMENT_64) {
        const auto *segment = reinterpret_cast<const segment_command_64 *>(commands);
        if (strcmp(segment->segname, SEG_LINKEDIT) == 0) linkEdit = segment;
      } else if (command->cmd == LC_SYMTAB) {
        symtab = reinterpret_cast<const symtab_command *>(commands);
      } else if (command->cmd == LC_DYSYMTAB) {
        dysymtab = reinterpret_cast<const dysymtab_command *>(commands);
      }
      commands += command->cmdsize;
    }
    if (linkEdit == nullptr || symtab == nullptr || dysymtab == nullptr) continue;
    const uintptr_t linkBase = static_cast<uintptr_t>(slide) +
      linkEdit->vmaddr - linkEdit->fileoff;
    const auto *symbols = reinterpret_cast<const nlist_64 *>(
      linkBase + symtab->symoff);
    const char *strings = reinterpret_cast<const char *>(
      linkBase + symtab->stroff);
    const auto *indirect = reinterpret_cast<const uint32_t *>(
      linkBase + dysymtab->indirectsymoff);
    commands = reinterpret_cast<const uint8_t *>(header + 1);
    for (uint32_t commandIndex = 0;
         commandIndex < header->ncmds;
         commandIndex += 1) {
      const auto *command = reinterpret_cast<const load_command *>(commands);
      if (command->cmd == LC_SEGMENT_64) {
        const auto *segment = reinterpret_cast<const segment_command_64 *>(commands);
        const auto *sections = reinterpret_cast<const section_64 *>(segment + 1);
        for (uint32_t sectionIndex = 0;
             sectionIndex < segment->nsects;
             sectionIndex += 1) {
          const section_64 *section = sections + sectionIndex;
          if (!IsPointerSection(section)) continue;
          auto *bindings = reinterpret_cast<uintptr_t *>(slide + section->addr);
          const size_t count = section->size / sizeof(uintptr_t);
          MakeWritable(reinterpret_cast<uintptr_t>(bindings),
                       count * sizeof(uintptr_t));
          for (size_t bindingIndex = 0;
               bindingIndex < count;
               bindingIndex += 1) {
            const uint32_t symbolIndex = indirect[
              section->reserved1 + bindingIndex];
            if (symbolIndex == INDIRECT_SYMBOL_ABS ||
                symbolIndex == INDIRECT_SYMBOL_LOCAL ||
                symbolIndex == (INDIRECT_SYMBOL_LOCAL | INDIRECT_SYMBOL_ABS)) {
              continue;
            }
            const char *name = strings + symbols[symbolIndex].n_un.n_strx;
            if (strcmp(name, "_glDrawArrays") != 0) continue;
            const uintptr_t replacement = reinterpret_cast<uintptr_t>(
              CSSEarthGoogleEarthZoomDrawArrays);
            if (bindings[bindingIndex] == replacement) continue;
            if (Api.nextDrawArrays == nullptr) {
              Api.nextDrawArrays = reinterpret_cast<DrawArraysFunction>(
                bindings[bindingIndex]);
            }
            bindings[bindingIndex] = replacement;
            rebound += 1;
          }
        }
      }
      commands += command->cmdsize;
    }
  }
  return rebound;
}

__attribute__((constructor)) static void InstallZoomOracleHook() {
  ResolveFunctions();
  const int rebound = RebindGoogleEarthDrawArrays();
  std::ostringstream line;
  line << "{\"event\":\"installed\",\"monotonicNanoseconds\":"
       << MonotonicNanoseconds()
       << ",\"pid\":" << getpid()
       << ",\"reboundDrawArrays\":" << rebound
       << ",\"notifyAvailable\":"
       << (Api.notifyInternal != nullptr ? "true" : "false")
       << ",\"legacyWheelAvailable\":"
       << (Api.legacyWheelConstructor != nullptr ? "true" : "false")
       << ",\"pixelWheelAvailable\":"
       << (Api.pixelWheelConstructor != nullptr ? "true" : "false") << '}';
  AppendLine("CSSEARTH_GOOGLE_EARTH_ZOOM_EVENT_LOG", line.str());
  dispatch_async(dispatch_get_main_queue(), ^{
    RecordWidgetInventory();
    MonitorCommands();
  });
}

}  // namespace
