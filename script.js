/* Aeva Chemicals — landing page interactions */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  addEventListener("resize", () => { setRotWidth(); fitWord(); });

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
  $$(".reveal-up, .reveal-words, .footer__word").forEach((el) => io.observe(el));

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
    const canvas = $(".liquid-scene__canvas", scene);
    const image = $(".liquid-scene__image", scene);
    const toggle = $(".liquid-scene__toggle", scene);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, powerPreference: "low-power" });
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
      precision mediump float;
      varying vec2 uv;
      uniform sampler2D artwork;
      uniform float phase;
      uniform float aspect;
      void main() {
        vec2 fit = vec2(min(aspect, 1.0), min(1.0 / aspect, 1.0));
        vec2 p = (uv - 0.5) * fit / 1.05 + 0.5;
        // Gentle local refraction makes the liquid bend and droplets drift.
        p.x += 0.014 * sin(p.y * 9.0 + phase) + 0.006 * sin(p.y * 17.0 - phase * 2.0);
        p.y += 0.012 * sin(p.x * 8.0 - phase) + 0.005 * cos(p.x * 14.0 + phase * 2.0);
        gl_FragColor = texture2D(artwork, p);
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
    const aspect = gl.getUniformLocation(program, "aspect");
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
    function resize() {
      const bounds = scene.getBoundingClientRect();
      const scale = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(bounds.width * scale));
      canvas.height = Math.max(1, Math.round(bounds.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(aspect, canvas.width / canvas.height);
      paint();
    }
    function load() {
      if (loaded || !image.naturalWidth || lost) return;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      } catch { return; }
      loaded = true;
      resize();
      scene.classList.add("is-ready");
      sync();
    }
    image.addEventListener("load", load, { once: true });
    if (image.complete) load();
    new ResizeObserver(resize).observe(scene);
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

  /* ---------- Footer giant word: fit to full width ---------- */
  const bigWord = $("#bigWord");
  function fitWord() {
    const wrap = bigWord.parentElement;
    bigWord.style.fontSize = "100px";
    const w = bigWord.scrollWidth;
    bigWord.style.fontSize = (100 * wrap.clientWidth / w) * 0.995 + "px";
  }
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(fitWord);

  /* ---------- Newsletter (front-end only) ---------- */
  const form = $("#newsForm");
  const msg = $("#newsMsg");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    msg.classList.remove("is-err");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "Please enter a valid email address."; msg.classList.add("is-err"); return; }
    if (!form.agree.checked) { msg.textContent = "Please agree to the privacy policy."; msg.classList.add("is-err"); return; }
    msg.textContent = "Thank you — you're on the list.";
    form.reset();
  });
})();
