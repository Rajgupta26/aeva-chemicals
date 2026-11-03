/* Aeva Chemicals — landing page interactions */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- About: the soaping bath, under the lens ----------
     A pinned macro view of woven cotton. Scrolling runs the wash-off: loose dye
     lifts off the threads, gold AeSop polymer chains (the logo's node-and-line
     mark) gather it up and carry it out of frame, and the cloth comes up bright
     with clean whites. */
  (() => {
    const section = $(".story");
    if (!section) return;
    const pin = $(".story__pin", section);
    const canvas = $(".story__canvas", section);
    const ctx = canvas.getContext("2d");
    const steps = $$(".story__steps li", section);
    const bars = $$(".story__progress i", section);
    const scaleBar = $(".story__scale i", section);
    const ease = (t) => t * t * (3 - 2 * t);
    const ramp = (a, b, v) => (v <= a ? 0 : v >= b ? 1 : ease((v - a) / (b - a)));
    const lerp = (a, b, t) => a + (b - a) * t;
    const OVER = 1.12;    // the weave is drawn oversize so the slow zoom-out never upscales it
    const PITCH_MM = 0.4; // thread spacing the scale bar assumes
    // Shades of the palette: leaf for dyed yarn, cream for white yarn, ink between the threads.
    const YARN = { dyed: ["#04342a", "#0b6b4f", "#3f9f80"], white: ["#aaa596", "#f4f1e8", "#ffffff"] };
    const DYE = ["#0a4d3b", "#0f6b52", "#163f4c"];
    const INK = "#16211c", GOLD = "#e8b84b";

    let w = 0, h = 0, dpr = 1, cell = 30, fw = 0, fh = 0;
    let fabric = null, vignette = null, dots = [], loose = null, bead = null;
    let specks = [], chains = [];
    let target = 0, shown = 0, active = -1, visible = false, raf = 0, last = 0, rebuild = 0;

    // Seeded random, so the dye lands in the same places after a resize.
    let seed = 7;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const sprite = (size, paint) => {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      paint(c.getContext("2d"), size);
      return c;
    };

    // Soft dye specks and a lit gold bead, drawn once and stamped every frame.
    dots = DYE.map((col) => sprite(48, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, col); gr.addColorStop(0.55, col + "e0"); gr.addColorStop(1, col + "00");
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }));
    // Dye once it lets go: lit up so it reads against the dark green yarn.
    loose = sprite(48, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, "#9fe0c4"); gr.addColorStop(0.3, "#2fae86"); gr.addColorStop(1, "rgba(47,174,134,0)");
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    });
    bead = sprite(64, (g, s) => {
      const gr = g.createRadialGradient(s * 0.38, s * 0.36, s * 0.04, s / 2, s / 2, s / 2);
      gr.addColorStop(0, "#fff6d8"); gr.addColorStop(0.35, GOLD); gr.addColorStop(0.82, "#a9802a"); gr.addColorStop(1, "rgba(169,128,42,0)");
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    });

    // A round yarn: dark edges, body colour, a highlight just off centre.
    function yarn(g, x0, y0, x1, y1, dyed) {
      const [edge, body, hi] = dyed ? YARN.dyed : YARN.white;
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, edge); gr.addColorStop(0.3, body); gr.addColorStop(0.44, hi);
      gr.addColorStop(0.62, body); gr.addColorStop(1, edge);
      return gr;
    }
    // Yarn twist: fine diagonal strokes across the thread.
    function twist(g, vertical, c, from, to, t, dyed) {
      g.strokeStyle = dyed ? "rgba(0,0,0,.18)" : "rgba(70,62,40,.12)";
      g.lineWidth = 1;
      g.beginPath();
      for (let s = from; s < to; s += t * 0.32) {
        if (vertical) { g.moveTo(c - t / 2, s); g.lineTo(c + t / 2, s + t * 0.5); }
        else { g.moveTo(s, c - t / 2); g.lineTo(s + t * 0.5, c + t / 2); }
      }
      g.stroke();
    }

    function weave() {
      fw = Math.ceil(w * OVER);
      fh = Math.ceil(h * OVER);
      fabric = document.createElement("canvas");
      fabric.width = Math.round(fw * dpr);
      fabric.height = Math.round(fh * dpr);
      const g = fabric.getContext("2d");
      g.scale(dpr, dpr);
      g.fillStyle = INK;
      g.fillRect(0, 0, fw, fh);
      g.translate(fw / 2, fh / 2);
      g.rotate(-0.17); // the threads run slightly on the bias
      const reach = Math.hypot(fw, fh) / 2 + cell;
      const n = Math.ceil(reach / cell), t = cell * 0.8;
      const dyed = (k) => ((k % 11) + 11) % 11 < 8; // 8 dyed threads, 3 white: a shirting check
      // Warp first, the weft over it, then the warp floats back on top at alternate crossings (plain weave).
      for (let i = -n; i <= n; i++) {
        const x = i * cell;
        g.fillStyle = yarn(g, x - t / 2, 0, x + t / 2, 0, dyed(i));
        g.fillRect(x - t / 2, -reach, t, reach * 2);
      }
      for (let j = -n; j <= n; j++) {
        const y = j * cell;
        g.fillStyle = yarn(g, 0, y - t / 2, 0, y + t / 2, dyed(j));
        g.fillRect(-reach, y - t / 2, reach * 2, t);
        twist(g, false, y, -reach, reach, t, dyed(j));
      }
      for (let i = -n; i <= n; i++) {
        const x = i * cell, d = dyed(i);
        const across = yarn(g, x - t / 2, 0, x + t / 2, 0, d);
        for (let j = -n; j <= n; j++) {
          if ((i + j) & 1) continue;
          const y = j * cell;
          g.save();
          g.shadowColor = "rgba(0,0,0,.5)";
          g.shadowBlur = cell * 0.3 * dpr;
          g.fillStyle = across;
          g.fillRect(x - t / 2, y - cell / 2, t, cell);
          g.restore();
          twist(g, true, x, y - cell / 2, y + cell / 2, t, d);
          // Darken the ends where the thread dips back under.
          const dip = g.createLinearGradient(0, y - cell / 2, 0, y + cell / 2);
          dip.addColorStop(0, "rgba(0,0,0,.45)"); dip.addColorStop(0.24, "rgba(0,0,0,0)");
          dip.addColorStop(0.76, "rgba(0,0,0,0)"); dip.addColorStop(1, "rgba(0,0,0,.45)");
          g.fillStyle = dip;
          g.fillRect(x - t / 2, y - cell / 2, t, cell);
        }
      }
    }

    function scatter() {
      seed = 7;
      const count = w < 720 ? 7 : 11;
      chains = [];
      for (let k = 0; k < count; k++) {
        chains.push({
          n: 7 + Math.floor(rand() * 5),
          x: w * (0.1 + 0.8 * ((k * 0.618 + 0.3) % 1)),
          y: h * (0.16 + 0.66 * (k / (count - 1))),
          a: (rand() - 0.5) * 1.2,
          phase: rand() * 6.28,
          delay: rand() * 0.1,
          pts: [],
          alpha: 0,
        });
      }
      specks = [];
      const total = Math.round(Math.min(460, Math.max(160, (w * h) / 3600)));
      for (let k = 0; k < total; k++) {
        const c = chains[k % count];
        specks.push({
          fx: rand() * fw, fy: rand() * fh,
          r: 1.8 + rand() * rand() * 4.6,
          blot: rand() < 0.14, // a few soft smudges among the specks
          t: 0.27 + rand() * 0.23, // when this speck lets go of the fibre
          c, b: Math.floor(rand() * c.n),
          ox: (rand() - 0.5) * cell * 0.7, oy: (rand() - 0.5) * cell * 0.7,
          img: dots[Math.floor(rand() * dots.length)],
          phase: rand() * 6.28,
        });
      }
    }

    function resize() {
      const r = pin.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      cell = Math.max(20, Math.min(38, w / 42));
      weave();
      scatter();
      vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6);
      vignette.addColorStop(0, "rgba(22,33,28,0)");
      vignette.addColorStop(1, "rgba(22,33,28,.6)");
    }

    function measure() {
      const r = section.getBoundingClientRect();
      const run = r.height - innerHeight;
      target = run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 0;
    }

    function draw(now) {
      if (!fabric) return;
      const p = shown, time = reduced ? 0 : now / 1000;
      const z = 1 - (1 - 1 / OVER) * ease(p); // a slow pull-back across the story
      const ox = w / 2 - (fw * z) / 2, oy = h / 2 - (fh * z) / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(fabric, ox, oy, fw * z, fh * z);

      // Before the wash: whites stained green-grey, the dye flat and muddy.
      const dull = 1 - ramp(0.45, 0.8, p);
      if (dull > 0.01) {
        ctx.globalAlpha = dull;
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = "#c8d2c3";
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = dull * 0.5;
        ctx.globalCompositeOperation = "saturation";
        ctx.fillStyle = "#808080";
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }

      // AeSop polymer chains: rise in with the bath, then leave carrying the dye.
      const wave = time * 1.6 + p * 7;
      for (const c of chains) {
        const enter = ramp(0.2 + c.delay, 0.44 + c.delay, p);
        const leave = ramp(0.6 + c.delay * 0.6, 0.88, p);
        const cx = c.x - (1 - enter) * 60 + leave * 90;
        const cy = lerp(h + 160, c.y, enter) - leave * (c.y + 260);
        const ang = c.a + Math.sin(time * 0.4 + c.phase) * 0.15 + leave * 0.5;
        const dx = Math.cos(ang), dy = Math.sin(ang), sp = cell * 0.62;
        c.alpha = enter * (1 - ramp(0.86, 0.92, p));
        for (let j = 0; j < c.n; j++) {
          const u = (j - (c.n - 1) / 2) * sp;
          const off = Math.sin(j * 0.9 + wave + c.phase) * sp * 0.45;
          c.pts[j] = [cx + dx * u - dy * off, cy + dy * u + dx * off];
        }
      }
      ctx.lineWidth = Math.max(1.4, cell * 0.06);
      ctx.strokeStyle = GOLD;
      for (const c of chains) {
        if (c.alpha < 0.01) continue;
        ctx.globalAlpha = c.alpha * 0.85;
        ctx.beginPath();
        c.pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }

      // Loose dye: sits on the threads, lets go, and is caught by a chain.
      for (const s of specks) {
        const lift = ramp(s.t, s.t + 0.07, p);
        const cap = ramp(s.t + 0.05, s.t + 0.2, p);
        let x = ox + s.fx * z, y = oy + s.fy * z - lift * cell * 0.5;
        if (lift > 0 && cap < 1) {
          x += Math.sin(time * 3 + s.phase) * 1.5 * lift;
          y += Math.cos(time * 2.6 + s.phase) * 1.5 * lift;
        }
        if (cap > 0) {
          const [bx, by] = s.c.pts[s.b];
          x = lerp(x, bx + s.ox, cap);
          y = lerp(y, by + s.oy, cap);
        }
        const alpha = (s.blot ? 0.5 : 0.95) * lerp(1, s.c.alpha, cap);
        if (alpha < 0.01 || y < -20 || y > h + 20) continue;
        const d = s.r * (s.blot ? 2.4 : 1) * (1 + lift * 0.6) * 2.6;
        ctx.globalAlpha = alpha * (1 - lift);
        if (lift < 1) ctx.drawImage(s.img, x - d / 2, y - d / 2, d, d);
        ctx.globalAlpha = alpha * lift;
        if (lift > 0) ctx.drawImage(loose, x - d * 0.75, y - d * 0.75, d * 1.5, d * 1.5);
      }
      const rb = cell * 0.42;
      for (const c of chains) {
        if (c.alpha < 0.01) continue;
        ctx.globalAlpha = c.alpha;
        for (const [x, y] of c.pts) ctx.drawImage(bead, x - rb / 2, y - rb / 2, rb, rb);
      }
      ctx.globalAlpha = 1;

      // Out of the bath: one slow sheen across the clean cloth.
      const sweep = (p - 0.8) / 0.17;
      if (sweep > 0 && sweep < 1) {
        const x = lerp(-0.4 * w, 1.4 * w, sweep);
        const gr = ctx.createLinearGradient(x - w * 0.22, 0, x + w * 0.22, h * 0.35);
        gr.addColorStop(0, "rgba(255,255,255,0)");
        gr.addColorStop(0.5, "rgba(255,250,235," + (0.24 * Math.sin(sweep * Math.PI)).toFixed(3) + ")");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      // The card and the scale bar follow the same progress.
      const step = Math.min(3, Math.floor(p * 4));
      if (step !== active) {
        active = step;
        steps.forEach((li, i) => li.classList.toggle("is-on", i === step));
      }
      bars.forEach((b, i) => b.style.setProperty("--fill", Math.min(1, Math.max(0, p * 4 - i)).toFixed(3)));
      if (scaleBar) scaleBar.style.width = ((cell / PITCH_MM) * z).toFixed(1) + "px";
    }

    function tick(now) {
      raf = 0;
      if (!visible) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      shown = reduced ? target : shown + (target - shown) * (1 - Math.exp(-dt * 7));
      if (Math.abs(target - shown) < 0.0005) shown = target;
      draw(now);
      if (!reduced || shown !== target) raf = requestAnimationFrame(tick);
    }
    const wake = () => {
      if (raf || !visible) return;
      last = 0;
      raf = requestAnimationFrame(tick);
    };
    addEventListener("scroll", () => { measure(); wake(); }, { passive: true });
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) { measure(); wake(); }
    }).observe(section);
    // Rebuilding the weave is heavy, so wait for the resize to settle.
    new ResizeObserver(() => {
      clearTimeout(rebuild);
      rebuild = setTimeout(() => {
        resize();
        measure();
        shown = target;
        draw(performance.now());
        wake();
      }, fabric ? 150 : 0);
    }).observe(pin);

    // The company film plays in a pop-up from the story card.
    const film = $(".film");
    if (film) {
      const video = $("video", film);
      $(".story__film", section).addEventListener("click", () => {
        film.showModal();
        video.play().catch(() => {});
      });
      $(".film__close", film).addEventListener("click", () => film.close());
      film.addEventListener("click", (e) => { if (e.target === film) film.close(); });
      film.addEventListener("close", () => video.pause());
    }
  })();

  /* ---------- Roll text effect ----------
     Hover: line rolls up, a tinted copy slides in from below.
     Leave: the copy stays up and fades back to the base colour (the trail),
     then the line silently resets once both layers look identical. */
  $$(".roll").forEach((el) => {
    const text = el.textContent.trim();
    el.innerHTML = `<span class="roll__in"><span>${text}</span><span aria-hidden="true">${text}</span></span>`;
    const host = el.closest(".btn") || el;
    let timer;
    host.addEventListener("mouseenter", () => {
      clearTimeout(timer);
      el.classList.remove("is-fade");
      el.classList.add("is-on");
    });
    host.addEventListener("mouseleave", () => {
      el.classList.add("is-fade");
      timer = setTimeout(() => el.classList.remove("is-on", "is-fade"), 1150);
    });
  });

  /* ---------- Split helpers ---------- */
  function splitChars(root, counter) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest(".hero__rotator") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(" "); return; }
        const word = document.createElement("span");
        word.className = "word";
        [...part].forEach((ch) => {
          const c = document.createElement("span");
          c.className = "char";
          c.textContent = ch;
          c.style.setProperty("--i", counter.n++);
          word.append(c);
        });
        frag.append(word);
      });
      node.replaceWith(frag);
    });
  }

  function splitWords(el) {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(" "); return; }
            const w = document.createElement("span");
            w.className = "word";
            w.innerHTML = `<span style="--i:${i++}">${part}</span>`;
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  }

  /* ---------- Hero title ---------- */
  const counter = { n: 0 };
  $$(".hero__title .split").forEach((s) => splitChars(s, counter));

  // rotating last word
  const rot = $(".hero__rotator");
  const track = $(".hero__rot-track");
  const items = $$(".hero__rot-track > span");
  items.forEach((s) => (s.style.width = "max-content"));
  rot.style.transition = "width .8s cubic-bezier(.7,0,.2,1)";
  rot.style.opacity = "0";
  rot.style.transform = "translateY(40%)";
  let idx = 0;
  const setRotWidth = () => (rot.style.width = items[idx].offsetWidth + "px");
  function nextWord() {
    idx++;
    track.style.transition = "";
    track.style.transform = `translateY(${-idx * 0.98}em)`;
    setRotWidth();
    if (idx === items.length - 1) {
      // last item duplicates the first: jump back without animating
      setTimeout(() => {
        track.style.transition = "none";
        idx = 0;
        track.style.transform = "translateY(0)";
        setRotWidth();
      }, 820);
    }
  }

  const start = () => {
    setRotWidth();
    document.body.classList.add("is-ready");
    $$(".hero__title .split").forEach((s) => s.classList.add("is-ready"));
    setTimeout(() => {
      rot.style.transition += ", opacity .8s, transform .9s cubic-bezier(.16,1,.3,1)";
      rot.style.opacity = "1";
      rot.style.transform = "none";
    }, counter.n * 28 + 300);
    if (!reduced) setInterval(nextWord, 2800);
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
  addEventListener("resize", setRotWidth);

  /* ---------- Scroll reveals ---------- */
  $$(".reveal-words").forEach(splitWords);
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      e.target.querySelectorAll("[data-count]").forEach(countUp);
      if (e.target.matches("[data-count]")) countUp(e.target);
      io.unobserve(e.target);
    }),
    { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }
  );
  $$(".reveal-up, .reveal-words").forEach((el) => io.observe(el));

  function countUp(el) {
    if (el.dataset.done) return;
    el.dataset.done = 1;
    const end = +el.dataset.count;
    const dur = reduced ? 0 : 1800;
    const t0 = performance.now();
    const tick = (t) => {
      const p = dur ? Math.min((t - t0) / dur, 1) : 1;
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(end * eased).toLocaleString("en-IN");
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Nav ---------- */
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  $(".nav__burger").addEventListener("click", (e) => {
    const open = nav.classList.toggle("is-open");
    e.currentTarget.setAttribute("aria-expanded", open);
  });
  $$(".nav__links a").forEach((a) => a.addEventListener("click", () => nav.classList.remove("is-open")));

  /* ---------- Capabilities cursor label ---------- */
  const cursor = $("#capCursor");
  $$("#capList a").forEach((a) => {
    a.addEventListener("mouseenter", () => { cursor.textContent = a.dataset.note; cursor.classList.add("is-on"); });
    a.addEventListener("mouseleave", () => cursor.classList.remove("is-on"));
  });
  addEventListener("mousemove", (e) => {
    cursor.style.left = e.clientX + "px";
    cursor.style.top = e.clientY + "px";
  }, { passive: true });

  /* ---------- Liquid formulation study ----------
     A small texture with GPU refraction, rather than a large autoplay video.
     The original image remains visible if WebGL is unavailable. */
  (() => {
    const scene = $("#liquidScene");
    const section = scene.closest("section");
    const copy = $(".split-panel__text", section);
    const cards = $(".tailor", section);
    const label = $(".liquid-scene__top", scene);
    const caption = $(".liquid-scene__bottom", scene);
    const canvas = $(".liquid-scene__canvas", scene);
    const image = $(".liquid-scene__image", scene);
    const toggle = $(".liquid-scene__toggle", scene);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const sideBySide = matchMedia("(min-width: 861px)");
    const heading = $("#tailor-title", copy);
    // Artwork box in CSS px, relative to the scene. `swirl` is where the liquid sits inside
    // its square image (fractions), measured once the image loads.
    const art = { x: 0, y: 0, size: 0, swirl: { top: 0, bottom: 1, left: 0, right: 1 } };

    // Gap between the heading's box and the top of its capital letters (half the line's extra leading
    // plus the space above the caps), so the swirl lines up with the ink rather than the box.
    const headingInk = () => {
      const cs = getComputedStyle(heading), size = parseFloat(cs.fontSize);
      const line = parseFloat(cs.lineHeight) || size * 1.2;
      return (line - size) / 2 + size * 0.2;
    };
    // Layout position on the page, ignoring the reveal transforms.
    const pageTop = (el) => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };

    // Sit the caption level with the bottom of the cards beside it, start the swirl level
    // with the top of "Tailor-made", and keep it clear of the label and the caption.
    function place() {
      const side = sideBySide.matches;
      if (side) {
        const below = pageTop(section) + section.offsetHeight - pageTop(cards) - cards.offsetHeight;
        scene.style.setProperty("--caption-bottom", Math.max(24, below) + "px");
      } else {
        scene.style.removeProperty("--caption-bottom");
      }
      const s = art.swirl;
      const clear = label.offsetTop + label.offsetHeight + 16;
      const from = side ? Math.max(clear, pageTop(heading) - pageTop(scene) + headingInk()) : clear;
      // Side by side the swirl is allowed down alongside the caption so it can fill the panel.
      const to = side ? caption.offsetTop + caption.offsetHeight * 0.3 : caption.offsetTop - 16;
      const across = side ? 0.98 : 0.92;
      art.size = Math.max(0, Math.min((scene.clientWidth * across) / (s.right - s.left), (to - from) / (s.bottom - s.top)));
      art.x = scene.clientWidth / 2 - ((s.left + s.right) / 2) * art.size;
      // Side by side the swirl's top meets the heading; stacked, it is centred between label and caption.
      const spare = side ? 0 : (to - from - (s.bottom - s.top) * art.size) / 2;
      art.y = from + spare - s.top * art.size;
      scene.style.setProperty("--art-x", art.x + "px");
      scene.style.setProperty("--art-y", art.y + "px");
      scene.style.setProperty("--art-size", art.size + "px");
      scene.classList.add("is-placed");
    }
    let resize = () => {};
    const layout = () => { place(); resize(); };
    const observer = new ResizeObserver(layout);
    [scene, ...copy.children].forEach((el) => observer.observe(el));
    sideBySide.addEventListener("change", layout);
    place();

    const options = { alpha: false, antialias: false, depth: false, powerPreference: "low-power" };
    const gl = canvas.getContext("webgl2", options) || canvas.getContext("webgl", options);
    if (!gl) return;

    function shader(type, source) {
      const value = gl.createShader(type);
      gl.shaderSource(value, source);
      gl.compileShader(value);
      if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) {
        gl.deleteShader(value);
        return null;
      }
      return value;
    }
    const vertex = shader(gl.VERTEX_SHADER, `
      attribute vec2 position;
      varying vec2 uv;
      void main() { uv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
    `);
    const fragment = shader(gl.FRAGMENT_SHADER, `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      varying vec2 uv;
      uniform sampler2D artwork;
      uniform float phase;
      uniform vec4 box; // artwork position and size, in canvas UV
      const vec3 cream = vec3(0.957, 0.945, 0.910);
      void main() {
        vec2 p = (uv - box.xy) / box.zw;
        // Gentle local refraction makes the liquid bend and droplets drift.
        p.x += 0.014 * sin(p.y * 9.0 + phase) + 0.006 * sin(p.y * 17.0 - phase * 2.0);
        p.y += 0.012 * sin(p.x * 8.0 - phase) + 0.005 * cos(p.x * 14.0 + phase * 2.0);
        // Lift the artwork's near-white (253-255) background to pure white so no box shows.
        // Sampled outside any branch so mipmap selection stays smooth at the artwork's edge.
        vec3 colour = min(texture2D(artwork, p).rgb * 1.008, 1.0);
        float inside = step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);
        colour = mix(vec3(1.0), colour, inside);
        // Multiply onto the page cream here, so the opaque canvas fully covers the still image.
        gl_FragColor = vec4(colour * cream, 1.0);
      }
    `);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const phase = gl.getUniformLocation(program, "phase");
    const box = gl.getUniformLocation(program, "box");
    gl.uniform1i(gl.getUniformLocation(program, "artwork"), 0);

    let loaded = false, visible = false, paused = false, lost = false;
    let frame = 0, elapsed = 0, previous = 0;
    const canAnimate = () => loaded && visible && !paused && !motion.matches && !document.hidden && !lost;
    function paint() {
      if (!loaded || lost) return;
      gl.uniform1f(phase, (elapsed % 20000) * Math.PI / 10000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    function tick(now) {
      frame = 0;
      if (!canAnimate()) { previous = 0; return; }
      // Cap at 30 fps and avoid jumps after leaving the viewport.
      if (!previous || now - previous >= 32) {
        elapsed += previous ? Math.min(now - previous, 64) : 0;
        previous = now;
        paint();
      }
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      toggle.hidden = !loaded || motion.matches || lost;
      if (canAnimate()) frame = requestAnimationFrame(tick);
      else paint();
    }
    resize = () => {
      const bounds = scene.getBoundingClientRect();
      // Full device resolution keeps the fine droplets crisp on retina screens.
      const scale = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * scale));
      canvas.height = Math.max(1, Math.round(bounds.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform4f(box, art.x / bounds.width, 1 - (art.y + art.size) / bounds.height, art.size / bounds.width, art.size / bounds.height);
      paint();
    };
    // Find the liquid inside its near-white square, so its visible top (not the image edge) lines up.
    function measureSwirl() {
      const n = 128, c = document.createElement("canvas");
      c.width = c.height = n;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(image, 0, 0, n, n);
      const px = g.getImageData(0, 0, n, n).data;
      let t = n, b = -1, l = n, r = -1;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const i = (y * n + x) * 4;
          if (Math.min(px[i], px[i + 1], px[i + 2]) > 232) continue;
          t = Math.min(t, y); b = Math.max(b, y); l = Math.min(l, x); r = Math.max(r, x);
        }
      }
      if (b > t && r > l) art.swirl = { top: t / n, bottom: (b + 1) / n, left: l / n, right: (r + 1) / n };
    }
    function load() {
      if (loaded || !image.naturalWidth || lost) return;
      // WebGL2 can mipmap this non-power-of-two texture, so it stays smooth when drawn small.
      const mipmaps = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      } catch { return; }
      if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
      measureSwirl();
      loaded = true;
      place();
      resize();
      scene.classList.add("is-ready");
      sync();
    }
    image.addEventListener("load", load, { once: true });
    if (image.complete) load();
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(scene);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    toggle.addEventListener("click", () => {
      paused = !paused;
      toggle.setAttribute("aria-pressed", String(paused));
      toggle.setAttribute("aria-label", paused ? "Play liquid animation" : "Pause liquid animation");
      sync();
    });
    canvas.addEventListener("webglcontextlost", () => {
      lost = true;
      scene.classList.remove("is-ready");
      sync();
    });
  })();

  /* ---------- Footer: halftone wordmark ----------
     The name is set huge along the bottom edge and printed as dots sized by
     how much letter covers each cell. Dots part around the pointer on springs,
     warming to gold as they are pushed; a click sends a ring through the word. */
  (() => {
    const root = $(".hwf-root");
    const canvas = $(".hwf-canvas", root);
    const ctx = canvas && canvas.getContext("2d");
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const hex = (v) => { const h = v.trim().replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
    const bg = css.getPropertyValue("--cream").trim();
    const inkHex = css.getPropertyValue("--ink").trim();
    const ink = hex(inkHex), warm = hex(css.getPropertyValue("--gold"));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const WORD = "Aeva Chemicals", RADIUS = 80;
    let w = 0, h = 0, dpr = 1, px = -1e5, py = -1e5, raf = 0, visible = true, awake = true;
    let ring = { x: 0, y: 0, t: -1 };
    let dots = new Float32Array(0), count = 0, grain = null; // x, y, vx, vy, hx, hy, r per dot

    function layout() {
      const rect = root.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      // Set the word once on a 1x mask, sized to fill the width.
      const mask = document.createElement("canvas");
      mask.width = w; mask.height = h;
      const m = mask.getContext("2d", { willReadFrequently: true });
      m.font = '700 100px "Jost", system-ui, sans-serif';
      const size = (w * 1.0 / m.measureText(WORD).width) * 100;
      m.font = '700 ' + size + 'px "Jost", system-ui, sans-serif';
      const box = m.measureText(WORD);
      // Whole word sits right on the bottom edge (letters' lowest ink at the last dot row).
      m.fillText(WORD, (w - box.width) / 2, h - (box.actualBoundingBoxDescent || 0) - 1);
      const img = m.getImageData(0, 0, w, h).data;
      const gap = w < 700 ? 4 : 6;
      const cols = Math.ceil(w / gap), rows = Math.ceil(h / gap), tmp = [];
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
      // A fixed tile of print grain laid over every frame.
      grain = document.createElement("canvas");
      grain.width = grain.height = 256;
      const g = grain.getContext("2d"), id = g.createImageData(256, 256);
      for (let i = 0; i < id.data.length; i += 4) {
        id.data[i] = id.data[i + 1] = id.data[i + 2] = Math.random() * 255;
        id.data[i + 3] = Math.random() < 0.5 ? 0 : 255;
      }
      g.putImageData(id, 0, 0);
      awake = true;
    }

    function draw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const r = reduced ? 0 : RADIUS;
      const age = ring.t < 0 ? 1e9 : now - ring.t, ringR = age * 0.9;
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
      if (grain) {
        ctx.globalAlpha = 0.045;
        ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = ctx.createPattern(grain, "repeat");
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      awake = moving || age < 900 || px > -1e4; // sleep once everything is home
    }

    const loop = (now) => { raf = 0; if (!visible) return; draw(now); if (awake) raf = requestAnimationFrame(loop); };
    const wake = () => { awake = true; if (!raf && visible) raf = requestAnimationFrame(loop); };
    const local = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    root.addEventListener("pointermove", (e) => { [px, py] = local(e); wake(); });
    root.addEventListener("pointerleave", () => { px = py = -1e5; wake(); });
    root.addEventListener("pointerdown", (e) => {
      if (reduced || e.target.closest("a,button")) return;
      const [x, y] = local(e);
      ring = { x, y, t: performance.now() };
      wake();
    });
    new ResizeObserver(() => { layout(); wake(); }).observe(root);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }).observe(root);
    // Re-set the word once Jost has loaded.
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { layout(); wake(); });
  })();

})();
