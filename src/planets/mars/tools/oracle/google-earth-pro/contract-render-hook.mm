#include <OpenGL/gl.h>

#include <dlfcn.h>
#include <fcntl.h>
#include <mach-o/dyld.h>
#include <mach-o/loader.h>
#include <mach-o/nlist.h>
#include <mach/mach.h>
#include <pthread.h>
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
#include <utility>
#include <vector>

namespace {

using DrawArraysFunction = void (*)(GLenum, GLint, GLsizei);
using DrawElementsFunction = void (*)(GLenum, GLsizei, GLenum, const GLvoid *);
using GetIntegervFunction = void (*)(GLenum, GLint *);
using GetFloatvFunction = void (*)(GLenum, GLfloat *);
using GetUniformLocationFunction = GLint (*)(GLuint, const GLchar *);
using GetUniformivFunction = void (*)(GLuint, GLint, GLint *);
using GetUniformfvFunction = void (*)(GLuint, GLint, GLfloat *);
using GetProgramivFunction = void (*)(GLuint, GLenum, GLint *);
using GetAttachedShadersFunction = void (*)(
  GLuint, GLsizei, GLsizei *, GLuint *);
using GetShaderivFunction = void (*)(GLuint, GLenum, GLint *);
using GetShaderSourceFunction = void (*)(
  GLuint, GLsizei, GLsizei *, GLchar *);
using GetActiveUniformFunction = void (*)(
  GLuint, GLuint, GLsizei, GLsizei *, GLint *, GLenum *, GLchar *);
using GetActiveAttribFunction = void (*)(
  GLuint, GLuint, GLsizei, GLsizei *, GLint *, GLenum *, GLchar *);
using GetAttribLocationFunction = GLint (*)(GLuint, const GLchar *);
using GetVertexAttribivFunction = void (*)(GLuint, GLenum, GLint *);
using GetVertexAttribPointervFunction = void (*)(GLuint, GLenum, GLvoid **);
using ActiveTextureFunction = void (*)(GLenum);
using GetTexLevelParameterivFunction = void (*)(GLenum, GLint, GLenum, GLint *);
using GetTexParameterivFunction = void (*)(GLenum, GLenum, GLint *);
using GetTexImageFunction = void (*)(GLenum, GLint, GLenum, GLenum, GLvoid *);
using PixelStoreiFunction = void (*)(GLenum, GLint);
using BindBufferFunction = void (*)(GLenum, GLuint);
using GetBufferParameterivFunction = void (*)(GLenum, GLenum, GLint *);
using GetBufferSubDataFunction = void (*)(GLenum, GLintptr, GLsizeiptr, GLvoid *);
using IsEnabledFunction = GLboolean (*)(GLenum);
using CurrentContextFunction = void *(*)();

struct OpenGLFunctions {
  DrawArraysFunction nextDrawArrays;
  DrawElementsFunction nextDrawElements;
  GetIntegervFunction getIntegerv;
  GetFloatvFunction getFloatv;
  GetUniformLocationFunction getUniformLocation;
  GetUniformivFunction getUniformiv;
  GetUniformfvFunction getUniformfv;
  GetProgramivFunction getProgramiv;
  GetAttachedShadersFunction getAttachedShaders;
  GetShaderivFunction getShaderiv;
  GetShaderSourceFunction getShaderSource;
  GetActiveUniformFunction getActiveUniform;
  GetActiveAttribFunction getActiveAttrib;
  GetAttribLocationFunction getAttribLocation;
  GetVertexAttribivFunction getVertexAttribiv;
  GetVertexAttribPointervFunction getVertexAttribPointerv;
  ActiveTextureFunction activeTexture;
  GetTexLevelParameterivFunction getTexLevelParameteriv;
  GetTexParameterivFunction getTexParameteriv;
  GetTexImageFunction getTexImage;
  PixelStoreiFunction pixelStorei;
  BindBufferFunction bindBuffer;
  GetBufferParameterivFunction getBufferParameteriv;
  GetBufferSubDataFunction getBufferSubData;
  IsEnabledFunction isEnabled;
  CurrentContextFunction currentContext;
};

struct SnapshotKey {
  void *context;
  uint32_t revision;
  GLuint program;
  GLuint unitZeroTexture;
  GLenum primitive;
  GLsizei count;
};

struct ProgramKey {
  void *context;
  GLuint program;
};

struct TextureKey {
  void *context;
  GLuint texture;
};

struct BufferKey {
  void *context;
  GLuint buffer;
};

struct TextureInfo {
  GLint unit;
  GLuint texture;
  GLint width;
  GLint height;
  GLint internalFormat;
  GLint minFilter;
  GLint magFilter;
  GLint wrapS;
  GLint wrapT;
  std::string dumpPath;
};

static OpenGLFunctions Functions = {};
static pthread_once_t ResolveOnce = PTHREAD_ONCE_INIT;
static pthread_mutex_t StateLock = PTHREAD_MUTEX_INITIALIZER;
static SnapshotKey Snapshots[16384] = {};
static size_t SnapshotCount = 0;
static ProgramKey AuditedPrograms[1024] = {};
static size_t AuditedProgramCount = 0;
static TextureKey DumpedTextures[512] = {};
static size_t DumpedTextureCount = 0;
static BufferKey DumpedBuffers[128] = {};
static size_t DumpedBufferCount = 0;
static const volatile char *MappedControl = nullptr;
static int MappedControlDescriptor = -1;

template <typename Function>
static Function ResolveSymbol(void *handle, const char *name) {
  return reinterpret_cast<Function>(dlsym(handle, name));
}

static void ResolveFunctions() {
  void *handle = dlopen(
    "/System/Library/Frameworks/OpenGL.framework/Versions/A/OpenGL",
    RTLD_LAZY | RTLD_LOCAL);
  if (handle == nullptr) return;
  Functions.getIntegerv = ResolveSymbol<GetIntegervFunction>(
    handle, "glGetIntegerv");
  Functions.getFloatv = ResolveSymbol<GetFloatvFunction>(handle, "glGetFloatv");
  Functions.getUniformLocation = ResolveSymbol<GetUniformLocationFunction>(
    handle, "glGetUniformLocation");
  Functions.getUniformiv = ResolveSymbol<GetUniformivFunction>(
    handle, "glGetUniformiv");
  Functions.getUniformfv = ResolveSymbol<GetUniformfvFunction>(
    handle, "glGetUniformfv");
  Functions.getProgramiv = ResolveSymbol<GetProgramivFunction>(
    handle, "glGetProgramiv");
  Functions.getAttachedShaders = ResolveSymbol<GetAttachedShadersFunction>(
    handle, "glGetAttachedShaders");
  Functions.getShaderiv = ResolveSymbol<GetShaderivFunction>(
    handle, "glGetShaderiv");
  Functions.getShaderSource = ResolveSymbol<GetShaderSourceFunction>(
    handle, "glGetShaderSource");
  Functions.getActiveUniform = ResolveSymbol<GetActiveUniformFunction>(
    handle, "glGetActiveUniform");
  Functions.getActiveAttrib = ResolveSymbol<GetActiveAttribFunction>(
    handle, "glGetActiveAttrib");
  Functions.getAttribLocation = ResolveSymbol<GetAttribLocationFunction>(
    handle, "glGetAttribLocation");
  Functions.getVertexAttribiv = ResolveSymbol<GetVertexAttribivFunction>(
    handle, "glGetVertexAttribiv");
  Functions.getVertexAttribPointerv =
    ResolveSymbol<GetVertexAttribPointervFunction>(
      handle, "glGetVertexAttribPointerv");
  Functions.activeTexture = ResolveSymbol<ActiveTextureFunction>(
    handle, "glActiveTexture");
  Functions.getTexLevelParameteriv =
    ResolveSymbol<GetTexLevelParameterivFunction>(
      handle, "glGetTexLevelParameteriv");
  Functions.getTexParameteriv = ResolveSymbol<GetTexParameterivFunction>(
    handle, "glGetTexParameteriv");
  Functions.getTexImage = ResolveSymbol<GetTexImageFunction>(
    handle, "glGetTexImage");
  Functions.pixelStorei = ResolveSymbol<PixelStoreiFunction>(
    handle, "glPixelStorei");
  Functions.bindBuffer = ResolveSymbol<BindBufferFunction>(
    handle, "glBindBuffer");
  Functions.getBufferParameteriv = ResolveSymbol<GetBufferParameterivFunction>(
    handle, "glGetBufferParameteriv");
  Functions.getBufferSubData = ResolveSymbol<GetBufferSubDataFunction>(
    handle, "glGetBufferSubData");
  Functions.isEnabled = ResolveSymbol<IsEnabledFunction>(handle, "glIsEnabled");
  Functions.currentContext = ResolveSymbol<CurrentContextFunction>(
    handle, "CGLGetCurrentContext");
}

static bool Ready() {
  pthread_once(&ResolveOnce, ResolveFunctions);
  return Functions.getIntegerv != nullptr &&
    Functions.getUniformLocation != nullptr &&
    Functions.getUniformiv != nullptr &&
    Functions.getUniformfv != nullptr;
}

static void MapControl() {
  if (MappedControl != nullptr) return;
  const char *path = getenv("CSSMARS_ORACLE_LAYER_MODE_FILE");
  if (path == nullptr || path[0] == '\0') return;
  MappedControlDescriptor = open(path, O_RDONLY);
  if (MappedControlDescriptor < 0) return;
  void *mapping = mmap(
    nullptr,
    32,
    PROT_READ,
    MAP_SHARED,
    MappedControlDescriptor,
    0);
  if (mapping == MAP_FAILED) return;
  MappedControl = reinterpret_cast<const volatile char *>(mapping);
}

static uint32_t ControlRevision() {
  MapControl();
  if (MappedControl == nullptr) return 0;
  return static_cast<uint32_t>(static_cast<uint8_t>(MappedControl[20])) |
    static_cast<uint32_t>(static_cast<uint8_t>(MappedControl[21])) << 8 |
    static_cast<uint32_t>(static_cast<uint8_t>(MappedControl[22])) << 16 |
    static_cast<uint32_t>(static_cast<uint8_t>(MappedControl[23])) << 24;
}

static std::string ControlMode() {
  MapControl();
  if (MappedControl == nullptr) return "unknown";
  char mode[16] = {};
  for (size_t index = 0; index < sizeof(mode) - 1; index += 1) {
    mode[index] = MappedControl[index];
  }
  return mode;
}

static bool ControlFlag(size_t offset) {
  MapControl();
  return MappedControl != nullptr && MappedControl[offset] == '1';
}

static const char *EnvironmentValue(
    const char *versionedName,
    const char *fallbackName) {
  const char *value = getenv(versionedName);
  return value != nullptr && value[0] != '\0' ? value : getenv(fallbackName);
}

static void AppendLine(const char *environmentName, const std::string &line) {
  const char *fallbackName = environmentName;
  if (strcmp(environmentName, "CSSMARS_ORACLE_CONTRACT_LOG_V10") == 0) {
    fallbackName = "CSSMARS_ORACLE_CONTRACT_LOG";
  } else if (strcmp(
      environmentName, "CSSMARS_ORACLE_CONTRACT_UNIFORM_LOG_V10") == 0) {
    fallbackName = "CSSMARS_ORACLE_CONTRACT_UNIFORM_LOG";
  } else if (strcmp(
      environmentName, "CSSMARS_ORACLE_CONTRACT_INSTALL_LOG_V10") == 0) {
    fallbackName = "CSSMARS_ORACLE_CONTRACT_INSTALL_LOG";
  }
  const char *path = EnvironmentValue(environmentName, fallbackName);
  if (path == nullptr || path[0] == '\0') return;
  int descriptor = open(path, O_WRONLY | O_CREAT | O_APPEND, 0600);
  if (descriptor < 0) return;
  write(descriptor, line.data(), line.size());
  write(descriptor, "\n", 1);
  close(descriptor);
}

static std::string PointerString(void *pointer) {
  std::ostringstream stream;
  stream << "0x" << std::hex << reinterpret_cast<uintptr_t>(pointer);
  return stream.str();
}

static bool MarkSnapshot(
    void *context,
    uint32_t revision,
    GLuint program,
    GLuint texture,
    GLenum primitive,
    GLsizei count) {
  pthread_mutex_lock(&StateLock);
  for (size_t index = 0; index < SnapshotCount; index += 1) {
    const SnapshotKey &key = Snapshots[index];
    if (key.context == context && key.revision == revision &&
        key.program == program && key.unitZeroTexture == texture &&
        key.primitive == primitive && key.count == count) {
      pthread_mutex_unlock(&StateLock);
      return false;
    }
  }
  if (SnapshotCount < sizeof(Snapshots) / sizeof(Snapshots[0])) {
    Snapshots[SnapshotCount++] = {
      context, revision, program, texture, primitive, count,
    };
  }
  pthread_mutex_unlock(&StateLock);
  return true;
}

static bool MarkProgram(void *context, GLuint program) {
  pthread_mutex_lock(&StateLock);
  for (size_t index = 0; index < AuditedProgramCount; index += 1) {
    if (AuditedPrograms[index].context == context &&
        AuditedPrograms[index].program == program) {
      pthread_mutex_unlock(&StateLock);
      return false;
    }
  }
  if (AuditedProgramCount <
      sizeof(AuditedPrograms) / sizeof(AuditedPrograms[0])) {
    AuditedPrograms[AuditedProgramCount++] = { context, program };
  }
  pthread_mutex_unlock(&StateLock);
  return true;
}

static bool MarkTexture(void *context, GLuint texture) {
  pthread_mutex_lock(&StateLock);
  for (size_t index = 0; index < DumpedTextureCount; index += 1) {
    if (DumpedTextures[index].context == context &&
        DumpedTextures[index].texture == texture) {
      pthread_mutex_unlock(&StateLock);
      return false;
    }
  }
  if (DumpedTextureCount <
      sizeof(DumpedTextures) / sizeof(DumpedTextures[0])) {
    DumpedTextures[DumpedTextureCount++] = { context, texture };
  }
  pthread_mutex_unlock(&StateLock);
  return true;
}

static bool MarkBuffer(void *context, GLuint buffer) {
  pthread_mutex_lock(&StateLock);
  for (size_t index = 0; index < DumpedBufferCount; index += 1) {
    if (DumpedBuffers[index].context == context &&
        DumpedBuffers[index].buffer == buffer) {
      pthread_mutex_unlock(&StateLock);
      return false;
    }
  }
  if (DumpedBufferCount < sizeof(DumpedBuffers) / sizeof(DumpedBuffers[0])) {
    DumpedBuffers[DumpedBufferCount++] = { context, buffer };
  }
  pthread_mutex_unlock(&StateLock);
  return true;
}

static GLint UniformLocation(GLuint program, const char *name) {
  if (program == 0 || Functions.getUniformLocation == nullptr) return -1;
  return Functions.getUniformLocation(program, name);
}

static void AppendFloatArray(
    std::ostringstream &stream,
    GLuint program,
    const char *name,
    size_t count,
    bool *first) {
  GLint location = UniformLocation(program, name);
  if (location < 0) return;
  GLfloat values[16] = {};
  Functions.getUniformfv(program, location, values);
  if (!*first) stream << ',';
  *first = false;
  stream << '"' << name << "\":[" << std::setprecision(9);
  for (size_t index = 0; index < count; index += 1) {
    if (index != 0) stream << ',';
    stream << values[index];
  }
  stream << ']';
}

static size_t FloatComponentCount(GLenum type) {
  switch (type) {
    case GL_FLOAT: return 1;
    case GL_FLOAT_VEC2: return 2;
    case GL_FLOAT_VEC3: return 3;
    case GL_FLOAT_VEC4: return 4;
    case GL_FLOAT_MAT2: return 4;
    case GL_FLOAT_MAT3: return 9;
    case GL_FLOAT_MAT4: return 16;
    default: return 0;
  }
}

static void AppendActiveFloatUniforms(
    std::ostringstream &stream,
    GLuint program,
    bool *first) {
  if (program == 0 || Functions.getProgramiv == nullptr ||
      Functions.getActiveUniform == nullptr) {
    return;
  }
  GLint activeCount = 0;
  GLint maximumLength = 0;
  Functions.getProgramiv(program, GL_ACTIVE_UNIFORMS, &activeCount);
  Functions.getProgramiv(
    program, GL_ACTIVE_UNIFORM_MAX_LENGTH, &maximumLength);
  if (activeCount <= 0 || maximumLength <= 0 || maximumLength > 4096) return;
  std::vector<GLchar> name(static_cast<size_t>(maximumLength));
  for (GLint index = 0; index < activeCount; index += 1) {
    GLsizei length = 0;
    GLint size = 0;
    GLenum type = 0;
    Functions.getActiveUniform(
      program,
      static_cast<GLuint>(index),
      maximumLength,
      &length,
      &size,
      &type,
      name.data());
    size_t components = FloatComponentCount(type);
    size_t valueCount = components * static_cast<size_t>(std::max(size, 0));
    if (length <= 0 || components == 0 || valueCount == 0 || valueCount > 64) {
      continue;
    }
    GLint location = Functions.getUniformLocation(program, name.data());
    if (location < 0) continue;
    std::vector<GLfloat> values(valueCount);
    Functions.getUniformfv(program, location, values.data());
    if (!*first) stream << ',';
    *first = false;
    stream << '"' << std::string(name.data(), static_cast<size_t>(length))
           << "\":[" << std::setprecision(9);
    for (size_t valueIndex = 0; valueIndex < values.size(); valueIndex += 1) {
      if (valueIndex != 0) stream << ',';
      stream << values[valueIndex];
    }
    stream << ']';
  }
}

static GLuint BoundTextureForUnit(GLint unit) {
  if (Functions.activeTexture == nullptr || unit < 0 || unit > 31) return 0;
  GLint previousActiveTexture = GL_TEXTURE0;
  Functions.getIntegerv(GL_ACTIVE_TEXTURE, &previousActiveTexture);
  Functions.activeTexture(GL_TEXTURE0 + unit);
  GLint binding = 0;
  Functions.getIntegerv(GL_TEXTURE_BINDING_2D, &binding);
  Functions.activeTexture(static_cast<GLenum>(previousActiveTexture));
  return static_cast<GLuint>(binding);
}

static TextureInfo InspectTexture(GLint unit, GLuint texture) {
  TextureInfo info = { unit, texture, 0, 0, 0, 0, 0, 0, 0, "" };
  if (texture == 0 || Functions.activeTexture == nullptr ||
      Functions.getTexLevelParameteriv == nullptr) {
    return info;
  }
  GLint previousActiveTexture = GL_TEXTURE0;
  Functions.getIntegerv(GL_ACTIVE_TEXTURE, &previousActiveTexture);
  Functions.activeTexture(GL_TEXTURE0 + unit);
  Functions.getTexLevelParameteriv(
    GL_TEXTURE_2D, 0, GL_TEXTURE_WIDTH, &info.width);
  Functions.getTexLevelParameteriv(
    GL_TEXTURE_2D, 0, GL_TEXTURE_HEIGHT, &info.height);
  Functions.getTexLevelParameteriv(
    GL_TEXTURE_2D, 0, GL_TEXTURE_INTERNAL_FORMAT, &info.internalFormat);
  if (Functions.getTexParameteriv != nullptr) {
    Functions.getTexParameteriv(
      GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, &info.minFilter);
    Functions.getTexParameteriv(
      GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, &info.magFilter);
    Functions.getTexParameteriv(
      GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, &info.wrapS);
    Functions.getTexParameteriv(
      GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, &info.wrapT);
  }
  Functions.activeTexture(static_cast<GLenum>(previousActiveTexture));
  return info;
}

static void DumpTextureIfNeeded(void *context, TextureInfo *info) {
  const char *root = EnvironmentValue(
    "CSSMARS_ORACLE_CONTRACT_TEXTURE_ROOT_V10",
    "CSSMARS_ORACLE_CONTRACT_TEXTURE_ROOT");
  if (root == nullptr || root[0] == '\0' || info->texture == 0 ||
      info->width <= 0 || info->height <= 0 || info->width > 4096 ||
      info->height > 4096 || Functions.getTexImage == nullptr ||
      Functions.pixelStorei == nullptr || !MarkTexture(context, info->texture)) {
    return;
  }
  const size_t byteCount = static_cast<size_t>(info->width) *
    static_cast<size_t>(info->height) * 4;
  if (byteCount > 64 * 1024 * 1024) return;
  std::vector<GLubyte> pixels(byteCount);
  GLint previousActiveTexture = GL_TEXTURE0;
  GLint previousPackAlignment = 4;
  Functions.getIntegerv(GL_ACTIVE_TEXTURE, &previousActiveTexture);
  Functions.getIntegerv(GL_PACK_ALIGNMENT, &previousPackAlignment);
  Functions.activeTexture(GL_TEXTURE0 + info->unit);
  Functions.pixelStorei(GL_PACK_ALIGNMENT, 1);
  Functions.getTexImage(
    GL_TEXTURE_2D, 0, GL_RGBA, GL_UNSIGNED_BYTE, pixels.data());
  Functions.pixelStorei(GL_PACK_ALIGNMENT, previousPackAlignment);
  Functions.activeTexture(static_cast<GLenum>(previousActiveTexture));
  char path[2048];
  snprintf(
    path,
    sizeof(path),
    "%s/texture-%d-%p-%u-%dx%d.rgba",
    root,
    getpid(),
    context,
    info->texture,
    info->width,
    info->height);
  int descriptor = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0600);
  if (descriptor < 0) return;
  ssize_t written = write(descriptor, pixels.data(), pixels.size());
  close(descriptor);
  if (written == static_cast<ssize_t>(pixels.size())) info->dumpPath = path;
}

