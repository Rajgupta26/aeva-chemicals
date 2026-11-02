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

  /* ---------- Flowing fabric lines (split panel 2) ---------- */
  const waveG = $("#waveLines");
  const LINES = 22;
  const paths = Array.from({ length: LINES }, () => {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    waveG.append(p);
    return p;
  });
  let waveVisible = false;
  new IntersectionObserver((es) => (waveVisible = es[0].isIntersecting)).observe(waveG.closest("svg"));
  function drawWaves(t) {
    if (waveVisible || t === 0) {
      paths.forEach((p, i) => {
        const base = 40 + i * 16;
        let d = "";
        for (let x = 0; x <= 800; x += 20) {
          const y = base + Math.sin(x * 0.008 + t * 0.0006 + i * 0.25) * (18 + i * 1.2) + Math.sin(x * 0.02 - t * 0.0009) * 6;
          d += (x ? "L" : "M") + x + " " + y.toFixed(1);
        }
        p.setAttribute("d", d);
        p.setAttribute("stroke-opacity", (0.25 + (i / LINES) * 0.75).toFixed(2));
      });
    }
    if (!reduced) requestAnimationFrame(drawWaves);
  }
  drawWaves(0);

  /* ---------- Footer dot mark (dot-matrix "A") ---------- */
  const A = [
    "....#....",
    "...###...",
    "...#.#...",
    "..##.##..",
    "..#...#..",
    ".#######.",
    ".##...##.",
    "##.....##",
    "#.......#",
  ];
  const dm = $("#dotMark");
  const ns = "http://www.w3.org/2000/svg";
  A.forEach((row, y) => [...row].forEach((ch, x) => {
    const cx = 4.5 + x * 8.9, cy = 4.5 + y * 8.9;
    const dist = Math.hypot(cx - 40, cy - 40);
    if (dist > 40) return;
    const c = document.createElementNS(ns, "circle");
    c.setAttribute("cx", cx);
    c.setAttribute("cy", cy);
    c.setAttribute("r", ch === "#" ? 4.2 : 1.6);
    c.style.setProperty("--d", ((x + y) * 0.12).toFixed(2) + "s");
    dm.append(c);
  }));

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
