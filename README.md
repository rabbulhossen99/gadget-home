# GadgetHome unified commerce

The active application lives at this folder's root. It integrates the wellness storefront from **health-home-hub-main**, the gallery/package/checkout journey from **product-showcase-main**, and the administration design and management areas from **complete-project**. The three original folders remain untouched as references and are excluded from the active build.

The supplied projects contained UI prototypes, not a working backend. This application adds the shared database, API, authentication and order processing. See [the architecture inspection and integration plan](INTEGRATION_PLAN.md).

## Run locally

Requires **Node.js 24+** and pnpm. Run commands from this directory, not an original project folder.

```sh
pnpm install --frozen-lockfile
pnpm db:seed
pnpm admin:create
pnpm dev
```

- Store: http://localhost:5173
- Administration: http://localhost:5173/admin
- API during development: http://127.0.0.1:3001/api/health
- `pnpm build && pnpm start` serves the built application and API together at http://127.0.0.1:3001 when running locally.

`admin:create` prompts for your email, name and a hidden password of at least 12 characters. There is **no default administrator account** in the store database. Never put administrator credentials in frontend variables. `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` can be supplied securely as process environment variables for noninteractive setup. Existing accounts are not overwritten. `pnpm admin:reset` resets an existing administrator password and revokes its sessions; this requires local server access.

The seed command is repeatable and preserves existing data. It creates **demonstration products, prices, inventory, policies, a combo offer and SAVE10**. Review all seeded content before accepting real orders. Prices are editable; the conflicting sample prices in the originals have been consolidated into the package prices from the product showcase.

## What is connected

| Area           | Implemented behavior                                                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog        | Products, multiple images/uploads, descriptions, usage, attributes, category hierarchy, URL slugs, status, featured products                                          |
| Inventory      | Independently stocked sellable packages/variants with SKU, price, original price and unit count; transactional stock decrement and cancellation/return restocking     |
| Homepage       | Ordered/enabled hero banners, promotions, category grids, featured/selected product grids, package sections and selectable combo offers                               |
| Shopping       | Category/subcategory browsing, search, sorting, gallery zoom, package selection, persisted session cart, quantity/removal, cart recovery after unavailable items      |
| Checkout       | Server-calculated prices/discounts/shipping, coupons, delivery areas, consent, notes, COD and configurable manual mobile payments                                     |
| Orders         | Transactional order creation, duplicate-request protection, immutable purchased item/price snapshots, confirmation, private tracking codes, account order history     |
| Administration | Order search/status filters/details, lifecycle changes, payment status, carrier/tracking/shipping notes, customer records, incomplete checkout workflow, stock alerts |
| Reports        | Real order/payment statistics and date-range sales, inventory and customer CSV downloads, with spreadsheet formula-injection protection                               |
| Content        | Store identity, contact details, announcement/footer, shipping rules, payment instructions, privacy/return/delivery policies, checkout consent and retention          |
| Accounts       | Customer registration, sign-in/out, password changes, administrator role enforcement, customer data exports/deletion requests                                         |
| Reviews        | Delivered-purchase eligibility, one review per customer/product, admin approval before publication                                                                    |
| Privacy        | Consent-based incomplete checkout saving, automatic draft retention cleanup, customer export, deliberate account/contact anonymization, admin audit trail             |
| Marketing      | Coupons with minimum spend, validity windows and redemption limits; editable campaign planning; saved product targeting metadata and snippet generation               |

Admin changes appear immediately on the next API request. Open customer pages refresh on focus and every 15 seconds, including cart/checkout quotes. Admin edits use versions to prevent overwriting stock or other changes made since the form was opened.

## Money, stock and order rules

- Currency is BDT. Database/API monetary values are integer **poisha** (100 = ৳1); customer, product and fixed-discount forms display taka.
- A variant is a stocked **sellable package**, not a shared pool of loose pieces. A family pack with stock 10 means 10 complete family packs. Selling a family pack does not decrement the separate single-pack SKU. This avoids inventing undocumented inventory conversion rules.
- Combos use the first active package of each selected product. The combo's tier determines its price; each component's stock is validated and decremented. Select products whose first active package is appropriate for the offer.
- Shipping uses the configured delivery area; free-shipping thresholds apply to the pre-coupon merchandise subtotal. Coupons can discount merchandise or shipping. Returned/cancelled orders release their coupon redemption and restore stock exactly once.
- Allowed lifecycle: pending → confirmed → processing → shipped → delivered; pending/confirmed/processing may cancel; shipped/delivered may return. Shipping requires carrier and tracking details.
- Changing payment status records an administrator's verification. **It does not charge or refund money.** Manual mobile payments remain `pending_verification` until reviewed.
- A product or variant used in an order must be archived/deactivated rather than deleted. Historical order item descriptions and prices remain unchanged.
- Guest order access is limited to the original browser session or the order's private 64-character tracking code. Save that code from confirmation. Signed-in customers can also see their own orders.