static void AppendTextureJson(
    std::ostringstream &stream,
    const char *name,
    const TextureInfo &info,
    bool *first) {
  if (!*first) stream << ',';
  *first = false;
  stream << '"' << name << "\":{\"unit\":" << info.unit
         << ",\"texture\":" << info.texture
         << ",\"width\":" << info.width
         << ",\"height\":" << info.height
         << ",\"internalFormat\":" << info.internalFormat
         << ",\"minFilter\":" << info.minFilter
         << ",\"magFilter\":" << info.magFilter
         << ",\"wrapS\":" << info.wrapS
         << ",\"wrapT\":" << info.wrapT;
  if (!info.dumpPath.empty()) stream << ",\"dumpPath\":\"" << info.dumpPath << '"';
  stream << '}';
}

static bool AppendSampler(
    std::ostringstream &stream,
    GLuint program,
    const char *name,
    void *context,
    bool dump,
    bool *first) {
  GLint location = UniformLocation(program, name);
  if (location < 0) return false;
  GLint unit = 0;
  Functions.getUniformiv(program, location, &unit);
  GLuint texture = BoundTextureForUnit(unit);
  TextureInfo info = InspectTexture(unit, texture);
  if (dump) DumpTextureIfNeeded(context, &info);
  AppendTextureJson(stream, name, info, first);
  return true;
}

