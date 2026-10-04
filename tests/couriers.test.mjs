import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { openDatabase, record } from "../server/db.mjs";
import { seed } from "../server/seed.mjs";
import { createApp } from "../server/app.mjs";
import { passwordHash } from "../server/auth.mjs";
import { mapCourierStatus } from "../server/couriers.mjs";

process.env.COURIER_ENCRYPTION_KEY = "cd".repeat(32);
const origin = "http://localhost:5173";

// Answers like the Steadfast (Packzy) and Pathao merchant APIs, and records every request.
function fakeCouriers() {
  const calls = [];
  const state = { steadfastStatus: "in_review", pathaoStatus: "Pending", pathaoTokens: 0, fail: null, pathaoExpiresIn: 432000 };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
  async function request(url, init = {}) {
    const { pathname, host } = new URL(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ host, path: pathname, method: init.method, headers: init.headers, body });
    if (state.fail === "network") throw new TypeError("fetch failed");
    if (host === "portal.packzy.com") {
      if (init.headers["Api-Key"] !== "sf-key" || init.headers["Secret-Key"] !== "sf-secret")
        return json({ status: 401, message: "Unauthorized" }, 401);
      if (pathname === "/api/v1/get_balance") return json({ status: 200, current_balance: 0 });
      if (pathname === "/api/v1/create_order")
        return json({ status: 200, message: "Consignment has been created successfully.", consignment: {
          consignment_id: 1424107, invoice: body.invoice, tracking_code: "15BAEB8A", status: "in_review", cod_amount: body.cod_amount } });
      if (pathname.startsWith("/api/v1/status_by_cid/")) return json({ status: 200, delivery_status: state.steadfastStatus });
    }
    if (host === "courier-api-sandbox.pathao.com") {
      if (pathname === "/aladdin/api/v1/issue-token") {
        state.pathaoTokens++;
        if (body.client_id !== "pa-client" || body.client_secret !== "pa-secret") return json({ code: 401, message: "Invalid client" }, 401);
        return json({ token_type: "Bearer", expires_in: state.pathaoExpiresIn, access_token: "token-" + state.pathaoTokens, refresh_token: "refresh-" + state.pathaoTokens });
      }
      if (!/^Bearer token-\d+$/.test(init.headers.Authorization || "")) return json({ code: 401, message: "Unauthenticated" }, 401);
      if (pathname === "/aladdin/api/v1/stores") return json({ code: 200, data: { data: [{ store_id: 55, store_name: "GadgetHome Mirpur", store_address: "Mirpur 10" }] } });
      if (pathname === "/aladdin/api/v1/city-list") return json({ code: 200, data: { data: [{ city_id: 1, city_name: "Dhaka" }, { city_id: 2, city_name: "Chittagong" }] } });
      if (pathname === "/aladdin/api/v1/cities/1/zone-list") return json({ code: 200, data: { data: [{ zone_id: 298, zone_name: "Mirpur" }] } });
      if (pathname === "/aladdin/api/v1/zones/298/area-list") return json({ code: 200, data: { data: [{ area_id: 37, area_name: "Mirpur 10" }] } });
      if (pathname === "/aladdin/api/v1/orders")
        return json({ message: "Order Created Successfully", type: "success", code: 200, data: {
          consignment_id: "DL121224VS8TTJ", merchant_order_id: body.merchant_order_id, order_status: "Pending", delivery_fee: 80 } });
      const info = pathname.match(/^\/aladdin\/api\/v1\/orders\/([^/]+)\/info$/);
      if (info) return json({ code: 200, data: { consignment_id: info[1], merchant_order_id: state.merchantOrderId, order_status: state.pathaoStatus, order_status_slug: state.pathaoStatus } });
    }
    return json({ message: "Not found" }, 404);
  }
  return { request, calls, state, sent: (path) => calls.filter((c) => c.path === path) };
}

