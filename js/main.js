(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) document.documentElement.classList.add("reduced-motion");

  /* Lenis smooth scroll */
  var lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
  }

  /* Header state */
  var header = document.getElementById("site-header");
  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 40);
    heroParallax();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  if (lenis) lenis.on("scroll", onScroll);

  /* Page-load reveal */
  requestAnimationFrame(function () { document.documentElement.classList.add("loaded"); });

  /* Hero: video recedes as you scroll past */
  var heroMedia = document.querySelector(".hero-media");
  var hero = document.getElementById("hero");
  function heroParallax() {
    if (reduced || !heroMedia) return;
    var range = hero.offsetHeight - window.innerHeight;
    var p = Math.min(1, Math.max(0, window.scrollY / Math.max(1, range)));
    heroMedia.style.transform = "scale(" + (1 + p * 0.08) + ")";
    heroMedia.style.opacity = String(1 - p * 0.55);
  }

  /* Videos always play (muted, decorative) with a visible Pause/Play control */
  function attachToggle(video, host) {
    if (!video || !host) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "vid-toggle";
    var ticker = host.querySelector(".tool-ticker");
    function sync() {
      var playing = !video.paused;
      btn.textContent = playing ? "Pause" : "Play";
      btn.setAttribute("aria-label", playing ? "Pause video" : "Play video");
      if (ticker) ticker.classList.toggle("is-paused", !playing);
    }
    btn.addEventListener("click", function () {
      if (video.paused) video.play().catch(function () {});
      else video.pause();
    });
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    host.appendChild(btn);
    sync();
  }

  var heroVideo = document.getElementById("hero-video");
  if (heroVideo) {
    attachToggle(heroVideo, heroVideo.closest(".hero-stage"));
    heroVideo.muted = true;
    heroVideo.play().catch(function () {});
  }

  /* Scroll reveals */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduced) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); ro.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revealEls.forEach(function (el) { ro.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  }

  document.querySelectorAll(".dots .d").forEach(function (d, i) { d.style.setProperty("--i", i); });

  /* Stat counters */
  var counts = document.querySelectorAll("[data-count]");
  function runCount(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (reduced) { el.textContent = target; return; }
    var start = null, dur = 1500;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if (counts.length) {
    var done = false;
    var co = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; }) && !done) {
        done = true; counts.forEach(runCount); co.disconnect();
      }
    }, { threshold: 0.4 });
    co.observe(counts[0]);
  }

  /* Rolling tool rows: duplicate each track once so the loop is seamless */
  document.querySelectorAll(".ticker-track").forEach(function (track) {
    Array.prototype.slice.call(track.children).forEach(function (chip) {
      var clone = chip.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
    });
  });

  /* Lazy-load the clips further down the page */
  var lazy = document.querySelectorAll("video[preload='none']");
  var vo = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        var s = v.querySelector("source[data-src]");
        if (s) { s.src = s.getAttribute("data-src"); s.removeAttribute("data-src"); v.load(); }
        v.muted = true;
        v.play().catch(function () {});
      } else if (!v.paused) {
        v.pause();
      }
    });
  }, { rootMargin: "150px" });
  lazy.forEach(function (v) { vo.observe(v); attachToggle(v, v.parentElement); });

  /* Anchor links through Lenis */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(t, { offset: -64 });
      else t.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    });
  });

  /* "Request a session" / "Discuss this" links pre-fill the enquiry message */
  document.querySelectorAll("[data-prefill]").forEach(function (a) {
    a.addEventListener("click", function () {
      var box = document.getElementById("c-msg");
      box.value = a.getAttribute("data-prefill");
      box.classList.remove("is-invalid");
      setTimeout(function () { box.focus({ preventScroll: true }); box.setSelectionRange(box.value.length, box.value.length); }, 1200);
    });
  });

  /* Contact form: validate, then deliver to the inbox via FormSubmit */
  var FORM_ENDPOINT = "https://formsubmit.co/ajax/work@buildalphaanalytics.com";
  var form = document.getElementById("contact-form");
  var note = document.getElementById("form-note");
  var sendBtn = form.querySelector("button[type=submit]");
  function setNote(text, isError) {
    note.textContent = text;
    note.classList.toggle("is-error", !!isError);
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var ok = true;
    form.querySelectorAll("[required]").forEach(function (f) {
      var v = f.value.trim();
      var bad = !v || (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
      f.classList.toggle("is-invalid", bad);
      if (bad) ok = false;
    });
    if (!ok) { setNote(""); return; }

    var d = new FormData(form);
    if (d.get("_honey")) return;
    var payload = {
      name: d.get("name"),
      email: d.get("email"),
      company: d.get("company") || "-",
      message: d.get("message"),
      _subject: "New enquiry from " + d.get("name") + " (Build Alpha website)",
      _template: "table",
      _captcha: "false"
    };

    var label = sendBtn.textContent;
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending…";
    setNote("");

    fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (!res.ok || String(res.body.success) !== "true") throw new Error("send failed");
        form.reset();
        setNote("Thank you. Your enquiry has been sent, and we will reply to " + payload.email + " soon.");
      })
      .catch(function () {
        setNote("", true);
        note.appendChild(document.createTextNode("Sorry, that did not send. "));
        var a = document.createElement("a");
        a.href = "mailto:work@buildalphaanalytics.com?subject=" + encodeURIComponent("Enquiry from " + payload.name) +
          "&body=" + encodeURIComponent("Name: " + payload.name + "\nEmail: " + payload.email + "\nCompany: " + payload.company + "\n\n" + payload.message);
        a.textContent = "Email us directly instead.";
        a.style.textDecoration = "underline";
        note.appendChild(a);
      })
      .then(function () {
        sendBtn.disabled = false;
        sendBtn.textContent = label;
      });
  });
  form.addEventListener("input", function (e) { e.target.classList.remove("is-invalid"); });

  onScroll();
})();