static std::string DumpBufferIfNeeded(
    void *context,
    GLuint buffer,
    GLint byteCount) {
  const char *root = EnvironmentValue(
    "CSSMARS_ORACLE_CONTRACT_TEXTURE_ROOT_V10",
    "CSSMARS_ORACLE_CONTRACT_TEXTURE_ROOT");
  if (root == nullptr || root[0] == '\0' || buffer == 0 || byteCount <= 0 ||
      byteCount > 64 * 1024 * 1024 || Functions.bindBuffer == nullptr ||
      Functions.getBufferSubData == nullptr || !MarkBuffer(context, buffer)) {
    return "";
  }
  GLint previousBuffer = 0;
  Functions.getIntegerv(GL_ARRAY_BUFFER_BINDING, &previousBuffer);
  Functions.bindBuffer(GL_ARRAY_BUFFER, buffer);
  std::vector<GLubyte> bytes(static_cast<size_t>(byteCount));
  Functions.getBufferSubData(GL_ARRAY_BUFFER, 0, byteCount, bytes.data());
  Functions.bindBuffer(GL_ARRAY_BUFFER, static_cast<GLuint>(previousBuffer));
  char path[2048];
  snprintf(
    path,
    sizeof(path),
    "%s/buffer-%d-%p-%u-%d.bin",
    root,
    getpid(),
    context,
    buffer,
    byteCount);
  int descriptor = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0600);
  if (descriptor < 0) return "";
  ssize_t written = write(descriptor, bytes.data(), bytes.size());
  close(descriptor);
  return written == static_cast<ssize_t>(bytes.size()) ? path : "";
}

