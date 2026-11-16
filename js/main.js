const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---- Lenis smooth scroll + anchor navigation ---- */
let lenis = null;
if (!reduceMotion && window.Lenis) {
  lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href").slice(1);
    const target = id ? document.getElementById(id) : document.body;
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: -8 });
    else target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  });
});

/* ---- "Request a session" / "Discuss this" links pre-fill the enquiry ---- */
const messageBox = document.getElementById("c-msg");
document.querySelectorAll("[data-prefill]").forEach((a) => {
  a.addEventListener("click", () => {
    if (!messageBox) return;
    messageBox.value = a.dataset.prefill;
    messageBox.classList.remove("is-invalid");
    setTimeout(() => {
      messageBox.focus({ preventScroll: true });
      messageBox.setSelectionRange(messageBox.value.length, messageBox.value.length);
    }, 1200);
  });
});

/* ---- Restrained scroll reveals ---- */
const revealTargets = document.querySelectorAll(".reveal");
if (revealTargets.length) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  revealTargets.forEach((el) => revealObserver.observe(el));
}

/* ---- Videos: play only while visible, with a Pause/Play toggle the visitor controls ---- */
function ensureSource(video) {
  const source = video.querySelector("source[data-src]");
  if (source && !source.getAttribute("src")) {
    source.src = source.dataset.src;
    video.load();
  }
}

function attachToggle(video, host) {
  if (!host) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "vid-toggle";
  const sync = () => {
    const playing = !video.paused;
    btn.textContent = playing ? "Pause" : "Play";
    btn.setAttribute("aria-label", playing ? "Pause video" : "Play video");
  };
  btn.addEventListener("click", () => {
    if (video.paused) {
      delete video.dataset.userPaused;
      ensureSource(video);
      video.play().catch(() => {});
    } else {
      // remembered, so scrolling back into view doesn't override the visitor's choice
      video.dataset.userPaused = "1";
      video.pause();
    }
  });
  video.addEventListener("play", sync);
  video.addEventListener("pause", sync);
  host.appendChild(btn);
  sync();
}

const videoObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(({ target: video, isIntersecting }) => {
      if (isIntersecting) {
        if (reduceMotion || video.dataset.userPaused) return;
        ensureSource(video);
        video.muted = true;
        video.play().catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    });
  },
  { rootMargin: "20% 0px" }
);
document.querySelectorAll("video.bg-video, video.inline-video").forEach((video) => {
  attachToggle(video, video.closest(".screen, section"));
  videoObserver.observe(video);
});

/* ---- Contact form: validate, then deliver to the inbox via FormSubmit ---- */
const FORM_ENDPOINT = "https://formsubmit.co/ajax/work@buildalphaanalytics.com";
const form = document.getElementById("enquiry-form");
const note = document.getElementById("enquiry-note");
if (form && note) {
  const sendBtn = form.querySelector("button[type=submit]");
  const errors = {
    name: "Please enter your name.",
    email: "Please enter a valid email address.",
    message: "Please tell us a little about what you need.",
  };
  const setNote = (text, isError) => {
    note.textContent = text;
    note.classList.toggle("is-error", !!isError);
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let firstError = "";
    form.querySelectorAll("[required]").forEach((f) => {
      const v = f.value.trim();
      const bad = !v || (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
      f.classList.toggle("is-invalid", bad);
      if (bad) f.setAttribute("aria-invalid", "true");
      else f.removeAttribute("aria-invalid");
      if (bad && !firstError) firstError = errors[f.name];
    });
    if (firstError) {
      setNote(firstError, true);
      return;
    }

    const d = new FormData(form);
    if (d.get("_honey")) return;
    const payload = {
      name: d.get("name"),
      email: d.get("email"),
      company: d.get("company") || "-",
      message: d.get("message"),
      _subject: `New enquiry from ${d.get("name")} (Build Alpha website)`,
      _template: "table",
      _captcha: "false",
    };

    const label = sendBtn.textContent;
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending…";
    setNote("");

    fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
      .then((res) => {
        if (!res.ok || String(res.body.success) !== "true") {
          // FormSubmit explains failures (e.g. "This form needs Activation") in body.message
          console.warn("FormSubmit did not accept the enquiry:", res.body && res.body.message);
          throw new Error("send failed");
        }
        form.reset();
        setNote(`Thank you. Your enquiry has been sent, and we will reply to ${payload.email} soon.`);
      })
      .catch(() => {
        setNote("Sorry, that did not send. ", true);
        const a = document.createElement("a");
        a.href =
          "mailto:work@buildalphaanalytics.com?subject=" + encodeURIComponent(`Enquiry from ${payload.name}`) +
          "&body=" + encodeURIComponent(`Name: ${payload.name}\nEmail: ${payload.email}\nCompany: ${payload.company}\n\n${payload.message}`);
        a.textContent = "Email us directly instead.";
        note.appendChild(a);
      })
      .finally(() => {
        sendBtn.disabled = false;
        sendBtn.textContent = label;
      });
  });

  form.addEventListener("input", (e) => {
    e.target.classList.remove("is-invalid");
    e.target.removeAttribute("aria-invalid");
  });
}
