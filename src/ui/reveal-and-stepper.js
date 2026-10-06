/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Alenok — Portfolio excerpt
 * Simplified from the production implementation for demonstration purposes.
 * Not a drop-in file: styles, copy, business rules and integrations are omitted.
 * © 2026 Fredy Espinoza — All rights reserved. See LICENSE.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Two lightweight UI behaviours with zero dependencies:
 *
 * 1. Scroll reveal — IntersectionObserver instead of scroll listeners
 *    (no layout thrashing, runs off the main scroll path).
 * 2. Auto-advancing "how to use" stepper with a progress bar that restarts
 *    cleanly on every slide, using a forced reflow to reset the CSS transition.
 */
(() => {
  const scope = document.querySelector('.aln-scope');
  if (!scope) return;

  // ── 1. Scroll reveal ──────────────────────────────────────────────────────
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealables = scope.querySelectorAll('.reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach((el) => el.classList.add('show'));
  } else {
    const io = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('show');
        observer.unobserve(entry.target); // animate once, then stop observing
      });
    }, { threshold: 0.12 });
    revealables.forEach((el) => io.observe(el));
  }

  // ── 2. Stepper with progress bar ─────────────────────────────────────────
  const slides = scope.querySelectorAll('.step-slide');
  const labels = scope.querySelectorAll('.step-label');
  const bar = scope.querySelector('.steps-progress');
  if (!slides.length) return;

  const DURATION = 3200;
  let index = 0;

  function show(i) {
    slides.forEach((s, si) => s.classList.toggle('active', si === i));
    labels.forEach((l, li) => l.classList.toggle('active', li === i));
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.width = '0%';
    void bar.offsetWidth; // force reflow so the next transition starts from 0
    bar.style.transition = `width ${DURATION}ms linear`;
    bar.style.width = '100%';
  }

  show(0);
  if (!reduceMotion) {
    setInterval(() => { index = (index + 1) % slides.length; show(index); }, DURATION);
  }
})();