static void AppendAttributeContract(
    std::ostringstream &stream,
    GLuint program,
    void *context,
    bool dumpBuffers,
    GLsizei drawCount,
    uint32_t revision,
    GLuint unitZeroTexture) {
  if (program == 0 || Functions.getProgramiv == nullptr ||
      Functions.getActiveAttrib == nullptr ||
      Functions.getAttribLocation == nullptr ||
      Functions.getVertexAttribiv == nullptr) {
    return;
  }
  GLint activeCount = 0;
  GLint maximumLength = 0;
  Functions.getProgramiv(program, GL_ACTIVE_ATTRIBUTES, &activeCount);
  Functions.getProgramiv(
    program, GL_ACTIVE_ATTRIBUTE_MAX_LENGTH, &maximumLength);
  if (activeCount <= 0 || maximumLength <= 0 || maximumLength > 4096) return;
  std::vector<GLchar> name(static_cast<size_t>(maximumLength));
  bool first = true;
  for (GLint index = 0; index < activeCount; index += 1) {
    GLsizei length = 0;
    GLint declaredSize = 0;
    GLenum declaredType = 0;
    Functions.getActiveAttrib(
      program,
      static_cast<GLuint>(index),
      maximumLength,
      &length,
      &declaredSize,
      &declaredType,
      name.data());
    if (length <= 0) continue;
    GLint location = Functions.getAttribLocation(program, name.data());
    if (location < 0) continue;
    GLint enabled = 0;
    GLint components = 0;
    GLint type = 0;
    GLint normalized = 0;
    GLint stride = 0;
    GLint buffer = 0;
    Functions.getVertexAttribiv(location, GL_VERTEX_ATTRIB_ARRAY_ENABLED, &enabled);
    Functions.getVertexAttribiv(location, GL_VERTEX_ATTRIB_ARRAY_SIZE, &components);
    Functions.getVertexAttribiv(location, GL_VERTEX_ATTRIB_ARRAY_TYPE, &type);
    Functions.getVertexAttribiv(
      location, GL_VERTEX_ATTRIB_ARRAY_NORMALIZED, &normalized);
    Functions.getVertexAttribiv(location, GL_VERTEX_ATTRIB_ARRAY_STRIDE, &stride);
    Functions.getVertexAttribiv(
      location, GL_VERTEX_ATTRIB_ARRAY_BUFFER_BINDING, &buffer);
    GLvoid *pointer = nullptr;
    if (Functions.getVertexAttribPointerv != nullptr) {
      Functions.getVertexAttribPointerv(
        location, GL_VERTEX_ATTRIB_ARRAY_POINTER, &pointer);
    }
    GLint bufferBytes = 0;
    std::string dumpPath;
    if (buffer > 0 && Functions.bindBuffer != nullptr &&
        Functions.getBufferParameteriv != nullptr) {
      GLint previousBuffer = 0;
      Functions.getIntegerv(GL_ARRAY_BUFFER_BINDING, &previousBuffer);
      Functions.bindBuffer(GL_ARRAY_BUFFER, static_cast<GLuint>(buffer));
      Functions.getBufferParameteriv(GL_ARRAY_BUFFER, GL_BUFFER_SIZE, &bufferBytes);
      Functions.bindBuffer(
        GL_ARRAY_BUFFER, static_cast<GLuint>(previousBuffer));
      if (dumpBuffers) {
        dumpPath = DumpBufferIfNeeded(
          context, static_cast<GLuint>(buffer), bufferBytes);
      }
    }
    GLint clientBytes = 0;
    std::string clientDumpPath;
    size_t componentBytes = type == GL_FLOAT || type == GL_UNSIGNED_INT ||
        type == GL_INT ? 4 : type == GL_UNSIGNED_SHORT || type == GL_SHORT
        ? 2 : type == GL_UNSIGNED_BYTE || type == GL_BYTE ? 1 : 0;
    if (buffer == 0 && enabled != 0 && pointer != nullptr && dumpBuffers &&
        drawCount > 0 && componentBytes > 0) {
      size_t elementBytes = static_cast<size_t>(std::max(components, 0)) *
        componentBytes;
      size_t effectiveStride = stride > 0
        ? static_cast<size_t>(stride)
        : elementBytes;
      size_t requestedBytes = effectiveStride *
        static_cast<size_t>(drawCount - 1) + elementBytes;
      if (requestedBytes > 0 && requestedBytes <= 1024 * 1024) {
        char path[2048];
        const char *root = EnvironmentValue(
          "CSSMARS_ORACLE_CONTRACT_TEXTURE_ROOT_V10",
          "CSSMARS_ORACLE_CONTRACT_TEXTURE_ROOT");
        if (root != nullptr && root[0] != '\0') {
          snprintf(
            path,
            sizeof(path),
            "%s/client-%d-%p-%u-%u-%u-%d-%zu.bin",
            root,
            getpid(),
            context,
            revision,
            program,
            unitZeroTexture,
            location,
            requestedBytes);
          int descriptor = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0600);
          if (descriptor >= 0) {
            ssize_t written = write(descriptor, pointer, requestedBytes);
            close(descriptor);
            if (written == static_cast<ssize_t>(requestedBytes)) {
              clientBytes = static_cast<GLint>(requestedBytes);
              clientDumpPath = path;
            }
          }
        }
      }
    }
    if (!first) stream << ',';
    first = false;
    stream << '"' << std::string(name.data(), static_cast<size_t>(length))
           << "\":{\"location\":" << location
           << ",\"declaredSize\":" << declaredSize
           << ",\"declaredType\":" << declaredType
           << ",\"enabled\":" << (enabled != 0 ? "true" : "false")
           << ",\"components\":" << components
           << ",\"type\":" << type
           << ",\"normalized\":" << (normalized != 0 ? "true" : "false")
           << ",\"stride\":" << stride
           << ",\"buffer\":" << buffer
           << ",\"bufferBytes\":" << bufferBytes
           << ",\"pointerOffset\":"
           << reinterpret_cast<uintptr_t>(pointer);
    if (!dumpPath.empty()) stream << ",\"dumpPath\":\"" << dumpPath << '"';
    if (!clientDumpPath.empty()) {
      stream << ",\"clientBytes\":" << clientBytes
             << ",\"clientDumpPath\":\"" << clientDumpPath << '"';
    }
    stream << '}';
  }
}

