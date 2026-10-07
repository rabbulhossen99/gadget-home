import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { z, ZodError } from "zod";
import { customerExport, anonymizeRequest } from "./privacy.mjs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { id, records, record, save, transaction, audit } from "./db.mjs";
import {
  schemas,
  cartSchema,
  quoteSchema,
  checkoutSchema,
  orderUpdateSchema,
  orderEditSchema,
  phoneSchema,
} from "./schemas.mjs";
import {
  settings,
  publicProduct,
  categoryVisible,
  fail,
  hash,
  quote,
  placeOrder,
  orderView,
  editConfirmedOrder,
  convertIncompleteOrder,
  updateOrder,
} from "./commerce.mjs";
import {
  sessions,
  safeUser,
  passwordHash,
  verifyPassword,
  rotateSession,
  requireAdmin,
  requireUser,
} from "./auth.mjs";
import { courierService, mountCourierAdmin } from "./couriers.mjs";
import { trackingService, mountTracking } from "./tracking.mjs";
import { renderIndex } from "./seo.mjs";

export function createApp(
  db,
  {
    production = false,
    origin = process.env.APP_ORIGIN || "http://localhost:5173",
    uploadDir = process.env.UPLOAD_DIR || "./uploads",
    staticDir = "./dist",
    limits = true,
    trackingFetch = globalThis.fetch,
    courierRequest,
  } = {},
) {
  const app = express();
app.set('trust proxy', 1);

  const couriers = courierService(db, { request: courierRequest });
  const tracking = trackingService(db, { origin, fetch: trackingFetch });
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: production
        ? {
            directives: {
              defaultSrc: ["'self'"],
              // Meta Pixel loads fbevents.js and reports to facebook.com.
              scriptSrc: ["'self'", "https://connect.facebook.net"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "https:", "data:", "blob:"],
              connectSrc: [
                "'self'",
                "https://connect.facebook.net",
                "https://www.facebook.com",
              ],
              // Large pixel payloads are posted through a hidden iframe form.
              formAction: ["'self'", "https://www.facebook.com"],
              frameSrc: ["https://www.facebook.com"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
      strictTransportSecurity: production ? undefined : false,
      referrerPolicy: { policy: "no-referrer" },
    }),
  );
  if (limits)
    app.use(
      "/api",
      rateLimit({
        windowMs: 60000,
        limit: 240,
        standardHeaders: "draft-8",
        legacyHeaders: false,
      }),
    );
  app.use("/api", (_, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/health", (_, res) => {
    db.prepare("SELECT 1").get();
    res.json({ ok: true });
  });

  app.locals.couriers = couriers;
  app.use("/api", sessions(db, production));
  app.use("/api", (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const requestOrigin = req.headers.origin;
      const devOrigins = new Set([
        origin,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
      ]);
      if (
        !requestOrigin ||
        (production
          ? requestOrigin !== origin
          : !devOrigins.has(requestOrigin)) ||
        req.headers["x-csrf-token"] !== req.session.csrf
      )
        return res
          .status(403)
          .json({ error: "Request verification failed. Refresh and retry." });
    }
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.get("/api/session", (req, res) =>
    res.json({ user: safeUser(req.user), csrf: req.session.csrf }),
  );
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 20,
    skip: () => !limits,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  app.post("/api/auth/register", authLimit, async (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(2).max(200),
        email: z
          .string()
          .email()
          .max(200)
          .transform((v) => v.toLowerCase()),
        password: z.string().min(12).max(128),
      })
      .strict()
      .parse(req.body);
    if (db.prepare("SELECT id FROM users WHERE email=?").get(input.email))
      fail("An account with this email already exists.", 409);
    const password = await passwordHash(input.password),
      user = { id: id(), ...input, role: "customer" };
    const session = transaction(db, () => {
      db.prepare(
        "INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)",
      ).run(user.id, user.email, user.name, password, "customer");
      return rotateSession(db, req, res, user, production);
    });
    res.status(201).json(session);
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const input = z
      .object({
        email: z.string().email().max(200),
        password: z.string().min(1).max(128),
      })
      .strict()
      .parse(req.body);
    const user = db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(input.email);
    // Always perform a password hash, even if the account does not exist.
    const valid = user
      ? await verifyPassword(input.password, user.password)
      : await passwordHash(input.password).then(() => false);
    if (!valid) fail("Email or password is incorrect.", 401);
    res.json(
      transaction(db, () => rotateSession(db, req, res, user, production)),
    );
  });
  app.post("/api/auth/logout", (req, res) => {
    db.prepare("DELETE FROM sessions WHERE id=?").run(req.session.id);
    res.clearCookie("gh_session", { path: "/" });
    res.json({ ok: true });
  });
  app.post("/api/auth/password", requireUser, authLimit, async (req, res) => {
    const data = z
      .object({
        currentPassword: z.string().max(128),
        password: z.string().min(12).max(128),
      })
      .strict()
      .parse(req.body);
    if (!(await verifyPassword(data.currentPassword, req.user.password)))
      fail("Current password is incorrect.", 401);
    const password = await passwordHash(data.password);
    transaction(db, () => {
      db.prepare("UPDATE users SET password=? WHERE id=?").run(
        password,
        req.user.id,
      );
      db.prepare("DELETE FROM sessions WHERE user_id=? AND id<>?").run(
        req.user.id,
        req.session.id,
      );
    });
    res.json({ ok: true });
  });


  app.get("/api/settings", (_, res) => {
    res.json(settings(db));
  });

  app.get("/api/catalog", (_, res) => {
    const categories = records(db, "categories")
      .filter((c) => categoryVisible(db, c.id))
      .sort((a, b) => a.position - b.position);
    res.json({
      products: records(db, "products")
        .map((p) => publicProduct(db, p))
        .filter(Boolean),
      categories,
      sections: records(db, "sections")
        .filter((s) => s.active)
        .sort((a, b) => a.position - b.position),
      combos: records(db, "combos").filter((c) => c.active),
      settings: settings(db),
    });
  });
  app.get("/api/cart", (req, res) =>
    res.json(
      JSON.parse(
        db
          .prepare("SELECT data FROM carts WHERE session_id=?")
          .get(req.session.id)?.data || "[]",
      ),
    ),
  );
  app.put("/api/cart", (req, res) => {
    const items = cartSchema.parse(req.body);
    // Saving a cart is not a stock reservation. Allow removing unavailable
    // items even if another stale item remains; quotes and orders validate all.
    db.prepare(
      "INSERT INTO carts VALUES(?,?) ON CONFLICT(session_id) DO UPDATE SET data=excluded.data",
    ).run(req.session.id, JSON.stringify(items));
    res.json(items);
  });
  app.post("/api/quote", (req, res) => {
    const { requirements, couponId, ...result } = quote(
      db,
      quoteSchema.parse(req.body),
    );
    res.json(result);
  });
  app.put("/api/checkout-draft", (req, res) => {
    const data = z
      .object({
        name: z.string().max(200).default(""),
        phone: phoneSchema,
        email: z.string().max(200).default(""),
        address: z.string().max(1000).default(""),
        items: cartSchema.refine((items) => items.length > 0, "Cart is empty."),
        checkoutKey: z.string().uuid().optional(),
        note: z.string().max(1000).optional(),
        area: z.enum(["inside", "outside"]).optional(),
        coupon: z.string().max(30).optional(),
      })
      .strict()
      .parse(req.body);
    if (
      data.checkoutKey &&
      db
        .prepare(
          "SELECT id FROM orders WHERE session_id=? AND idempotency_key=?",
        )
        .get(req.session.id, data.checkoutKey)
    ) {
      return res.json({ ok: true, status: "converted" });
    }
    db.prepare(
      "INSERT INTO checkouts(id,session_id,data) VALUES(?,?,?) ON CONFLICT(session_id) DO UPDATE SET data=excluded.data,status='incomplete',updated_at=CURRENT_TIMESTAMP",
    ).run(id(), req.session.id, JSON.stringify(data));
    res.json({ ok: true });
  });
  app.post(
    "/api/orders",
    rateLimit({ windowMs: 60000, limit: 10, skip: () => !limits }),
    (req, res) => {
      const { tracking: context, ...input } = req.body ?? {};
      const order = placeOrder(db, req.session, checkoutSchema.parse(input));
      // Only newly placed orders carry a tracking token; repeated submissions are not reported again.
      if (order.trackingToken) tracking.purchase(order, req, context);
      res.status(201).json(order);
    },
  );
  app.get("/api/orders", (req, res) => {
    const rows = db
      .prepare(
        "SELECT * FROM orders WHERE session_id=? OR (user_id IS NOT NULL AND user_id=?) ORDER BY created_at DESC",
      )
      .all(req.session.id, req.user?.id || null);
    res.json(rows.map((row) => orderView(db, row)));
  });
  app.get("/api/orders/:id", (req, res) => {
    const row = db
      .prepare(
        "SELECT * FROM orders WHERE id=? AND (session_id=? OR (user_id IS NOT NULL AND user_id=?))",
      )
      .get(req.params.id, req.session.id, req.user?.id || null);
    res.json(orderView(db, row));
  });
  app.post("/api/track", authLimit, (req, res) => {
    const input = z
      .object({ number: z.string().max(60), token: z.string().length(64) })
      .strict()
      .parse(req.body);
    const row = db
      .prepare("SELECT * FROM orders WHERE number=? AND token_hash=?")
      .get(input.number, hash(input.token));
    res.json(orderView(db, row));
  });
  app.get("/api/products/:id/reviews", (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT r.*,u.name FROM reviews r JOIN users u ON u.id=r.user_id WHERE product_id=? AND approved=1",
        )
        .all(req.params.id)
        .map((r) => ({ ...JSON.parse(r.data), id: r.id, name: r.name })),
    ),
  );
  app.post("/api/products/:id/reviews", requireUser, (req, res) => {
    const input = z
      .object({
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().min(5).max(2000),
      })
      .strict()
      .parse(req.body);
    const purchase = db
      .prepare(
        "SELECT o.id FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.user_id=? AND i.product_id=? AND o.status='delivered'",
      )
      .get(req.user.id, req.params.id);
    if (!purchase)
      fail("Reviews are available after delivery of a purchased product.", 403);
    db.prepare(
      "INSERT INTO reviews(id,product_id,user_id,data) VALUES(?,?,?,?) ON CONFLICT(product_id,user_id) DO UPDATE SET data=excluded.data,approved=0",
    ).run(
      id(),
      req.params.id,
      req.user.id,
      JSON.stringify({ ...input, createdAt: new Date().toISOString() }),
    );
    res.json({ ok: true });
  });
  app.post("/api/privacy-requests", requireUser, (req, res) => {
    const input = z
      .object({ type: z.enum(["export", "deletion"]) })
      .strict()
      .parse(req.body);
    db.prepare(
      "INSERT INTO privacy_requests(id,user_id,data) VALUES(?,?,?)",
    ).run(id(), req.user.id, JSON.stringify({ ...input, status: "pending" }));
    res.status(201).json({ ok: true });
  });
  app.get("/api/account/export", requireUser, (req, res) =>
    res.json({
      user: safeUser(req.user),
      orders: db
        .prepare("SELECT * FROM orders WHERE user_id=?")
        .all(req.user.id)
        .map((o) => orderView(db, o)),
    }),
  );

  app.use("/api/admin", requireAdmin);
  app.use("/api/courier", requireAdmin);
  mountCourierAdmin(app, couriers);
  mountTracking(app, tracking);
  app.get("/api/admin/overview", (_, res) => {
    const orders = db
      .prepare("SELECT * FROM orders ORDER BY created_at DESC")
      .all()
      .map((o) => ({ ...orderView(db, o, true), courierShipment: couriers.shipment(o.id).shipment }));
    const products = records(db, "products");
    const customers = db
      .prepare(
        "SELECT id,name,email,created_at FROM users WHERE role='customer' ORDER BY created_at DESC",
      )
      .all();
    res.json({
      orders,
      customers,
      products,
      lowStock: products.flatMap((p) =>
        p.variants
          .filter((v) => v.active && v.stock <= settings(db).lowStockThreshold)
          .map((v) => ({ product: p.name, ...v })),
      ),
      incomplete: db
        .prepare(
          "SELECT * FROM checkouts WHERE status!='converted' ORDER BY updated_at DESC",
        )
        .all()
        .map((c) => ({
          id: c.id,
          ...JSON.parse(c.data),
          status: c.status,
          updatedAt: c.updated_at,
        })),
      audit: db
        .prepare("SELECT * FROM audit_log ORDER BY rowid DESC LIMIT 100")
        .all(),
    });
  });
  app.get("/api/admin/orders", (req, res) => {
    const search = String(req.query.search || "")
        .toLowerCase()
        .slice(0, 200),
      status = String(req.query.status || "");
    res.json(
      db
        .prepare("SELECT * FROM orders ORDER BY created_at DESC")
        .all()
        .filter((o) => !status || o.status === status)
        .map((o) => ({
          ...orderView(db, o, true),
          courierShipment: couriers.shipment(o.id).shipment,
        }))
        .filter((o) =>
          `${o.number} ${o.name} ${o.phone} ${o.email}`
            .toLowerCase()
            .includes(search),
        ),
    );
  });
  app.patch("/api/admin/orders/:id/edit", (req, res) => {
    const result = editConfirmedOrder(db, req.params.id, orderEditSchema.parse(req.body), req.user.id);
    audit(db, req.user.id, "order.edit", req.params.id);
    res.json(result);
  });
  app.put("/api/orders/:id/edit", requireAdmin, (req, res) => {
    const result = editConfirmedOrder(db, req.params.id, orderEditSchema.parse(req.body), req.user.id);
    audit(db, req.user.id, "order.edit", req.params.id);
    res.json(result);
  });
  app.patch("/api/admin/orders/:id", (req, res) => {
    const result = updateOrder(
      db,
      req.params.id,
      orderUpdateSchema.parse(req.body),
      req.user.id,
    );
    audit(db, req.user.id, "order.update", req.params.id);
    res.json(result);
  });
  app.patch("/api/admin/incomplete/:id", (req, res) => {
    const { status } = z
      .object({ status: z.enum(["incomplete", "contacted", "closed"]) })
      .strict()
      .parse(req.body);
    const result = db
      .prepare(
        "UPDATE checkouts SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status!='converted'",
      )
      .run(status, req.params.id);
    if (!result.changes) fail("Incomplete order not found.", 404);
    audit(db, req.user.id, "checkout." + status, req.params.id);
    res.json({ ok: true });
  });
  app.post("/api/admin/incomplete/:id/confirm", (req, res) => {
    const details = z.object({ name: z.string().trim().min(2).max(200).optional(), address: z.string().trim().min(8).max(1000).optional() }).strict().parse(req.body || {});
    const order = convertIncompleteOrder(db, req.params.id, req.user.id, details);
    audit(db, req.user.id, "checkout.confirm", req.params.id);
    res.json(order);
  });
  app.delete("/api/admin/incomplete/:id", (req, res) => {
    const result = db
      .prepare("DELETE FROM checkouts WHERE id=? AND status!='converted'")
      .run(req.params.id);
    if (!result.changes)
      fail("Incomplete order not found or already converted.", 404);
    audit(db, req.user.id, "checkout.delete", req.params.id);
    res.json({ ok: true });
  });
  app.get("/api/admin/reviews", (_, res) =>
    res.json(
      db
        .prepare(
          "SELECT r.*,u.name FROM reviews r JOIN users u ON u.id=r.user_id",
        )
        .all()
        .map((r) => ({ ...r, ...JSON.parse(r.data) })),
    ),
  );
  app.patch("/api/admin/reviews/:id", (req, res) => {
    const { approved } = z
      .object({ approved: z.boolean() })
      .strict()
      .parse(req.body);
    db.prepare("UPDATE reviews SET approved=? WHERE id=?").run(
      Number(approved),
      req.params.id,
    );
    res.json({ ok: true });
  });
  app.get("/api/admin/privacy-requests", (_, res) =>
    res.json(
      db
        .prepare(
          "SELECT p.*,u.name,u.email FROM privacy_requests p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC",
        )
        .all()
        .map((r) => ({ ...r, ...JSON.parse(r.data) })),
    ),
  );
  app.get("/api/admin/customers/:id/export", (req, res) => {
    const result = customerExport(db, req.params.id);
    audit(db, req.user.id, "customer.export", req.params.id);
    res.json(result);
  });
  app.post("/api/admin/privacy-requests/:id/anonymize", (req, res) => {
    const { confirmed } = z
      .object({ confirmed: z.literal(true) })
      .strict()
      .parse(req.body);
    res.json(anonymizeRequest(db, req.params.id, req.user.id));
  });
  app.patch("/api/admin/privacy-requests/:id", (req, res) => {
    const { status, note } = z
      .object({
        status: z.enum(["pending", "completed", "declined"]),
        note: z.string().max(2000),
      })
      .strict()
      .parse(req.body);
    const r = db
      .prepare("SELECT * FROM privacy_requests WHERE id=?")
      .get(req.params.id);
    if (!r) fail("Request not found.", 404);
    db.prepare("UPDATE privacy_requests SET data=? WHERE id=?").run(
      JSON.stringify({ ...JSON.parse(r.data), status, note }),
      r.id,
    );
    audit(db, req.user.id, "privacy." + status, r.id);
    res.json({ ok: true });
  });
  app.post(
    "/api/admin/upload",
    express.raw({
      type: ["image/jpeg", "image/png", "image/webp"],
      limit: "5mb",
    }),
    (req, res) => {
      const buffer = req.body;
      if (!Buffer.isBuffer(buffer)) fail("Choose a JPEG, PNG or WebP image.");
      let ext = "";
      if (
        buffer.length > 12 &&
        buffer[0] === 255 &&
        buffer[1] === 216 &&
        buffer[2] === 255
      )
        ext = "jpg";
      else if (
        buffer
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        ext = "png";
      else if (
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
      )
        ext = "webp";
      if (!ext) fail("Image contents are not a supported format.");
      mkdirSync(resolve(uploadDir), { recursive: true });
      const filename = `${id()}.${ext}`;
      writeFileSync(resolve(uploadDir, filename), buffer, { flag: "wx" });
      audit(db, req.user.id, "image.upload", filename);
      res.status(201).json({ url: `/uploads/${filename}` });
    },
  );
  app.get("/api/admin/content/:kind", (req, res) => {
    if (!schemas[req.params.kind]) fail("Unknown resource.", 404);
    res.json(records(db, req.params.kind));
  });
  app.put("/api/admin/content/:kind/:id", (req, res) => {
    const { kind } = req.params,
      key = req.params.id;
    if (!schemas[kind] || !key.match(/^[a-zA-Z0-9_-]{1,100}$/))
      fail("Unknown resource.", 404);
    const envelope = z
        .object({ data: z.unknown(), version: z.number().int().optional() })
        .strict()
        .parse(req.body),
      data = schemas[kind].parse(envelope.data);
    const result = transaction(db, () => {
      if (["products", "categories"].includes(kind)) {
        if (records(db, kind).some((p) => p.slug === data.slug && p.id !== key))
          fail("This URL slug already exists.", 409);
      }
      if (kind === "categories" && data.parentId) {
        let parent = data.parentId,
          seen = new Set([key]);
        while (parent) {
          if (seen.has(parent)) fail("Categories cannot form a cycle.");
          seen.add(parent);
          const c = record(db, "categories", parent);
          if (!c) fail("Parent category does not exist.");
          parent = c.parentId;
        }
      }
      if (kind === "products") {
        if (!record(db, "categories", data.categoryId))
          fail("Choose an existing category.");
        const used = db
          .prepare(
            "SELECT DISTINCT variant_id FROM order_items WHERE product_id=?",
          )
          .all(key);
        if (used.some((v) => !data.variants.some((x) => x.id === v.variant_id)))
          fail(
            "Packages used in orders must be deactivated instead of removed.",
          );
      }
      if (
        kind === "combos" &&
        data.productIds.some((p) => !record(db, "products", p))
      )
        fail("Select existing combo products.");
      if (
        kind === "sections" &&
        (data.productIds.some((p) => !record(db, "products", p)) ||
          data.categoryIds.some((c) => !record(db, "categories", c)))
      )
        fail("Select existing products and categories.");
      if (
        kind === "coupons" &&
        records(db, "coupons").some((c) => c.code === data.code && c.id !== key)
      )
        fail("Coupon code already exists.", 409);
      if (kind === "settings" && key !== "store")
        fail("Use the store settings record.");
      const saved = save(db, kind, key, data, envelope.version);
      audit(db, req.user.id, `${kind}.save`, key);
      return saved;
    });
    res.json(result);
  });
  app.delete("/api/admin/content/:kind/:id", (req, res) => {
    const { kind } = req.params,
      key = req.params.id;
    if (!schemas[kind] || kind === "settings")
      fail("This resource cannot be deleted.");
    const moved = transaction(db, () => {
      const current = record(db, kind, key);
      if (!current) fail("This record no longer exists.", 404);
      if (
        kind === "products" &&
        records(db, "combos").some((c) => c.productIds.includes(key))
      )
        fail("Remove this product from combos first.");
      let moved = 0;
      if (kind === "categories") {
        // Products move to the category chosen by the administrator, and
        // subcategories move up to the deleted category's parent.
        const contents = records(db, "products").filter(
            (p) => p.categoryId === key,
          ),
          moveTo = String(req.query.moveTo || "");
        if (contents.length) {
          if (!moveTo || moveTo === key || !record(db, "categories", moveTo))
            fail(
              `Choose another category for the ${contents.length} product(s) in ${current.name}.`,
            );
          for (const { id: productId, version, ...product } of contents)
            save(db, "products", productId, { ...product, categoryId: moveTo });
          moved = contents.length;
        }
        for (const { id: childId, version, ...child } of records(
          db,
          "categories",
        ).filter((c) => c.parentId === key))
          save(db, "categories", childId, {
            ...child,
            parentId: current.parentId || null,
          });
        db.prepare("DELETE FROM categories WHERE id=?").run(key);
      } else if (kind === "products")
        db.prepare("DELETE FROM products WHERE id=?").run(key);
      else
        db.prepare("DELETE FROM content WHERE kind=? AND id=?").run(kind, key);
      if (["products", "categories"].includes(kind))
        for (const s of records(db, "sections")) {
          s.productIds = s.productIds.filter(
            (v) => kind !== "products" || v !== key,
          );
          s.categoryIds = s.categoryIds.filter(
            (v) => kind !== "categories" || v !== key,
          );
          save(db, "sections", s.id, s);
        }
      audit(db, req.user.id, `${kind}.delete`, key);
      return moved;
    });
    res.json({ ok: true, moved });
  });
  app.use("/api", (_, res) =>
    res.status(404).json({ error: "API endpoint not found." }),
  );
  app.use(
    "/uploads",
    express.static(resolve(uploadDir), {
      dotfiles: "deny",
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Content-Security-Policy", "default-src 'none'");
      },
    }),
  );
  app.use(express.static(resolve(staticDir), { dotfiles: "deny" }));
  app.get("/{*path}", (req, res, next) => {
    let html;
    try {
      html = readFileSync(resolve(staticDir, "index.html"), "utf8");
    } catch (error) {
      return next(error);
    }
    res.type("html").send(renderIndex(db, req.path, html, origin));
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof ZodError)
      return res.status(400).json({
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    if (String(error.message).includes("FOREIGN KEY constraint"))
      return res.status(409).json({
        error:
          "This record is in use. Archive it or remove its references first.",
      });
    if (String(error.message).includes("UNIQUE constraint"))
      return res
        .status(409)
        .json({ error: "A record with these details already exists." });
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    res.status(status).json({
      error: error.message,
    });
  });
  return app;
}

