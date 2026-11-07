/* Footer wordmark: the name printed in dots along the bottom edge. Dots part around
   the pointer on springs, warming to gold as they are pushed; a click sends a ring
   through the word. Added after hydration, so the rest of the footer is untouched. */
(() => {
  const WORD = "Aeva Chemicals", RADIUS = 80;
  const FONT = '"Jost", system-ui, sans-serif';

  function start() {
    const root = document.querySelector(".site-footer-bottom");
    if (!root) return;
    const footer = root.closest(".site-footer");
    const canvas = document.createElement("canvas");
    canvas.className = "aeva-dots";
    canvas.setAttribute("aria-hidden", "true");
    root.append(canvas);
    const ctx = canvas.getContext("2d");
    const css = getComputedStyle(document.documentElement);
    const hex = (v) => { const h = v.trim().replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
    const inkHex = css.getPropertyValue("--aeva-ink").trim();
    const ink = hex(inkHex), warm = hex(css.getPropertyValue("--aeva-gold"));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1, px = -1e5, py = -1e5, raf = 0, visible = true, awake = true;
    let ring = { x: 0, y: 0, t: -1 }, dots = new Float32Array(0), count = 0; // x, y, vx, vy, hx, hy, r

    function layout() {
      w = Math.max(1, root.clientWidth);
      const mask = document.createElement("canvas");
      const m = mask.getContext("2d", { willReadFrequently: true });
      m.font = "700 100px " + FONT;
      const size = (w / m.measureText(WORD).width) * 100;
      m.font = "700 " + size + "px " + FONT;
      const box = m.measureText(WORD);
      const low = box.actualBoundingBoxDescent || 0;
      h = Math.ceil((box.actualBoundingBoxAscent || size * 0.72) + low + 8);
      root.style.height = h + "px"; // the word sets its own height and sits on the bottom edge
      canvas.style.height = h + "px";
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      mask.width = w; mask.height = h;
      m.font = "700 " + size + "px " + FONT;
      m.fillText(WORD, (w - box.width) / 2, h - low - 1);
      const img = m.getImageData(0, 0, w, h).data;
      const gap = w < 700 ? 3 : 6, cols = Math.ceil(w / gap), rows = Math.ceil(h / gap), tmp = [];
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          let sum = 0; // coverage: average alpha over a 3x3 sample of the cell
          for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
            const x = Math.min(w - 1, Math.floor(gx * gap + (sx + 0.5) * gap / 3));
            const y = Math.min(h - 1, Math.floor(gy * gap + (sy + 0.5) * gap / 3));
            sum += img[(y * w + x) * 4 + 3];
          }
          const cov = sum / (9 * 255);
          if (cov < 0.06) continue;
          const hx = gx * gap + gap / 2, hy = gy * gap + gap / 2;
          tmp.push(hx, hy, 0, 0, hx, hy, Math.sqrt(cov) * gap * 0.56); // area-true radius
        }
      }
      dots = new Float32Array(tmp);
      count = tmp.length / 7;
      awake = true;
    }

    function draw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const r = reduced ? 0 : RADIUS, age = ring.t < 0 ? 1e9 : now - ring.t, ringR = age * 0.9;
      let moving = false;
      for (let i = 0; i < count; i++) {
        const j = i * 7;
        let x = dots[j], y = dots[j + 1], vx = dots[j + 2], vy = dots[j + 3];
        const hx = dots[j + 4], hy = dots[j + 5];
        if (!reduced) {
          if (age < 900) { // click shock ring
            const dx = hx - ring.x, dy = hy - ring.y, d = Math.hypot(dx, dy) + 0.001;
            const band = 1 - Math.min(1, Math.abs(d - ringR) / 26);
            if (band > 0) { const f = band * 3.2 * (1 - age / 900); vx += dx / d * f; vy += dy / d * f; }
          }
          const dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
          if (r > 0 && d2 < r * r) { const d = Math.sqrt(d2) + 0.001, f = (1 - d / r) * 2.6; vx += dx / d * f; vy += dy / d * f; }
          vx = (vx + (hx - x) * 0.05) * 0.84; // spring home
          vy = (vy + (hy - y) * 0.05) * 0.84;
          x += vx; y += vy;
          if (Math.abs(vx) + Math.abs(vy) > 0.02 || Math.abs(x - hx) + Math.abs(y - hy) > 0.05) moving = true;
          else { x = hx; y = hy; vx = vy = 0; }
          dots[j] = x; dots[j + 1] = y; dots[j + 2] = vx; dots[j + 3] = vy;
        }
        const k = Math.min(1, Math.hypot(x - hx, y - hy) / 28);
        ctx.fillStyle = k > 0.02
          ? "rgb(" + Math.round(ink[0] + (warm[0] - ink[0]) * k) + "," + Math.round(ink[1] + (warm[1] - ink[1]) * k) + "," + Math.round(ink[2] + (warm[2] - ink[2]) * k) + ")"
          : inkHex;
        ctx.beginPath();
        ctx.arc(x, y, dots[j + 6], 0, 6.2832);
        ctx.fill();
      }
      awake = moving || age < 900 || px > -1e4; // sleep once everything is home
    }

    const loop = (now) => { raf = 0; if (!visible) return; draw(now); if (awake) raf = requestAnimationFrame(loop); };
    const wake = () => { awake = true; if (!raf && visible) raf = requestAnimationFrame(loop); };
    const local = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    footer.addEventListener("pointermove", (e) => { [px, py] = local(e); wake(); });
    footer.addEventListener("pointerleave", () => { px = py = -1e5; wake(); });
    root.addEventListener("pointerdown", (e) => {
      if (reduced) return;
      const [x, y] = local(e);
      ring = { x, y, t: performance.now() };
      wake();
    });
    let lastW = 0;
    new ResizeObserver(() => {
      if (root.clientWidth === lastW) return; // height changes come from layout() itself
      lastW = root.clientWidth;
      layout();
      wake();
    }).observe(root);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }).observe(root);
  }

  function prepare() {
    const font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=Jost:wght@700&display=swap";
    document.head.append(font);
    // Wait for Jost, so the word is set in its real face.
    font.addEventListener("load", () => document.fonts.load('700 100px "Jost"').catch(() => {}).then(start));
    font.addEventListener("error", start);
  }
  // Setting the word is heavy, so it waits until the footer is close.
  window.__aevaWhenStarted(() => {
    const footer = document.querySelector(".site-footer");
    if (!footer) return;
    new IntersectionObserver(([e], observer) => {
      if (!e.isIntersecting) return;
      observer.disconnect();
      prepare();
    }, { rootMargin: "1000px 0px" }).observe(footer);
  });
})();
