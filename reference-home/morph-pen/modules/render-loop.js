export function createRenderLoop({ onFrame, onShouldPause, onScrollStateChange, onResize, onError }) {
  let frameId = 0;
  let isRunning = false;
  let disposed = false;
  let failed = false;
  let paused = false;
  let scrollDirty = false;
  let resizeDirty = false;
  let elapsed = 0;
  let lastTime = 0;

  const stop = () => {
    isRunning = false;
    window.cancelAnimationFrame(frameId);
    frameId = 0;
  };

  const animate = (now) => {
    if (disposed || failed || !isRunning) return;
    frameId = 0;
    // Keep pending layout work until the tab becomes visible again.
    if (document.visibilityState === "hidden") {
      stop();
      return;
    }
    try {
      const resized = resizeDirty;
      const refreshScroll = scrollDirty;
      resizeDirty = false;
      scrollDirty = false;
      if (resized) onResize?.();
      if (refreshScroll) onScrollStateChange?.();
      if (disposed || failed || !isRunning) return;

      if (onShouldPause()) {
        // One final frame on entry; further offscreen scroll events only refresh
        // layout state. Resizing clears the canvas, so it needs one fresh frame.
        if (!paused || resized) onFrame(0, elapsed);
        paused = true;
        stop();
        return;
      }
      const dt = paused ? 0 : Math.min(Math.max((now - lastTime) / 1000, 0), 0.05);
      paused = false;
      lastTime = now;
      elapsed += dt;
      onFrame(dt, elapsed);
      if (isRunning && !disposed) frameId = window.requestAnimationFrame(animate);
    } catch (error) {
      failed = true;
      stop();
      onError?.(error);
    }
  };

  const schedule = () => {
    if (disposed || failed || isRunning || document.visibilityState === "hidden") return;
    isRunning = true;
    lastTime = performance.now();
    frameId = window.requestAnimationFrame(animate);
  };

  const handleScroll = () => {
    if (disposed || failed) return;
    scrollDirty = true;
    schedule();
  };

  return {
    dispose() { disposed = true; stop(); },
    handleScroll,
    handleResize() {
      if (disposed || failed) return;
      resizeDirty = true;
      scrollDirty = true;
      schedule();
    },
    handleVisibilityChange() {
      if (document.visibilityState === "hidden") stop();
      else handleScroll();
    },
    start() {
      if (disposed || failed) return;
      if (onShouldPause()) { paused = true; return; }
      schedule();
    },
    stop,
  };
}