## Structure

```text
src/
  pages/             Customer storefront, product, cart, checkout, account
  admin/             Admin shell, product/content editors, orders, reporting
  components/        Shared storefront layout, controls and cards
  lib/               API client, shared domain types and state
server/
  db.mjs             SQL schema migration, persistence and transactions
  schemas.mjs        Server-side input validation
  auth.mjs           Password hashing and database sessions
  commerce.mjs       Pricing, stock and order lifecycle rules
  privacy.mjs        Customer exports and anonymization
  app.mjs            Shared HTTP API and authorization
  seed.mjs           One-time editable template data
scripts/             Development launcher and consistent database backups
tests/               Isolated API integration tests and disposable UI fixture
public/assets/       Selected images reused from the three projects
data/                Local database/backups (ignored by Git)
uploads/             Admin image uploads (ignored by Git)
```

## Verification

```sh
pnpm test
pnpm build
pnpm format:check
```

Tests create isolated databases and do not modify your store. They exercise authorization, CSRF/origin enforcement, catalog synchronization, stale edits, cart isolation, price tampering, stock races, duplicate orders, guest order privacy, lifecycle/restocking, coupon limits, combos, category rules, consent, registration, manual payments and uploads.

For manual UI verification after building, `node tests/preview.mjs` runs an **in-memory, loopback-only disposable store** on port 3002. Its test-only credentials are printed by that command. Never deploy this fixture or expose its port publicly.

## Deployment and operations

Copy `.env.example` to `.env` and configure the environment. For deployment:

```dotenv
NODE_ENV=production
APP_ORIGIN=https://shop.your-domain.example
HOST=127.0.0.1
PORT=3001
DATABASE_PATH=/persistent/private/commerce.sqlite
UPLOAD_DIR=/persistent/uploads
TRUST_PROXY=1
```

Set `TRUST_PROXY=1` **only** behind a single trusted reverse proxy, and prevent direct public access to the Node port. Proxy the entire website and `/api` to the same application origin. Terminate HTTPS at the proxy. Production rejects a missing/non-HTTPS `APP_ORIGIN`; session cookies are Secure, HttpOnly and SameSite=Strict. Only the built `dist/` and uploads are served, never the repository/database.

Build with the pinned lockfile, run the seed and admin setup deliberately, and start under a service manager with restart/log rotation. The database and upload paths must survive deployments. `/api/health` checks database availability. The application applies request limits, JSON size limits, image size/signature checks, CSRF/origin verification, prepared SQL, role checks and security headers.

**Deployment model:** one Node server using SQLite WAL on a durable local filesystem. Do not use an ephemeral/serverless filesystem, a network share for the SQLite file, or multiple replicas against independent database copies. API/catalog/report list responses currently load complete collections; this is a practical single-store baseline, **not a demonstrated high-volume deployment**. Before horizontal scaling or a large catalog, migrate the repository layer to a shared PostgreSQL database, introduce server pagination/aggregates, shared session/rate-limit storage and object storage for uploads. The pricing/order domain is separated to support that work.

### Backups

`pnpm db:backup` creates a consistent `VACUUM INTO` database snapshot in `data/backups/`. Also back up the upload directory to private durable storage. Exercise restoration before launch. To restore, stop the application, preserve the current database and its WAL/SHM files, restore a verified snapshot to `DATABASE_PATH`, restore matching uploads, and restart. Do not copy just the live SQLite main file while writes are occurring.

### External services and launch work

The originals did not contain working payment gateways, courier APIs, email/SMS delivery, Meta CAPI, Stripe or ad network integrations despite some sample “connected” labels. This application does not claim those services are connected. Automatic payments/refunds, notifications, shipment creation and ad event forwarding require provider credentials, webhook verification and provider-specific integration/testing. Campaigns and Meta fields are planning/metadata tools, not an ad-dispatch service. Email verification and self-service email password recovery are not configured.

Before going live, create your administrator, replace demonstration inventory and policies, configure contact/shipping/payment information, select and configure hosting/HTTPS/backups, verify your real payment procedures and perform a staging purchase/fulfillment check. Automated tests and a successful local build do not establish production readiness for an unspecified hosting/payment environment.
"# gadget-home" 
