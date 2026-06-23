# Gusto — Feature Roadmap

> Companion to [PLAN.md](./PLAN.md). PLAN.md is the original architecture/vision; this
> document is the **forward-looking, gradual feature plan** — what to build next and in
> what order, grounded in a competitive scan and the code as it actually exists today.

**Product decisions driving this roadmap**

| Decision        | Choice                                                                  |
| --------------- | ----------------------------------------------------------------------- |
| Market          | **Israel-first** (₪, Hebrew/RTL, Israeli invoicing/VAT, local payments) |
| Delivery        | **In-house couriers ("Gus")** — branded dispatch + a courier app        |
| Monetization    | **Commission + fees** (chef commission %, customer service + delivery)  |
| Immediate focus | **Customer ordering + payments** — complete the marketplace loop        |

---

## 1. Where we are today

**Built**

-   Phone-OTP 2FA auth end-to-end (API + web + mobile), refresh-token rotation + reuse detection.
-   Chef onboarding **wizard** (web + iOS + Android): about → photos → location → first dish → review → publish.
-   Chef **dashboard** (web): Facebook-style profile, Home/Meals/Orders/Settings tabs, add/suspend meals, an orders board with status advance, settings.
-   "Become a chef" entry on the landing page; mobile success screen.
-   Shared `@gusto/contracts` (Chef, Meal, Order, Diet/OrderStatus, zod schemas, `distanceKm`).

**Stubbed / not real yet**

-   Chef, Meal, and Order data are **in-memory** in the API (lost on restart). No Prisma persistence beyond auth.
-   Photos are stored as **base64 data URLs**, not in object storage.
-   Orders are **seeded demo data**; there is **no way for a customer to place one**.

**Missing entirely** — everything below. The single biggest gap: **customers cannot order**. The
chef side can onboard and (pretend to) manage a menu, but the marketplace has no demand side.

---

## 2. Competitive scan — what best-in-class platforms do

### Home-cooked / chef marketplaces (closest peers)

-   **Shef** (US) — vetted home cooks, **weekly rotating menus**, **scheduled** (not on-demand) heat-at-home delivery, discovery **by cuisine/heritage**, mandatory food-handler certification, reviews.
-   **WoodSpoon** (US) — strong **chef storytelling/profiles**, **daily menus**, on-demand + scheduled, transparent **chef earnings**.
-   **Cookin (UK) / HomeMade / tiffin & meal-plan services** — **subscriptions / meal plans**, dietary plans, batch pre-orders.

> Takeaways: home-food is **pre-order/scheduled** first, on-demand second; **chef storytelling**,
> **dietary/allergen filters**, **food-safety vetting**, **favorites/follow-a-chef**, and
> **rotating menus + capacity** are core, not extras.

### On-demand delivery (table stakes Gusto lacks)

-   **Wolt** (dominant in Israel) — polished discovery, **live courier map + ETA**, in-app **support chat**, **scheduled orders**, **tipping**, **group orders**, **Wolt+** subscription, ratings, and **Wolt Drive** (logistics-as-a-service).
-   **Uber Eats / DoorDash** — search & **ranking**, **promotions/coupons**, **reorder**, **scheduled**, **subscriptions** (Eats Pass / DashPass), **sponsored placement** (ad revenue), dietary filters, **merchant analytics**, group orders.

> Takeaways: **live map tracking + ETA**, **scheduling**, **tipping**, **support chat**,
> **promotions**, **reorder**, **merchant analytics**, and a **subscription/membership** are the
> baseline customers now expect.

### Israel-specific (major differentiators)

-   **Cibus / 10bis** — employer meal benefits/vouchers. Accepting them as a **payment method** unlocks the lucrative **B2B weekday-lunch** market — arguably Gusto's strongest local wedge.
-   **Bit** (Bank Hapoalim) — the default consumer P2P/payment app; expected alongside cards.
-   **Kosher** — `תעודת כשרות` badges + clear labeling matter to a large customer segment.
-   **Invoicing/VAT** — Israeli law expects a `חשבונית מס/קבלה`; chefs are typically `עוסק פטור/מורשה`. The platform must issue or facilitate compliant receipts, and handle **VAT (~18%)**.

