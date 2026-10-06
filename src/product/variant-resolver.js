/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Alenok — Portfolio excerpt
 * Simplified from the production implementation for demonstration purposes.
 * Not a drop-in file: styles, copy, business rules and integrations are omitted.
 * © 2026 Fredy Espinoza — All rights reserved. See LICENSE.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Variant resolver for custom option chips
 *
 * Shopify stores a variant as (option1, option2, option3). The UI lets the
 * shopper pick each option independently, so we need to resolve the current
 * combination back to a variant id and keep the hidden <select name="id"> in
 * sync — that select is what the native product form actually submits.
 */
(() => {
  const dataEl = document.getElementById('aln-variants-json');
  const select = document.getElementById('aln-variant-select');
  if (!dataEl || !select) return;

  const variants = JSON.parse(dataEl.textContent);
  const optionCount = Math.max(...variants.map((v) => v.options.length));

  // Initial state = currently selected variant (server-rendered)
  const initial = variants.find((v) => String(v.id) === select.value) || variants[0];
  const selected = [...initial.options];

  /** Returns the variant matching every selected option, or null. */
  const resolveVariant = () =>
    variants.find((v) => v.options.slice(0, optionCount).every((opt, i) => opt === selected[i])) || null;

  function onVariantChange(variant) {
    select.value = variant ? variant.id : '';
    document.dispatchEvent(new CustomEvent('aln:variant-change', { detail: { variant } }));
  }

  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.option-chip');
    if (!chip) return;

    const index = Number(chip.dataset.optionIndex);
    selected[index] = chip.dataset.optionValue;

    chip.parentElement.querySelectorAll('.option-chip').forEach((c) => {
      const active = c === chip;
      c.classList.toggle('is-active', active);
      c.setAttribute('aria-checked', String(active));
    });

    const label = document.querySelector(`[data-option-current="${index}"]`);
    if (label) label.textContent = chip.dataset.optionValue;

    onVariantChange(resolveVariant());
  });
})();
