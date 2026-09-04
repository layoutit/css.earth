#import <Cocoa/Cocoa.h>

#include <OpenGL/gl.h>

#include <dlfcn.h>
#include <fcntl.h>
#include <float.h>
#include <limits.h>
#include <math.h>
#include <mach-o/dyld.h>
#include <mach-o/loader.h>
#include <mach-o/nlist.h>
#include <mach/mach.h>
#include <sys/mman.h>
#include <pthread.h>
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include <vector>

namespace {

using DrawArraysFunction = void (*)(GLenum, GLint, GLsizei);
using DrawElementsFunction = void (*)(GLenum, GLsizei, GLenum, const GLvoid *);
using GetIntegervFunction = void (*)(GLenum, GLint *);
using GetUniformLocationFunction = GLint (*)(GLuint, const GLchar *);
using GetUniformivFunction = void (*)(GLuint, GLint, GLint *);
using GetUniformfvFunction = void (*)(GLuint, GLint, GLfloat *);
using GetAttribLocationFunction = GLint (*)(GLuint, const GLchar *);
using GetVertexAttribivFunction = void (*)(GLuint, GLenum, GLint *);
using GetVertexAttribPointervFunction = void (*)(GLuint, GLenum, GLvoid **);
using ActiveTextureFunction = void (*)(GLenum);
using GenTexturesFunction = void (*)(GLsizei, GLuint *);
using BindTextureFunction = void (*)(GLenum, GLuint);
using BindBufferFunction = void (*)(GLenum, GLuint);
using GetBufferParameterivFunction = void (*)(GLenum, GLenum, GLint *);
using GetBufferSubDataFunction = void (*)(
  GLenum, GLintptr, GLsizeiptr, GLvoid *);
using GetTexLevelParameterivFunction = void (*)(GLenum, GLint, GLenum, GLint *);
using GetTexImageFunction = void (*)(GLenum, GLint, GLenum, GLenum, GLvoid *);
using GetCompressedTexImageFunction = void (*)(GLenum, GLint, GLvoid *);
using GetTexParameterivFunction = void (*)(GLenum, GLenum, GLint *);
using GenerateMipmapFunction = void (*)(GLenum);
using TexImage2DFunction = void (*)(
  GLenum, GLint, GLint, GLsizei, GLsizei, GLint, GLenum, GLenum,
  const GLvoid *);
using TexParameteriFunction = void (*)(GLenum, GLenum, GLint);
using Uniform1iFunction = void (*)(GLint, GLint);
using CurrentContextFunction = void *(*)();

struct OpenGLFunctions {
  DrawArraysFunction drawArrays;
  DrawElementsFunction drawElements;
  GetIntegervFunction getIntegerv;
  GetUniformLocationFunction getUniformLocation;
  GetUniformivFunction getUniformiv;
  GetUniformfvFunction getUniformfv;
  GetAttribLocationFunction getAttribLocation;
  GetVertexAttribivFunction getVertexAttribiv;
  GetVertexAttribPointervFunction getVertexAttribPointerv;
  ActiveTextureFunction activeTexture;
  GenTexturesFunction genTextures;
  BindTextureFunction bindTexture;
  BindBufferFunction bindBuffer;
  GetBufferParameterivFunction getBufferParameteriv;
  GetBufferSubDataFunction getBufferSubData;
  GetTexLevelParameterivFunction getTexLevelParameteriv;
  GetTexImageFunction getTexImage;
  GetCompressedTexImageFunction getCompressedTexImage;
  GetTexParameterivFunction getTexParameteriv;
  GenerateMipmapFunction generateMipmap;
  TexImage2DFunction texImage2D;
  TexParameteriFunction texParameteri;
  Uniform1iFunction uniform1i;
  CurrentContextFunction currentContext;
};

struct ProgramClassification {
  GLuint program;
  GLint groundTextureLocation;
  GLint skyMapTextureLocation;
  bool logged;
};

struct ContextTexture {
  void *context;
  GLuint texture;
};

struct AuditedGroundDraw {
  uint32_t revision;
  GLuint program;
  GLuint texture;
  GLuint vertexBuffer;
  GLuint elementBuffer;
};

struct CalibrationMapping {
  GLuint originalTexture;
  GLuint program;
  GLuint vertexBuffer;
  GLuint elementBuffer;
  uint32_t auditRevision;
  int level;
  int x;
  int y;
  char rawPath[PATH_MAX];
  char decodedSha256[65];
};

struct CalibrationTexture {
  void *context;
  GLuint originalTexture;
  GLuint program;
  GLuint vertexBuffer;
  GLuint elementBuffer;
  GLuint calibrationTexture;
  CalibrationMapping mapping;
};

struct AuditedCalibrationBinding {
  uint32_t revision;
  GLuint program;
  GLuint originalTexture;
  GLuint vertexBuffer;
  GLuint elementBuffer;
};

static OpenGLFunctions Functions = {};
static pthread_once_t ResolveOnce = PTHREAD_ONCE_INIT;
static pthread_mutex_t StateLock = PTHREAD_MUTEX_INITIALIZER;
static ProgramClassification Programs[512] = {};
static size_t ProgramCount = 0;
static ContextTexture WhiteTextures[32] = {};
static size_t WhiteTextureCount = 0;
static ContextTexture GlobalCalibrationTextures[32] = {};
static size_t GlobalCalibrationTextureCount = 0;
static AuditedGroundDraw AuditedGroundDraws[4096] = {};
static size_t AuditedGroundDrawCount = 0;
static CalibrationTexture CalibrationTextures[4096] = {};
static size_t CalibrationTextureCount = 0;
static AuditedCalibrationBinding AuditedCalibrationBindings[16384] = {};
static size_t AuditedCalibrationBindingCount = 0;
static volatile uint64_t GroundDrawSequence = 0;
static const volatile char *MappedMode = nullptr;
static int MappedModeDescriptor = -1;
using HeadlessSetQtToggleFunction = void (*)(NSString *, signed char);
static HeadlessSetQtToggleFunction HeadlessSetQtToggle = nullptr;
static uint32_t ReadControlRevision();

static const char *TextureMode() {
  static thread_local char mode[16] = {};
  if (MappedMode != nullptr) {
    for (size_t index = 0; index < sizeof(mode) - 1; index += 1) {
      mode[index] = MappedMode[index];
    }
    mode[sizeof(mode) - 1] = '\0';
    return mode;
  }
  const char *modePath = getenv("CSSMARS_ORACLE_LAYER_MODE_FILE");
  if (modePath != nullptr && modePath[0] != '\0') {
    MappedModeDescriptor = open(modePath, O_RDONLY);
    if (MappedModeDescriptor >= 0) {
      void *mapping = mmap(
        nullptr,
        32,
        PROT_READ,
        MAP_SHARED,
        MappedModeDescriptor,
        0);
      if (mapping != MAP_FAILED) {
        MappedMode = reinterpret_cast<const volatile char *>(mapping);
        return TextureMode();
      }
    }
  }
  const char *environmentMode = getenv("CSSMARS_ORACLE_TEXTURE_MODE");
  return environmentMode == nullptr ? "off" : environmentMode;
}

static bool ModeIs(const char *expected) {
  return strcmp(TextureMode(), expected) == 0;
}

template <typename Function>
static Function ResolveSymbol(void *handle, const char *name) {
  return reinterpret_cast<Function>(dlsym(handle, name));
}

static void ResolveFunctions() {
  void *handle = dlopen(
    "/System/Library/Frameworks/OpenGL.framework/Versions/A/OpenGL",
    RTLD_LAZY | RTLD_LOCAL);
  if (handle == nullptr) return;
  Functions.drawArrays = ResolveSymbol<DrawArraysFunction>(handle,
    "glDrawArrays");
  Functions.drawElements = ResolveSymbol<DrawElementsFunction>(handle,
    "glDrawElements");
  Functions.getIntegerv = ResolveSymbol<GetIntegervFunction>(handle,
    "glGetIntegerv");
  Functions.getUniformLocation = ResolveSymbol<GetUniformLocationFunction>(
    handle, "glGetUniformLocation");
  Functions.getUniformiv = ResolveSymbol<GetUniformivFunction>(handle,
    "glGetUniformiv");
  Functions.getUniformfv = ResolveSymbol<GetUniformfvFunction>(handle,
    "glGetUniformfv");
  Functions.getAttribLocation = ResolveSymbol<GetAttribLocationFunction>(
    handle, "glGetAttribLocation");
  Functions.getVertexAttribiv = ResolveSymbol<GetVertexAttribivFunction>(
    handle, "glGetVertexAttribiv");
  Functions.getVertexAttribPointerv =
    ResolveSymbol<GetVertexAttribPointervFunction>(
      handle, "glGetVertexAttribPointerv");
  Functions.activeTexture = ResolveSymbol<ActiveTextureFunction>(handle,
    "glActiveTexture");
  Functions.genTextures = ResolveSymbol<GenTexturesFunction>(handle,
    "glGenTextures");
  Functions.bindTexture = ResolveSymbol<BindTextureFunction>(handle,
    "glBindTexture");
  Functions.bindBuffer = ResolveSymbol<BindBufferFunction>(handle,
    "glBindBuffer");
  Functions.getBufferParameteriv = ResolveSymbol<GetBufferParameterivFunction>(
    handle, "glGetBufferParameteriv");
  Functions.getBufferSubData = ResolveSymbol<GetBufferSubDataFunction>(
    handle, "glGetBufferSubData");
  Functions.getTexLevelParameteriv =
    ResolveSymbol<GetTexLevelParameterivFunction>(
      handle, "glGetTexLevelParameteriv");
  Functions.getTexImage = ResolveSymbol<GetTexImageFunction>(handle,
    "glGetTexImage");
  Functions.getCompressedTexImage =
    ResolveSymbol<GetCompressedTexImageFunction>(
      handle, "glGetCompressedTexImage");
  Functions.getTexParameteriv = ResolveSymbol<GetTexParameterivFunction>(
    handle, "glGetTexParameteriv");
  Functions.generateMipmap = ResolveSymbol<GenerateMipmapFunction>(
    handle, "glGenerateMipmap");
  Functions.texImage2D = ResolveSymbol<TexImage2DFunction>(handle,
    "glTexImage2D");
  Functions.texParameteri = ResolveSymbol<TexParameteriFunction>(handle,
    "glTexParameteri");
  Functions.uniform1i = ResolveSymbol<Uniform1iFunction>(handle, "glUniform1i");
  Functions.currentContext = ResolveSymbol<CurrentContextFunction>(handle,
    "CGLGetCurrentContext");
}

static bool Ready() {
  pthread_once(&ResolveOnce, ResolveFunctions);
  return Functions.drawArrays != nullptr &&
    Functions.drawElements != nullptr &&
    Functions.getIntegerv != nullptr &&
    Functions.getUniformLocation != nullptr;
}

static void AppendAuditLine(const ProgramClassification &classification) {
  const char *path = getenv("CSSMARS_ORACLE_LAYER_AUDIT_LOG");
  if (path == nullptr || path[0] == '\0') return;
  char line[256];
  int length = snprintf(
    line,
    sizeof(line),
    "%u\t%d\t%d\t%d\t%s\n",
    classification.program,
    classification.groundTextureLocation,
    classification.skyMapTextureLocation,
    classification.groundTextureLocation >= 0 ? 1 : 0,
    TextureMode());
  if (length <= 0) return;
  int descriptor = open(path, O_WRONLY | O_CREAT | O_APPEND, 0600);
  if (descriptor < 0) return;
  write(descriptor, line, static_cast<size_t>(length));
  close(descriptor);
}

static void AppendInstallLine(int reboundArrays, int reboundElements) {
  const char *path = getenv("CSSMARS_ORACLE_LAYER_INSTALL_LOG");
  if (path == nullptr || path[0] == '\0') return;
  char line[256];
  int length = snprintf(
    line,
    sizeof(line),
    "reboundDrawArrays=%d\treboundDrawElements=%d\tpid=%d\n",
    reboundArrays,
    reboundElements,
    getpid());
  if (length <= 0) return;
  int descriptor = open(path, O_WRONLY | O_CREAT | O_APPEND, 0600);
  if (descriptor < 0) return;
  write(descriptor, line, static_cast<size_t>(length));
  close(descriptor);
}

static void AppendControlLine(
    uint32_t revision,
    bool atmosphere,
    bool sun) {
  const char *path = getenv("CSSMARS_ORACLE_LAYER_CONTROL_LOG");
  if (path == nullptr || path[0] == '\0') return;
  char line[256];
  int length = snprintf(
    line,
    sizeof(line),
    "revision=%u\tatmosphere=%d\tsun=%d\tpid=%d\n",
    revision,
    atmosphere ? 1 : 0,
    sun ? 1 : 0,
    getpid());
  if (length <= 0) return;
  int descriptor = open(path, O_WRONLY | O_CREAT | O_APPEND, 0600);
  if (descriptor < 0) return;
  write(descriptor, line, static_cast<size_t>(length));
  close(descriptor);
}

static ProgramClassification ClassifyCurrentProgram() {
  GLint currentProgram = 0;
  Functions.getIntegerv(GL_CURRENT_PROGRAM, &currentProgram);
  if (currentProgram <= 0) return {};

  pthread_mutex_lock(&StateLock);
  for (size_t index = 0; index < ProgramCount; index += 1) {
    if (Programs[index].program == static_cast<GLuint>(currentProgram)) {
      ProgramClassification classification = Programs[index];
      pthread_mutex_unlock(&StateLock);
      return classification;
    }
  }
  pthread_mutex_unlock(&StateLock);

  ProgramClassification classification = {
    static_cast<GLuint>(currentProgram),
    Functions.getUniformLocation(
      static_cast<GLuint>(currentProgram), "groundTexture"),
    Functions.getUniformLocation(
      static_cast<GLuint>(currentProgram), "skymapTexture"),
    false,
  };
  pthread_mutex_lock(&StateLock);
  if (ProgramCount < sizeof(Programs) / sizeof(Programs[0])) {
    classification.logged = true;
    Programs[ProgramCount++] = classification;
  }
  pthread_mutex_unlock(&StateLock);
  AppendAuditLine(classification);
  return classification;
}

static GLuint WhiteTextureForCurrentContext() {
  void *context = Functions.currentContext == nullptr
    ? nullptr
    : Functions.currentContext();
  pthread_mutex_lock(&StateLock);
  for (size_t index = 0; index < WhiteTextureCount; index += 1) {
    if (WhiteTextures[index].context == context) {
      GLuint texture = WhiteTextures[index].texture;
      pthread_mutex_unlock(&StateLock);
      return texture;
    }
  }
  pthread_mutex_unlock(&StateLock);

  GLuint texture = 0;
  Functions.genTextures(1, &texture);
  Functions.bindTexture(GL_TEXTURE_2D, texture);
  static const GLubyte WhitePixel[4] = { 255, 255, 255, 255 };
  Functions.texImage2D(
    GL_TEXTURE_2D,
    0,
    GL_RGBA,
    1,
    1,
    0,
    GL_RGBA,
    GL_UNSIGNED_BYTE,
    WhitePixel);
  Functions.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
  Functions.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
  Functions.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
  Functions.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

  pthread_mutex_lock(&StateLock);
  if (WhiteTextureCount <
      sizeof(WhiteTextures) / sizeof(WhiteTextures[0])) {
    WhiteTextures[WhiteTextureCount++] = { context, texture };
  }
  pthread_mutex_unlock(&StateLock);
  return texture;
}

static bool MarkGroundDrawForAudit(const AuditedGroundDraw &draw) {
  pthread_mutex_lock(&StateLock);
  for (size_t index = 0; index < AuditedGroundDrawCount; index += 1) {
    const AuditedGroundDraw &existing = AuditedGroundDraws[index];
    if (existing.revision == draw.revision &&
        existing.program == draw.program &&
        existing.texture == draw.texture &&
        existing.vertexBuffer == draw.vertexBuffer &&
        existing.elementBuffer == draw.elementBuffer) {
      pthread_mutex_unlock(&StateLock);
      return false;
    }
  }
  if (AuditedGroundDrawCount >=
      sizeof(AuditedGroundDraws) / sizeof(AuditedGroundDraws[0])) {
    pthread_mutex_unlock(&StateLock);
    return false;
  }
  AuditedGroundDraws[AuditedGroundDrawCount++] = draw;
  pthread_mutex_unlock(&StateLock);
  return true;
}

static void WriteAll(int descriptor, const void *bytes, size_t byteCount) {
  const uint8_t *cursor = reinterpret_cast<const uint8_t *>(bytes);
  while (byteCount > 0) {
    ssize_t written = write(descriptor, cursor, byteCount);
    if (written <= 0) return;
    cursor += written;
    byteCount -= static_cast<size_t>(written);
  }
}

static const char *ComponentTypeName(GLint type) {
  return type == GL_FLOAT ? "float" :
    type == GL_UNSIGNED_BYTE ? "unsigned-byte" :
    type == GL_SHORT ? "short" :
    type == GL_UNSIGNED_SHORT ? "unsigned-short" :
    type == GL_UNSIGNED_INT ? "unsigned-int" : "other";
}

static GLuint CurrentGroundTexture(
    const ProgramClassification &classification,
    GLint *samplerUnit,
    GLint *previousActiveTexture) {
  if (Functions.getUniformiv == nullptr ||
      Functions.activeTexture == nullptr) return 0;
  *samplerUnit = 0;
  Functions.getUniformiv(
    classification.program,
    classification.groundTextureLocation,
    samplerUnit);
  if (*samplerUnit < 0 || *samplerUnit > 31) return 0;
  *previousActiveTexture = GL_TEXTURE0;
  Functions.getIntegerv(GL_ACTIVE_TEXTURE, previousActiveTexture);
  Functions.activeTexture(GL_TEXTURE0 + *samplerUnit);
  GLint texture = 0;
  Functions.getIntegerv(GL_TEXTURE_BINDING_2D, &texture);
  return texture > 0 ? static_cast<GLuint>(texture) : 0;
}

static AuditedGroundDraw CurrentGroundDrawKey(
    const ProgramClassification &classification,
    GLuint texture) {
  GLint vertexBuffer = 0;
  GLint elementBuffer = 0;
  if (Functions.getAttribLocation != nullptr &&
      Functions.getVertexAttribiv != nullptr) {
    GLint vertexLocation = Functions.getAttribLocation(
      classification.program, "ig_Vertex");
    if (vertexLocation < 0) vertexLocation = Functions.getAttribLocation(
      classification.program, "ig_VertexAttr0");
    if (vertexLocation >= 0) {
      Functions.getVertexAttribiv(
        static_cast<GLuint>(vertexLocation),
        GL_VERTEX_ATTRIB_ARRAY_BUFFER_BINDING,
        &vertexBuffer);
    }
  }
  Functions.getIntegerv(GL_ELEMENT_ARRAY_BUFFER_BINDING, &elementBuffer);
  return {
    ReadControlRevision(),
    classification.program,
    texture,
    static_cast<GLuint>(vertexBuffer),
    static_cast<GLuint>(elementBuffer),
  };
}

static bool CurrentTextureIsGoogleDxt1Albedo() {
  if (Functions.getTexLevelParameteriv == nullptr) return false;
  GLint width = 0;
  GLint height = 0;
  GLint internalFormat = 0;
  GLint compressedBytes = 0;
  Functions.getTexLevelParameteriv(
    GL_TEXTURE_2D, 0, GL_TEXTURE_WIDTH, &width);
  Functions.getTexLevelParameteriv(
    GL_TEXTURE_2D, 0, GL_TEXTURE_HEIGHT, &height);
  Functions.getTexLevelParameteriv(
    GL_TEXTURE_2D, 0, GL_TEXTURE_INTERNAL_FORMAT, &internalFormat);
  Functions.getTexLevelParameteriv(
    GL_TEXTURE_2D, 0, GL_TEXTURE_COMPRESSED_IMAGE_SIZE, &compressedBytes);
  return width == 256 && height == 256 &&
    internalFormat == 0x83f0 && compressedBytes == 32768;
}

static void AuditGroundDraw(
    const ProgramClassification &classification,
    const char *drawKind,
    GLint first,
    GLsizei count,
    GLenum indexType,
    const GLvoid *indices) {
  if (!ModeIs("cal-audit") && !ModeIs("cal")) return;
  if (Functions.getAttribLocation == nullptr ||
      Functions.getVertexAttribiv == nullptr ||
      Functions.getVertexAttribPointerv == nullptr ||
      Functions.bindBuffer == nullptr ||
      Functions.getBufferParameteriv == nullptr ||
      Functions.getBufferSubData == nullptr ||
      Functions.getUniformfv == nullptr ||
      Functions.getTexLevelParameteriv == nullptr ||
      Functions.getTexImage == nullptr) return;

  GLint samplerUnit = 0;
  GLint previousActiveTexture = GL_TEXTURE0;
  GLuint texture = CurrentGroundTexture(
    classification, &samplerUnit, &previousActiveTexture);
  if (texture == 0) return;
  const uint64_t drawId = __sync_add_and_fetch(&GroundDrawSequence, 1);

  GLint vertexLocation = Functions.getAttribLocation(
    classification.program, "ig_Vertex");
  if (vertexLocation < 0) vertexLocation = Functions.getAttribLocation(
    classification.program, "ig_VertexAttr0");
  if (vertexLocation < 0) {
    Functions.activeTexture(static_cast<GLenum>(previousActiveTexture));
    return;
  }
  GLint vertexBuffer = 0;
  GLint elementBuffer = 0;
  GLint components = 0;
  GLint componentType = 0;
  GLint stride = 0;
  GLint normalized = 0;
  Functions.getVertexAttribiv(
    static_cast<GLuint>(vertexLocation),
    GL_VERTEX_ATTRIB_ARRAY_BUFFER_BINDING,
    &vertexBuffer);
  Functions.getVertexAttribiv(
    static_cast<GLuint>(vertexLocation),
    GL_VERTEX_ATTRIB_ARRAY_SIZE,
    &components);
  Functions.getVertexAttribiv(
    static_cast<GLuint>(vertexLocation),
    GL_VERTEX_ATTRIB_ARRAY_TYPE,
    &componentType);
  Functions.getVertexAttribiv(
    static_cast<GLuint>(vertexLocation),
    GL_VERTEX_ATTRIB_ARRAY_STRIDE,
    &stride);
  Functions.getVertexAttribiv(
    static_cast<GLuint>(vertexLocation),
    GL_VERTEX_ATTRIB_ARRAY_NORMALIZED,
    &normalized);
  GLvoid *vertexPointer = nullptr;
  Functions.getVertexAttribPointerv(
    static_cast<GLuint>(vertexLocation),
    GL_VERTEX_ATTRIB_ARRAY_POINTER,
    &vertexPointer);
  Functions.getIntegerv(GL_ELEMENT_ARRAY_BUFFER_BINDING, &elementBuffer);
  const uint32_t revision = ReadControlRevision();
  AuditedGroundDraw key = {
    revision,
    classification.program,
    texture,
    static_cast<GLuint>(vertexBuffer),
    static_cast<GLuint>(elementBuffer),
  };
  if (!MarkGroundDrawForAudit(key)) {
    Functions.activeTexture(static_cast<GLenum>(previousActiveTexture));
    return;
  }

  GLint previousArrayBuffer = 0;
  Functions.getIntegerv(GL_ARRAY_BUFFER_BINDING, &previousArrayBuffer);
  GLint vertexBufferBytes = 0;
  std::vector<uint8_t> vertexBytes;
  if (vertexBuffer > 0) {
    Functions.bindBuffer(GL_ARRAY_BUFFER, static_cast<GLuint>(vertexBuffer));
    Functions.getBufferParameteriv(
      GL_ARRAY_BUFFER, GL_BUFFER_SIZE, &vertexBufferBytes);
    if (vertexBufferBytes > 0 && vertexBufferBytes <= 16 * 1024 * 1024) {
      vertexBytes.resize(static_cast<size_t>(vertexBufferBytes));
      Functions.getBufferSubData(
        GL_ARRAY_BUFFER, 0, vertexBufferBytes, vertexBytes.data());
    }
  }
  Functions.bindBuffer(
    GL_ARRAY_BUFFER, static_cast<GLuint>(previousArrayBuffer));

  const intptr_t pointerOffset = reinterpret_cast<intptr_t>(vertexPointer);
  const GLint effectiveStride = stride > 0 ? stride : components *
    (componentType == GL_FLOAT ? static_cast<GLint>(sizeof(float)) : 1);
  double minimum[3] = { DBL_MAX, DBL_MAX, DBL_MAX };
  double maximum[3] = { -DBL_MAX, -DBL_MAX, -DBL_MAX };
  double mean[3] = {};
  size_t vertexCount = 0;
  if (componentType == GL_FLOAT && components >= 3 && effectiveStride > 0 &&
      pointerOffset >= 0 &&
      static_cast<size_t>(pointerOffset) < vertexBytes.size()) {
    for (size_t offset = static_cast<size_t>(pointerOffset);
         offset + sizeof(float) * 3 <= vertexBytes.size();
         offset += static_cast<size_t>(effectiveStride)) {
      const float *position = reinterpret_cast<const float *>(
        vertexBytes.data() + offset);
      for (size_t axis = 0; axis < 3; axis += 1) {
        minimum[axis] = fmin(minimum[axis], position[axis]);
        maximum[axis] = fmax(maximum[axis], position[axis]);
        mean[axis] += position[axis];
      }
      vertexCount += 1;
    }
  }
  if (vertexCount > 0) {
    for (double &component : mean) component /= vertexCount;
  } else {
    for (size_t axis = 0; axis < 3; axis += 1) {
      minimum[axis] = 0;
      maximum[axis] = 0;
    }
  }

  GLfloat textureMatrix[16] = {};
  GLint textureMatrixLocation = Functions.getUniformLocation(
    classification.program, "ig_TextureMatrix");
  if (textureMatrixLocation >= 0) {
    Functions.getUniformfv(
      classification.program, textureMatrixLocation, textureMatrix);
  }
  GLint textureWidth = 0;
  GLint textureHeight = 0;
  GLint internalFormat = 0;
  GLint minFilter = 0;
  GLint magFilter = 0;
  GLint wrapS = 0;
  GLint wrapT = 0;
  GLint compressed = 0;
  GLint compressedByteCount = 0;
  Functions.getTexLevelParameteriv(
    GL_TEXTURE_2D, 0, GL_TEXTURE_WIDTH, &textureWidth);
  Functions.getTexLevelParameteriv(
    GL_TEXTURE_2D, 0, GL_TEXTURE_HEIGHT, &textureHeight);
  Functions.getTexLevelParameteriv(
    GL_TEXTURE_2D, 0, GL_TEXTURE_INTERNAL_FORMAT, &internalFormat);
  Functions.getTexLevelParameteriv(
    GL_TEXTURE_2D, 0, GL_TEXTURE_COMPRESSED, &compressed);
  Functions.getTexLevelParameteriv(
    GL_TEXTURE_2D, 0, GL_TEXTURE_COMPRESSED_IMAGE_SIZE,
    &compressedByteCount);
  if (Functions.getTexParameteriv != nullptr) {
    Functions.getTexParameteriv(
      GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, &minFilter);
    Functions.getTexParameteriv(
      GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, &magFilter);
    Functions.getTexParameteriv(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, &wrapS);
    Functions.getTexParameteriv(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, &wrapT);
  }

  char rawPath[PATH_MAX] = {};
  char compressedPath[PATH_MAX] = {};
  const char *dumpDirectory = getenv("CSSMARS_ORACLE_CALIBRATION_DUMP_DIR");
  if (dumpDirectory != nullptr && dumpDirectory[0] != '\0' &&
      textureWidth > 0 && textureHeight > 0 &&
      textureWidth <= 4096 && textureHeight <= 4096) {
    snprintf(
      rawPath,
      sizeof(rawPath),
      "%s/revision-%u-program-%u-texture-%u-vbo-%u-ebo-%u.rgba",
      dumpDirectory,
      revision,
      classification.program,
      texture,
      static_cast<GLuint>(vertexBuffer),
      static_cast<GLuint>(elementBuffer));
    int rawDescriptor = open(rawPath, O_WRONLY | O_CREAT | O_EXCL, 0600);
    if (rawDescriptor >= 0) {
      size_t rawByteCount = static_cast<size_t>(textureWidth) *
        static_cast<size_t>(textureHeight) * 4;
      std::vector<uint8_t> raw(rawByteCount);
      Functions.getTexImage(
        GL_TEXTURE_2D, 0, GL_RGBA, GL_UNSIGNED_BYTE, raw.data());
      WriteAll(rawDescriptor, raw.data(), raw.size());
      close(rawDescriptor);
    }
    if (compressed != 0 && compressedByteCount > 0 &&
        compressedByteCount <= 16 * 1024 * 1024 &&
        Functions.getCompressedTexImage != nullptr) {
      snprintf(
        compressedPath,
        sizeof(compressedPath),
        "%s/revision-%u-program-%u-texture-%u-vbo-%u-ebo-%u.compressed",
        dumpDirectory,
        revision,
        classification.program,
        texture,
        static_cast<GLuint>(vertexBuffer),
        static_cast<GLuint>(elementBuffer));
      int compressedDescriptor = open(
        compressedPath, O_WRONLY | O_CREAT | O_EXCL, 0600);
      if (compressedDescriptor >= 0) {
        std::vector<uint8_t> compressedBytes(
          static_cast<size_t>(compressedByteCount));
        Functions.getCompressedTexImage(
          GL_TEXTURE_2D, 0, compressedBytes.data());
        WriteAll(
          compressedDescriptor,
          compressedBytes.data(),
          compressedBytes.size());
        close(compressedDescriptor);
      }
    }
  }

  const char *auditPath = getenv(
    "CSSMARS_ORACLE_CALIBRATION_AUDIT_LOG");
  if (auditPath != nullptr && auditPath[0] != '\0') {
    char line[4096];
    int length = snprintf(
      line,
      sizeof(line),
      "{\"drawId\":%llu,\"revision\":%u,\"program\":%u,"
      "\"texture\":%u,\"samplerUnit\":%d,"
      "\"textureWidth\":%d,\"textureHeight\":%d,"
      "\"internalFormat\":%d,\"compressed\":%s,"
      "\"compressedByteCount\":%d,"
      "\"sampler\":{\"minFilter\":%d,\"magFilter\":%d,"
      "\"wrapS\":%d,\"wrapT\":%d},\"drawKind\":\"%s\","
      "\"first\":%d,\"count\":%d,\"indexType\":%u,"
      "\"indexOffset\":%llu,\"vertexLocation\":%d,"
      "\"vertexBuffer\":%d,\"elementBuffer\":%d,"
      "\"vertexBufferBytes\":%d,\"vertexCount\":%zu,"
      "\"components\":%d,\"componentType\":\"%s\","
      "\"normalized\":%d,\"stride\":%d,\"pointerOffset\":%lld,"
      "\"positionMin\":[%.9g,%.9g,%.9g],"
      "\"positionMax\":[%.9g,%.9g,%.9g],"
      "\"positionMean\":[%.9g,%.9g,%.9g],"
      "\"textureMatrix\":[%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,"
      "%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g],"
      "\"rawPath\":\"%s\",\"compressedPath\":\"%s\"}\n",
      static_cast<unsigned long long>(drawId),
      revision,
      classification.program,
      texture,
      samplerUnit,
      textureWidth,
      textureHeight,
      internalFormat,
      compressed == 0 ? "false" : "true",
      compressedByteCount,
      minFilter,
      magFilter,
      wrapS,
      wrapT,
      drawKind,
      first,
      count,
      indexType,
      static_cast<unsigned long long>(reinterpret_cast<uintptr_t>(indices)),
      vertexLocation,
      vertexBuffer,
      elementBuffer,
      vertexBufferBytes,
      vertexCount,
      components,
      ComponentTypeName(componentType),
      normalized,
      stride,
      static_cast<long long>(pointerOffset),
      minimum[0], minimum[1], minimum[2],
      maximum[0], maximum[1], maximum[2],
      mean[0], mean[1], mean[2],
      textureMatrix[0], textureMatrix[1], textureMatrix[2], textureMatrix[3],
      textureMatrix[4], textureMatrix[5], textureMatrix[6], textureMatrix[7],
      textureMatrix[8], textureMatrix[9], textureMatrix[10], textureMatrix[11],
      textureMatrix[12], textureMatrix[13], textureMatrix[14], textureMatrix[15],
      rawPath,
      compressedPath);
    if (length > 0 && static_cast<size_t>(length) < sizeof(line)) {
      int descriptor = open(auditPath, O_WRONLY | O_CREAT | O_APPEND, 0600);
      if (descriptor >= 0) {
        WriteAll(descriptor, line, static_cast<size_t>(length));
        close(descriptor);
      }
    }
  }
  Functions.activeTexture(static_cast<GLenum>(previousActiveTexture));
}

static bool FindCalibrationMapping(
    const AuditedGroundDraw &draw,
    CalibrationMapping *mapping) {
  const char *mappingPath = getenv("CSSMARS_ORACLE_CALIBRATION_MAP");
  if (mappingPath == nullptr || mappingPath[0] == '\0') return false;
  FILE *file = fopen(mappingPath, "r");
  if (file == nullptr) return false;
  CalibrationMapping candidate = {};
  bool found = false;
  while (fscanf(
      file,
      "%u\t%u\t%u\t%u\t%u\t%d\t%d\t%d\t%1023s\t%64s\n",
      &candidate.originalTexture,
      &candidate.program,
      &candidate.vertexBuffer,
      &candidate.elementBuffer,
      &candidate.auditRevision,
      &candidate.level,
      &candidate.x,
      &candidate.y,
      candidate.rawPath,
      candidate.decodedSha256) == 10) {
    if (candidate.originalTexture == draw.texture &&
        candidate.program == draw.program &&
        candidate.vertexBuffer == draw.vertexBuffer &&
        candidate.elementBuffer == draw.elementBuffer) {
      *mapping = candidate;
      found = true;
    }
  }
  fclose(file);
  return found;
}

static bool ReadExactFile(
    const char *path,
    void *bytes,
    size_t byteCount) {
  int descriptor = open(path, O_RDONLY);
  if (descriptor < 0) return false;
  uint8_t *cursor = reinterpret_cast<uint8_t *>(bytes);
  size_t remaining = byteCount;
  while (remaining > 0) {
    ssize_t count = read(descriptor, cursor, remaining);
    if (count <= 0) break;
    cursor += count;
    remaining -= static_cast<size_t>(count);
  }
  uint8_t trailing = 0;
  ssize_t trailingCount = read(descriptor, &trailing, 1);
  close(descriptor);
  return remaining == 0 && trailingCount == 0;
}

static GLuint GlobalCalibrationTextureForCurrentContext() {
  if (Functions.currentContext == nullptr ||
      Functions.genTextures == nullptr ||
      Functions.bindTexture == nullptr ||
      Functions.texImage2D == nullptr ||
      Functions.texParameteri == nullptr ||
      Functions.generateMipmap == nullptr) return 0;
  void *context = Functions.currentContext();
  pthread_mutex_lock(&StateLock);
  for (size_t index = 0; index < GlobalCalibrationTextureCount; index += 1) {
    if (GlobalCalibrationTextures[index].context == context) {
      GLuint texture = GlobalCalibrationTextures[index].texture;
      pthread_mutex_unlock(&StateLock);
      return texture;
    }
  }
  pthread_mutex_unlock(&StateLock);
  const char *path = getenv("CSSMARS_ORACLE_CALIBRATION_MASTER_RAW");
  if (path == nullptr || path[0] == '\0') return 0;
  static constexpr size_t ByteCount = 4096 * 2048 * 4;
  std::vector<uint8_t> bytes(ByteCount);
  if (!ReadExactFile(path, bytes.data(), bytes.size())) return 0;
  GLuint texture = 0;
  Functions.genTextures(1, &texture);
  if (texture == 0) return 0;
  Functions.bindTexture(GL_TEXTURE_2D, texture);
  Functions.texImage2D(
    GL_TEXTURE_2D,
    0,
    GL_RGBA,
    4096,
    2048,
    0,
    GL_RGBA,
    GL_UNSIGNED_BYTE,
    bytes.data());
  Functions.generateMipmap(GL_TEXTURE_2D);
  Functions.texParameteri(
    GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
  Functions.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
  Functions.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
  Functions.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
  pthread_mutex_lock(&StateLock);
  if (GlobalCalibrationTextureCount <
      sizeof(GlobalCalibrationTextures) /
        sizeof(GlobalCalibrationTextures[0])) {
    GlobalCalibrationTextures[GlobalCalibrationTextureCount++] = {
      context,
      texture,
    };
  }
  pthread_mutex_unlock(&StateLock);
  return texture;
}

static void AppendGlobalCalibrationBindingLine(
    uint64_t drawId,
    uint32_t revision,
    const ProgramClassification &classification,
    const char *drawKind,
    GLsizei count,
    const AuditedGroundDraw &draw,
    GLuint calibrationTexture,
    GLint textureUnit) {
  const char *path = getenv("CSSMARS_ORACLE_CALIBRATION_BINDING_LOG");
  if (path == nullptr || path[0] == '\0') return;
  const char *sourceHash = getenv(
    "CSSMARS_ORACLE_CALIBRATION_MASTER_RGBA_SHA256");
  if (sourceHash == nullptr) sourceHash = "";
  GLfloat modelView[16] = {};
  GLfloat worldOriginInView[4] = {};
  GLfloat projectionScaling[4] = {};
  const GLint modelViewLocation = Functions.getUniformLocation(
    classification.program, "ig_ModelViewMatrix");
  const GLint worldOriginLocation = Functions.getUniformLocation(
    classification.program, "worldOriginInView");
  const GLint projectionScalingLocation = Functions.getUniformLocation(
    classification.program, "projScalingFactor");
  if (Functions.getUniformfv != nullptr) {
    if (modelViewLocation >= 0) Functions.getUniformfv(
      classification.program, modelViewLocation, modelView);
    if (worldOriginLocation >= 0) Functions.getUniformfv(
      classification.program, worldOriginLocation, worldOriginInView);
    if (projectionScalingLocation >= 0) Functions.getUniformfv(
      classification.program, projectionScalingLocation, projectionScaling);
  }
  const double determinant =
    modelView[0] * (modelView[5] * modelView[10] -
      modelView[9] * modelView[6]) -
    modelView[4] * (modelView[1] * modelView[10] -
      modelView[9] * modelView[2]) +
    modelView[8] * (modelView[1] * modelView[6] -
      modelView[5] * modelView[2]);
  char line[2048];
  int length = snprintf(
    line,
    sizeof(line),
    "{\"drawId\":%llu,\"revision\":%u,\"program\":%u,"
    "\"drawKind\":\"%s\",\"count\":%d,"
    "\"originalTexture\":%u,\"vertexBuffer\":%u,"
    "\"elementBuffer\":%u,\"mapped\":%s,"
    "\"calibrationTexture\":%u,\"textureUnit\":%d,"
    "\"decodedRgbaSha256\":\"%s\","
    "\"coordinateContract\":\"normalized unpacked igv_Vertex globe position,"
    "then plate-carree\","
    "\"worldOriginInView\":[%.9g,%.9g,%.9g],"
    "\"projectionScaling\":[%.9g,%.9g,%.9g,%.9g],"
    "\"modelViewLinear\":[%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g],"
    "\"modelViewLinearDeterminant\":%.9g,"
    "\"sampler\":{\"minFilter\":%d,\"magFilter\":%d,"
    "\"wrapS\":%d,\"wrapT\":%d}}\n",
    static_cast<unsigned long long>(drawId),
    revision,
    classification.program,
    drawKind,
    count,
    draw.texture,
    draw.vertexBuffer,
    draw.elementBuffer,
    calibrationTexture == 0 ? "false" : "true",
    calibrationTexture,
    textureUnit,
    sourceHash,
    worldOriginInView[0], worldOriginInView[1], worldOriginInView[2],
    projectionScaling[0], projectionScaling[1],
    projectionScaling[2], projectionScaling[3],
    modelView[0], modelView[1], modelView[2],
    modelView[4], modelView[5], modelView[6],
    modelView[8], modelView[9], modelView[10],
    determinant,
    GL_LINEAR_MIPMAP_LINEAR,
    GL_LINEAR,
    GL_REPEAT,
    GL_CLAMP_TO_EDGE);
  if (length <= 0 || static_cast<size_t>(length) >= sizeof(line)) return;
  int descriptor = open(path, O_WRONLY | O_CREAT | O_APPEND, 0600);
  if (descriptor < 0) return;
  WriteAll(descriptor, line, static_cast<size_t>(length));
  close(descriptor);
}

static GLuint CalibrationTextureForCurrentContext(
    const AuditedGroundDraw &draw,
    CalibrationMapping *resolvedMapping,
    GLint *originalMinFilter,
    GLint *originalMagFilter,
    GLint *originalWrapS,
    GLint *originalWrapT) {
  if (Functions.currentContext == nullptr ||
      Functions.getTexParameteriv == nullptr ||
      Functions.generateMipmap == nullptr) return 0;
  void *context = Functions.currentContext();
  Functions.getTexParameteriv(
    GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, originalMinFilter);
  Functions.getTexParameteriv(
    GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, originalMagFilter);
  Functions.getTexParameteriv(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, originalWrapS);
  Functions.getTexParameteriv(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, originalWrapT);
  pthread_mutex_lock(&StateLock);
  for (size_t index = 0; index < CalibrationTextureCount; index += 1) {
    const CalibrationTexture &existing = CalibrationTextures[index];
    if (existing.context == context &&
        existing.originalTexture == draw.texture &&
        existing.program == draw.program &&
        existing.vertexBuffer == draw.vertexBuffer &&
        existing.elementBuffer == draw.elementBuffer &&
        existing.mapping.auditRevision == ReadControlRevision() - 1) {
      *resolvedMapping = existing.mapping;
      GLuint texture = existing.calibrationTexture;
      pthread_mutex_unlock(&StateLock);
      return texture;
    }
  }
  pthread_mutex_unlock(&StateLock);

  CalibrationMapping mapping = {};
  if (!FindCalibrationMapping(draw, &mapping)) return 0;
  static constexpr size_t CalibrationRawBytes = 256 * 256 * 4;
  std::vector<uint8_t> bytes(CalibrationRawBytes);
  if (!ReadExactFile(mapping.rawPath, bytes.data(), bytes.size())) return 0;

  GLuint texture = 0;
  Functions.genTextures(1, &texture);
  if (texture == 0) return 0;
  Functions.bindTexture(GL_TEXTURE_2D, texture);
  Functions.texImage2D(
    GL_TEXTURE_2D,
    0,
    GL_RGBA,
    256,
    256,
    0,
    GL_RGBA,
    GL_UNSIGNED_BYTE,
    bytes.data());
  Functions.generateMipmap(GL_TEXTURE_2D);
  Functions.texParameteri(
    GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, *originalMinFilter);
  Functions.texParameteri(
    GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, *originalMagFilter);
  Functions.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, *originalWrapS);
  Functions.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, *originalWrapT);