static void DumpProgramShaders(void *context, GLuint program) {
  const char *root = EnvironmentValue(
    "CSSMARS_ORACLE_CONTRACT_SHADER_ROOT_V10",
    "CSSMARS_ORACLE_CONTRACT_SHADER_ROOT");
  if (root == nullptr || root[0] == '\0' ||
      Functions.getProgramiv == nullptr ||
      Functions.getAttachedShaders == nullptr ||
      Functions.getShaderiv == nullptr ||
      Functions.getShaderSource == nullptr) {
    return;
  }
  GLint shaderCount = 0;
  Functions.getProgramiv(program, GL_ATTACHED_SHADERS, &shaderCount);
  if (shaderCount <= 0 || shaderCount > 32) return;
  std::vector<GLuint> shaders(static_cast<size_t>(shaderCount));
  GLsizei returnedCount = 0;
  Functions.getAttachedShaders(
    program, shaderCount, &returnedCount, shaders.data());
  for (GLsizei index = 0; index < returnedCount; index += 1) {
    GLint sourceLength = 0;
    GLint shaderType = 0;
    Functions.getShaderiv(shaders[index], GL_SHADER_SOURCE_LENGTH, &sourceLength);
    Functions.getShaderiv(shaders[index], GL_SHADER_TYPE, &shaderType);
    if (sourceLength <= 1 || sourceLength > 16 * 1024 * 1024) continue;
    std::vector<GLchar> source(static_cast<size_t>(sourceLength));
    GLsizei returnedLength = 0;
    Functions.getShaderSource(
      shaders[index], sourceLength, &returnedLength, source.data());
    if (returnedLength <= 0) continue;
    const char *stage = shaderType == GL_VERTEX_SHADER
      ? "vertex"
      : shaderType == GL_FRAGMENT_SHADER ? "fragment" : "unknown";
    char path[2048];
    snprintf(
      path,
      sizeof(path),
      "%s/program-%d-%p-%u-shader-%u-%s.glsl",
      root,
      getpid(),
      context,
      program,
      shaders[index],
      stage);
    int descriptor = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0600);
    if (descriptor < 0) continue;
    ssize_t written = write(
      descriptor, source.data(), static_cast<size_t>(returnedLength));
    close(descriptor);
    if (written != returnedLength) continue;
    std::ostringstream line;
    line << "shader\t" << PointerString(context) << '\t' << program << '\t'
         << shaders[index] << '\t' << shaderType << '\t' << returnedLength
         << '\t' << path;
    AppendLine("CSSMARS_ORACLE_CONTRACT_INSTALL_LOG_V10", line.str());
  }
}

