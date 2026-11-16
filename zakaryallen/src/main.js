import { startScene } from "./scene.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

startScene(document.getElementById("scene"));

// ---------- Nav ----------
const nav = document.getElementById("nav");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 30);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

const toggle = document.querySelector(".nav-toggle");
const links = document.getElementById("nav-links");
toggle.addEventListener("click", () => {
  const open = links.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(open));
});
links.addEventListener("click", (e) => {
  if (e.target.closest("a")) {
    links.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }
});

// Highlight the section in view
const navAnchors = [...links.querySelectorAll("a[href^='#']")];
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    navAnchors.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
  });
}, { rootMargin: "-45% 0px -50% 0px" });
document.querySelectorAll("main section[id]").forEach((s) => sectionObserver.observe(s));

// ---------- Image fallbacks (if a hosted photo fails to load) ----------
document.querySelectorAll("img").forEach((img) => {
  const fail = () => {
    const d = document.createElement("div");
    d.className = "img-fallback";
    d.textContent = img.dataset.fallback || "ZA";
    d.setAttribute("role", "img");
    d.setAttribute("aria-label", img.alt || "");
    img.replaceWith(d);
  };
  if (img.complete && img.naturalWidth === 0 && img.src) fail();
  else img.addEventListener("error", fail, { once: true });
});

// ---------- 3D tilt cards ----------
if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
  document.querySelectorAll("[data-tilt]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty("--ry", `${(px - 0.5) * 14}deg`);
      el.style.setProperty("--rx", `${(0.5 - py) * 14}deg`);
      el.style.setProperty("--gx", `${px * 100}%`);
      el.style.setProperty("--gy", `${py * 100}%`);
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    });
  });
}

// ---------- Reveal + count-up + gauges ----------
const revealTargets = document.querySelectorAll(".section-head, .reel, .stat, .social-card, .gauge, .video, .quote, .event, .about-photo, .about-text, .contact-form, .contact-side, .empty-state");
revealTargets.forEach((el, i) => {
  el.classList.add("reveal");
  el.style.transitionDelay = `${(i % 4) * 70}ms`;
});

function countUp(el) {
  const end = parseFloat(el.dataset.count);
  const dec = parseInt(el.dataset.decimals || "0", 10);
  if (reduceMotion) { el.textContent = end.toFixed(dec); return; }
  const dur = 1300;
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min((now - t0) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = (end * eased).toFixed(dec);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const CIRC = 2 * Math.PI * 50;
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    const el = en.target;
    el.classList.add("in");
    el.querySelectorAll("[data-count]").forEach(countUp);
    if (el.dataset.gauge) {
      const ratio = Math.min(parseFloat(el.dataset.gauge) / parseFloat(el.dataset.max), 1);
      el.querySelector(".g-bar").style.strokeDashoffset = String(CIRC * (1 - ratio));
    }
    io.unobserve(el);
  });
}, { threshold: 0.15 });
revealTargets.forEach((el) => io.observe(el));

// ---------- Click-to-load YouTube (fast page, no tracking until play) ----------
document.querySelectorAll(".yt").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.yt;
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    iframe.title = btn.getAttribute("aria-label") || "YouTube video";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    btn.replaceChildren(iframe);
    btn.style.cursor = "default";
  }, { once: true });
});

// ---------- Contact form -> opens the visitor's email app ----------
const form = document.getElementById("contact-form");
const note = document.getElementById("form-note");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const email = String(data.get("email") || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    note.textContent = "Please enter a valid email so Zakary can reply.";
    form.email.focus();
    return;
  }
  const name = String(data.get("name") || "").trim();
  const msg = String(data.get("message") || "").trim();
  const subject = `Recruiting inquiry${name ? " from " + name : ""}`;
  const body = `${msg}\n\nName: ${name}\nEmail: ${email}`;
  window.location.href = `mailto:zakkallenn@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  note.textContent = "Opening your email app. If nothing happens, email zakkallenn@gmail.com directly.";
});