  pthread_mutex_lock(&StateLock);
  if (CalibrationTextureCount <
      sizeof(CalibrationTextures) / sizeof(CalibrationTextures[0])) {
    CalibrationTextures[CalibrationTextureCount++] = {
      context,
      draw.texture,
      draw.program,
      draw.vertexBuffer,
      draw.elementBuffer,
      texture,
      mapping,
    };
  }
  pthread_mutex_unlock(&StateLock);
  *resolvedMapping = mapping;
  return texture;
}

static bool MarkCalibrationBindingForAudit(
    uint32_t revision,
    GLuint program,
    GLuint originalTexture,
    GLuint vertexBuffer,
    GLuint elementBuffer) {
  pthread_mutex_lock(&StateLock);
  for (size_t index = 0;
       index < AuditedCalibrationBindingCount;
       index += 1) {
    const AuditedCalibrationBinding &existing =
      AuditedCalibrationBindings[index];
    if (existing.revision == revision &&
        existing.program == program &&
        existing.originalTexture == originalTexture &&
        existing.vertexBuffer == vertexBuffer &&
        existing.elementBuffer == elementBuffer) {
      pthread_mutex_unlock(&StateLock);
      return false;
    }
  }
  if (AuditedCalibrationBindingCount >=
      sizeof(AuditedCalibrationBindings) /
        sizeof(AuditedCalibrationBindings[0])) {
    pthread_mutex_unlock(&StateLock);
    return false;
  }
  AuditedCalibrationBindings[AuditedCalibrationBindingCount++] = {
    revision,
    program,
    originalTexture,
    vertexBuffer,
    elementBuffer,
  };
  pthread_mutex_unlock(&StateLock);
  return true;
}

