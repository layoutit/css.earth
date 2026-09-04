import { validatePreparedOrbitGuides } from "./orbit-guide-contract.mjs";

export function indexPreparedOrbitGuides(plan) {
  validatePreparedOrbitGuides(plan);
  return new Map(plan.guides.map((guide) => [guide.id, guide]));
}

export function mountPreparedOrbitGuide({
  guideIndex,
  id,
  container,
  createLeaf,
  className = "planet-orbit-guide",
}) {
  const guide = guideIndex?.get?.(id);
  if (!guide) throw new Error(`Prepared orbit guide missing for ${id}.`);
  if (!container?.appendChild || typeof createLeaf !== "function" ||
      typeof className !== "string" || className.length === 0) {
    throw new TypeError("Prepared orbit-guide mount request is incompatible.");
  }
  const guideLeaf = createLeaf(guide.leaf);
  guideLeaf.className = className;
  container.appendChild(guideLeaf);
  return Object.freeze({
    id: guide.id,
    guideLeaf,
    planeTransform: guide.planeTransform,
    orbitRadius: guide.orbitRadius,
  });
}

export function createPreparedOrbitGuideInteraction({
  plan,
  bindings,
  inputSurface,
  cameraElement,
  sceneElement,
  systemTransform,
  enabled = true,
  setGuideActive,
  setInputHit,
  windowTarget = globalThis,
  Matrix = globalThis.DOMMatrix,
  readSceneProjectionMatrix,
  requestFrame = (callback) => globalThis.requestAnimationFrame(callback),
  cancelFrame = (frame) => globalThis.cancelAnimationFrame(frame),
}) {
  validatePreparedOrbitGuides(plan);
  validateRuntimeRequest({
    bindings,
    inputSurface,
    cameraElement,
    sceneElement,
    systemTransform,
    enabled,
    setGuideActive,
    setInputHit,
    windowTarget,
    Matrix,
    readSceneProjectionMatrix,
    requestFrame,
    cancelFrame,
  });
  const hitTest = plan.hitTest;
  const guideIndex = indexPreparedOrbitGuides(plan);
  const bindingIds = new Set();
  const preparedBindings = Object.freeze(bindings.map((binding) => {
    const guide = guideIndex.get(binding.id);
    if (!guide || bindingIds.has(binding.id) || !binding.guideLeaf ||
        binding.orbitRadius !== guide.orbitRadius ||
        binding.planeTransform !== guide.planeTransform) {
      throw new TypeError(`Orbit-guide binding drifted for ${binding.id}.`);
    }
    bindingIds.add(binding.id);
    return Object.freeze({
      ...binding,
      planeMatrix: binding.planeTransform
        ? new Matrix(binding.planeTransform)
        : new Matrix(),
    });
  }));
  if (preparedBindings.length !== plan.guideCount) {
    throw new TypeError("Orbit-guide binding count drifted from its plan.");
  }
  const thresholdSquared = hitTest.thresholdPixels ** 2;
  const staticSystemTransform = matrixFromTransform(Matrix, systemTransform);
  const readProjectionMatrix = readSceneProjectionMatrix ??
    ((MatrixConstructor, element) => matrixFromTransform(
      MatrixConstructor,
      element.style.transform,
    ));
  const cameraPerspective = Number.parseFloat(cameraElement.style.perspective);
  if (!Number.isFinite(cameraPerspective) || cameraPerspective <= 0) {
    throw new TypeError("Orbit-guide camera perspective is incompatible.");
  }
  const conics = preparedBindings.map(() => new Float64Array(6));
  let sceneSystemTransform = new Matrix();
  let centerX = 0;
  let centerY = 0;
  let shellScale = 1;
  let pointerX = 0;
  let pointerY = 0;
  let hoverFrame = 0;
  let layoutFrame = 0;
  let interactionActive = false;
  let interactionEnabled = enabled;
  let hoveredBinding = null;
  let touchPointerId = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let touchMaxDistanceSquared = 0;
  let callbackCount = 0;
  let projectionRefreshCount = 0;
  let selectionWriteCount = 0;
  let cursorWriteCount = 0;
  let touchTapCheckCount = 0;
  let destroyed = false;

  const refreshLayout = () => {
    if (destroyed) return;
    const rect = cameraElement.getBoundingClientRect();
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top) ||
        !Number.isFinite(rect.width) || !Number.isFinite(rect.height) ||
        !Number.isFinite(cameraElement.offsetWidth) ||
        cameraElement.offsetWidth <= 0) {
      throw new TypeError("Orbit-guide camera layout is incompatible.");
    }
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
    shellScale = rect.width / cameraElement.offsetWidth;
    refreshProjection();
  };
  const refreshProjection = () => {
    if (destroyed) return;
    const sceneProjectionMatrix = readProjectionMatrix(Matrix, sceneElement);
    if (!isProjectionMatrix(sceneProjectionMatrix)) {
      throw new TypeError(
        "Orbit-guide scene projection matrix is incompatible.",
      );
    }
    sceneSystemTransform = sceneProjectionMatrix.multiply(
      staticSystemTransform,
    );
    if (!isProjectionMatrix(sceneSystemTransform)) {
      throw new TypeError(
        "Orbit-guide composed projection matrix is incompatible.",
      );
    }
    projectionRefreshCount += 1;
    for (let index = 0; index < preparedBindings.length; index += 1) {
      projectPreparedOrbitConic({
        binding: preparedBindings[index],
        sceneSystemTransform,
        cameraPerspective,
        centerX,
        centerY,
        shellScale,
        output: conics[index],
      });
    }
  };
  const setHovered = (binding) => {
    if (binding === hoveredBinding) return;
    const hitStateChanged = (hoveredBinding === null) !== (binding === null);
    if (hoveredBinding) {
      setGuideActive(hoveredBinding, false);
      selectionWriteCount += 1;
    }
    hoveredBinding = binding;
    if (hitStateChanged) {
      setInputHit(hoveredBinding !== null);
      cursorWriteCount += 1;
    }
    if (hoveredBinding) {
      setGuideActive(hoveredBinding, true);
      selectionWriteCount += 1;
    }
  };
  const publishHover = () => {
    hoverFrame = 0;
    if (interactionActive || !interactionEnabled) {
      setHovered(null);
      return;
    }
    callbackCount += 1;
    let nearestBinding = null;
    let nearestDistanceSquared = thresholdSquared;
    for (let index = 0; index < preparedBindings.length; index += 1) {
      const distanceSquared = nearestPreparedOrbitDistanceSquared(
        conics[index],
        pointerX,
        pointerY,
      );
      if (distanceSquared <= nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared;
        nearestBinding = preparedBindings[index];
      }
    }
    setHovered(nearestBinding);
  };
  const scheduleHover = () => {
    if (destroyed || hoverFrame !== 0) return;
    hoverFrame = requestFrame(publishHover);
  };
  const scheduleLayoutRefresh = () => {
    if (destroyed || layoutFrame !== 0) return;
    layoutFrame = requestFrame(() => {
      layoutFrame = 0;
      refreshLayout();
    });
  };
  const onPointerMove = ({ clientX, clientY, pointerId }) => {
    pointerX = clientX;
    pointerY = clientY;
    if (pointerId === touchPointerId) {
      const offsetX = clientX - touchStartX;
      const offsetY = clientY - touchStartY;
      touchMaxDistanceSquared = Math.max(
        touchMaxDistanceSquared,
        offsetX * offsetX + offsetY * offsetY,
      );
    }
    if (!interactionActive) scheduleHover();
  };
  const onPointerDown = ({
    clientX,
    clientY,
    isPrimary,
    pointerId,
    pointerType,
    timeStamp,
  }) => {
    if (pointerType !== "touch" || isPrimary === false) return;
    touchPointerId = pointerId;
    touchStartX = clientX;
    touchStartY = clientY;
    touchStartTime = timeStamp;
    touchMaxDistanceSquared = 0;
  };
  const onPointerUp = ({ clientX, clientY, pointerId, timeStamp }) => {
    if (pointerId !== touchPointerId) return;
    const offsetX = clientX - touchStartX;
    const offsetY = clientY - touchStartY;
    touchMaxDistanceSquared = Math.max(
      touchMaxDistanceSquared,
      offsetX * offsetX + offsetY * offsetY,
    );
    const maximumDistance = hitTest.touchTapMaxMovementPixels;
    const isTap = timeStamp - touchStartTime <=
        hitTest.touchTapMaxDurationMilliseconds &&
      touchMaxDistanceSquared <= maximumDistance * maximumDistance;
    touchPointerId = null;
    if (!isTap) {
      setHovered(null);
      return;
    }
    touchTapCheckCount += 1;
    pointerX = clientX;
    pointerY = clientY;
    scheduleHover();
  };
  const onPointerCancel = ({ pointerId }) => {
    if (pointerId !== touchPointerId) return;
    touchPointerId = null;
    setHovered(null);
  };
  const onPointerLeave = ({ pointerType }) => {
    if (pointerType !== "touch") setHovered(null);
  };

  refreshLayout();
  inputSurface.addEventListener("pointermove", onPointerMove, { passive: true });
  inputSurface.addEventListener("pointerdown", onPointerDown, { passive: true });
  inputSurface.addEventListener("pointerup", onPointerUp, { passive: true });
  inputSurface.addEventListener("pointercancel", onPointerCancel, {
    passive: true,
  });
  inputSurface.addEventListener("pointerleave", onPointerLeave, {
    passive: true,
  });
  windowTarget.addEventListener("resize", scheduleLayoutRefresh, {
    passive: true,
  });

  return Object.freeze({
    refreshLayout,
    refreshProjection,
    interactionStart() {
      interactionActive = true;
      setHovered(null);
    },
    interactionEnd() {
      interactionActive = false;
      refreshProjection();
      if (touchPointerId === null) scheduleHover();
    },
    setEnabled(nextEnabled) {
      const normalizedEnabled = Boolean(nextEnabled);
      if (normalizedEnabled === interactionEnabled) return false;
      interactionEnabled = normalizedEnabled;
      if (!interactionEnabled) setHovered(null);
      return true;
    },
    clear() {
      setHovered(null);
    },
    destroy() {
      if (destroyed) return;
      inputSurface.removeEventListener("pointermove", onPointerMove);
      inputSurface.removeEventListener("pointerdown", onPointerDown);
      inputSurface.removeEventListener("pointerup", onPointerUp);
      inputSurface.removeEventListener("pointercancel", onPointerCancel);
      inputSurface.removeEventListener("pointerleave", onPointerLeave);
      windowTarget.removeEventListener("resize", scheduleLayoutRefresh);
      if (hoverFrame !== 0) cancelFrame(hoverFrame);
      if (layoutFrame !== 0) cancelFrame(layoutFrame);
      hoverFrame = 0;
      layoutFrame = 0;
      setHovered(null);
      destroyed = true;
    },
    stats() {
      return Object.freeze({
        callbackCount,
        projectionRefreshCount,
        selectionWriteCount,
        cursorWriteCount,
        touchTapCheckCount,
        hoveredGuideId: hoveredBinding?.id ?? null,
        model: hitTest.model,
        orbitTestsPerCallback: hitTest.orbitTestsPerCallback,
        pointSamplesPerOrbit: hitTest.pointSamplesPerOrbit,
      });
    },
  });
}

