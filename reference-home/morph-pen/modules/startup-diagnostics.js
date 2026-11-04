// Stage-level events only: no logging or allocations in the animation loop.
export function createStartupDiagnostics({ backend, attempt, onEvent, isActive = () => true, now = () => performance.now() }) {
  const startedAt = now();
  let current = null;
  let running = false;
  let closed = false;
  let rendererBackend = null;
  const pendingBackground = new Set();
  const active = () => !closed && isActive();
  const emit = (stage, status, started, error) => {
    if (!active()) return;
    const at = now();
    try {
      onEvent?.({ backend, rendererBackend, attempt, stage, status,
        elapsedMs: at - startedAt, durationMs: at - started,
        ...(error ? { message: error.message } : {}),
      });
    } catch { /* Observers must never interrupt rendering or recovery. */ }
  };
  const annotate = (error, stage) => {
    if (error?.morphStage) return error;
    const wrapped = new Error(`${backend} / ${stage}: ${error?.message ?? String(error)}`, { cause: error });
    wrapped.morphStage = stage;
    wrapped.morphBackend = backend;
    wrapped.morphRendererBackend = rendererBackend;
    wrapped.morphAttempt = attempt;
    return wrapped;
  };
  const complete = () => {
    if (!current) return;
    emit(current.name, 'complete', current.started);
    current = null;
  };
  const cancelBackground = () => {
    for (const stage of pendingBackground) emit(stage.name, 'cancelled', stage.started);
    pendingBackground.clear();
  };
  return {
    get stage() { return current?.name ?? (running ? 'runtime' : 'startup'); },
    enter(name) {
      if (!active()) return;
      complete();
      current = { name, started: now() };
      emit(name, 'started', current.started);
    },
    complete,
    setRendererBackend(value) { if (active()) rendererBackend = value; },
    running() {
      if (!active()) return;
      complete();
      running = true;
      emit('running', 'started', now());
    },
    fail(error) {
      const stage = error?.morphStage ?? this.stage;
      const failure = annotate(error, stage);
      emit(stage, 'failed', current?.started ?? now(), failure);
      current = null;
      cancelBackground();
      closed = true;
      return failure;
    },
    fallback(error) {
      const failure = annotate(error, this.stage);
      emit(this.stage, 'fallback', current?.started ?? now(), failure);
      current = null;
      return failure;
    },
    background(name) {
      const started = now();
      const stage = { name, started };
      if (active()) pendingBackground.add(stage);
      let settled = false;
      emit(name, 'started', started);
      return {
        complete() {
          if (settled) return;
          settled = true;
          pendingBackground.delete(stage);
          emit(name, 'complete', started);
        },
        fail(error) {
          const failure = annotate(error, name);
          if (!settled) emit(name, 'failed', started, failure);
          settled = true;
          pendingBackground.delete(stage);
          return failure;
        },
      };
    },
    cancel() {
      if (current) emit(current.name, 'cancelled', current.started);
      current = null;
      cancelBackground();
      closed = true;
    },
  };
}

// Opt in with ?morphDebug=1. Keep only the most recent 100 stage events.
export function createStartupReporter(target = globalThis.window) {
  if (!target || new URLSearchParams(target.location?.search ?? '').get('morphDebug') !== '1') return undefined;
  const events = [];
  target.__morphDiagnostics = events;
  return (event) => {
    events.push(event);
    if (events.length > 100) events.shift();
  };
}

// A background asset deadline must not take down an otherwise working renderer.
// Late values are released even when the underlying operation cannot be cancelled.
export function runStartupTask({ task, resources, timeoutMs = 8000, onTimeout, onLateResult }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    let release = () => {};
    const finish = (error, value) => {
      if (settled) return false;
      settled = true;
      clearTimeout(timer);
      release();
      if (error) reject(error);
      else resolve(value);
      return true;
    };
    release = resources.defer(() => finish(new Error('Startup task cancelled.')));
    if (settled) return;
    timer = setTimeout(() => {
      finish(new Error(`Stage timed out after ${timeoutMs}ms.`));
      try { onTimeout?.(); }
      catch (error) { console.warn('Morph task cancellation failed.', error); }
    }, timeoutMs);
    try {
      Promise.resolve(task()).then(value => {
        if (!finish(null, value) && value !== undefined) {
          try { onLateResult?.(value); }
          catch (error) { console.warn('Morph late resource cleanup failed.', error); }
        }
      }, error => finish(error));
    } catch (error) {
      finish(error);
    }
  });
}