static void AppendCalibrationBindingLine(
    uint64_t drawId,
    uint32_t revision,
    const ProgramClassification &classification,
    const char *drawKind,
    GLsizei count,
    GLuint originalTexture,
    GLuint vertexBuffer,
    GLuint elementBuffer,
    GLuint calibrationTexture,
    const CalibrationMapping &mapping,
    GLint originalMinFilter,
    GLint originalMagFilter,
    GLint originalWrapS,
    GLint originalWrapT) {
  const char *path = getenv("CSSMARS_ORACLE_CALIBRATION_BINDING_LOG");
  if (path == nullptr || path[0] == '\0') return;
  char line[2048];
  int length = snprintf(
    line,
    sizeof(line),
    "{\"drawId\":%llu,\"revision\":%u,\"program\":%u,"
    "\"drawKind\":\"%s\","
    "\"count\":%d,\"originalTexture\":%u,"
    "\"vertexBuffer\":%u,\"elementBuffer\":%u,"
    "\"mapped\":%s,\"calibrationTexture\":%u,"
    "\"auditRevision\":%u,"
    "\"level\":%d,\"x\":%d,\"y\":%d,"
    "\"decodedRgbaSha256\":\"%s\","
    "\"sampler\":{\"minFilter\":%d,\"magFilter\":%d,"
    "\"wrapS\":%d,\"wrapT\":%d}}\n",
    static_cast<unsigned long long>(drawId),
    revision,
    classification.program,
    drawKind,
    count,
    originalTexture,
    vertexBuffer,
    elementBuffer,
    calibrationTexture == 0 ? "false" : "true",
    calibrationTexture,
    mapping.auditRevision,
    mapping.level,
    mapping.x,
    mapping.y,
    mapping.decodedSha256,
    originalMinFilter,
    originalMagFilter,
    originalWrapS,
    originalWrapT);
  if (length <= 0 || static_cast<size_t>(length) >= sizeof(line)) return;
  int descriptor = open(path, O_WRONLY | O_CREAT | O_APPEND, 0600);
  if (descriptor < 0) return;
  WriteAll(descriptor, line, static_cast<size_t>(length));
  close(descriptor);
}

