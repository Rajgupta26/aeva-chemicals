// Each startup attempt owns its allocations, even before it returns a disposer.
export function createResourceScope({ signal, onCleanupError = (error) => console.warn("Morph resource cleanup failed.", error) } = {}) {
  const cleanups = [];
  const owned = new WeakSet();
  let disposed = false;

  const report = (error) => {
    try { onCleanupError(error); } catch { /* Cleanup must always continue. */ }
  };
  const defer = (cleanup) => {
    let pending = true;
    const release = () => {
      if (!pending) return;
      pending = false;
      const action = cleanup;
      cleanup = null;
      try { action(); } catch (error) { report(error); }
    };
    if (disposed) release();
    else cleanups.push(release);
    return release;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    signal?.removeEventListener("abort", dispose);
    while (cleanups.length) cleanups.pop()();
  };
  signal?.addEventListener("abort", dispose, { once: true });
  if (signal?.aborted) dispose();

  return {
    get disposed() { return disposed; },
    defer,
    dispose,
    own(resource) {
      if (resource && !owned.has(resource)) {
        owned.add(resource);
        defer(() => resource.dispose());
      }
      return resource;
    },
    listen(target, type, listener, options) {
      target.addEventListener(type, listener, options);
      return defer(() => target.removeEventListener(type, listener, options));
    },
    check() {
      signal?.throwIfAborted();
      if (disposed) throw new Error("Morph scene has been disposed.");
    },
  };
}

// Synchronous factories clean their partial allocations if construction throws.
export function withResourceScope(parent, initialize) {
  const resources = createResourceScope();
  parent?.defer(resources.dispose);
  try {
    resources.check();
    return initialize(resources);
  } catch (error) {
    resources.dispose();
    throw error;
  }
}
