# Hearth — Home-Chefs Food Delivery Platform

> Working monorepo name: **`hearth`** (a hearth is the heart of a home kitchen).
> Alternates if the brand is taken: **Sofra**, **Potluck**, **HomePlate**, **Cocina**.

A marketplace connecting home cooks ("home-chefs") with nearby customers. Chefs onboard
through a vetted KYC + kitchen-approval flow; customers sign up with phone-number 2FA and
order home-cooked meals. One Nx monorepo holds the NestJS API, the Angular web portal, and
the React Native mobile app, sharing a single contracts library.

---

## 1. Architecture at a glance

```
                ┌──────────────────────┐
   Customers ──▶│  Mobile app (Expo RN) │──┐
                └──────────────────────┘  │
                ┌──────────────────────┐  │   HTTPS / WSS
   Chefs+Ops ──▶│  Web portal (Angular) │──┼────────────────▶  NestJS API
                └──────────────────────┘  │                     │
                                          │                     ├─▶ PostgreSQL (Prisma)
                shared @hearth/contracts ─┘                     ├─▶ Redis (OTP, cache, BullMQ)
                                                                ├─▶ Stripe (payments + Connect payouts)
                                                                ├─▶ Twilio Verify (phone OTP / SMS)
                                                                ├─▶ S3-compatible storage (docs/photos)
                                                                └─▶ Expo Push / FCM+APNs (notifications)
```

**Client split (deliberate):**
- **React Native (Expo)** = the *customer* app: browse, order, track, pay. Optionally a chef-lite view.
- **Angular** = the *chef portal* (onboarding, menu, order queue) **and** the *admin/ops console* (approvals, disputes, payouts). Two routed sections behind role-based guards, one Angular app — or two apps if they diverge.

Rationale: customers are mobile-first; chefs manage a kitchen at a counter/desktop and ops are internal — both are far better on web.

---

## 2. Monorepo: Nx + pnpm

Nx is the only tool that natively understands NestJS, Angular, **and** React Native/Expo together, with a shared TypeScript graph, `affected` builds, and generators for each.

```
hearth/
├── apps/
│   ├── api/                  # NestJS (REST + WebSocket gateway)
│   ├── web/                  # Angular (chef portal + admin console)
│   └── mobile/               # React Native via Expo (customer app)
├── libs/
│   ├── contracts/            # shared DTOs, enums, zod/class-validator schemas, API types
│   ├── api-client/           # typed SDK generated from the API's OpenAPI spec
│   ├── ui-web/               # Angular shared components/design system
│   ├── ui-mobile/            # RN shared components/design system
│   └── domain/               # framework-agnostic domain logic (state machines, pricing, geo)
├── tools/                    # Nx generators, scripts
├── docker-compose.yml        # Postgres + Redis + minio for local dev
├── nx.json  pnpm-workspace.yaml  tsconfig.base.json
└── .github/workflows/ci.yml  # nx affected: lint, test, build
```

`libs/contracts` is the keystone: the API, Angular, and RN all import the same request/response
types and validation schemas, so a backend change that breaks a client fails at compile time.

---

## 3. Tech stack & key decisions

| Concern            | Choice                                  | Why |
|--------------------|-----------------------------------------|-----|
| API framework      | **NestJS**                              | Modular DI, guards/interceptors map cleanly to auth + RBAC |
| Database           | **PostgreSQL** + **Prisma**             | Relational marketplace data; Prisma migrations + type-safety |
| Cache / queue / OTP| **Redis** + **BullMQ**                  | OTP storage w/ TTL, rate limiting, async jobs, timers |
| Auth               | **Phone OTP (passwordless 2FA)** + JWT  | See §5 |
| SMS / OTP delivery | **Twilio Verify**                       | Handles code generation, delivery, retries, fraud signals |
| Payments           | **Stripe** PaymentIntents + **Connect** | Auth/capture flow + per-chef payouts with Stripe-handled KYC |
| File storage       | **S3-compatible** (AWS S3 / MinIO local)| Kitchen photos, ID docs, certificates |
| Push               | **Expo Push** (wraps FCM + APNs)        | Simplest path with Expo-managed RN |
| Realtime           | **Socket.IO gateway** in Nest           | Live order-status to customer + chef |
| Maps / geo         | **Mapbox or Google Maps**               | Geocoding, distance/ETA, delivery radius |
| Local dev          | **docker-compose**                      | Postgres + Redis + MinIO in one command |