template <typename DrawOperation>
static void DrawWithLayerMode(
    const char *drawKind,
    GLint first,
    GLsizei count,
    GLenum indexType,
    const GLvoid *indices,
    DrawOperation draw) {
  if (!Ready()) return;
  ProgramClassification classification = ClassifyCurrentProgram();
  bool isGround = classification.groundTextureLocation >= 0;
  if (isGround) {
    AuditGroundDraw(
      classification, drawKind, first, count, indexType, indices);
  }
  if (isGround && ModeIs("hide-ground")) return;
  if (isGround && ModeIs("cal-global")) {
    GLint samplerUnit = 0;
    GLint previousActiveTexture = GL_TEXTURE0;
    GLuint originalTexture = CurrentGroundTexture(
      classification, &samplerUnit, &previousActiveTexture);
    const AuditedGroundDraw drawKey = CurrentGroundDrawKey(
      classification, originalTexture);
    const GLint calibrationUniform = Functions.getUniformLocation(
      classification.program, "cssmars_calibration_texture");
    GLint maximumTextureUnits = 0;
    Functions.getIntegerv(GL_MAX_TEXTURE_IMAGE_UNITS, &maximumTextureUnits);
    const GLint calibrationUnit = maximumTextureUnits > 0
      ? std::min(15, maximumTextureUnits - 1)
      : -1;
    GLuint calibrationTexture = 0;
    GLint previousCalibrationBinding = 0;
    if (calibrationUniform >= 0 && calibrationUnit >= 0 &&
        Functions.uniform1i != nullptr) {
      Functions.activeTexture(GL_TEXTURE0 + calibrationUnit);
      Functions.getIntegerv(
        GL_TEXTURE_BINDING_2D, &previousCalibrationBinding);
      calibrationTexture = GlobalCalibrationTextureForCurrentContext();
      if (calibrationTexture != 0) {
        Functions.bindTexture(GL_TEXTURE_2D, calibrationTexture);
        Functions.uniform1i(calibrationUniform, calibrationUnit);
      }
    }
    const uint64_t drawId = __sync_add_and_fetch(&GroundDrawSequence, 1);
    const uint32_t revision = ReadControlRevision();
    if (MarkCalibrationBindingForAudit(
        revision,
        classification.program,
        originalTexture,
        drawKey.vertexBuffer,
        drawKey.elementBuffer)) {
      AppendGlobalCalibrationBindingLine(
        drawId,
        revision,
        classification,
        drawKind,
        count,
        drawKey,
        calibrationTexture,
        calibrationUnit);
    }
    if (calibrationTexture != 0) {
      draw();
      Functions.bindTexture(
        GL_TEXTURE_2D, static_cast<GLuint>(previousCalibrationBinding));
      Functions.activeTexture(static_cast<GLenum>(previousActiveTexture));
      return;
    }
    Functions.activeTexture(static_cast<GLenum>(previousActiveTexture));
  }
  if (isGround && ModeIs("cal")) {
    GLint samplerUnit = 0;
    GLint previousActiveTexture = GL_TEXTURE0;
    GLuint originalTexture = CurrentGroundTexture(
      classification, &samplerUnit, &previousActiveTexture);
    if (!CurrentTextureIsGoogleDxt1Albedo()) {
      Functions.activeTexture(static_cast<GLenum>(previousActiveTexture));
      draw();
      return;
    }
    const AuditedGroundDraw drawKey = CurrentGroundDrawKey(
      classification, originalTexture);
    CalibrationMapping mapping = {};
    GLint minFilter = GL_LINEAR;
    GLint magFilter = GL_LINEAR;
    GLint wrapS = GL_CLAMP_TO_EDGE;
    GLint wrapT = GL_CLAMP_TO_EDGE;
    GLuint calibrationTexture = originalTexture == 0 ? 0 :
      CalibrationTextureForCurrentContext(
        drawKey,
        &mapping,
        &minFilter,
        &magFilter,
        &wrapS,
        &wrapT);
    uint64_t drawId = __sync_add_and_fetch(&GroundDrawSequence, 1);
    uint32_t revision = ReadControlRevision();
    if (MarkCalibrationBindingForAudit(
        revision,
        classification.program,
        originalTexture,
        drawKey.vertexBuffer,
        drawKey.elementBuffer)) {
      AppendCalibrationBindingLine(
        drawId,
        revision,
        classification,
        drawKind,
        count,
        originalTexture,
        drawKey.vertexBuffer,
        drawKey.elementBuffer,
        calibrationTexture,
        mapping,
        minFilter,
        magFilter,
        wrapS,
        wrapT);
    }
    if (calibrationTexture != 0) {
      Functions.bindTexture(GL_TEXTURE_2D, calibrationTexture);
      draw();
      Functions.bindTexture(GL_TEXTURE_2D, originalTexture);
      Functions.activeTexture(static_cast<GLenum>(previousActiveTexture));
      return;
    }
    Functions.activeTexture(static_cast<GLenum>(previousActiveTexture));
  }
  if (!isGround || !ModeIs("white-ground")) {
    draw();
    return;
  }

  if (Functions.getUniformiv == nullptr ||
      Functions.activeTexture == nullptr ||
      Functions.genTextures == nullptr ||
      Functions.bindTexture == nullptr ||
      Functions.texImage2D == nullptr ||
      Functions.texParameteri == nullptr) {
    draw();
    return;
  }
  GLint samplerUnit = 0;
  Functions.getUniformiv(
    classification.program,
    classification.groundTextureLocation,
    &samplerUnit);
  if (samplerUnit < 0 || samplerUnit > 31) {
    draw();
    return;
  }
  GLint previousActiveTexture = GL_TEXTURE0;
  Functions.getIntegerv(GL_ACTIVE_TEXTURE, &previousActiveTexture);
  Functions.activeTexture(GL_TEXTURE0 + samplerUnit);
  GLint previousBinding = 0;
  Functions.getIntegerv(GL_TEXTURE_BINDING_2D, &previousBinding);
  GLuint whiteTexture = WhiteTextureForCurrentContext();
  Functions.bindTexture(GL_TEXTURE_2D, whiteTexture);
  draw();
  Functions.bindTexture(GL_TEXTURE_2D, static_cast<GLuint>(previousBinding));
  Functions.activeTexture(static_cast<GLenum>(previousActiveTexture));
}

}  // namespace