static void AuditProgram(void *context, GLuint program) {
  if (program == 0 || Functions.getProgramiv == nullptr ||
      Functions.getActiveUniform == nullptr || !MarkProgram(context, program)) {
    return;
  }
  DumpProgramShaders(context, program);
  GLint activeCount = 0;
  GLint maximumLength = 0;
  Functions.getProgramiv(program, GL_ACTIVE_UNIFORMS, &activeCount);
  Functions.getProgramiv(
    program, GL_ACTIVE_UNIFORM_MAX_LENGTH, &maximumLength);
  if (activeCount <= 0 || maximumLength <= 0 || maximumLength > 4096) return;
  std::vector<GLchar> name(static_cast<size_t>(maximumLength));
  for (GLint index = 0; index < activeCount; index += 1) {
    GLsizei length = 0;
    GLint size = 0;
    GLenum type = 0;
    Functions.getActiveUniform(
      program,
      static_cast<GLuint>(index),
      maximumLength,
      &length,
      &size,
      &type,
      name.data());
    if (length <= 0) continue;
    GLint location = Functions.getUniformLocation(program, name.data());
    std::ostringstream line;
    line << PointerString(context) << '\t' << program << '\t' << index
         << '\t' << size << '\t' << type << '\t' << location << '\t'
         << std::string(name.data(), static_cast<size_t>(length));
    AppendLine("CSSMARS_ORACLE_CONTRACT_UNIFORM_LOG_V10", line.str());
  }
}

