/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Alenok — Portfolio excerpt · Optimistic cart updates (Shopify Ajax Cart API)
 * Refactored from the production implementation for readability.
 * Not a drop-in file: styles, copy and store-specific pricing are omitted.
 * © 2026 Fredy Espinoza — All rights reserved. See LICENSE.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Problem
 *   Every quantity change waits a full network round-trip to /cart/change.js
 *   (~400–600 ms on mobile in Ecuador). The UI felt laggy.
 *
 * Approach
 *   1. Predict  — update the UI instantly using a client-side mirror of the
 *                 store's pricing rule (injected, never hard-coded here).
 *   2. Lock     — disable the row while the request is in flight (no races).
 *   3. Reconcile— overwrite everything with the server response (source of truth).
 *   4. Fail safe— on any error, reload: the server state always wins.
 *
 *   A wrong prediction can only cause a brief visual correction — never a wrong
 *   charge, because Shopify computes the real total at checkout.
 */
const OptimisticCart = (() => {
  const $ = (id) => document.getElementById(id);
  const money = (cents) => `$${(cents / 100).toFixed(2)}`;
  const plural = (n) => `${n} item${n === 1 ? '' : 's'}`;

  function create({ predictTotal, referencePrice }) {
    function paintLine(key, qty, lineCents) {
      const input = $(`aln-qty-${key}`);
      const price = $(`aln-price-${key}`);
      const old = $(`aln-price-old-${key}`);
      if (input) input.value = qty;
      if (price) price.textContent = money(lineCents);
      if (old) old.textContent = money(referencePrice(qty));
    }

    function paintSummary(totalCents, itemCount) {
      const total = $('aln-cart-total');
      const count = $('aln-item-count');
      if (total) total.textContent = money(totalCents);
      if (count) count.textContent = plural(itemCount);
    }

    async function update(key, qty) {
      const row = $(`aln-row-${key}`);
      if (!row) return;

      // 1) Predict
      if (qty > 0) {
        const predicted = predictTotal(qty);
        paintLine(key, qty, predicted);
        paintSummary(predicted, qty);
      } else {
        row.style.opacity = '0.4';
      }

      // 2) Lock
      row.style.pointerEvents = 'none';

      try {
        const res = await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ id: key, quantity: qty }),
        });
        const cart = await res.json();
        if (!res.ok || typeof cart?.total_price !== 'number') throw new Error('Invalid cart payload');

        // 3) Reconcile
        if (qty <= 0) {
          row.remove();
        } else {
          const fresh = cart.items.find((i) => i.key === key);
          if (!fresh) throw new Error('Line item not found after update');
          // Order-level discounts only live in cart.total_price (see ENGINEERING-NOTES)
          const lineCents = cart.items.length === 1 ? cart.total_price : fresh.final_line_price;
          paintLine(key, fresh.quantity, lineCents);
          row.style.pointerEvents = '';
        }
        paintSummary(cart.total_price, cart.item_count);
        if (cart.item_count === 0) window.location.reload();
      } catch (err) {
        // 4) Fail safe
        window.location.reload();
      }
    }

    function step(key, delta) {
      const input = $(`aln-qty-${key}`);
      const current = parseInt(input?.value, 10) || 0;
      update(key, Math.max(0, current + delta));
    }

    // Event delegation: one listener for every line item, current and future.
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cart-action]');
      if (!btn) return;
      const key = JSON.parse(btn.dataset.key);
      if (btn.dataset.cartAction === 'remove') update(key, 0);
      if (btn.dataset.cartAction === 'step') step(key, Number(btn.dataset.delta));
    });

    return { update, step };
  }

  return { create };
})();

/* Usage — the pricing rule is injected, so the component stays reusable.
 * Values below are illustrative, not the store's real prices.
 *
 * OptimisticCart.create({
 *   predictTotal:   (qty) => qty * UNIT_CENTS - (qty >= 2 ? BUNDLE_DISCOUNT_CENTS : 0),
 *   referencePrice: (qty) => qty * COMPARE_AT_CENTS,
 * });
 */