extern "C" void CSSMarsLayerDrawArrays(
    GLenum mode,
    GLint first,
    GLsizei count) {
  if (!Ready() || Functions.drawArrays == nullptr) return;
  DrawWithLayerMode(
    "arrays", first, count, 0, nullptr,
    [=] { Functions.drawArrays(mode, first, count); });
}

extern "C" void CSSMarsLayerDrawElements(
    GLenum mode,
    GLsizei count,
    GLenum type,
    const GLvoid *indices) {
  if (!Ready() || Functions.drawElements == nullptr) return;
  DrawWithLayerMode("elements", 0, count, type, indices, [=] {
    Functions.drawElements(mode, count, type, indices);
  });
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
    uintptr_t replacement = 0;
    DrawArraysFunction *drawArraysOriginal = nullptr;
    DrawElementsFunction *drawElementsOriginal = nullptr;
    if (strcmp(name, "_glDrawArrays") == 0) {
      replacement = reinterpret_cast<uintptr_t>(CSSMarsLayerDrawArrays);
      drawArraysOriginal = &Functions.drawArrays;
    } else if (strcmp(name, "_glDrawElements") == 0) {
      replacement = reinterpret_cast<uintptr_t>(CSSMarsLayerDrawElements);
      drawElementsOriginal = &Functions.drawElements;
    } else {
      continue;
    }
    if (bindings[index] == replacement) continue;
    Dl_info currentBindingInfo = {};
    dladdr(reinterpret_cast<void *>(bindings[index]), &currentBindingInfo);
    bool bindingIsOlderLayerHook = currentBindingInfo.dli_fname != nullptr &&
      strstr(
        currentBindingInfo.dli_fname,
        "libcssmars_googleearth_layer_hook") != nullptr;
    if (drawArraysOriginal != nullptr && !bindingIsOlderLayerHook) {
      *drawArraysOriginal = reinterpret_cast<DrawArraysFunction>(
        bindings[index]);
      *reboundArrays += 1;
    }
    if (drawElementsOriginal != nullptr && !bindingIsOlderLayerHook) {
      *drawElementsOriginal = reinterpret_cast<DrawElementsFunction>(
        bindings[index]);
      *reboundElements += 1;
    }
    bindings[index] = replacement;
  }
}

