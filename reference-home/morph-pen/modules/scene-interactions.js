import { withResourceScope } from "./resource-scope.js";
export function getResponsiveSceneScale(width) {
  if (width <= 600) return 0.72;
  if (width <= 800) return 0.8;
  if (width <= 1000) return 0.88;
  return 1;
}

export function createResizeController({
  mount,
  camera,
  renderer,
  pointerInput,
  onScaleChange,
}) {
  const onResize = () => {
    const width = Math.max(mount.clientWidth, 1);
    const height = Math.max(mount.clientHeight, 1);

    onScaleChange(getResponsiveSceneScale(width));
    pointerInput.updateBounds();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  return {
    onResize,
  };
}

export function attachSceneEventBindings({
  resources: parent,
  canvas,
  pointerInput,
  renderLoop,
  onError,
}) {
  return withResourceScope(parent, (resources) => {
    const onContextLost = (event) => {
      event.preventDefault();
      renderLoop.stop();
      onError?.(new Error("Graphics context lost."));
    };
    resources.listen(canvas, "webglcontextlost", onContextLost);
    resources.listen(canvas, "pointerleave", pointerInput.resetPointer);
    resources.listen(canvas, "pointerdown", pointerInput.onPointerDown);
    resources.listen(window, "pointermove", pointerInput.onPointerMove);
    resources.listen(window, "pointerup", pointerInput.endDrag);
    resources.listen(window, "pointercancel", pointerInput.endDrag);
    resources.listen(window, "pointerleave", pointerInput.resetPointer);
    resources.listen(window, "scroll", renderLoop.handleScroll, { passive: true });
    resources.listen(window, "resize", renderLoop.handleResize);
    resources.listen(document, "visibilitychange", renderLoop.handleVisibilityChange);

    resources.defer(() => pointerInput.endDrag());
    return resources.dispose;
  });
}