static void RecordSnapshot(
    GLenum primitive,
    GLsizei count,
    bool indexed,
    GLenum elementType) {
  if (!Ready()) return;
  GLint currentProgram = 0;
  Functions.getIntegerv(GL_CURRENT_PROGRAM, &currentProgram);
  void *context = Functions.currentContext == nullptr
    ? nullptr
    : Functions.currentContext();
  GLuint unitZeroTexture = BoundTextureForUnit(0);
  uint32_t revision = ControlRevision();
  if (!MarkSnapshot(
      context,
      revision,
      static_cast<GLuint>(std::max(currentProgram, 0)),
      unitZeroTexture,
      primitive,
      count)) {
    return;
  }

  GLuint program = static_cast<GLuint>(std::max(currentProgram, 0));
  const char *isolation = getenv("CSSMARS_ORACLE_COMPONENT_ISOLATION");
  if (isolation != nullptr && strcmp(isolation, "1") == 0 &&
      ControlMode() == "hide-ground") {
    const bool isSkyMap = UniformLocation(program, "skymapTexture") >= 0;
    const bool isCatalogueStars = primitive == GL_POINTS && count == 5000 &&
      UniformLocation(program, "t_tex0") >= 0;
    bool isSunBillboard = false;
    if (program == 6 && primitive == GL_TRIANGLE_STRIP && count == 4) {
      TextureInfo texture = InspectTexture(0, unitZeroTexture);
      isSunBillboard = texture.width == 128 && texture.height == 128;
    }
    if (!isSkyMap && !isCatalogueStars && !isSunBillboard) return;
  }
  AuditProgram(context, program);
  GLint viewport[4] = {};
  Functions.getIntegerv(GL_VIEWPORT, viewport);
  GLint blendSourceRgb = 0;
  GLint blendDestinationRgb = 0;
  GLint blendSourceAlpha = 0;
  GLint blendDestinationAlpha = 0;
  GLint depthWrite = 0;
  Functions.getIntegerv(GL_BLEND_SRC_RGB, &blendSourceRgb);
  Functions.getIntegerv(GL_BLEND_DST_RGB, &blendDestinationRgb);
  Functions.getIntegerv(GL_BLEND_SRC_ALPHA, &blendSourceAlpha);
  Functions.getIntegerv(GL_BLEND_DST_ALPHA, &blendDestinationAlpha);
  Functions.getIntegerv(GL_DEPTH_WRITEMASK, &depthWrite);

  std::ostringstream uniforms;
  bool firstUniform = true;
  AppendActiveFloatUniforms(uniforms, program, &firstUniform);

  std::ostringstream samplers;
  bool firstSampler = true;
  bool hasSkyMap = AppendSampler(
    samplers, program, "skymapTexture", context, true, &firstSampler);
  bool hasStarSprite = AppendSampler(
    samplers, program, "t_tex0", context, true, &firstSampler);
  AppendSampler(samplers, program, "skyMap", context, true, &firstSampler);
  AppendSampler(
    samplers, program, "groundTexture", context, false, &firstSampler);

  if (program == 0 && unitZeroTexture != 0) {
    TextureInfo fixedTexture = InspectTexture(0, unitZeroTexture);
    if (ControlMode() == "hide-ground") {
      DumpTextureIfNeeded(context, &fixedTexture);
    }
    AppendTextureJson(
      samplers, "fixedFunctionUnit0", fixedTexture, &firstSampler);
  }

  const bool isCatalogueStars = hasStarSprite && primitive == GL_POINTS &&
    count == 5000;
  std::ostringstream attributes;
  const bool isGenericTexturedQuad = program == 6 &&
    primitive == GL_TRIANGLE_STRIP && count == 4;
  AppendAttributeContract(
    attributes,
    program,
    context,
    isCatalogueStars || isGenericTexturedQuad,
    count,
    revision,
    unitZeroTexture);

  std::ostringstream line;
  line << '{'
       << "\"revision\":" << revision
       << ",\"mode\":\"" << ControlMode() << '"'
       << ",\"atmosphere\":" << (ControlFlag(16) ? "true" : "false")
       << ",\"sun\":" << (ControlFlag(17) ? "true" : "false")
       << ",\"context\":\"" << PointerString(context) << '"'
       << ",\"program\":" << program
       << ",\"indexed\":" << (indexed ? "true" : "false")
       << ",\"primitive\":" << primitive
       << ",\"count\":" << count
       << ",\"elementType\":" << elementType
       << ",\"viewport\":[" << viewport[0] << ',' << viewport[1] << ','
       << viewport[2] << ',' << viewport[3] << ']'
       << ",\"blendEnabled\":"
       << (Functions.isEnabled != nullptr && Functions.isEnabled(GL_BLEND)
         ? "true" : "false")
       << ",\"blend\":[" << blendSourceRgb << ',' << blendDestinationRgb
       << ',' << blendSourceAlpha << ',' << blendDestinationAlpha << ']'
       << ",\"depthTestEnabled\":"
       << (Functions.isEnabled != nullptr && Functions.isEnabled(GL_DEPTH_TEST)
         ? "true" : "false")
       << ",\"depthWrite\":" << (depthWrite != 0 ? "true" : "false")
       << ",\"classification\":{\"skyMap\":"
       << (hasSkyMap ? "true" : "false")
       << ",\"catalogueStars\":"
       << (isCatalogueStars ? "true" : "false") << '}'
       << ",\"uniforms\":{" << uniforms.str() << '}'
       << ",\"samplers\":{" << samplers.str() << '}'
       << ",\"attributes\":{" << attributes.str() << "}}";
  AppendLine("CSSMARS_ORACLE_CONTRACT_LOG_V10", line.str());
}

static bool ComponentDrawAllowed(GLenum primitive, GLsizei count) {
  const char *isolation = getenv("CSSMARS_ORACLE_COMPONENT_ISOLATION");
  if (isolation == nullptr || strcmp(isolation, "1") != 0 ||
      ControlMode() != "hide-ground" || !Ready()) {
    return true;
  }
  GLint currentProgram = 0;
  Functions.getIntegerv(GL_CURRENT_PROGRAM, &currentProgram);
  if (currentProgram <= 0) return false;
  GLuint program = static_cast<GLuint>(currentProgram);
  if (UniformLocation(program, "skymapTexture") >= 0) return true;
  if (primitive == GL_POINTS && count == 5000 &&
      UniformLocation(program, "t_tex0") >= 0) {
    return true;
  }
  if (primitive == GL_TRIANGLE_STRIP && count == 4) {
    GLint sampler = UniformLocation(program, "t_tex0");
    if (sampler >= 0) {
      GLint unit = 0;
      Functions.getUniformiv(program, sampler, &unit);
      GLuint texture = BoundTextureForUnit(unit);
      TextureInfo info = InspectTexture(unit, texture);
      return info.width == 128 && info.height == 128;
    }
  }
  return false;
}

}  // namespace

extern "C" void CSSMarsContractDrawArrays(
    GLenum mode,
    GLint first,
    GLsizei count) {
  RecordSnapshot(mode, count, false, 0);
  if (Functions.nextDrawArrays != nullptr &&
      ComponentDrawAllowed(mode, count)) {
    Functions.nextDrawArrays(mode, first, count);
  }
}

extern "C" void CSSMarsContractDrawElements(
    GLenum mode,
    GLsizei count,
    GLenum type,
    const GLvoid *indices) {
  RecordSnapshot(mode, count, true, type);
  if (Functions.nextDrawElements != nullptr &&
      ComponentDrawAllowed(mode, count)) {
    Functions.nextDrawElements(mode, count, type, indices);
  }
}

