(() => {
  const stage = document.querySelector(".home-stage");
  const displacement = stage.querySelector("feDisplacementMap");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const pixelScene = document.querySelector(".liquid-scene");
  const artwork = pixelScene.querySelector(".liquid-scene__image");
  const pixels = document.createElement("canvas");
  pixels.className = "home-pixel";
  pixels.hidden = true;
  pixels.setAttribute("aria-hidden", "true");
  pixelScene.append(pixels);
  const context = pixels.getContext("2d");
  const clamp = value => Math.max(0, Math.min(1, value));
  let frame = 0;

  function paintPixels() {
    const bounds = pixelScene.getBoundingClientRect();
    const progress = clamp((innerHeight - bounds.top) / (innerHeight * .78));
    pixels.hidden = !context || !artwork.naturalWidth || progress === 0 || progress === 1;
    if (pixels.hidden) return;
    const size = 4 + 30 * (1 - progress);
    const width = Math.max(1, Math.round(bounds.width / size));
    const height = Math.max(1, Math.round(bounds.height / size));
    if (pixels.width !== width) pixels.width = width;
    if (pixels.height !== height) pixels.height = height;
    const art = artwork.getBoundingClientRect();
    context.fillStyle = getComputedStyle(pixelScene).backgroundColor;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "multiply";
    context.drawImage(artwork, (art.left - bounds.left) / size, (art.top - bounds.top) / size,
      art.width / size, art.height / size);
    context.globalCompositeOperation = "source-over";
    pixels.style.opacity = String(1 - progress);
  }

  function paint() {
    frame = 0;
    const bounds = stage.getBoundingClientRect();
    const progress = motion.matches ? 0 : clamp(-bounds.top / Math.max(1, bounds.height - innerHeight));
    const exit = clamp((progress - .57) / .43);
    stage.style.setProperty("--title-left", `-${exit * 36}vw`);
    stage.style.setProperty("--title-right", `${exit * 36}vw`);
    stage.style.setProperty("--scene-opacity", 1 - exit);
    stage.style.setProperty("--liquid-angle", `${-8 + progress * 112}deg`);
    stage.style.setProperty("--liquid-scale", 1 + Math.sin(progress * Math.PI) * .37 - exit * .4);
    displacement.setAttribute("scale", 12 + Math.sin(progress * Math.PI) * 86);
    if (motion.matches) pixels.hidden = true;
    else paintPixels();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(paint);
  }

  function syncMotion() {
    stage.classList.toggle("is-scrubbed", !motion.matches);
    schedule();
  }

  if (!motion.matches && scrollY === 0 && !location.hash) {
    document.body.classList.add("is-home-entering");
    setTimeout(() => document.body.classList.remove("is-home-entering"), 900);
  }
  motion.addEventListener("change", syncMotion);
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  artwork.addEventListener("load", schedule, { once: true });
  syncMotion();
})();
