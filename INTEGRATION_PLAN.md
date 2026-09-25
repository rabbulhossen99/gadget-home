# Unified commerce integration

## Inspection findings

| Source                                      | Framework                                                | Existing behavior                                                                                                | Missing infrastructure                                                                                               |
| ------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| health-home-hub-main/health-home-hub-main   | React 19, TanStack Start/Router, Vite, Tailwind 4, Radix | Bengali wellness homepage, category tiles, package cards, selectable combo                                       | Products and content are arrays; cart is a counter; search/auth are decorative                                       |
| product-showcase-main/product-showcase-main | Same React/TanStack stack                                | Product gallery with zoom, packages, quantity, detail/usage/review tabs, checkout, confirmation                  | Checkout trusts URL subtotal and only sets React state; no order persistence; sample reviews                         |
| complete-project                            | Next App Router, React 19, Tailwind 4, Base UI, Recharts | Admin shell, dashboard, sales, product and Meta targeting form, promotions, analytics, reports, privacy/settings | Sample data and transient toggles; save/report actions are simulations; no API, auth, schema, or database connection |

Neon is declared in the admin dependencies but unused. No environment files, migrations, backend endpoints, authentication, or real integrations were found. Two incompatible routers, duplicated UI libraries, conflicting theme tokens, and sample currencies must be consolidated.

## Architecture and sequence

1. Establish a single root application: React/Vite/Tailwind using the storefront design system; React Router for customer and `/admin/*` routes. Keep original source folders as read-only reference material outside the active build.
2. Create a Node/Express API with SQLite migrations, foreign keys, WAL, prepared statements, transactional inventory, integer minor-unit money, validation, session authentication, CSRF/origin checks, security headers, and rate limits. SQLite supports a single server with a persistent local disk; multi-instance deployment requires a shared database migration.
3. Seed editable content from the supplied templates once. Model products, package variants, categories/subcategories, selectable combos, coupons, homepage sections/banners, store/shipping/payment/policy settings, users, carts, orders/items/events, and abandoned checkouts.
4. Connect the original homepage layout and product gallery/package flow to current catalog data. Implement category/search listings, persisted cart, server quotes, guest and signed-in checkout, customer accounts, and private order tracking.
5. Port the admin navigation/theme and implement actual product/category/content/promotion/settings management, image uploads, order search/filter/detail/status/shipping/payment management, customers, incomplete orders, stock notifications, dashboards and CSV exports. Preserve targeting metadata/snippet tooling; do not pretend third-party advertising/payment services are connected.
6. Validate build/types and integration tests covering unauthorized access, CSRF, price tampering, concurrent stock, idempotency, coupon limits, cancellation restocking, and end-to-end admin-to-storefront/order visibility. Inspect responsive UI where browser tooling is available.
7. Document installation, initial administrator setup, backups, environment variables, payment behavior, deployment, and any unverified external services.

## Boundaries

Cash on delivery and configurable manual mobile payment instructions are supported; manual payment references remain unverified until reviewed by an administrator. No automatic gateway charge, courier dispatch, email/SMS, Meta CAPI, or legal-compliance claim is fabricated. Such external services require credentials and explicit provider integration. All stored product/content changes feed the same API; clients refetch on focus and periodically.