function matrixFromTransform(Matrix, transform) {
  return transform && transform !== "none"
    ? new Matrix(transform)
    : new Matrix();
}

export function projectPreparedOrbitConic({
  binding,
  sceneSystemTransform: scene,
  cameraPerspective,
  centerX,
  centerY,
  shellScale,
  output,
}) {
  const plane = binding.planeMatrix;
  const worldXx = scene.m11 * plane.m11 + scene.m21 * plane.m12 +
    scene.m31 * plane.m13 + scene.m41 * plane.m14;
  const worldXy = scene.m12 * plane.m11 + scene.m22 * plane.m12 +
    scene.m32 * plane.m13 + scene.m42 * plane.m14;
  const worldXz = scene.m13 * plane.m11 + scene.m23 * plane.m12 +
    scene.m33 * plane.m13 + scene.m43 * plane.m14;
  const worldYx = scene.m11 * plane.m21 + scene.m21 * plane.m22 +
    scene.m31 * plane.m23 + scene.m41 * plane.m24;
  const worldYy = scene.m12 * plane.m21 + scene.m22 * plane.m22 +
    scene.m32 * plane.m23 + scene.m42 * plane.m24;
  const worldYz = scene.m13 * plane.m21 + scene.m23 * plane.m22 +
    scene.m33 * plane.m23 + scene.m43 * plane.m24;
  const worldTx = scene.m11 * plane.m41 + scene.m21 * plane.m42 +
    scene.m31 * plane.m43 + scene.m41 * plane.m44;
  const worldTy = scene.m12 * plane.m41 + scene.m22 * plane.m42 +
    scene.m32 * plane.m43 + scene.m42 * plane.m44;
  const worldTz = scene.m13 * plane.m41 + scene.m23 * plane.m42 +
    scene.m33 * plane.m43 + scene.m43 * plane.m44;
  const scaledPerspective = shellScale * cameraPerspective;
  const h11 = -centerX * worldXz + scaledPerspective * worldXx;
  const h12 = -centerX * worldYz + scaledPerspective * worldYx;
  const h13 = centerX * (cameraPerspective - worldTz) +
    scaledPerspective * worldTx;
  const h21 = -centerY * worldXz + scaledPerspective * worldXy;
  const h22 = -centerY * worldYz + scaledPerspective * worldYy;
  const h23 = centerY * (cameraPerspective - worldTz) +
    scaledPerspective * worldTy;
  const h31 = -worldXz;
  const h32 = -worldYz;
  const h33 = cameraPerspective - worldTz;
  const determinant = h11 * (h22 * h33 - h23 * h32) -
    h12 * (h21 * h33 - h23 * h31) +
    h13 * (h21 * h32 - h22 * h31);
  if (!Number.isFinite(determinant) || determinant === 0) {
    output.fill(Number.NaN);
    return output;
  }
  const inverseDeterminant = 1 / determinant;
  const i11 = (h22 * h33 - h23 * h32) * inverseDeterminant;
  const i12 = (h13 * h32 - h12 * h33) * inverseDeterminant;
  const i13 = (h12 * h23 - h13 * h22) * inverseDeterminant;
  const i21 = (h23 * h31 - h21 * h33) * inverseDeterminant;
  const i22 = (h11 * h33 - h13 * h31) * inverseDeterminant;
  const i23 = (h13 * h21 - h11 * h23) * inverseDeterminant;
  const i31 = (h21 * h32 - h22 * h31) * inverseDeterminant;
  const i32 = (h12 * h31 - h11 * h32) * inverseDeterminant;
  const i33 = (h11 * h22 - h12 * h21) * inverseDeterminant;
  const radiusSquared = binding.orbitRadius ** 2;
  output[0] = i11 ** 2 + i21 ** 2 - radiusSquared * i31 ** 2;
  output[1] = i11 * i12 + i21 * i22 - radiusSquared * i31 * i32;
  output[2] = i11 * i13 + i21 * i23 - radiusSquared * i31 * i33;
  output[3] = i12 ** 2 + i22 ** 2 - radiusSquared * i32 ** 2;
  output[4] = i12 * i13 + i22 * i23 - radiusSquared * i32 * i33;
  output[5] = i13 ** 2 + i23 ** 2 - radiusSquared * i33 ** 2;
  return output;
}

