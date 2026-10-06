# Engineering notes

Real problems found while building and testing the store, how they were
diagnosed, and the trade-offs of each fix.

---

## 1. The bundle showed $60.00 instead of $59.99

**Symptom.** A "buy 2" promotion should cost $59.99 (2 × $39.99 − $19.99).
The cart showed **$60.00**.

**Diagnosis.** The promotion was configured as a *percentage product discount*.
Shopify computes product-level percentage discounts **per unit and rounds each
unit to the cent** before summing, so 25% off $39.99 → $29.9925 → $29.99 or
$30.00 depending on allocation. Two rounded units drifted one cent from the
intended total. Not a code bug — a configuration choice with a math side effect.

**Fix.** Replaced it with a **fixed-amount discount at the order level**
($19.99 off when quantity ≥ 2). Applied once to the order total → no per-unit
rounding → exactly $79.98 − $19.99 = **$59.99**.

**Lesson.** For "exact price" promotions, prefer fixed amounts applied once over
percentages applied per unit.

---

## 2. Order-level discounts don't reach the line item

**Symptom.** After fixing #1, the cart *total* was right, but the price shown
next to the product still said $79.98.

**Diagnosis.** Order-level automatic discounts are **not allocated** into
`item.final_line_price` / `item.final_price` — neither in Liquid nor in the
Ajax Cart API. Only `cart.total_price` includes them. The code was reading the
"correct" field; the platform simply doesn't put the discount there.

**Fix.** When the cart contains exactly one line item, the line price *is* the
cart total, so the UI displays `cart.total_price` (Liquid on first render, the
Ajax response on every update).

**Trade-off (documented, not hidden).** The workaround is exact for a
single-product store. With multiple different products in the cart it falls
back to `final_line_price`, and the right long-term fix would be to read
`cart.cart_level_discount_applications` and allocate the discount
proportionally per line.

---

## 3. "Remove" and quantity buttons silently did nothing

**Symptom.** Clicking the cart buttons had no effect.

**Diagnosis.** The handler was written as
`onclick="update({{ item.key | json }}, 0)"`. The `json` filter outputs a
**double-quoted** string, which closed the double-quoted HTML attribute early:
`onclick="update("42:abc", 0)"` → the browser parsed `onclick="update("`.

**Fix.** Immediate hot-fix: single-quoted attributes. Refactored version (shown
in this repo): the key goes into a `data-key` attribute and a single delegated
listener reads it with `JSON.parse` — no inline JS, no quoting issues, and it
works for rows added later. → `src/cart/cart-line-item.liquid`

---

## 4. Wrong totals after crossing the bundle threshold

**Symptom.** Going from 1 to 2 units displayed $79.98 and, worse, sometimes
sent a wrong quantity back to the server.

**Diagnosis.** The first version captured the unit price in a `data-` attribute
at page load and multiplied it client-side. That breaks the moment pricing is
non-linear (bundles, discounts), and reading the quantity back from a value
computed with stale data corrupted later requests.

**Fix.** The client never "owns" prices. Every request is followed by a full
reconciliation from the server's cart JSON.

---

## 5. Perceived lag on every quantity change

**Symptom.** ~0.5 s between tap and visual feedback on mobile networks.

**Diagnosis.** Unavoidable network round-trip to `/cart/change.js`.

**Fix.** Optimistic UI: a small, injectable `predictTotal(qty)` mirrors the
store's pricing rule so the UI updates on tap; the server response then
silently confirms or corrects it, and the row is locked meanwhile to prevent
race conditions. → `src/cart/optimistic-cart.js`

**Trade-off.** The prediction duplicates a business rule on the client, so it
must change when the promotion changes. A mismatch can only cause a brief
visual correction — never a wrong charge, because checkout totals are always
computed by Shopify.