namespace {

static bool IsIndirectPointerSection(const section_64 *section) {
  uint32_t type = section->flags & SECTION_TYPE;
  return type == S_LAZY_SYMBOL_POINTERS ||
    type == S_NON_LAZY_SYMBOL_POINTERS;
}

static void MakeBindingsWritable(uintptr_t address, size_t byteCount) {
  vm_size_t pageSize = static_cast<vm_size_t>(getpagesize());
  vm_address_t page = static_cast<vm_address_t>(address) & ~(pageSize - 1);
  vm_size_t length = static_cast<vm_size_t>(
    address + byteCount - page + pageSize - 1) & ~(pageSize - 1);
  vm_protect(
    mach_task_self(),
    page,
    length,
    false,
    VM_PROT_READ | VM_PROT_WRITE | VM_PROT_COPY);
}

static void RebindSection(
    const section_64 *section,
    intptr_t slide,
    const nlist_64 *symbols,
    const char *strings,
    const uint32_t *indirectSymbols,
    int *reboundArrays,
    int *reboundElements) {
  if (!IsIndirectPointerSection(section)) return;
  auto bindings = reinterpret_cast<uintptr_t *>(slide + section->addr);
  size_t bindingCount = section->size / sizeof(uintptr_t);
  MakeBindingsWritable(
    reinterpret_cast<uintptr_t>(bindings),
    bindingCount * sizeof(uintptr_t));
  for (size_t index = 0; index < bindingCount; index += 1) {
    uint32_t symbolIndex = indirectSymbols[section->reserved1 + index];
    if (symbolIndex == INDIRECT_SYMBOL_ABS ||
        symbolIndex == INDIRECT_SYMBOL_LOCAL ||
        symbolIndex == (INDIRECT_SYMBOL_LOCAL | INDIRECT_SYMBOL_ABS)) {
      continue;
    }
    const char *name = strings + symbols[symbolIndex].n_un.n_strx;
    if (strcmp(name, "_glDrawArrays") == 0) {
      uintptr_t replacement =
        reinterpret_cast<uintptr_t>(CSSMarsContractDrawArrays);
      if (bindings[index] == replacement) continue;
      if (Functions.nextDrawArrays == nullptr) {
        Functions.nextDrawArrays = reinterpret_cast<DrawArraysFunction>(
          bindings[index]);
      }
      bindings[index] = replacement;
      *reboundArrays += 1;
    } else if (strcmp(name, "_glDrawElements") == 0) {
      uintptr_t replacement =
        reinterpret_cast<uintptr_t>(CSSMarsContractDrawElements);
      if (bindings[index] == replacement) continue;
      if (Functions.nextDrawElements == nullptr) {
        Functions.nextDrawElements = reinterpret_cast<DrawElementsFunction>(
          bindings[index]);
      }
      bindings[index] = replacement;
      *reboundElements += 1;
    }
  }
}

static void InstallContractHook() {
  pthread_once(&ResolveOnce, ResolveFunctions);
  int reboundArrays = 0;
  int reboundElements = 0;
  uint32_t imageCount = _dyld_image_count();
  for (uint32_t imageIndex = 0; imageIndex < imageCount; imageIndex += 1) {
    const char *imageName = _dyld_get_image_name(imageIndex);
    if (imageName == nullptr ||
        strstr(imageName, "/libgoogleearth_pro.dylib") == nullptr) {
      continue;
    }
    const auto *header = reinterpret_cast<const mach_header_64 *>(
      _dyld_get_image_header(imageIndex));
    intptr_t slide = _dyld_get_image_vmaddr_slide(imageIndex);
    const segment_command_64 *linkEdit = nullptr;
    const symtab_command *symbolTableCommand = nullptr;
    const dysymtab_command *dynamicSymbolTableCommand = nullptr;
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
        symbolTableCommand = reinterpret_cast<const symtab_command *>(
          commandBytes);
      } else if (command->cmd == LC_DYSYMTAB) {
        dynamicSymbolTableCommand =
          reinterpret_cast<const dysymtab_command *>(commandBytes);
      }
      commandBytes += command->cmdsize;
    }
    if (linkEdit == nullptr || symbolTableCommand == nullptr ||
        dynamicSymbolTableCommand == nullptr) {
      continue;
    }
    uintptr_t linkEditBase = static_cast<uintptr_t>(slide) +
      linkEdit->vmaddr - linkEdit->fileoff;
    const auto *symbols = reinterpret_cast<const nlist_64 *>(
      linkEditBase + symbolTableCommand->symoff);
    const char *strings = reinterpret_cast<const char *>(
      linkEditBase + symbolTableCommand->stroff);
    const auto *indirectSymbols = reinterpret_cast<const uint32_t *>(
      linkEditBase + dynamicSymbolTableCommand->indirectsymoff);

    commandBytes = reinterpret_cast<const uint8_t *>(header + 1);
    for (uint32_t commandIndex = 0;
         commandIndex < header->ncmds;
         commandIndex += 1) {
      const auto *command = reinterpret_cast<const load_command *>(commandBytes);
      if (command->cmd == LC_SEGMENT_64) {
        const auto *segment = reinterpret_cast<const segment_command_64 *>(
          commandBytes);
        const auto *sections = reinterpret_cast<const section_64 *>(
          segment + 1);
        for (uint32_t sectionIndex = 0;
             sectionIndex < segment->nsects;
             sectionIndex += 1) {
          RebindSection(
            sections + sectionIndex,
            slide,
            symbols,
            strings,
            indirectSymbols,
            &reboundArrays,
            &reboundElements);
        }
      }
      commandBytes += command->cmdsize;
    }
  }
  std::ostringstream line;
  line << "reboundDrawArrays=" << reboundArrays
       << "\treboundDrawElements=" << reboundElements
       << "\tpid=" << getpid();
  AppendLine("CSSMARS_ORACLE_CONTRACT_INSTALL_LOG_V10", line.str());
}

__attribute__((constructor)) static void LoadContractHook() {
  MapControl();
  InstallContractHook();
}

}  // namespace