export function nearestPreparedOrbitDistanceSquared(conic, x, y) {
  const value = conic[0] * x * x + 2 * conic[1] * x * y +
    2 * conic[2] * x + conic[3] * y * y + 2 * conic[4] * y +
    conic[5];
  const gradientX = 2 * (conic[0] * x + conic[1] * y + conic[2]);
  const gradientY = 2 * (conic[1] * x + conic[3] * y + conic[4]);
  const gradientSquared = gradientX ** 2 + gradientY ** 2;
  if (!Number.isFinite(gradientSquared) || gradientSquared === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return value ** 2 / gradientSquared;
}

function validateRuntimeRequest(request) {
  if (!Array.isArray(request.bindings) || request.bindings.length === 0 ||
      !request.inputSurface?.addEventListener ||
      !request.inputSurface?.removeEventListener ||
      !request.cameraElement?.getBoundingClientRect ||
      !request.sceneElement?.style ||
      typeof request.systemTransform !== "string" ||
      typeof request.enabled !== "boolean" ||
      typeof request.setGuideActive !== "function" ||
      typeof request.setInputHit !== "function" ||
      !request.windowTarget?.addEventListener ||
      !request.windowTarget?.removeEventListener ||
      typeof request.Matrix !== "function" ||
      (request.readSceneProjectionMatrix !== undefined &&
        typeof request.readSceneProjectionMatrix !== "function") ||
      typeof request.requestFrame !== "function" ||
      typeof request.cancelFrame !== "function") {
    throw new TypeError("Orbit-guide runtime request is incompatible.");
  }
}

function isProjectionMatrix(matrix) {
  return matrix && typeof matrix.multiply === "function" && [
    "m11", "m12", "m13", "m14",
    "m21", "m22", "m23", "m24",
    "m31", "m32", "m33", "m34",
    "m41", "m42", "m43", "m44",
  ].every((property) => Number.isFinite(matrix[property]));
}
