const preference = matchMedia("(prefers-reduced-motion: reduce)");
const hero = document.querySelector(".p-hero");
const mount = hero.querySelector(".p-morph");
let controller;
let dispose;
let pendingFrame;

function stopMorph() {
  controller?.abort();
  dispose?.();
  dispose = undefined;
  mount.classList.remove("is-ready");
  hero.classList.remove("has-morph");
}

async function startMorph() {
  stopMorph();
  if (preference.matches) return;
  const run = new AbortController();
  controller = run;
  const renderers = [
    [() => import("./reference-home/morph-pen/react-scene.js"), "initMorphScene"],
    [() => import("./reference-home/morph-pen/webgl-fallback-scene.js"), "initWebGLFallbackScene"],
  ];
  for (const [load, init] of renderers) {
    try {
      const renderer = await load();
      if (run.signal.aborted) return;
      const canvas = document.createElement("canvas");
      mount.querySelector("canvas")?.remove();
      mount.append(canvas);
      hero.classList.add("has-morph");
      const backdropColor = getComputedStyle(hero).getPropertyValue("--aeva-emerald").trim();
      const cleanup = await renderer[init]({ mount, canvas, backdropColor, signal: run.signal, onError: () => {
        if (controller === run) stopMorph();
      } });
      if (run.signal.aborted) {
        cleanup();
        return;
      }
      dispose = cleanup;
      mount.classList.add("is-ready");
      return;
    } catch {
      if (run.signal.aborted) return;
    }
  }
  stopMorph();
}

function updateHero() {
  pendingFrame = undefined;
  const bounds = hero.getBoundingClientRect();
  const distance = Math.max(1, bounds.height - innerHeight);
  const progress = preference.matches ? 0 : Math.min(1, Math.max(0, -bounds.top / distance));
  hero.style.setProperty("--product-progress", progress);
}

if ("IntersectionObserver" in window) {
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.remove("is-pending");
      reveal.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -8% 0px" });
  for (const section of document.querySelectorAll("[data-product-reveal]")) {
    if (!preference.matches && section.getBoundingClientRect().top > innerHeight) {
      section.classList.add("is-pending");
      section.addEventListener("focusin", () => section.classList.remove("is-pending"), { once: true });
      reveal.observe(section);
    }
  }
}

function requestUpdate() {
  pendingFrame ??= requestAnimationFrame(updateHero);
}

addEventListener("scroll", requestUpdate, { passive: true });
addEventListener("resize", requestUpdate);
preference.addEventListener("change", () => {
  for (const section of document.querySelectorAll(".is-pending")) section.classList.remove("is-pending");
  requestUpdate();
  void startMorph();
});
addEventListener("pagehide", stopMorph);
addEventListener("pageshow", event => {
  if (event.persisted) void startMorph();
});
void startMorph();
