/* About: the Tailor-made section with the live liquid, in place of the photo gallery.
   Added after hydration; the gallery markup stays hidden underneath. */
(() => {
  const POINTS = [
    ["var(--aeva-leaf)", "Water hardness", "Tuned to your water"],
    ["var(--aeva-emerald)", "Machine type", "Jet, soft-flow, winch"],
    ["var(--aeva-gold)", "Low temp", "60–70 °C grade"],
    ["var(--aeva-ink)", "Strength & price", "For your budget"],
  ];

  function section(wrap) {
    const root = document.createElement("section");
    root.className = "aeva-tailor";
    root.setAttribute("aria-labelledby", "aeva-tailor-title");
    root.innerHTML = `
      <div class="aeva-tailor__copy">
        <p class="aeva-tailor__eyebrow">Built for the bath</p>
        <h2 id="aeva-tailor-title">Tailor-made<br>for your mill.</h2>
        <p class="aeva-tailor__lede">Every dyehouse is different. We tune each formulation to your water hardness, your machines, your temperature and your budget — then send a trial sample with a recipe for your machine.</p>
        <div class="aeva-points"></div>
      </div>
      <div class="aeva-tailor__art">
        <div class="aeva-tailor__liquid"></div>
        <div class="aeva-tailor__caption">
          <p>Chemistry,<br><span>tailored.</span></p>
          <button type="button" aria-label="Pause liquid animation" aria-pressed="false"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path class="is-pause" d="M9 6v12M15 6v12"/><path class="is-play" d="m9 6 9 6-9 6Z"/></svg></button>
        </div>
      </div>`;
    const list = root.querySelector(".aeva-points");
    POINTS.forEach(([colour, title, note]) => {
      const item = document.createElement("div");
      item.innerHTML = "<i></i><b></b><span></span>";
      item.children[0].style.background = colour;
      item.children[1].textContent = title;
      item.children[2].textContent = note;
      list.append(item);
    });
    wrap.after(root);
    wrap.hidden = true;
    liquid(root.querySelector(".aeva-tailor__liquid"), root.querySelector("button"));
  }

  function liquid(clip, toggle) {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = document.createElement("canvas");
    canvas.className = "aeva-liquid";
    canvas.setAttribute("aria-hidden", "true");
    clip.append(canvas);
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false });
    if (!gl) return;
    const compile = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, `
      attribute vec2 position;
      varying vec2 uv;
      void main() { uv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `
      precision highp float;
      varying vec2 uv;
      uniform sampler2D artwork;
      uniform float phase, turn, aspect;
      void main() {
        vec2 c = (uv - 0.5) * vec2(1.0, 1.0 / aspect) / 0.94;
        float s = sin(turn), k = cos(turn);
        vec2 p = vec2(k * c.x - s * c.y, s * c.x + k * c.y) + 0.5; // the slow rotation
        p.x += 0.014 * sin(p.y * 9.0 + phase) + 0.006 * sin(p.y * 17.0 - phase * 2.0);
        p.y += 0.012 * sin(p.x * 8.0 - phase) + 0.005 * cos(p.x * 14.0 + phase * 2.0);
        vec3 colour = min(texture2D(artwork, p).rgb * 1.008, 1.0);
        float inside = step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);
        gl_FragColor = vec4(mix(vec3(1.0), colour, inside), 1.0);
      }`));
    gl.linkProgram(program);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    const phase = gl.getUniformLocation(program, "phase");
    const turn = gl.getUniformLocation(program, "turn");
    const aspect = gl.getUniformLocation(program, "aspect");
    let loaded = false, visible = false, paused = false, raf = 0, clock = 0, last = 0;

    function paint() {
      if (!loaded) return;
      const t = clock;
      gl.uniform1f(phase, t * 0.314);
      gl.uniform1f(turn, t * 0.175); // one turn in about 36 seconds
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    const tick = (now) => {
      raf = 0;
      if (!visible) return;
      if (last) clock += Math.min(now - last, 64) / 1000;
      last = now;
      paint();
      if (!reduced && !paused) raf = requestAnimationFrame(tick);
    };
    const wake = () => { last = 0; if (!raf && visible) raf = requestAnimationFrame(tick); };
    new ResizeObserver(() => {
      const scale = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(clip.clientWidth * scale));
      canvas.height = Math.max(1, Math.round(clip.clientHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(aspect, canvas.width / canvas.height);
      paint();
    }).observe(clip);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }).observe(clip);

    toggle.hidden = reduced;
    toggle.addEventListener("click", () => {
      paused = !paused;
      toggle.setAttribute("aria-pressed", String(paused));
      toggle.setAttribute("aria-label", paused ? "Play liquid animation" : "Pause liquid animation");
      wake();
    });

    const image = new Image();
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      loaded = true;
      paint();
      wake();
    };
    image.src = "assets/formulation-liquid-white.webp";
  }

  function start() {
    const font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600&display=swap";
    document.head.append(font);
    const wrap = document.querySelector(".page-entry-gallery-wrap");
    if (wrap) section(wrap);
  }
  if (document.readyState === "complete") setTimeout(start, 300);
  else addEventListener("load", () => setTimeout(start, 300));
})();
