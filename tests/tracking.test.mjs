import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, record, records, save } from "../server/db.mjs";
import { seed } from "../server/seed.mjs";
import { createApp } from "../server/app.mjs";
import { passwordHash } from "../server/auth.mjs";

process.env.TRACKING_ENCRYPTION_KEY = "ab".repeat(32);
const origin = "http://localhost:5173";
const sha256 = (v) => createHash("sha256").update(v).digest("hex");

async function fixture(t, reply = () => ({ events_received: 1, fbtrace_id: "trace" })) {
  const db = openDatabase(":memory:");
  seed(db);
  db.prepare(
    "INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)",
  ).run(
    "admin",
    "admin@example.test",
    "Store admin",
    await passwordHash("very-long-test-password"),
    "admin",
  );
  const dir = mkdtempSync(join(tmpdir(), "tracking-test-"));
  writeFileSync(
    join(dir, "index.html"),
    '<html><head><meta name="description" content="Default" /><title>GadgetHome</title></head><body></body></html>',
  );
  const meta = [];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    meta.push({ url, body });
    const result = reply(body);
    return new Response(JSON.stringify(result), {
      status: result.error ? 400 : 200,
    });
  };
  const server = createApp(db, {
    limits: false,
    uploadDir: dir,
    staticDir: dir,
    trackingFetch: fetch,
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const root = `http://127.0.0.1:${server.address().port}`;
  async function client() {
    let cookie = "",
      csrf = "";
    const call = async (path, method = "GET", body) => {
      const r = await fetch_(root + "/api" + path, {
        method,
        headers: {
          cookie,
          origin,
          "user-agent": "TrackingTest/1.0",
          "X-CSRF-Token": csrf,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
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
      setCookie: (extra) => (cookie = `${cookie}; ${extra}`),
    };
  }
  const guest = await client(),
    admin = await client();
  await admin.call("/auth/login", "POST", {
    email: "admin@example.test",
    password: "very-long-test-password",
  });
  return { db, guest, admin, meta, root };
}
const fetch_ = globalThis.fetch;
async function until(check) {
  for (let i = 0; i < 100 && !check(); i++)
    await new Promise((r) => setTimeout(r, 10));
  assert.ok(check(), "condition was not met in time");
}
const configure = (admin, extra = {}) =>
  admin.call("/admin/tracking", "PUT", {
    pixelId: "123456789012345",
    accessToken: "EAAB-test-token",
    ...extra,
  });
async function order(client, extra = {}) {
  const items = extra.items || [
    { type: "product", productId: "vitaboost", variantId: "double", quantity: 2 },
  ];
  const q = await client.call("/quote", "POST", { items, area: "inside", coupon: "" });
  return client.call("/orders", "POST", {
    items,
    area: "inside",
    coupon: "",
    name: "Rahim Uddin",
    phone: "01712345678",
    email: "Rahim@Example.com",
    address: "House 12, Road 3, Dhaka",
    note: "",
    paymentMethod: "cod",
    paymentReference: "",
    idempotencyKey: randomUUID(),
    expectedTotal: q.data.total,
    ...extra,
  });
}

test("admin can save the settings it loaded and the token is never returned", async (t) => {
  const { admin, guest } = await fixture(t);
  const loaded = (await admin.call("/admin/tracking")).data;
  assert.equal(loaded.status.browserPixel, false);
  // The form echoes back `configured`; this previously failed strict validation.
  const saved = await admin.call("/admin/tracking", "PUT", {
    ...loaded.settings,
    pixelId: "123456789012345",
    accessToken: "EAAB-secret",
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.settings.accessToken, "");
  assert.equal(saved.data.settings.configured, true);
  assert.deepEqual(saved.data.status, {
    browserPixel: true,
    serverCapi: true,
    graphVersion: "v26.0",
  });
  // A blank token keeps the saved one; clearAccessToken removes it.
  const kept = await admin.call("/admin/tracking", "PUT", { ...saved.data.settings });
  assert.equal(kept.data.settings.configured, true);
  const cleared = await admin.call("/admin/tracking", "PUT", { clearAccessToken: true });
  assert.equal(cleared.data.settings.configured, false);
  assert.equal(cleared.data.status.serverCapi, false);
  assert.equal(
    (await admin.call("/admin/tracking", "PUT", { pixelId: "pixel-abc" })).status,
    400,
  );
  assert.equal((await guest.call("/admin/tracking")).status, 403);
});

test("public config exposes only the pixel settings", async (t) => {
  const { admin, guest } = await fixture(t);
  assert.deepEqual((await guest.call("/tracking/config")).data, { pixelId: "" });
  await configure(admin, { advancedMatching: true });
  const config = (await guest.call("/tracking/config")).data;
  assert.deepEqual(config, {
    pixelId: "123456789012345",
    cookieConsent: true,
    advancedMatching: true,
    dynamicProducts: true,
    serverSide: true,
  });
  assert.ok(!JSON.stringify(config).includes("EAAB"));
});

test("browser events are mirrored to the Conversions API with the same event ID", async (t) => {
  const { admin, guest, meta } = await fixture(t);
  const event = {
    eventName: "AddToCart",
    eventId: "addtocart_" + randomUUID(),
    sourceUrl: "http://localhost:5173/product/vitaboost",
    customData: {
      value: 600,
      currency: "BDT",
      content_ids: ["vitaboost"],
      content_type: "product",
      contents: [{ id: "vitaboost", quantity: 1, item_price: 600 }],
    },
  };
  assert.deepEqual((await guest.call("/tracking/events", "POST", event)).data, {
    queued: false,
  });
  await configure(admin);
  guest.setCookie("_fbp=fb.1.1700000000000.123456789");
  assert.equal((await guest.call("/tracking/events", "POST", event)).status, 202);
  await until(() => meta.length === 1);
  const { url, body } = meta[0];
  assert.equal(url, "https://graph.facebook.com/v26.0/123456789012345/events");
  assert.equal(body.access_token, "EAAB-test-token");
  const sent = body.data[0];
  assert.equal(sent.event_id, event.eventId);
  assert.equal(sent.event_name, "AddToCart");
  assert.equal(sent.action_source, "website");
  assert.equal(sent.event_source_url, event.sourceUrl);
  assert.deepEqual(sent.custom_data, event.customData);
  assert.equal(sent.user_data.client_ip_address, "127.0.0.1");
  assert.equal(sent.user_data.client_user_agent, "TrackingTest/1.0");
  assert.equal(sent.user_data.fbp, "fb.1.1700000000000.123456789");
  assert.equal(sent.user_data.em, undefined);
  // Purchases can only come from the server.
  assert.equal(
    (await guest.call("/tracking/events", "POST", { ...event, eventName: "Purchase" })).status,
    400,
  );
  const log = (await admin.call("/admin/tracking")).data.events;
  assert.equal(log[0].status, "delivered");
  assert.equal(log[0].event_id, event.eventId);
});

test("purchases are sent from the stored order once, with consent and hashed matching", async (t) => {
  const { admin, guest, meta } = await fixture(t);
  await configure(admin, { advancedMatching: true, testCode: "TEST123" });
  // No consent: nothing is sent while cookie consent is required.
  assert.equal((await order(guest)).status, 201);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(meta.length, 0);
  const key = randomUUID(),
    placed = await order(guest, { idempotencyKey: key, tracking: { consent: true } });
  assert.equal(placed.status, 201);
  await until(() => meta.length === 1);
  const { body } = meta[0],
    sent = body.data[0];
  assert.equal(body.test_event_code, "TEST123");
  assert.equal(sent.event_name, "Purchase");
  assert.equal(sent.event_id, `purchase_${placed.data.id}`);
  assert.equal(sent.custom_data.value, placed.data.total / 100);
  assert.equal(sent.custom_data.order_id, placed.data.number);
  assert.deepEqual(sent.custom_data.contents, [
    { id: "vitaboost", quantity: 2, item_price: 600 },
  ]);
  assert.deepEqual(sent.user_data.ph, [sha256("8801712345678")]);
  assert.deepEqual(sent.user_data.em, [sha256("rahim@example.com")]);
  assert.deepEqual(sent.user_data.fn, [sha256("rahim")]);
  assert.deepEqual(sent.user_data.ln, [sha256("uddin")]);
  // Resubmitting the same checkout does not report the purchase again.
  await order(guest, { idempotencyKey: key, tracking: { consent: true } });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(meta.length, 1);
  // Without the consent requirement, purchases are always reported.
  await configure(admin, { cookieConsent: false, advancedMatching: false });
  await order(guest);
  await until(() => meta.length === 2);
  assert.equal(meta[1].body.data[0].user_data.ph, undefined);
});

test("diagnostic test reports Meta errors and records them", async (t) => {
  const { admin, meta } = await fixture(t, () => ({
    error: { code: 190, message: "Invalid OAuth access token." },
  }));
  assert.equal((await admin.call("/admin/tracking/test", "POST", {})).status, 400);
  await configure(admin);
  const result = await admin.call("/admin/tracking/test", "POST", { eventName: "Purchase" });
  assert.equal(result.status, 502);
  assert.match(result.data.error, /Invalid OAuth access token/);
  assert.equal(meta[0].body.data[0].event_name, "Purchase");
  assert.equal(meta[0].body.data[0].user_data.client_user_agent, "TrackingTest/1.0");
  const log = (await admin.call("/admin/tracking")).data.events;
  assert.equal(log[0].status, "failed");
});

test("product and category SEO meta data render into the page head", async (t) => {
  const { db, root } = await fixture(t);
  const product = record(db, "products", "vitaboost");
  save(db, "products", product.id, {
    ...product,
    metaTitle: 'VitaBoost "Daily" $& Immunity',
    metaDescription: "Herbal immunity support <for> families.",
  });
  const html = await (await fetch_(`${root}/product/${product.slug}`)).text();
  assert.match(html, /<title>VitaBoost &quot;Daily&quot; \$&amp; Immunity · /);
  assert.match(html, /<meta name="description" content="Herbal immunity support &lt;for&gt; families." \/>/);
  assert.match(html, /<meta property="og:title" content="VitaBoost &quot;Daily&quot; \$&amp; Immunity"/);
  assert.match(html, /<meta property="og:type" content="product"/);
  assert.match(html, /<meta property="product:price:currency" content="BDT"/);
  const c = records(db, "categories").find((x) => x.active && !x.parentId);
  const categoryHtml = await (await fetch_(`${root}/category/${c.slug}`)).text();
  assert.match(categoryHtml, new RegExp(`<meta property="og:title" content="${c.name}"`));
  const missing = await (await fetch_(`${root}/product/does-not-exist`)).text();
  assert.match(missing, /<title>GadgetHome<\/title>/);
});

test("combo purchases report each component, and product data can be turned off", async (t) => {
  const { admin, guest, meta } = await fixture(t);
  await configure(admin, { cookieConsent: false });
  const combo = {
    type: "combo",
    comboId: "wellness",
    productIds: ["herbal-tea", "baby-lotion"],
    quantity: 2,
  };
  const placed = await order(guest, { items: [combo] });
  assert.equal(placed.status, 201);
  await until(() => meta.length === 1);
  const data = meta[0].body.data[0].custom_data;
  assert.equal(data.value, placed.data.total / 100);
  assert.deepEqual(data.contents, [
    { id: "herbal-tea", quantity: 2 },
    { id: "baby-lotion", quantity: 2 },
  ]);
  assert.equal(data.num_items, 4);
  await configure(admin, { cookieConsent: false, dynamicProducts: false });
  await order(guest);
  await until(() => meta.length === 2);
  const stripped = meta[1].body.data[0].custom_data;
  assert.deepEqual(Object.keys(stripped).sort(), ["currency", "order_id", "value"]);
});

test("production security policy allows every Meta Pixel transport", async (t) => {
  const db = openDatabase(":memory:");
  seed(db);
  const server = createApp(db, { production: true, limits: false }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    db.close();
  });
  const response = await fetch_(`http://127.0.0.1:${server.address().port}/api/health`);
  const policy = Object.fromEntries(
    response.headers
      .get("content-security-policy")
      .split(";")
      .map((d) => d.trim().split(/\s+/))
      .map(([name, ...values]) => [name, values]),
  );
  assert.ok(policy["script-src"].includes("https://connect.facebook.net"));
  assert.ok(policy["connect-src"].includes("https://www.facebook.com"));
  assert.ok(policy["img-src"].includes("https:"));
  // The pixel posts large payloads (e.g. with advanced matching) through an iframe form.
  assert.ok(policy["form-action"].includes("https://www.facebook.com"));
  assert.ok(policy["frame-src"].includes("https://www.facebook.com"));
  assert.deepEqual(policy["frame-ancestors"], ["'none'"]);
});

test("category SEO meta title overrides the category name", async (t) => {
  const { db, root } = await fixture(t);
  const c = records(db, "categories").find((x) => x.active && !x.parentId);
  save(db, "categories", c.id, { ...c, metaTitle: "Buy Medicine Online in Bangladesh", metaDescription: "Genuine medicine delivered." });
  const html = await (await fetch_(`${root}/category/${c.slug}`)).text();
  assert.match(html, /<title>Buy Medicine Online in Bangladesh · /);
  assert.match(html, /<meta name="description" content="Genuine medicine delivered." \/>/);
  assert.match(html, /<meta property="og:type" content="website"/);
});

test("ad click IDs are attributed even before the pixel stores its cookie", async (t) => {
  const { admin, guest, meta } = await fixture(t);
  await configure(admin);
  const event = (eventId, sourceUrl) => ({ eventName: "PageView", eventId, sourceUrl, customData: {} });
  await guest.call("/tracking/events", "POST", event("pageview_landing01", "http://localhost:5173/?fbclid=IwAR123abc"));
  await until(() => meta.length === 1);
  assert.match(meta[0].body.data[0].user_data.fbc, /^fb\.1\.\d{13}\.IwAR123abc$/);
  // Once the pixel has set _fbc, the cookie value is used as-is.
  guest.setCookie("_fbc=fb.1.1700000000000.IwAR123abc");
  await guest.call("/tracking/events", "POST", event("pageview_landing02", "http://localhost:5173/shop"));
  await until(() => meta.length === 2);
  assert.equal(meta[1].body.data[0].user_data.fbc, "fb.1.1700000000000.IwAR123abc");
  // Without an ad click there is no fbc.
  const plain = await fixture(t);
  await configure(plain.admin);
  await plain.guest.call("/tracking/events", "POST", event("pageview_plain0001", "http://localhost:5173/"));
  await until(() => plain.meta.length === 1);
  assert.equal(plain.meta[0].body.data[0].user_data.fbc, undefined);
});
