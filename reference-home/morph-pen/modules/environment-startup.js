import { runStartupTask } from "./startup-diagnostics.js";

export function createStatusController(status) {
  return {
    show(message) {
      status.hidden = false;
      status.textContent = message;
    },
    hide() {
      status.hidden = true;
      status.textContent = "";
    },
  };
}

export async function initializeEnvironmentStartup({
  loadEnvironment,
  cancelEnvironmentLoad,
  diagnostics,
  hdrTimeoutMs = 8000,
  setEnvironmentTexture,
  setFallbackEnvironment,
  startupEnvironmentUrl,
  startupEnvironmentHint,
  statusController,
  resources,
}) {
  if (resources.disposed) return;
  setFallbackEnvironment();
  const stage = diagnostics?.background("hdr-loading");

  try {
    statusController.show("Loading Studio HDR...");
    const startupTexture = await runStartupTask({
      task: () => loadEnvironment(startupEnvironmentUrl, startupEnvironmentHint),
      resources, timeoutMs: hdrTimeoutMs,
      onTimeout: cancelEnvironmentLoad,
      onLateResult: (texture) => texture.dispose(),
    });
    if (resources.disposed) {
      startupTexture.dispose();
      return;
    }
    setEnvironmentTexture(startupTexture);
    stage?.complete();
    statusController.hide();
  } catch (error) {
    if (resources.disposed) return;
    console.warn("Morph HDR unavailable; keeping generated environment.", stage?.fail(error) ?? error);
    statusController.show("Environment fallback active.");
    const timer = window.setTimeout(() => {
      if (!resources.disposed) statusController.hide();
    }, 1200);
    resources.defer(() => window.clearTimeout(timer));
  }
}