### Marketplace trust (Airbnb/Etsy patterns)

-   Rigorous **host onboarding + verified ID**, **two-way reviews**, **Superhost-style tiers/badges**, **in-app messaging**, clear **cancellation/refund policies**, **host dashboards/insights**, dynamic-pricing nudges.

### Gap summary (have → need)

| Area              | Today                          | Best-in-class                                                                                        |
| ----------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Customer ordering | none                           | discovery → cart → checkout → pay → live tracking → reorder                                          |
| Persistence       | in-memory stubs                | durable Postgres for chefs, menus, orders, payments                                                  |
| Menu              | name/price/diet/suspend        | categories, modifiers, photos in storage, prep time, allergens, kosher, capacity windows, scheduling |
| Payments          | none                           | cards (Israeli PSP) + Bit + Cibus/10bis, auth/capture, payouts, invoices, VAT                        |
| Delivery          | none                           | in-house dispatch + courier app + live GPS tracking + ETA                                            |
| Trust & safety    | self-declared, `verified` flag | ID/KYC, kitchen approval, food-safety/kosher, admin review, 2-way reviews                            |
| Notifications     | none                           | push + SMS + email on every order transition                                                         |
| Ops               | none                           | admin console: approvals, disputes, refunds, payouts, courier mgmt                                   |
| Localization      | English LTR only               | Hebrew + RTL, i18n                                                                                   |
| Growth            | none                           | search ranking, promos, referrals, loyalty, subscriptions, analytics                                 |

---

## 3. Sequencing principles

1. **Each milestone ships something usable end-to-end** — no half-features parked behind flags.
2. **Persistence and localization come first** because every later feature builds on them, and
   retrofitting Hebrew/RTL is painful — do it while the surface area is small.
3. **Complete the marketplace loop before widening it** — ordering + payments before growth.
4. **Money paths are first-class**: build the fee/commission/payout engine with the order loop,
   not bolted on later.
5. **Cross-cutting tracks (payments, localization, notifications, trust, observability) ramp in
   parallel** — see §5.

---

## 4. The roadmap

> Milestones M1–M8 continue from PLAN.md's Phase 0 (done) and Phase 1 (partially done). Each lists
> **Goal · Features · Data/API/Client deltas · Israel notes · Definition of Done (DoD)**.

### M1 — Persistence & menu foundation _(substrate)_

-   **Goal:** make the chef/menu real and durable; lay i18n/RTL groundwork.
-   **Features:** migrate in-memory `ChefService` → Prisma (`ChefProfile`, `Kitchen`, `Dish`,
    `Availability`); menu gains **categories, prep time, allergens, dietary, kosher fields,
    per-dish photo**; real **image upload to MinIO/S3** via signed URLs (replace base64);
    **availability windows + capacity** (`maxOrders` per slot).
-   **Data:** add the PLAN §4 chef/menu tables; keep `@gusto/contracts` the source of truth.
-   **Clients:** web chef dashboard reads/writes the real API; **Hebrew + RTL** scaffolding (i18n
    library, locale switch, RTL-aware styles) so all later UI is bilingual.
-   **Israel:** Hebrew copy, RTL, kosher + allergen fields from the start.
-   **DoD:** chef data survives restarts; menu supports categories/photos/dietary/kosher/capacity;
    images live in object storage; web + mobile render he/en + RTL.

### M2 — Customer discovery & browsing _(demand side, read-only)_

-   **Goal:** a customer can find nearby chefs and browse menus (no ordering yet).
-   **Features:** customer home (list + **map**) of nearby kitchens via `distanceKm`/geo; **filters**
    (cuisine, dietary, kosher, open-now, price, distance); **search**; customer-facing **kitchen
    page** (reuse the Facebook-style profile) + **dish detail**; **favorites / follow-a-chef**;
    distance + ETA placeholder; ratings placeholder.
-   **API:** `GET /kitchens?lat&lng&radius&filters`, `GET /kitchens/:id`, `/dishes`, favorites.
-   **Clients:** mobile customer tabs (Discover / Favorites / Orders / Profile); the RN app gains a
    **customer role** alongside the existing chef screens.