static void *FindImageSymbol(
    const char *imageSuffix,
    const char *symbolName) {
  uint32_t imageCount = _dyld_image_count();
  for (uint32_t imageIndex = 0; imageIndex < imageCount; imageIndex += 1) {
    const char *imageName = _dyld_get_image_name(imageIndex);
    if (imageName == nullptr || strstr(imageName, imageSuffix) == nullptr) {
      continue;
    }
    const auto *header = reinterpret_cast<const mach_header_64 *>(
      _dyld_get_image_header(imageIndex));
    intptr_t slide = _dyld_get_image_vmaddr_slide(imageIndex);
    const segment_command_64 *linkEdit = nullptr;
    const symtab_command *symbolTableCommand = nullptr;
    const uint8_t *commandBytes = reinterpret_cast<const uint8_t *>(
      header + 1);
    for (uint32_t commandIndex = 0;
         commandIndex < header->ncmds;
         commandIndex += 1) {
      const auto *command = reinterpret_cast<const load_command *>(
        commandBytes);
      if (command->cmd == LC_SEGMENT_64) {
        const auto *segment = reinterpret_cast<const segment_command_64 *>(
          commandBytes);
        if (strcmp(segment->segname, SEG_LINKEDIT) == 0) linkEdit = segment;
      } else if (command->cmd == LC_SYMTAB) {
        symbolTableCommand = reinterpret_cast<const symtab_command *>(
          commandBytes);
      }
      commandBytes += command->cmdsize;
    }
    if (linkEdit == nullptr || symbolTableCommand == nullptr) continue;
    uintptr_t linkEditBase = static_cast<uintptr_t>(slide) +
      linkEdit->vmaddr - linkEdit->fileoff;
    const auto *symbols = reinterpret_cast<const nlist_64 *>(
      linkEditBase + symbolTableCommand->symoff);
    const char *strings = reinterpret_cast<const char *>(
      linkEditBase + symbolTableCommand->stroff);
    for (uint32_t symbolIndex = 0;
         symbolIndex < symbolTableCommand->nsyms;
         symbolIndex += 1) {
      const nlist_64 &symbol = symbols[symbolIndex];
      if (symbol.n_un.n_strx == 0 || symbol.n_value == 0) continue;
      const char *name = strings + symbol.n_un.n_strx;
      if (strcmp(name, symbolName) == 0) {
        return reinterpret_cast<void *>(slide + symbol.n_value);
      }
    }
  }
  return nullptr;
}

