/* Phones and tablets skip the 3D engine: the hero blob is a light image, and this
   turns and shrinks it with the scroll so the opening keeps its motion. */
(() => {
  if (!window.__aevaLite) return;
  let frame = 0;
  function update() {
    frame = 0;
    const track = document.querySelector(".hero-canvas-track");
    const scene = document.querySelector(".morph-scene");
    if (!track || !scene) return;
    const run = Math.max(1, track.offsetHeight - innerHeight);
    const progress = Math.min(1, Math.max(0, -track.getBoundingClientRect().top / run));
    scene.style.setProperty("--hero-progress", progress.toFixed(3));
  }
  addEventListener("scroll", () => { frame ||= requestAnimationFrame(update); }, { passive: true });
  addEventListener("resize", update);
  update();
})();
