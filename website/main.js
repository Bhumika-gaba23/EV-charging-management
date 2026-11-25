// Pluggo website: scroll reveals, counters, parallax phones, nav state and the latest release info.
(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Nav gets a solid background once the page scrolls.
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("scrolled", scrollY > 12);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Reveal elements as they enter the screen, staggering siblings in the same group.
  const items = [...document.querySelectorAll(".reveal, .reveal-up")];
  const groups = new Map();
  for (const el of items) {
    const parent = el.parentElement;
    const index = groups.get(parent) || 0;
    groups.set(parent, index + 1);
    el.style.setProperty("--delay", `${Math.min(index * 0.08, 0.4)}s`);
  }
  if (reduced || !("IntersectionObserver" in window)) items.forEach((el) => el.classList.add("is-visible"));
  else {
    const seen = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add("is-visible"); seen.unobserve(entry.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    items.forEach((el) => seen.observe(el));
  }

  // Count the stats up when they appear.
  const counters = document.querySelectorAll("[data-count]");
  const format = (n) => n.toLocaleString("en-IN");
  const run = (el) => {
    const target = Number(el.dataset.count), suffix = el.dataset.suffix || "";
    if (reduced) { el.textContent = format(target) + suffix; return; }
    el.textContent = "0" + suffix;
    const start = performance.now(), duration = 1400;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration), eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(Math.round(target * eased)) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    const watch = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) { run(entry.target); watch.unobserve(entry.target); }
    }, { threshold: 0.6 });
    counters.forEach((el) => watch.observe(el));
  } else counters.forEach(run);

  // Gentle parallax on the hero phones.
  const layers = [...document.querySelectorAll(".parallax")];
  if (!reduced && layers.length) {
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = Math.min(scrollY, innerHeight);
      for (const el of layers) el.style.transform = `translate3d(0, ${(y * Number(el.dataset.speed)).toFixed(1)}px, 0)`;
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  }

  // Show the real version and size of the latest release (the links always point at the latest APK).
  fetch("https://api.github.com/repos/Bhumika-gaba23/EV-charging-management/releases/latest", { headers: { Accept: "application/vnd.github+json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((release) => {
      if (!release) return;
      const apk = (release.assets || []).find((a) => a.name === "pluggo-phone-test.apk");
      const version = String(release.tag_name || "").replace(/^v/, "");
      if (version) document.querySelectorAll(".version-label").forEach((el) => { el.textContent = `Latest version ${version}`; });
      if (apk) document.querySelectorAll(".size-label").forEach((el) => { el.textContent = `${(apk.size / 1048576).toFixed(1)} MB`; });
    })
    .catch(() => {});
})();