-   **DoD:** a customer can discover chefs near them and browse a full menu end-to-end.

### M3 — Cart, checkout & payments _(priority loop, part 1)_

-   **Goal:** a customer can place and pay for an order.
-   **Features:** **single-kitchen cart** (per PLAN), item **notes/modifiers**, **scheduling**
    (pickup/delivery slots tied to availability + capacity), **fee/commission engine** (chef
    commission %, customer service fee, delivery fee, **tip**, **VAT**, itemized totals),
    order creation `CREATED → AWAITING_CHEF`.
-   **Payments (Israel):** integrate an Israeli PSP for **cards** (e.g. Tranzila / Meshulam-Grow /
    Cardcom) with **authorize-not-capture**; add **Bit**; scope **Cibus/10bis** as a fast-follow
    payment method for B2B lunch. Issue a compliant **`חשבונית מס/קבלה`**.
-   **API:** `POST /orders`, `POST /payments/intent`, `POST /webhooks/<psp>`, cart endpoints.
-   **DoD:** a real authorized payment creates a real order the chef can see; receipt issued; funds
    not yet captured.

### M4 — Order lifecycle, chef queue & realtime _(priority loop, part 2)_

-   **Goal:** the full order happy-path + cancellations, with money actually moving.
-   **Features:** **order state machine** (PLAN §7); chef **accept/reject** + **BullMQ accept-timeout**
    auto-cancel/refund; `PREPARING → READY`; **capture on handoff**; **commission split + chef payout
    ledger**; **realtime** (Socket.IO) order updates; **push (Expo) + SMS** on key transitions;
    customer **live tracking** screen; chef **order queue** + **payout/earnings dashboard**.
-   **DoD:** place → accept → prepare → ready → complete, plus reject/cancel/refund, all work
    end-to-end; chef sees earnings; both sides get realtime + push updates.

### M5 — In-house delivery: "Gus" couriers _(the branded differentiator)_

-   **Goal:** orders are auto-dispatched to couriers and tracked live to the door.
-   **Features:** **courier onboarding** + a **courier mobile app** (Expo: online/offline toggle,
    receive dispatch, accept job, pickup confirmation, **navigation**, **proof of delivery**,
    earnings); **dispatch engine** (assignment by proximity/availability/zone, reassignment on
    timeout, **batching**; surge later); **live GPS tracking → customer map** with ETA ("Gus is on
    the way"); **delivery zones/radius + distance-based fees**; **courier payouts** (per-delivery +
    tips).
-   **Data/API:** `Courier`, `DeliveryJob`, `CourierLocation`; dispatch + tracking WS channels.
-   **Clients:** new courier app (or a courier role); customer tracking map; chef "ready for pickup".
-   **DoD:** an order flows to a courier automatically, the customer watches it move on a map, and the
    courier is paid.

### M6 — Trust & safety + Admin/Ops console

-   **Goal:** vetted chefs, accountable behavior, an internal console to run the marketplace.
-   **Features:** **chef KYC** (ID upload, kitchen photos, food-hygiene/health-ministry compliance,
    optional **kosher cert + badge**, allergen declarations) with the **onboarding state machine +
    admin review** (PLAN §6); **two-way reviews** (customer↔chef, customer↔courier); **chef tiers/
    badges** ("Top chef"); **in-app messaging/support**; **cancellation/refund policies**; **Admin/Ops
    console** (Angular): approvals, disputes, refunds, payout oversight, courier management,
    moderation, support tooling.
-   **DoD:** chefs are reviewed before going live; customers/couriers can be rated; ops can resolve
    disputes, refunds, and approvals.

### M7 — Growth, discovery quality & retention

-   **Goal:** levers to grow demand, raise basket size, and retain both sides.
-   **Features:** **search ranking + personalization**; **sponsored placement/ads** (revenue);
    **promotions/coupons/first-order discounts**; **referrals**; **loyalty/points**; **reorder**;
    **group orders**; **scheduled recurring / meal plans** (home-food customers want weekly plans);
    **customer membership** (free delivery tier, Wolt+ style); **B2B**: deeper **Cibus/10bis**, company
    lunch, **catering/large pre-orders**; **chef analytics** (sales, demand heatmaps, promo tools,
    dynamic-pricing nudges).
