const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

function clamp01(v) { return Math.min(1, Math.max(0, v)); }
function smoothstep(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

/* ---- pointer tilt on .tilt elements ---- */
if (finePointer && !reduceMotion) {
  document.querySelectorAll(".tilt").forEach((el) => {
    const max = parseFloat(el.dataset.tilt || "6");
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(1000px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateZ(12px)`;
      el.classList.add("is-tilting");
    });
    el.addEventListener("pointerleave", () => {
      el.style.transform = "";
      el.classList.remove("is-tilting");
    });
  });
}

/* ---- hero: plate parallax + copy that lifts away as the dashboard assembles ---- */
const hero = document.getElementById("hero");
const plate = document.getElementById("hero-canvas");
const heroContent = document.querySelector(".hero-content");
const cue = document.querySelector(".scroll-cue");

if (hero && heroContent) {
  if (finePointer && !reduceMotion) {
    hero.addEventListener("pointermove", (e) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      if (plate) plate.style.transform = `translate3d(${(-x * 20).toFixed(1)}px, ${(-y * 14).toFixed(1)}px, 0) scale(1.06)`;
      heroContent.style.setProperty("--px", `${(x * 10).toFixed(1)}px`);
      heroContent.style.setProperty("--py", `${(y * 7).toFixed(1)}px`);
    }, { passive: true });
  }

  const updateHeroCopy = () => {
    if (reduceMotion) return;
    const scrollable = hero.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return;
    const forced = parseFloat(new URLSearchParams(location.search).get("p"));
    const p = Number.isNaN(forced) ? clamp01(-hero.getBoundingClientRect().top / scrollable) : clamp01(forced);
    const fade = 1 - smoothstep(0.22, 0.5, p);
    heroContent.style.opacity = fade.toFixed(3);
    heroContent.style.setProperty("--rise", `${(-p * 140).toFixed(1)}px`);
    heroContent.style.pointerEvents = fade < 0.1 ? "none" : "";
    if (cue) cue.classList.toggle("is-hidden", p > 0.06);
  };
  window.addEventListener("scroll", updateHeroCopy, { passive: true });
  window.addEventListener("resize", updateHeroCopy);
  updateHeroCopy();
}

/* ---- "why" section: dashboard plate drifts slower than the page ---- */
const whySection = document.getElementById("why");
const whyPlate = whySection && whySection.querySelector(".bg-plate");
if (whyPlate && !reduceMotion) {
  const drift = () => {
    const r = whySection.getBoundingClientRect();
    const p = clamp01((window.innerHeight - r.top) / (r.height + window.innerHeight));
    whyPlate.style.transform = `translate3d(0, ${((p - 0.5) * -60).toFixed(1)}px, 0) scale(1.1)`;
  };
  window.addEventListener("scroll", drift, { passive: true });
  window.addEventListener("resize", drift);
  drift();
}

/* ---- header: solid once the hero scrolls away ---- */
const header = document.querySelector(".site-header");
if (header) {
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > window.innerHeight * 0.6);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ---- hardcover books: real thickness, turn on hover (or tap), settle back on leave ---- */
const books = document.querySelectorAll(".book");
if (books.length) {
  const SPINE_RATIO = 0.109; // spine width ÷ cover width, measured from the print files
  const ro = new ResizeObserver((entries) => {
    entries.forEach((e) => e.target.style.setProperty("--thick", `${(e.target.offsetWidth * SPINE_RATIO).toFixed(1)}px`));
  });
  books.forEach((book) => {
    ro.observe(book);
    if (reduceMotion) return;
    let angle = 30, spinning = false, raf = 0, last = 0;
    const apply = () => book.style.setProperty("--angle", `${angle.toFixed(2)}deg`);
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (spinning) {
        angle += 48 * dt;
      } else {
        // ease back to the resting pose along the shortest path
        const rest = 30, diff = ((angle - rest + 540) % 360) - 180;
        if (Math.abs(diff) < 0.3) { angle = rest; apply(); raf = 0; return; }
        angle -= diff * Math.min(1, dt * 6);
      }
      apply();
      raf = requestAnimationFrame(tick);
    };
    const run = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    book.addEventListener("pointerenter", (e) => { if (e.pointerType !== "touch") { spinning = true; run(); } });
    book.addEventListener("pointerleave", () => { spinning = false; run(); });
    book.addEventListener("click", (e) => { if (e.pointerType === "touch" || e.pointerType === "") { spinning = !spinning; run(); } });
    book.addEventListener("focus", () => { spinning = true; run(); });
    book.addEventListener("blur", () => { spinning = false; run(); });
  });
}

/* ---- marquee ribbons: duplicate content for a seamless loop ---- */
document.querySelectorAll(".ribbon-track").forEach((track) => {
  track.insertAdjacentHTML("beforeend", track.innerHTML);
});