---

## 4. Core data model (Prisma sketch)

```
User            id, phone (unique), displayName, roles[], status, createdAt
Device          id, userId, pushToken, platform, lastSeenAt        # for push + refresh binding
OtpChallenge    id, phone, providerRef, purpose, expiresAt, consumedAt   # backed by Redis TTL
RefreshToken    id, userId, deviceId, tokenHash, expiresAt, revokedAt

ChefProfile     id, userId, bio, cuisines[], status (onboarding state machine), rating
Kitchen         id, chefProfileId, address, geo(lat,lng), photos[], hygieneCertUrl
ChefDocument    id, chefProfileId, type(ID|HYGIENE|INSURANCE), fileUrl, reviewStatus
PayoutAccount   id, chefProfileId, stripeAccountId, status

Dish            id, kitchenId, name, description, photoUrl, price, prepMinutes, active
Availability    id, kitchenId, weekday, startTime, endTime, maxOrders   # capacity windows

Address         id, userId, label, line1, geo(lat,lng)
Cart            id, userId, kitchenId, items[]                        # single-kitchen carts
Order           id, customerId, kitchenId, status (state machine), totals, deliveryAddressId
OrderItem       id, orderId, dishId, qty, unitPrice
Payment         id, orderId, stripePaymentIntentId, status, amount
Payout          id, chefProfileId, orderId, amount, stripeTransferId, status
Review          id, orderId, customerId, kitchenId, rating, comment
Notification    id, userId, type, payload, readAt
```