-   **DoD:** measurable demand-gen + retention features live; chefs have an insights dashboard.

### M8 — Scale & hardening _(ongoing)_

-   **Goal:** production resilience and quality.
-   **Features:** **observability** (Sentry, tracing, structured logs), load/perf, **fraud/risk**,
    rate limiting everywhere, **PII/privacy**, backups/DR, on-call runbooks, **feature flags + A/B**,
    **Expo EAS OTA updates**, accessibility, full **test pyramid** (Jest unit, Playwright e2e,
    Detox/Maestro mobile), **OpenAPI → `libs/api-client` SDK** generation.

---

## 5. Cross-cutting tracks (run in parallel)

-   **Localization (Hebrew/RTL, i18n)** — start in **M1**; every new screen ships bilingual.
-   **Payments & finance** — PSP + Bit (**M3**), Cibus/10bis (**M3/M7**), invoicing/VAT (**M3**),
    payouts + reconciliation (**M4–M5**).
-   **Notifications** (push/SMS/email) — formalized in **M4**, reused everywhere after.
-   **Trust, safety & compliance** — health-ministry/home-food rules, kosher, consumer protection,
    data privacy; KYC hooks from onboarding, formalized in **M6** (legal review alongside).
-   **Observability & testing** — grow continuously; gate releases from **M3** onward.

---

## 6. Decisions still open (flag when each milestone starts)

-   **Payments provider:** Israeli PSP (Tranzila/Meshulam/Cardcom) vs Stripe (PLAN's pick) vs both?
    Affects M3 + payouts. (Stripe Connect now supports Israel, but local cards/Bit/Cibus lean local.)
-   **Courier app:** a **separate** Expo app, or a **role** inside the existing mobile app? (Affects M5.)
-   **On-demand vs scheduled-first:** peers lean **scheduled/pre-order** for home food. Which is the
    primary ordering mode for launch? (Affects M3 scheduling depth.)
-   **Kosher:** optional label, or a required/structured field with certification review? (M1/M6.)
-   **Invoicing responsibility:** platform-issued receipts on chefs' behalf vs chef-issued? VAT
    handling for `עוסק פטור` vs `מורשה`. (M3, legal.)
-   **Cibus/10bis:** partnership/integration feasibility and timing. (Could pull B2B earlier.)
-   **Minimum order / delivery zones / radius defaults.** (M3/M5.)

---

## 7. Deferred / parked (consciously skipped, do later)

Built as MVP shortcuts to keep momentum; revisit before launch.

-   **Image upload to S3/MinIO** — photos (selfie, cover, dishes) are still **base64 data
    URLs** stored inline. Wire signed-URL uploads to MinIO/S3. _(M1 — bucket already in
    docker-compose.)_
-   **Hebrew / RTL i18n** — clients are still **English LTR only**; no i18n library yet.
    Israel-first means this should land early. _(M1 cross-cutting.)_
-   **Web chef form: kosher + allergens** — the API/Prisma support them, but the Angular
    add-meal + onboarding forms don't collect them yet (defaulted to `false` / `[]`). _(M1.)_
-   **Real payments** — `MockPaymentProvider` only **authorizes** (no real money). Integrate an
    Israeli PSP (Tranzila/Meshulam/Cardcom) + **Bit**, then **Cibus/10bis**, plus compliant
    **`חשבונית מס`** + VAT. _(M3 cross-cutting.)_
-   **Visual mobile re-verification** — M2/M3 customer screens (Discover, KitchenDetail cart,
    Checkout, MyOrders) build + typecheck but were not re-driven in the simulator/emulator after
    the API was curl-verified. Smoke-test on a device.
-   **VAT model** — currently applied only to platform fees + delivery (home-food chefs are often
    `עוסק פטור`). Confirm with the invoicing/tax work. _(M3/legal.)_
