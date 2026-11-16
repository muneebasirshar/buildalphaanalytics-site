const canvas = document.getElementById("hero-canvas");
const heroSection = document.getElementById("hero");

if (canvas && heroSection) {
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let frameCount = 0;
  let images = [];
  let loadedCount = 0;
  let currentFrame = -1;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  function frameUrl(i) {
    return `assets/frames/hero/frame-${String(i + 1).padStart(4, "0")}.jpg`;
  }

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  }

  function drawFrame(index) {
    const img = images[index];
    if (!img || !img.complete || !img.naturalWidth) return;
    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    let sx, sy, sw, sh;
    if (imgRatio > canvasRatio) {
      sh = img.naturalHeight;
      sw = sh * canvasRatio;
      sx = (img.naturalWidth - sw) / 2;
      sy = 0;
    } else {
      sw = img.naturalWidth;
      sh = sw / canvasRatio;
      sx = 0;
      sy = (img.naturalHeight - sh) / 2;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }

  const forcedProgress = parseFloat(new URLSearchParams(location.search).get("p"));

  function currentTargetFrame() {
    if (!Number.isNaN(forcedProgress)) return Math.min(frameCount - 1, Math.floor(forcedProgress * frameCount));
    const scrollableHeight = heroSection.offsetHeight - window.innerHeight;
    const rect = heroSection.getBoundingClientRect();
    const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(scrollableHeight, 1));
    const progress = scrollableHeight > 0 ? scrolled / scrollableHeight : 0;
    return Math.min(frameCount - 1, Math.max(0, Math.floor(progress * frameCount)));
  }

  function loop() {
    const target = currentTargetFrame();
    const img = images[target];
    if (img && img.complete && img.naturalWidth) {
      if (target !== currentFrame) {
        currentFrame = target;
        drawFrame(currentFrame);
      }
    } else if (target !== currentFrame) {
      // Target frame not decoded yet (e.g. fast scroll outrunning preload) — keep
      // retrying it each tick instead of permanently skipping it once loaded.
      drawFrame(target);
    }
    requestAnimationFrame(loop);
  }

  async function init() {
    resizeCanvas();

    let manifest;
    try {
      const res = await fetch("assets/frames/hero/manifest.json");
      manifest = await res.json();
    } catch (e) {
      return;
    }
    frameCount = manifest.count;
    if (!frameCount) return;

    if (reduceMotion) {
      const mid = new Image();
      mid.src = frameUrl(Math.floor(frameCount / 2));
      mid.onload = () => drawFrame(0);
      images[0] = mid;
      window.addEventListener("resize", () => { resizeCanvas(); drawFrame(0); });
      return;
    }

    images = new Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      const img = new Image();
      img.decoding = "async";
      img.src = frameUrl(i);
      images[i] = img;
      img.onload = () => {
        loadedCount++;
        if (i === 0) drawFrame(0);
        if (!Number.isNaN(forcedProgress) && i === currentTargetFrame()) drawFrame(i);
      };
    }

    window.addEventListener("resize", () => {
      resizeCanvas();
      drawFrame(currentFrame < 0 ? 0 : currentFrame);
    });

    requestAnimationFrame(loop);
  }

  init();
}