Carts are single-kitchen by design (you can't mix two home-chefs in one order) — this keeps
prep, capacity, and delivery logic tractable.

---

## 5. Phone-number 2FA login flow

Passwordless, OTP-based. The phone number is the identity; the SMS code is the second factor
proving control of that number. Optional re-challenge on sensitive actions (payout changes).

```
POST /auth/otp/request   { phone }
   → rate-limit per phone + per IP (Redis sliding window)
   → Twilio Verify sends a 6-digit code; store challenge ref in Redis w/ 5-min TTL
   → 200 (always generic, to avoid phone enumeration)

POST /auth/otp/verify    { phone, code, deviceInfo }
   → Twilio Verify checks code
   → upsert User by phone (new user → role CUSTOMER)
   → issue access JWT (15 min) + refresh token (rotating, hashed, device-bound, 30 days)
   → register Device + push token
   → 200 { accessToken, refreshToken, user }

POST /auth/refresh       { refreshToken }   → rotate + reissue
POST /auth/logout        → revoke refresh token for device
```

Guards & hardening: `JwtAuthGuard` + `RolesGuard` (CUSTOMER / CHEF / ADMIN); brute-force lockout
after N failed codes; resend cooldown; refresh-token rotation with reuse detection; all OTP
responses generic to prevent enumeration.

---

## 6. Home-chef onboarding flow

A state machine on `ChefProfile.status`, gated by an admin review. A customer can request to
become a chef; the app walks them through steps and admins approve.

```
DRAFT ──submit profile──▶ SUBMITTED ──auto/manual──▶ UNDER_REVIEW
   │                                                     │
   │                                          approve ◀──┴──▶ reject (with reasons → back to DRAFT)
   ▼                                            │
(edit anytime)                                  ▼
                                              APPROVED ──go live──▶ ACTIVE ⇄ SUSPENDED
```

Steps the chef completes (each saved incrementally so they can resume):
1. **Identity** — already phone-verified; add legal name + ID document upload.
2. **Kitchen** — address (geocoded), photos, food-hygiene/safety certificate, optional insurance.
3. **Menu** — at least one dish (name, photo, price, prep time) + availability windows & capacity.
4. **Payouts** — create Stripe Connect Express account; Stripe handles bank + identity KYC.
5. **Submit for review** — locks the application into `UNDER_REVIEW`.
6. **Admin review** (Angular admin console) — verify docs, approve or reject with reasons.
7. **Go live** — approved chef toggles `ACTIVE`; kitchen becomes discoverable to customers.

Notifications fire on each transition (submitted, approved, rejected, suspended).

---

## 7. Order management flow

```
Customer:  browse kitchens (by geo + open availability) → add dishes to cart (one kitchen)
           → checkout → Stripe PaymentIntent authorized (not captured)

Order state machine:
  CREATED ─paid(authorized)─▶ AWAITING_CHEF
      AWAITING_CHEF ──chef accepts──▶ ACCEPTED ──▶ PREPARING ──▶ READY
                    └─chef rejects / timeout──▶ CANCELLED (auth released, customer refunded)
      READY ──▶ OUT_FOR_DELIVERY ──▶ DELIVERED   (capture payment, schedule chef payout)
      any active state ──customer/ops cancel──▶ CANCELLED (refund per policy)
```

Mechanics:
- **Capacity check** at checkout against the kitchen's availability window `maxOrders`.
- **Payment**: authorize at order time, **capture on DELIVERED** — so cancellations release funds cleanly.
- **Chef accept timer**: a BullMQ delayed job auto-cancels + refunds if the chef doesn't respond in N minutes.
- **Realtime**: Socket.IO pushes every state change to the customer (tracking screen) and the chef (order queue); push notifications mirror key transitions.
- **Payouts**: on capture, a Payout job transfers the chef's share (minus platform fee) via Stripe Connect.
- **Delivery (MVP)**: chef self-delivery or a manually assigned courier; pluggable for a 3rd-party logistics integration later.

BullMQ jobs: send OTP/SMS, send push/notifications, order-accept timeout, payment capture,
payout settlement, review reminder.

---

## 8. API surface (representative)

```
Auth      POST /auth/otp/request  /auth/otp/verify  /auth/refresh  /auth/logout
Me        GET/PATCH /me           GET /me/orders     POST /me/devices
Chef      POST /chef/apply        PATCH /chef/profile  POST /chef/documents
          POST /chef/kitchen      POST /chef/dishes    PATCH /chef/availability
          GET  /chef/orders       POST /chef/orders/:id/accept|reject|ready
Catalog   GET /kitchens?lat&lng&radius   GET /kitchens/:id   GET /kitchens/:id/dishes
Orders    POST /orders   GET /orders/:id   POST /orders/:id/cancel
Payments  POST /payments/intent   POST /webhooks/stripe
Admin     GET /admin/chefs?status   POST /admin/chefs/:id/approve|reject
          GET /admin/orders   GET /admin/payouts
Realtime  WS /ws   events: order.updated, chef.order.created
```

REST + OpenAPI (Nest `@nestjs/swagger`); the spec generates `libs/api-client` so clients stay in sync.

---

## 9. Delivery roadmap

- **Phase 0 — Foundations.** Nx scaffold, pnpm, CI (`nx affected`), docker-compose, `contracts` lib, Prisma schema + migrations, **phone-OTP auth end-to-end** (API + a login screen on both clients).
- **Phase 1 — Chef onboarding.** Onboarding state machine, document/photo uploads to S3, Stripe Connect account creation, admin review console in Angular.
- **Phase 2 — Catalog & ordering.** Menu/availability management, geo-based kitchen discovery on mobile, single-kitchen cart, checkout with Stripe PaymentIntent (auth).
- **Phase 3 — Order lifecycle.** Order state machine, chef order queue, accept/reject + auto-cancel timer, realtime tracking, push notifications, capture-on-delivery + payouts.
- **Phase 4 — Trust & polish.** Reviews/ratings, dispute/refund tooling, search & discovery ranking, delivery/courier integration, analytics dashboards.

---

## 10. Cross-cutting

- **Security**: phone-enumeration-safe auth, RBAC guards, rate limiting (Redis), signed S3 upload URLs, Stripe webhook signature verification, secrets via env/secret manager, PII minimization on logs.
- **Testing**: Jest unit (Nest + libs), Playwright e2e (Angular), Detox/Maestro (RN), contract tests against `libs/contracts`.
- **Observability**: structured logging (pino), request tracing, Sentry on all three apps, health/readiness probes.
- **Config**: 12-factor env per app; `.env` locally, secret manager in prod.
- **Deploy**: API as a container (Fly/Render/ECS), Angular static to CDN, mobile via Expo EAS to App Store / Play.
