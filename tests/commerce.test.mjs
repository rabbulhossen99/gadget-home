import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, record, records, save } from "../server/db.mjs";
import { seed } from "../server/seed.mjs";
import { createApp } from "../server/app.mjs";
import { passwordHash } from "../server/auth.mjs";
import { verifyPassword } from "../server/auth.mjs";
const origin = "http://localhost:5173";
async function fixture(t) {
  const db = openDatabase(":memory:");
  seed(db);
  const uploads = mkdtempSync(join(tmpdir(), "commerce-test-"));
  db.prepare(
    "INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)",
  ).run(
    "admin",
    "admin@example.test",
    "Store admin",
    await passwordHash("very-long-test-password"),
    "admin",
  );
  const server = createApp(db, { limits: false, uploadDir: uploads }).listen(
    0,
    "127.0.0.1",
  );
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    db.close();
    rmSync(uploads, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function client() {
    let cookie = "",
      csrf = "";
    const call = async (path, method = "GET", body, headers = {}) => {
      const r = await fetch(base + path, {
        method,
        headers: {
          cookie,
          origin,
          "X-CSRF-Token": csrf,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      const data = await r.json();
      if (data.csrf) csrf = data.csrf;
      return { status: r.status, data };
    };
    await call("/session");
    return {
      call,
      get cookie() {
        return cookie;
      },
      get csrf() {
        return csrf;
      },
    };
  }
  const guest = await client(),
    admin = await client();
  assert.equal(
    (
      await admin.call("/auth/login", "POST", {
        email: "admin@example.test",
        password: "very-long-test-password",
      })
    ).status,
    200,
  );
  return { db, guest, admin, client, base };
}
const items = [
  { type: "product", productId: "vitaboost", variantId: "double", quantity: 1 },
];
async function checkout(client, overrides = {}) {
  const input = { items, area: "inside", coupon: "", ...overrides };
  const q = await client.call("/quote", "POST", {
    items: input.items,
    area: input.area,
    coupon: input.coupon,
  });
  return client.call("/orders", "POST", {
    name: "Test Customer",
    phone: "01712345678",
    email: "",
    address: "House 12, Road 3, Dhaka",
    note: "",
    paymentMethod: "cod",
    paymentReference: "",
    idempotencyKey: randomUUID(),
    expectedTotal: q.data.total,
    ...input,
  });
}
test("seed is idempotent and catalog exposes dynamic data without targeting", async (t) => {
  const { db, guest } = await fixture(t);
  seed(db);
  const { data, status } = await guest.call("/catalog");
  assert.equal(status, 200);
  assert.equal(data.products.length, 4);
  assert.equal(data.products[0].targeting, undefined);
  assert.equal(data.settings.currency, "BDT");
});
test("admin APIs reject guests; mutations require CSRF and trusted origin", async (t) => {
  const { guest, admin } = await fixture(t);
  assert.equal((await guest.call("/admin/overview")).status, 403);
  assert.equal(
    (await guest.call("/cart", "PUT", items, { "X-CSRF-Token": "invalid" }))
      .status,
    403,
  );
  assert.equal(
    (
      await admin.call("/cart", "PUT", items, {
        origin: "https://evil.example",
      })
    ).status,
    403,
  );
});
test("product and banner edits immediately appear in the catalog", async (t) => {
  const { admin, guest } = await fixture(t);
  const products = (await admin.call("/admin/content/products")).data;
  const { id, version, ...p } = products.find((p) => p.id === "vitaboost");
  p.name = "Updated Vitamin";
  p.variants[0].price = 12300;
  assert.equal(
    (
      await admin.call("/admin/content/products/" + id, "PUT", {
        version,
        data: p,
      })
    ).status,
    200,
  );
  let catalog = (await guest.call("/catalog")).data;
  assert.equal(
    catalog.products.find((p) => p.id === id).name,
    "Updated Vitamin",
  );
  assert.equal(
    catalog.products.find((p) => p.id === id).variants[0].price,
    12300,
  );
  const {
    id: sid,
    version: sv,
    ...section
  } = (await admin.call("/admin/content/sections")).data[0];
  section.title = "New promotion";
  assert.equal(
    (
      await admin.call("/admin/content/sections/" + sid, "PUT", {
        version: sv,
        data: section,
      })
    ).status,
    200,
  );
  catalog = (await guest.call("/catalog")).data;
  assert.equal(
    catalog.sections.find((s) => s.id === sid).title,
    "New promotion",
  );
});
test("stale product writes cannot overwrite checkout stock changes", async (t) => {
  const { admin, guest } = await fixture(t);
  const { id, version, ...p } = (
    await admin.call("/admin/content/products")
  ).data.find((p) => p.id === "vitaboost");
  assert.equal((await checkout(guest)).status, 201);
  assert.equal(
    (
      await admin.call("/admin/content/products/" + id, "PUT", {
        data: p,
        version,
      })
    ).status,
    409,
  );
});
test("cart persists per session and no client-supplied price is accepted", async (t) => {
  const { guest, client } = await fixture(t);
  assert.equal((await guest.call("/cart", "PUT", items)).status, 200);
  assert.deepEqual((await guest.call("/cart")).data, items);
  assert.deepEqual((await (await client()).call("/cart")).data, []);
  assert.equal(
    (
      await guest.call("/quote", "POST", {
        items: [{ ...items[0], price: 1 }],
        area: "inside",
        coupon: "",
      })
    ).status,
    400,
  );
  assert.equal((await checkout(guest, { expectedTotal: 1 })).status, 409);
  assert.equal((await guest.call("/orders")).data.length, 0);
});
test("order writes are atomic and duplicate submission is idempotent", async (t) => {
  const { db, guest, admin } = await fixture(t),
    key = randomUUID();
  await guest.call("/cart", "PUT", items);
  const first = await checkout(guest, { idempotencyKey: key });
  assert.equal(first.status, 201);
  assert.equal(first.data.total, 66000);
  const second = await checkout(guest, { idempotencyKey: key });
  assert.equal(second.data.id, first.data.id);
  assert.equal(
    record(db, "products", "vitaboost").variants.find((v) => v.id === "double")
      .stock,
    29,
  );
  assert.equal((await admin.call("/admin/orders")).data.length, 1);
  assert.deepEqual((await guest.call("/cart")).data, []);
});
test("simultaneous buyers cannot oversell final inventory", async (t) => {
  const { db, client } = await fixture(t);
  const p = record(db, "products", "vitaboost");
  p.variants.find((v) => v.id === "double").stock = 1;
  save(db, "products", p.id, p);
  const a = await client(),
    b = await client();
  const orders = await Promise.all([checkout(a), checkout(b)]);
  assert.deepEqual(orders.map((o) => o.status).sort(), [201, 409]);
  assert.equal(
    record(db, "products", "vitaboost").variants.find((v) => v.id === "double")
      .stock,
    0,
  );
});
test("duplicate cart lines cannot bypass aggregate stock checking", async (t) => {
  const { db, guest } = await fixture(t);
  const p = record(db, "products", "vitaboost");
  p.variants.find((v) => v.id === "double").stock = 1;
  save(db, "products", p.id, p);
  assert.equal(
    (
      await guest.call("/quote", "POST", {
        items: [...items, ...items],
        area: "inside",
        coupon: "",
      })
    ).status,
    409,
  );
});
test("private orders require session ownership or a correct tracking secret", async (t) => {
  const { guest, client } = await fixture(t),
    other = await client();
  const order = (await checkout(guest)).data;
  assert.equal((await other.call("/orders/" + order.id)).status, 404);
  assert.equal(
    (
      await other.call("/track", "POST", {
        number: order.number,
        token: "a".repeat(64),
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await other.call("/track", "POST", {
        number: order.number,
        token: order.trackingToken,
      })
    ).data.id,
    order.id,
  );
});
test("cancellation restores stock once and rejects stale updates", async (t) => {
  const { db, guest, admin } = await fixture(t);
  const order = (await checkout(guest)).data;
  const update = {
    status: "cancelled",
    paymentStatus: "unpaid",
    carrier: "",
    trackingNumber: "",
    shippingNote: "",
    expectedVersion: 1,
  };
  const result = await admin.call("/admin/orders/" + order.id, "PATCH", update);
  assert.equal(result.status, 200);
  assert.equal(
    record(db, "products", "vitaboost").variants.find((v) => v.id === "double")
      .stock,
    30,
  );
  assert.equal(
    (await admin.call("/admin/orders/" + order.id, "PATCH", update)).status,
    409,
  );
  assert.equal(
    (
      await admin.call("/admin/orders/" + order.id, "PATCH", {
        ...update,
        expectedVersion: 2,
      })
    ).status,
    200,
  );
  assert.equal(
    record(db, "products", "vitaboost").variants.find((v) => v.id === "double")
      .stock,
    30,
  );
});
test("order transitions require valid lifecycle and shipping details", async (t) => {
  const { guest, admin } = await fixture(t);
  let order = (await checkout(guest)).data;
  const patch = async (status, extra = {}) =>
    admin.call("/admin/orders/" + order.id, "PATCH", {
      status,
      paymentStatus: "unpaid",
      carrier: "",
      trackingNumber: "",
      shippingNote: "",
      expectedVersion: order.version,
      ...extra,
    });
  assert.equal((await patch("delivered")).status, 400);
  order = (await patch("confirmed")).data;
  order = (await patch("processing")).data;
  assert.equal((await patch("shipped")).status, 400);
  order = (
    await patch("shipped", {
      carrier: "Local courier",
      trackingNumber: "TRACK-1",
    })
  ).data;
  order = (
    await patch("delivered", {
      carrier: "Local courier",
      trackingNumber: "TRACK-1",
      paymentStatus: "paid",
    })
  ).data;
  assert.equal(order.status, "delivered");
  assert.equal(order.events.length, 5);
});
test("coupons enforce limits, shipping rules, and release use after cancellation", async (t) => {
  const { db, guest, admin, client } = await fixture(t);
  const coupon = record(db, "coupons", "save10");
  coupon.limit = 1;
  save(db, "coupons", coupon.id, coupon);
  const first = await checkout(guest, { coupon: "SAVE10" });
  assert.equal(first.data.total, 60000);
  const other = await client();
  assert.equal(
    (
      await other.call("/quote", "POST", {
        items,
        area: "inside",
        coupon: "SAVE10",
      })
    ).status,
    400,
  );
  await admin.call("/admin/orders/" + first.data.id, "PATCH", {
    status: "cancelled",
    paymentStatus: "unpaid",
    carrier: "",
    trackingNumber: "",
    shippingNote: "",
    expectedVersion: 1,
  });
  assert.equal(
    (
      await other.call("/quote", "POST", {
        items,
        area: "inside",
        coupon: "SAVE10",
      })
    ).status,
    200,
  );
});
test("combo pricing uses admin tiers and decrements each component stock", async (t) => {
  const { db, guest } = await fixture(t);
  const combo = [
    {
      type: "combo",
      comboId: "wellness",
      productIds: ["herbal-tea", "baby-lotion"],
      quantity: 2,
    },
  ];
  const result = await checkout(guest, { items: combo });
  assert.equal(result.status, 201);
  assert.equal(result.data.total, 166000);
  assert.equal(record(db, "products", "baby-lotion").variants[0].stock, 48);
  assert.equal(
    (
      await guest.call("/quote", "POST", {
        items: [{ ...combo[0], productIds: ["baby-lotion", "baby-lotion"] }],
        area: "inside",
        coupon: "",
      })
    ).status,
    409,
  );
});
test("inactive parent categories hide descendants and prevent checkout", async (t) => {
  const { db, guest, admin } = await fixture(t);
  save(db, "categories", "child", {
    name: "Child",
    slug: "child",
    parentId: "medicine",
    image: "",
    homepage: true,
    active: true,
    position: 1,
  });
  const p = record(db, "products", "vitaboost");
  p.categoryId = "child";
  save(db, "products", p.id, p);
  const { id, version, ...c } = record(db, "categories", "medicine");
  c.active = false;
  await admin.call("/admin/content/categories/" + id, "PUT", {
    data: c,
    version,
  });
  assert.ok(
    !(await guest.call("/catalog")).data.products.some(
      (p) => p.id === "vitaboost",
    ),
  );
  assert.equal(
    (await guest.call("/quote", "POST", { items, area: "inside", coupon: "" }))
      .status,
    409,
  );
});
test("category cycles and removing ordered variants are rejected", async (t) => {
  const { guest, admin } = await fixture(t);
  const { id, version, ...category } = (
    await admin.call("/admin/content/categories")
  ).data[0];
  assert.equal(
    (
      await admin.call("/admin/content/categories/" + id, "PUT", {
        data: { ...category, parentId: id },
        version,
      })
    ).status,
    400,
  );
  await checkout(guest);
  const {
    id: pid,
    version: pv,
    ...product
  } = (await admin.call("/admin/content/products")).data.find(
    (p) => p.id === "vitaboost",
  );
  product.variants = product.variants.filter((v) => v.id !== "double");
  assert.equal(
    (
      await admin.call("/admin/content/products/" + pid, "PUT", {
        data: product,
        version: pv,
      })
    ).status,
    400,
  );
});
test("valid checkout numbers save automatically and become converted after purchase", async (t) => {
  const { guest, admin } = await fixture(t);
  const draft = {
    name: "Customer",
    phone: "01712345678",
    email: "",
    address: "Dhaka Bangladesh",
    items,
  };
  assert.equal(
    (await guest.call("/checkout-draft", "PUT", { ...draft, phone: "01712" }))
      .status,
    400,
  );
  assert.equal((await guest.call("/checkout-draft", "PUT", draft)).status, 200);
  assert.equal((await admin.call("/admin/overview")).data.incomplete.length, 1);
  await checkout(guest);
  assert.equal((await admin.call("/admin/overview")).data.incomplete.length, 0);
});

test("local and +88 phone formats save one incomplete checkout without name or address", async (t) => {
  const { guest, admin } = await fixture(t);
  for (const phone of ["01244334242", "+88 01308336353", "+8801308336353"]) {
    assert.equal(
      (await guest.call("/checkout-draft", "PUT", { phone, items })).status,
      200,
    );
    const drafts = (await admin.call("/admin/overview")).data.incomplete;
    assert.equal(drafts.length, 1);
    assert.equal(
      drafts[0].phone,
      phone === "01244334242" ? phone : "01308336353",
    );
    assert.equal(drafts[0].name, "");
  }
  for (const phone of [
    "",
    "0124433424",
    "012443342422",
    "02244334242",
    "8801308336353",
    "+99 01308336353",
    "+88 0130833635",
    "01abcdefgh9",
  ]) {
    assert.equal(
      (await guest.call("/checkout-draft", "PUT", { phone, items })).status,
      400,
      phone,
    );
    assert.equal((await checkout(guest, { phone })).status, 400, phone);
  }
});

test("international-format order normalizes phone and delayed draft stays converted", async (t) => {
  const { guest, admin } = await fixture(t),
    key = randomUUID();
  const draft = { phone: "+88 01308336353", items, checkoutKey: key };
  await guest.call("/checkout-draft", "PUT", draft);
  const order = await checkout(guest, {
    phone: draft.phone,
    idempotencyKey: key,
  });
  assert.equal(order.status, 201);
  assert.equal(order.data.phone, "01308336353");
  assert.equal(order.data.consentedAt, undefined);
  assert.equal(
    (await guest.call("/checkout-draft", "PUT", draft)).data.status,
    "converted",
  );
  assert.equal((await admin.call("/admin/overview")).data.incomplete.length, 0);
});
test("registration rotates sessions, preserves cart, and cannot elevate roles", async (t) => {
  const { guest } = await fixture(t);
  await guest.call("/cart", "PUT", items);
  const old = guest.cookie;
  assert.equal(
    (
      await guest.call("/auth/register", "POST", {
        name: "New Customer",
        email: "new@example.test",
        password: "long-customer-password",
        role: "admin",
      })
    ).status,
    400,
  );
  const result = await guest.call("/auth/register", "POST", {
    name: "New Customer",
    email: "new@example.test",
    password: "long-customer-password",
  });
  assert.equal(result.status, 201);
  assert.notEqual(guest.cookie, old);
  assert.equal(result.data.user.role, "customer");
  assert.deepEqual((await guest.call("/cart")).data, items);
  assert.equal((await guest.call("/admin/overview")).status, 403);
});
test("manual payments remain pending verification and require a reference", async (t) => {
  const { db, guest } = await fixture(t);
  const config = record(db, "settings", "store");
  config.manualEnabled = true;
  save(db, "settings", "store", config);
  assert.equal(
    (await checkout(guest, { paymentMethod: "manual" })).status,
    400,
  );
  const order = await checkout(guest, {
    paymentMethod: "manual",
    paymentReference: "TXN-1234",
  });
  assert.equal(order.data.paymentStatus, "pending_verification");
});
test("image uploads reject SVG and accept supported signatures", async (t) => {
  const { base, admin, guest } = await fixture(t);
  const upload = async (c, type, body) =>
    fetch(base + "/admin/upload", {
      method: "POST",
      headers: {
        cookie: c.cookie,
        origin,
        "X-CSRF-Token": c.csrf,
        "Content-Type": type,
      },
      body,
    });
  assert.equal(
    (await upload(guest, "image/png", Buffer.from("fake"))).status,
    403,
  );
  assert.equal(
    (await upload(admin, "image/svg+xml", '<svg onload="alert(1)"/>')).status,
    400,
  );
  assert.equal(
    (await upload(admin, "image/png", Buffer.from("fake"))).status,
    400,
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
    "base64",
  );
  assert.equal((await upload(admin, "image/png", png)).status, 201);
});

test("unavailable cart items can be removed without trapping the cart", async (t) => {
  const { db, guest } = await fixture(t);
  const multiple = [
    ...items,
    {
      type: "product",
      productId: "baby-lotion",
      variantId: "standard",
      quantity: 1,
    },
  ];
  await guest.call("/cart", "PUT", multiple);
  for (const key of ["vitaboost", "baby-lotion"]) {
    const p = record(db, "products", key);
    p.status = "archived";
    save(db, "products", key, p);
  }
  assert.equal((await guest.call("/cart", "PUT", [multiple[1]])).status, 200);
  assert.equal(
    (
      await guest.call("/quote", "POST", {
        items: [multiple[1]],
        area: "inside",
        coupon: "",
      })
    ).status,
    409,
  );
  assert.equal((await guest.call("/cart", "PUT", [])).status, 200);
});

test("delivered customer reviews require moderation before publication", async (t) => {
  const { guest, admin } = await fixture(t);
  await guest.call("/auth/register", "POST", {
    name: "Reviewer",
    email: "reviewer@example.test",
    password: "long-reviewer-password",
  });
  assert.equal(
    (
      await guest.call("/products/vitaboost/reviews", "POST", {
        rating: 5,
        comment: "Good test product",
      })
    ).status,
    403,
  );
  let order = (await checkout(guest)).data;
  for (const status of ["confirmed", "processing", "shipped", "delivered"])
    order = (
      await admin.call("/admin/orders/" + order.id, "PATCH", {
        status,
        paymentStatus: "paid",
        carrier: "Test courier",
        trackingNumber: "SHIP-001",
        shippingNote: "",
        expectedVersion: order.version,
      })
    ).data;
  assert.equal(
    (
      await guest.call("/products/vitaboost/reviews", "POST", {
        rating: 5,
        comment: "Good test product",
      })
    ).status,
    200,
  );
  assert.equal(
    (await guest.call("/products/vitaboost/reviews")).data.length,
    0,
  );
  const review = (await admin.call("/admin/reviews")).data[0];
  assert.equal(
    (
      await admin.call("/admin/reviews/" + review.id, "PATCH", {
        approved: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (await guest.call("/products/vitaboost/reviews")).data.length,
    1,
  );
});

test("customer anonymization blocks active orders and revokes sessions and tracking", async (t) => {
  const { db, guest, admin, client } = await fixture(t);
  const user = (
    await guest.call("/auth/register", "POST", {
      name: "Privacy Customer",
      email: "privacy@example.test",
      password: "long-privacy-password",
    })
  ).data.user;
  const order = (await checkout(guest)).data;
  await guest.call("/privacy-requests", "POST", { type: "deletion" });
  const request = (await admin.call("/admin/privacy-requests")).data[0];
  assert.equal(
    (
      await admin.call(
        "/privacy-requests/" + request.id + "/anonymize",
        "POST",
        { confirmed: true },
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await admin.call(
        "/admin/privacy-requests/" + request.id + "/anonymize",
        "POST",
        { confirmed: true },
      )
    ).status,
    409,
  );
  await admin.call("/admin/orders/" + order.id, "PATCH", {
    status: "cancelled",
    paymentStatus: "unpaid",
    carrier: "",
    trackingNumber: "",
    shippingNote: "",
    expectedVersion: 1,
  });
  assert.equal(
    (
      await admin.call(
        "/admin/privacy-requests/" + request.id + "/anonymize",
        "POST",
        { confirmed: true },
      )
    ).status,
    200,
  );
  assert.equal((await guest.call("/orders")).status, 401);
  const redacted = JSON.parse(
    db.prepare("SELECT data FROM orders WHERE id=?").get(order.id).data,
  );
  assert.equal(redacted.phone, "");
  assert.equal(redacted.name, "Deleted customer");
  const other = await client();
  assert.equal(
    (
      await other.call("/track", "POST", {
        number: order.number,
        token: order.trackingToken,
      })
    ).status,
    404,
  );
  assert.equal(
    await verifyPassword(
      "anything",
      db.prepare("SELECT password FROM users WHERE id=?").get(user.id).password,
    ),
    false,
  );
});

test("administrator can correct delivery details before shipment only", async (t) => {
  const { guest, admin } = await fixture(t);
  let order = (await checkout(guest)).data;
  const patch = (status, extra = {}) =>
    admin.call("/admin/orders/" + order.id, "PATCH", {
      status,
      paymentStatus: "unpaid",
      carrier: "Test courier",
      trackingNumber: "SHIP-1",
      shippingNote: "",
      expectedVersion: order.version,
      ...extra,
    });
  order = (
    await patch("confirmed", { address: "Corrected address, Road 22, Dhaka" })
  ).data;
  assert.equal(
    (await guest.call("/orders/" + order.id)).data.address,
    "Corrected address, Road 22, Dhaka",
  );
  order = (await patch("processing")).data;
  order = (await patch("shipped")).data;
  assert.equal(
    (await patch("shipped", { address: "Changed address, Road 33, Dhaka" }))
      .status,
    400,
  );
});

test("SQL data and consistent backup survive database reopening", async (t) => {
  const folder = mkdtempSync(join(tmpdir(), "commerce-persistence-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const filename = join(folder, "store.sqlite"),
    backup = join(folder, "backup.sqlite");
  let db = openDatabase(filename);
  seed(db);
  const product = record(db, "products", "vitaboost");
  product.name = "Persisted name";
  save(db, "products", product.id, product);
  db.prepare("VACUUM INTO ?").run(backup);
  db.close();
  db = openDatabase(filename);
  assert.equal(record(db, "products", "vitaboost").name, "Persisted name");
  db.close();
  db = openDatabase(backup);
  assert.equal(record(db, "products", "vitaboost").name, "Persisted name");
  db.close();
});

test("free-delivery products remove shipping and canceled orders can return to pending", async (t) => {
  const { db, guest, admin } = await fixture(t);
  const product = record(db, "products", "vitaboost");
  product.freeDelivery = true;
  save(db, "products", product.id, product);
  const quoteResult = (
    await guest.call("/quote", "POST", { items, area: "outside", coupon: "" })
  ).data;
  assert.equal(quoteResult.shipping, 0);
  let order = (await checkout(guest, { area: "outside" })).data;
  const cancel = await admin.call("/admin/orders/" + order.id, "PATCH", {
    status: "cancelled",
    paymentStatus: "unpaid",
    carrier: "",
    trackingNumber: "",
    shippingNote: "",
    expectedVersion: order.version,
  });
  assert.equal(cancel.status, 200);
  assert.equal(
    record(db, "products", "vitaboost").variants.find((v) => v.id === "double")
      .stock,
    30,
  );
  order = cancel.data;
  const restored = await admin.call("/admin/orders/" + order.id, "PATCH", {
    status: "pending",
    paymentStatus: "unpaid",
    carrier: "",
    trackingNumber: "",
    shippingNote: "",
    expectedVersion: order.version,
  });
  assert.equal(restored.status, 200);
  assert.equal(
    record(db, "products", "vitaboost").variants.find((v) => v.id === "double")
      .stock,
    29,
  );
  assert.equal(
    (
      await admin.call("/admin/orders/" + order.id, "PATCH", {
        status: "pending",
        paymentStatus: "unpaid",
        carrier: "",
        trackingNumber: "",
        shippingNote: "",
        expectedVersion: restored.data.version,
      })
    ).status,
    200,
  );
  assert.equal(
    record(db, "products", "vitaboost").variants.find((v) => v.id === "double")
      .stock,
    29,
  );
});

test("free delivery toggles persist and apply only to eligible products including combos", async (t) => {
  const { db, guest, admin } = await fixture(t);
  const settings = record(db, "settings", "store");
  settings.freeShippingThreshold = null;
  save(db, "settings", "store", settings);
  async function toggle(key, enabled) {
    const { id, version, ...data } = record(db, "products", key);
    const result = await admin.call("/admin/content/products/" + id, "PUT", {
      version,
      data: { ...data, freeDelivery: enabled },
    });
    assert.equal(result.status, 200);
  }
  const getQuote = async (lines, area = "outside") =>
    (await guest.call("/quote", "POST", { items: lines, area, coupon: "" }))
      .data;
  await toggle("vitaboost", true);
  let q = await getQuote(items);
  assert.equal(q.shipping, 0);
  assert.equal(q.freeDelivery, true);
  assert.equal(q.total, q.subtotal);
  const mixed = [
    ...items,
    {
      type: "product",
      productId: "baby-lotion",
      variantId: "standard",
      quantity: 1,
    },
  ];
  q = await getQuote(mixed);
  assert.equal(q.shipping, 12000);
  assert.equal(q.freeDelivery, false);
  await toggle("vitaboost", false);
  q = await getQuote(items, "inside");
  assert.equal(q.shipping, 6000);
  assert.equal(q.freeDelivery, false);
  const combo = [
    {
      type: "combo",
      comboId: "wellness",
      productIds: ["vitaboost", "baby-lotion"],
      quantity: 1,
    },
  ];
  await toggle("vitaboost", true);
  await toggle("baby-lotion", true);
  q = await getQuote(combo);
  assert.equal(q.shipping, 0);
  assert.equal(q.freeDelivery, true);
  await toggle("baby-lotion", false);
  q = await getQuote(combo);
  assert.equal(q.shipping, 12000);
  assert.equal(q.freeDelivery, false);
});

test("admin can remove an incomplete checkout", async (t) => {
  const { guest, admin } = await fixture(t);
  assert.equal(
    (
      await guest.call("/checkout-draft", "PUT", {
        phone: "01712345678",
        items,
      })
    ).status,
    200,
  );
  const id = (await admin.call("/admin/overview")).data.incomplete[0].id;
  assert.equal(
    (await admin.call("/admin/incomplete/" + id, "DELETE")).status,
    200,
  );
  assert.equal((await admin.call("/admin/overview")).data.incomplete.length, 0);
  assert.equal(
    (await admin.call("/admin/incomplete/" + id, "DELETE")).status,
    404,
  );
});
test("deleting a category moves its products and promotes subcategories", async (t) => {
  const { db, admin, guest } = await fixture(t);
  const del = (id, moveTo) =>
    admin.call(
      `/admin/content/categories/${id}${moveTo ? `?moveTo=${moveTo}` : ""}`,
      "DELETE",
    );
  // An empty category is deleted directly.
  assert.deepEqual((await del("health-care")).data, { ok: true, moved: 0 });
  assert.equal(record(db, "categories", "health-care"), null);
  // A subcategory of medicine moves up when medicine is deleted.
  const herbal = record(db, "categories", "herbal");
  save(db, "categories", "herbal", { ...herbal, id: undefined, version: undefined, parentId: "medicine" });
  const section = records(db, "sections")[0];
  save(db, "sections", section.id, { ...section, categoryIds: ["medicine", "baby-care"] });
  // Categories with products need a destination.
  const blocked = await del("medicine");
  assert.equal(blocked.status, 400);
  assert.match(blocked.data.error, /Choose another category for the 1 product/);
  assert.equal((await del("medicine", "medicine")).status, 400);
  assert.equal((await del("medicine", "missing")).status, 400);
  assert.ok(record(db, "categories", "medicine"));
  const deleted = await del("medicine", "baby-care");
  assert.deepEqual(deleted.data, { ok: true, moved: 1 });
  assert.equal(record(db, "categories", "medicine"), null);
  assert.equal(record(db, "products", "vitaboost").categoryId, "baby-care");
  assert.equal(
    db.prepare("SELECT category_id FROM products WHERE id='vitaboost'").get().category_id,
    "baby-care",
  );
  assert.equal(record(db, "categories", "herbal").parentId, null);
  assert.deepEqual(record(db, "sections", section.id).categoryIds, ["baby-care"]);
  // The moved product stays visible and purchasable.
  const catalog = (await guest.call("/catalog")).data;
  assert.equal(catalog.products.find((p) => p.id === "vitaboost").categoryId, "baby-care");
  assert.equal((await checkout(guest)).status, 201);
  assert.equal((await del("medicine")).status, 404);
});
test("product deletion removes unordered products and protects ordered ones", async (t) => {
  const { db, admin, guest } = await fixture(t);
  for (const combo of records(db, "combos"))
    save(db, "combos", combo.id, { ...combo, productIds: [] });
  assert.equal((await admin.call("/admin/content/products/hand-sanitizer", "DELETE")).status, 200);
  assert.equal(record(db, "products", "hand-sanitizer"), null);
  await checkout(guest);
  assert.equal((await admin.call("/admin/content/products/vitaboost", "DELETE")).status, 409);
  assert.ok(record(db, "products", "vitaboost"));
});
test("category links cleared by the old delete are restored on startup", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "commerce-links-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "store.sqlite");
  let db = openDatabase(file);
  seed(db);
  db.exec("UPDATE products SET category_id=NULL WHERE id='vitaboost'");
  db.close();
  db = openDatabase(file);
  assert.equal(
    db.prepare("SELECT category_id FROM products WHERE id='vitaboost'").get().category_id,
    "medicine",
  );
  db.close();
});