static uint32_t ReadControlRevision() {
  if (MappedMode == nullptr) return 0;
  return static_cast<uint32_t>(
    static_cast<uint8_t>(MappedMode[20])) |
    static_cast<uint32_t>(static_cast<uint8_t>(MappedMode[21])) << 8 |
    static_cast<uint32_t>(static_cast<uint8_t>(MappedMode[22])) << 16 |
    static_cast<uint32_t>(static_cast<uint8_t>(MappedMode[23])) << 24;
}

static void *WatchLayerControl(void *) {
  TextureMode();
  uint32_t appliedRevision = 0;
  while (true) {
    uint32_t revision = ReadControlRevision();
    if (revision != 0 && revision != appliedRevision &&
        MappedMode != nullptr) {
      appliedRevision = revision;
      bool atmosphere = MappedMode[16] == '1';
      bool sun = MappedMode[17] == '1';
      dispatch_async(dispatch_get_main_queue(), ^{
        if (HeadlessSetQtToggle != nullptr) {
          HeadlessSetQtToggle(@"Atmosphere", atmosphere ? 1 : 0);
          HeadlessSetQtToggle(@"Sun", sun ? 1 : 0);
        }
        AppendControlLine(revision, atmosphere, sun);
      });
    }
    usleep(50 * 1000);
  }
  return nullptr;
}