async function fixture(t) {
  const db = openDatabase(":memory:");
  seed(db);
  db.prepare("INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)").run(
    "admin", "admin@example.test", "Store admin", await passwordHash("very-long-test-password"), "admin");
  const couriers = fakeCouriers();
  const app = createApp(db, { limits: false, courierRequest: couriers.request });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function client() {
    let cookie = "", csrf = "";
    const call = async (path, method = "GET", body) => {
      const r = await fetch(base + path, { method, headers: { cookie, origin, "X-CSRF-Token": csrf,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      if (r.headers.get("set-cookie")) cookie = r.headers.get("set-cookie").split(";")[0];
      const data = await r.json();
      if (data.csrf) csrf = data.csrf;
      return { status: r.status, data };
    };
    await call("/session");
    return { call };
  }
  const guest = await client(), admin = await client();
  await admin.call("/auth/login", "POST", { email: "admin@example.test", password: "very-long-test-password" });
  async function order(extra = {}) {
    const items = [{ type: "product", productId: "vitaboost", variantId: "double", quantity: 1 }];
    const q = await guest.call("/quote", "POST", { items, area: "inside", coupon: "" });
    const placed = await guest.call("/orders", "POST", { items, area: "inside", coupon: "", name: "Rahim Uddin",
      phone: "01712345678", email: "", address: "House 12, Road 3, Block C", note: "Call before delivery",
      paymentMethod: "cod", paymentReference: "", idempotencyKey: randomUUID(), expectedTotal: q.data.total, ...extra });
    assert.equal(placed.status, 201);
    return placed.data;
  }
  return { db, app, admin, guest, couriers, order };
}
const steadfast = { enabled: true, active: true, apiKey: "sf-key", secretKey: "sf-secret" };
const pathao = { enabled: true, active: true, environment: "sandbox", storeId: 55, defaultWeight: 1,
  clientId: "pa-client", clientSecret: "pa-secret", username: "merchant@example.test", password: "merchant-pass" };
async function locate(admin, id, body) {
  const version = (await admin.call("/admin/orders")).data.find((o) => o.id === id).version;
  return admin.call(`/admin/orders/${id}/courier/location`, "PUT", { ...body, expectedVersion: version });
}

test("courier credentials are encrypted, masked and verified with the courier", async (t) => {
  const { db, admin, couriers } = await fixture(t);
  assert.equal((await admin.call("/admin/couriers/steadfast", "PUT", { enabled: true })).status, 400);
  const saved = await admin.call("/admin/couriers/steadfast", "PUT", steadfast);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.settings.apiKey, "");
  assert.equal(saved.data.settings.configured.apiKey, true);
  const stored = db.prepare("SELECT encrypted FROM courier_settings WHERE provider='steadfast'").get().encrypted;
  assert.ok(!stored.includes("sf-key") && !stored.includes("sf-secret"));
  assert.deepEqual((await admin.call("/admin/couriers/steadfast/test", "POST", {})).data, { ok: true, stores: [] });
  assert.equal(couriers.sent("/api/v1/get_balance")[0].headers["Api-Key"], "sf-key");
  const wrong = await admin.call("/admin/couriers/steadfast/test", "POST", { apiKey: "wrong" });
  assert.equal(wrong.status, 502);
  assert.match(wrong.data.error, /authentication failed/);
  // Only one courier is active at a time.
  await admin.call("/admin/couriers/pathao", "PUT", pathao);
  const list = (await admin.call("/admin/couriers")).data;
  assert.equal(list.pathao.active, true);
  assert.equal(list.steadfast.active, false);
  const stores = await admin.call("/admin/couriers/pathao/test", "POST", {});
  assert.deepEqual(stores.data.stores, [{ store_id: 55, store_name: "GadgetHome Mirpur", store_address: "Mirpur 10" }]);
});

test("Steadfast booking sends a valid consignment and syncs delivery status", async (t) => {
  const { db, app, admin, couriers, order } = await fixture(t);
  await admin.call("/admin/couriers/steadfast", "PUT", steadfast);
  const placed = await order();
  const districts = (await admin.call("/admin/couriers/steadfast/locations")).data;
  const dhaka = districts.find((d) => d.name === "Dhaka");
  const city = (await admin.call(`/admin/couriers/steadfast/locations?districtId=${dhaka.id}&locationType=city`)).data;
  const mirpur = city.find((x) => x.name === "Mirpur");
  const located = await locate(admin, placed.id, { provider: "steadfast", districtId: dhaka.id, thanaId: mirpur.id, locationType: "city" });
  assert.equal(located.status, 200);
  // A booking with a stale order version is refused.
  assert.equal((await admin.call(`/admin/orders/${placed.id}/courier`, "POST", { provider: "steadfast", expectedVersion: 1 })).status, 409);
  const booked = await admin.call(`/admin/orders/${placed.id}/courier`, "POST", { provider: "steadfast", expectedVersion: located.data.version });
  assert.equal(booked.status, 200);
  const [sent] = couriers.sent("/api/v1/create_order");
  assert.deepEqual(sent.body, {
    invoice: placed.number, recipient_name: "Rahim Uddin", recipient_phone: "01712345678",
    recipient_address: "House 12, Road 3, Block C, Mirpur, Dhaka", cod_amount: placed.total / 100,
    item_description: "VitaBoost Vitamin C 1000mg x1", note: "Call before delivery",
  });
  assert.equal(booked.data.shipment.state, "booked");
  assert.equal(booked.data.shipment.consignment_id, "1424107");
  assert.equal(booked.data.shipment.tracking_id, "15BAEB8A");
  assert.deepEqual(booked.data.order, { version: located.data.version + 1, status: "pending", carrier: "steadfast", trackingNumber: "15BAEB8A" });
  // A second submission is blocked to prevent duplicate parcels.
  assert.equal((await admin.call(`/admin/orders/${placed.id}/courier`, "POST", { provider: "steadfast", expectedVersion: booked.data.order.version })).status, 409);
  const listed = (await admin.call("/admin/orders")).data.find((o) => o.id === placed.id);
  assert.equal(listed.courierShipment.courier_status, "in_review");
  // The scheduled sync follows the courier: in review → processing, delivered → completed.
  await app.locals.couriers.tick();
  assert.equal(db.prepare("SELECT status FROM orders WHERE id=?").get(placed.id).status, "processing");
  couriers.state.steadfastStatus = "delivered";
  await app.locals.couriers.tick();
  assert.equal(db.prepare("SELECT status FROM orders WHERE id=?").get(placed.id).status, "processing", "re-checked only after 5 minutes");
  const tracked = await admin.call(`/admin/orders/${placed.id}/courier/track`, "POST", {});
  assert.equal(tracked.data.order.status, "completed");
  assert.equal(tracked.data.shipment.courier_status, "delivered");
  const events = (await admin.call("/admin/orders")).data.find((o) => o.id === placed.id).events;
  assert.match(events.at(-1).message, /steadfast: delivered/);
  // Shipments keep syncing after the courier is disabled for new bookings.
  await admin.call("/admin/couriers/steadfast", "PUT", { ...steadfast, enabled: false, active: false });
  assert.equal((await admin.call(`/admin/orders/${placed.id}/courier/track`, "POST", {})).status, 200);
  assert.equal(record(db, "products", "vitaboost").variants.find((v) => v.id === "double").stock, 29);
});

test("Pathao booking uses courier locations, reuses its token and rejects invalid orders before sending", async (t) => {
  const { admin, couriers, order, db } = await fixture(t);
  assert.equal((await admin.call("/admin/couriers/pathao", "PUT", { ...pathao, storeId: 0 })).status, 400);
  await admin.call("/admin/couriers/pathao", "PUT", pathao);
  const placed = await order({ name: "Al" });
  const cities = (await admin.call("/admin/couriers/pathao/locations")).data;
  assert.deepEqual(cities[0], { id: "1", name: "Dhaka" });
  const zones = (await admin.call("/admin/couriers/pathao/locations?districtId=1")).data;
  const areas = (await admin.call("/admin/couriers/pathao/locations?districtId=1&zoneId=298")).data;
  assert.equal((await locate(admin, placed.id, { provider: "pathao", districtId: "1", thanaId: "999" })).status, 400);
  const located = await locate(admin, placed.id, { provider: "pathao", districtId: "1", thanaId: zones[0].id, areaId: areas[0].id });
  assert.equal(located.status, 200);
  // Pathao requires a recipient name of at least 3 characters: refused without contacting Pathao.
  const short = await admin.call(`/admin/orders/${placed.id}/courier`, "POST", { provider: "pathao", expectedVersion: located.data.version });
  assert.equal(short.status, 400);
  assert.match(short.data.error, /recipient name of 3–100 characters/);
  assert.equal(couriers.sent("/aladdin/api/v1/orders").length, 0);
  assert.equal((await admin.call(`/admin/orders/${placed.id}/courier`)).data.shipment, null);
  // After the order is fixed, booking succeeds.
  const fixed = await admin.call(`/admin/orders/${placed.id}`, "PATCH", { status: "processing", carrier: "", trackingNumber: "",
    shippingNote: "", note: "Call before delivery", name: "Ali Hasan", phone: "01712345678", address: "House 12, Road 3, Block C", expectedVersion: located.data.version });
  assert.equal(fixed.status, 200);
  couriers.state.merchantOrderId = placed.number;
  const booked = await admin.call(`/admin/orders/${placed.id}/courier`, "POST", { provider: "pathao", expectedVersion: fixed.data.version });
  assert.equal(booked.status, 200, JSON.stringify(booked.data));
  const [sent] = couriers.sent("/aladdin/api/v1/orders");
  assert.equal(sent.headers.Authorization, "Bearer token-1");
  assert.deepEqual(sent.body, {
    store_id: 55, merchant_order_id: placed.number, recipient_name: "Ali Hasan", recipient_phone: "01712345678",
    recipient_address: "House 12, Road 3, Block C, Mirpur, Dhaka", recipient_city: 1, recipient_zone: 298, recipient_area: 37,
    delivery_type: 48, item_type: 2, item_weight: 1, item_quantity: 1, item_description: "VitaBoost Vitamin C 1000mg x1",
    special_instruction: "Call before delivery", amount_to_collect: placed.total / 100,
  });
  assert.equal(booked.data.shipment.consignment_id, "DL121224VS8TTJ");
  // Location lists, booking and tracking all share one token.
  couriers.state.pathaoStatus = "Partial_Delivery";
  await admin.call(`/admin/orders/${placed.id}/courier/track`, "POST", {});
  assert.equal(couriers.state.pathaoTokens, 1);
  assert.equal(db.prepare("SELECT status FROM orders WHERE id=?").get(placed.id).status, "on-hold");
  // A Pathao address longer than 220 characters is refused before sending.
  const long = await order({ address: "House 12, Road 3, ".repeat(14) });
  const longLocated = await locate(admin, long.id, { provider: "pathao", districtId: "1", thanaId: "298" });
  const refused = await admin.call(`/admin/orders/${long.id}/courier`, "POST", { provider: "pathao", expectedVersion: longLocated.data.version });
  assert.equal(refused.status, 400);
  assert.match(refused.data.error, /limit of 220 characters/);
  assert.equal(couriers.sent("/aladdin/api/v1/orders").length, 1);
});

test("an unconfirmed booking blocks resubmission until the admin links the consignment", async (t) => {
  const { admin, couriers, order } = await fixture(t);
  await admin.call("/admin/couriers/pathao", "PUT", pathao);
  const placed = await order();
  const located = await locate(admin, placed.id, { provider: "pathao", districtId: "1", thanaId: "298" });
  await admin.call("/admin/couriers/pathao/test", "POST", {});
  couriers.state.fail = "network";
  const lost = await admin.call(`/admin/orders/${placed.id}/courier`, "POST", { provider: "pathao", expectedVersion: located.data.version });
  assert.equal(lost.status, 502);
  assert.match(lost.data.error, /not confirmed/);
  couriers.state.fail = null;
  const shipment = (await admin.call(`/admin/orders/${placed.id}/courier`)).data;
  assert.equal(shipment.shipment.state, "uncertain");
  assert.equal((await admin.call(`/admin/orders/${placed.id}/courier`, "POST", { provider: "pathao", expectedVersion: shipment.order.version })).status, 409);
  // A consignment that belongs to another order cannot be linked.
  couriers.state.merchantOrderId = "GH-OTHER";
  assert.equal((await admin.call(`/admin/orders/${placed.id}/courier/reconcile`, "POST", { consignmentId: "DL999" })).status, 409);
  couriers.state.merchantOrderId = placed.number;
  const linked = await admin.call(`/admin/orders/${placed.id}/courier/reconcile`, "POST", { consignmentId: "DL121224VS8TTJ" });
  assert.equal(linked.status, 200);
  assert.equal(linked.data.shipment.state, "booked");
  assert.equal(linked.data.order.trackingNumber, "DL121224VS8TTJ");
});

test("courier statuses map to order statuses", () => {
  const cases = {
    in_review: "processing", pending: "processing", hold: "on-hold", delivered_approval_pending: "processing",
    partial_delivered_approval_pending: "processing", cancelled_approval_pending: "processing", delivered: "completed",
    partial_delivered: "on-hold", cancelled: "cancelled", exceptional: "on-hold", unknown: null,
    cancelled_return_processing: "on-hold", Pending: "processing", Pickup_Requested: "processing", "Assigned for Pickup": "processing",
    Picked: "processing", Pickup_Failed: "on-hold", Pickup_Cancelled: "on-hold", At_the_Sorting_HUB: "processing",
    In_Transit: "processing", Received_at_Last_Mile_HUB: "processing", Assigned_for_Delivery: "processing",
    Delivered: "completed", Partial_Delivery: "on-hold", Return: "on-hold", Delivery_Failed: "on-hold", On_Hold: "on-hold", Paid: null,
  };
  for (const [raw, expected] of Object.entries(cases)) assert.equal(mapCourierStatus("any", raw), expected, raw);
});