static void RebindGoogleEarthDrawCalls() {
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
    const uint8_t *commandBytes = reinterpret_cast<const uint8_t *>(
      header + 1);
    for (uint32_t commandIndex = 0;
         commandIndex < header->ncmds;
         commandIndex += 1) {
      const auto *command = reinterpret_cast<const load_command *>(
        commandBytes);
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
        dynamicSymbolTableCommand == nullptr) continue;
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
      const auto *command = reinterpret_cast<const load_command *>(
        commandBytes);
      if (command->cmd == LC_SEGMENT_64) {
        const auto *segment = reinterpret_cast<const segment_command_64 *>(
          commandBytes);
        if (strcmp(segment->segname, SEG_DATA) == 0 ||
            strcmp(segment->segname, "__DATA_CONST") == 0) {
          const auto *sections = reinterpret_cast<const section_64 *>(
            segment + 1);
          for (uint32_t sectionIndex = 0;
               sectionIndex < segment->nsects;
               sectionIndex += 1) {
            RebindSection(
              &sections[sectionIndex],
              slide,
              symbols,
              strings,
              indirectSymbols,
              &reboundArrays,
              &reboundElements);
          }
        }
      }
      commandBytes += command->cmdsize;
    }
  }
  AppendInstallLine(reboundArrays, reboundElements);
}

__attribute__((constructor)) static void InstallLayerRenderHook() {
  @autoreleasepool {
    ResolveFunctions();
    HeadlessSetQtToggle = reinterpret_cast<HeadlessSetQtToggleFunction>(
      FindImageSymbol(
        "/libcssmars_googleearth_oracle.dylib",
        "__ZL11SetQtToggleP8NSStringa"));
    RebindGoogleEarthDrawCalls();
    pthread_t controlThread;
    if (HeadlessSetQtToggle != nullptr &&
        pthread_create(&controlThread, nullptr, WatchLayerControl, nullptr) ==
          0) {
      pthread_detach(controlThread);
    }
  }
}

}  // namespace
