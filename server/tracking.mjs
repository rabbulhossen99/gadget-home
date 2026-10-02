import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { id, audit } from "./db.mjs";

// Graph API versions expire about two years after release (v20.0 expired 2026-09-24).
export const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v26.0";
const browserEvents = ["PageView", "ViewContent", "Search", "AddToCart", "InitiateCheckout", "AddPaymentInfo"];
export const metaEvents = [...browserEvents, "Purchase"];

// Unknown keys (such as the `configured` flag echoed back by the admin form) are stripped, not rejected.
const schema = z.object({
  pixelId: z.string().trim().max(100).default(""), testCode: z.string().trim().max(200).default(""),
  accessToken: z.string().trim().max(5000).default(""), tiktokPixelId: z.string().trim().max(100).default(""),
  googleMeasurementId: z.string().trim().max(100).default(""),
  advancedMatching: z.boolean().default(false), serverSide: z.boolean().default(true),
  cookieConsent: z.boolean().default(true), dynamicProducts: z.boolean().default(true),
});
const content = z.object({ id: z.string().max(100), quantity: z.number().int().min(1).max(10000), item_price: z.number().min(0).max(1e9).optional() }).strict();
const customDataSchema = z.object({
  value: z.number().min(0).max(1e9).optional(), currency: z.literal("BDT").optional(),
  content_ids: z.array(z.string().max(100)).max(100).optional(), content_type: z.enum(["product", "product_group"]).optional(),
  content_name: z.string().max(500).optional(), content_category: z.string().max(500).optional(),
  contents: z.array(content).max(100).optional(), num_items: z.number().int().min(0).max(10000).optional(),
  search_string: z.string().max(500).optional(),
}).strict();
const browserEventSchema = z.object({
  eventName: z.enum(browserEvents), eventId: z.string().regex(/^[A-Za-z0-9_-]{8,120}$/),
  sourceUrl: z.string().url().max(2000), customData: customDataSchema.default({}),
}).strict();
const orderContextSchema = z.object({ consent: z.boolean().default(false), sourceUrl: z.string().url().max(2000).optional() }).catch({ consent: false });

const key = () => { const raw = process.env.TRACKING_ENCRYPTION_KEY || process.env.COURIER_ENCRYPTION_KEY || ""; if (!/^[a-f0-9]{64}$/i.test(raw)) throw Object.assign(new Error("Configure a 64-character hex TRACKING_ENCRYPTION_KEY."), { status: 503 }); return Buffer.from(raw, "hex"); };
const encrypt = value => { const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv); const data = c.update(JSON.stringify(value), "utf8", "hex") + c.final("hex"); return `${iv.toString("hex")}.${data}.${c.getAuthTag().toString("hex")}`; };
const decrypt = value => { const [iv,data,tag] = value.split("."), d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv,"hex")); d.setAuthTag(Buffer.from(tag,"hex")); return JSON.parse(d.update(data,"hex","utf8") + d.final("utf8")); };
const sha256 = value => createHash("sha256").update(value).digest("hex");
const cookie = (req, name) => (req.headers.cookie || "").split(";").map(c => c.trim()).find(c => c.startsWith(name + "="))?.slice(name.length + 1);

// Meta customer information parameters: normalized, then SHA-256 hashed. IP, user agent, fbp and fbc stay unhashed.
// The click ID from a Meta ad link; the pixel stores it as _fbc, but the first events after landing can arrive before that.
const clickId = sourceUrl => { try { const fbclid = new URL(sourceUrl).searchParams.get("fbclid"); return fbclid ? `fb.1.${Date.now()}.${fbclid.slice(0, 500)}` : undefined; } catch { return undefined; } };
function userData(req, customer = {}, advanced = false, sourceUrl = "") {
  const data = { client_ip_address: String(req.ip || "").replace(/^::ffff:/, ""), client_user_agent: String(req.get("user-agent") || "").slice(0, 1000) };
  const fbp = cookie(req, "_fbp"), fbc = cookie(req, "_fbc") || clickId(sourceUrl);
  if (fbp) data.fbp = fbp;
  if (fbc) data.fbc = fbc;
  if (!advanced) return data;
  const email = customer.email?.trim().toLowerCase(), digits = customer.phone?.replace(/\D/g, "");
  const names = (customer.name || "").trim().toLowerCase().replace(/[^\p{L}\p{M}\s]/gu, "").split(/\s+/).filter(Boolean);
  if (email) data.em = [sha256(email)];
  // Bangladeshi local numbers (01XXXXXXXXX) are sent with the 880 country code.
  if (digits) data.ph = [sha256(digits.startsWith("880") ? digits : digits.replace(/^0/, "880"))];
  if (names[0]) data.fn = [sha256(names[0])];
  if (names.length > 1) data.ln = [sha256(names.at(-1))];
  if (customer.userId) data.external_id = [sha256(customer.userId)];
  data.country = [sha256("bd")];
  return data;
}
function purchaseData(order) {
  const contents = order.lines.flatMap(line => line.type === "combo"
    ? line.components.map(c => ({ id: c.productId, quantity: c.quantity }))
    : [{ id: line.productId, quantity: line.quantity, item_price: line.unitPrice / 100 }]);
  return { value: order.total / 100, currency: "BDT", order_id: order.number, content_type: "product", content_ids: [...new Set(contents.map(c => c.id))], contents, num_items: contents.reduce((sum, c) => sum + c.quantity, 0) };
}
const productFields = ["content_ids", "contents", "content_type", "content_name", "content_category", "num_items"];
const withoutProducts = data => Object.fromEntries(Object.entries(data).filter(([k]) => !productFields.includes(k)));

export function installTracking(db) { db.exec("CREATE TABLE IF NOT EXISTS tracking_settings (id TEXT PRIMARY KEY, encrypted TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS tracking_events (id TEXT PRIMARY KEY, event_name TEXT NOT NULL, event_id TEXT NOT NULL, status TEXT NOT NULL, response TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); CREATE INDEX IF NOT EXISTS tracking_events_date ON tracking_events(created_at)"); }
export function trackingService(db, { origin = process.env.APP_ORIGIN || "http://localhost:5173", fetch = globalThis.fetch } = {}) {
  installTracking(db);
  let cache = null;
  const read = () => { if (cache) return cache; const row = db.prepare("SELECT encrypted FROM tracking_settings WHERE id='store'").get(); return (cache = schema.parse(row ? decrypt(row.encrypted) : {})); };
  const status = value => ({ browserPixel: !!value.pixelId, serverCapi: !!(value.pixelId && value.accessToken && value.serverSide), graphVersion: GRAPH_VERSION });
  const safe = value => ({ ...value, accessToken: "", configured: !!value.accessToken });
  const save = (input, actor) => {
    const { clearAccessToken, ...fields } = input || {}, previous = read();
    const next = schema.parse({ ...previous, ...fields, accessToken: clearAccessToken ? "" : fields.accessToken?.trim() || previous.accessToken });
    if (next.pixelId && !/^\d{5,30}$/.test(next.pixelId)) throw Object.assign(new Error("Meta Pixel ID must be the 5–30 digit number from Events Manager."), { status: 400 });
    db.prepare("INSERT INTO tracking_settings(id,encrypted) VALUES('store',?) ON CONFLICT(id) DO UPDATE SET encrypted=excluded.encrypted,updated_at=CURRENT_TIMESTAMP").run(encrypt(next));
    cache = next;
    audit(db, actor, "tracking.update", "store");
    return safe(next);
  };
  const log = (events, ok, response) => {
    const insert = db.prepare("INSERT INTO tracking_events VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)");
    for (const e of events) insert.run(id(), e.event_name, e.event_id, ok ? "delivered" : "failed", JSON.stringify(response));
    db.prepare("DELETE FROM tracking_events WHERE rowid NOT IN (SELECT rowid FROM tracking_events ORDER BY rowid DESC LIMIT 500)").run();
  };
  // Sends events to the Conversions API and records the outcome. Never throws.
  async function deliver(settings, events) {
    const body = { data: events, access_token: settings.accessToken, ...(settings.testCode ? { test_event_code: settings.testCode } : {}) };
    let response, data;
    try {
      response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(settings.pixelId)}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      data = await response.json().catch(() => ({}));
    } catch {
      const message = "Meta Graph API timed out or could not be reached.";
      log(events, false, { message });
      return { ok: false, message };
    }
    const ok = response.ok && !data.error, message = ok ? "" : data.error?.error_user_msg || data.error?.message || `Meta rejected the event (HTTP ${response.status}).`;
    log(events, ok, ok ? { events_received: data.events_received, fbtrace_id: data.fbtrace_id, test: !!settings.testCode } : { code: data.error?.code, message });
    return { ok, message, status: response.status, data };
  }
  const event = (name, eventId, sourceUrl, req, customData, customer) => {
    const s = read();
    return { event_name: name, event_time: Math.floor(Date.now() / 1000), event_id: eventId, event_source_url: sourceUrl, action_source: "website", user_data: userData(req, customer, s.advancedMatching, sourceUrl), custom_data: s.dynamicProducts ? customData : withoutProducts(customData) };
  };
  const serverEnabled = () => { try { return status(read()).serverCapi; } catch { return false; } };
  async function test(input, req, actor) {
    const settings = read();
    if (!/^\d{5,30}$/.test(settings.pixelId) || !settings.accessToken) throw Object.assign(new Error("Save a valid Meta Pixel ID and access token first."), { status: 400 });
    const name = metaEvents.includes(input.eventName) ? input.eventName : "PageView", eventId = `test_${id()}`;
    const result = await deliver(settings, [event(name, eventId, origin, req, { currency: "BDT", value: Number(input.value || 0) }, {})]);
    if (!result.ok) throw Object.assign(new Error(result.message), { status: 502 });
    audit(db, actor, "tracking.test", eventId);
    return { ok: true, pixelId: settings.pixelId, eventName: name, eventId, eventsReceived: result.data.events_received, testEventCode: settings.testCode || null, apiStatus: `${result.status} OK` };
  }
  // Browser pixel events mirrored server-side with the same event_id so Meta deduplicates them.
  function browserEvent(input, req) {
    const e = browserEventSchema.parse(input);
    if (!serverEnabled()) return { queued: false };
    void deliver(read(), [event(e.eventName, e.eventId, e.sourceUrl, req, e.customData, { userId: req.user?.id, email: req.user?.email, name: req.user?.name })]);
    return { queued: true };
  }
  // Purchases are only reported by the server, from the stored order, so the value cannot be altered in the browser.
  function purchase(order, req, context) {
    const c = orderContextSchema.parse(context ?? {});
    if (!serverEnabled() || (read().cookieConsent && !c.consent)) return;
    return deliver(read(), [event("Purchase", `purchase_${order.id}`, c.sourceUrl || `${origin}/checkout`, req, purchaseData(order), { email: order.email, phone: order.phone, name: order.name, userId: req.user?.id })]);
  }
  const publicConfig = () => {
    try { const s = read(); return s.pixelId ? { pixelId: s.pixelId, cookieConsent: s.cookieConsent, advancedMatching: s.advancedMatching, dynamicProducts: s.dynamicProducts, serverSide: status(s).serverCapi } : { pixelId: "" }; }
    catch { return { pixelId: "" }; }
  };
  return { read: () => safe(read()), status: () => status(read()), save, test, browserEvent, purchase, publicConfig, events: () => db.prepare("SELECT created_at,event_name,event_id,status,response FROM tracking_events ORDER BY rowid DESC LIMIT 50").all() };
}
export function mountTracking(app, service) {
  app.get("/api/tracking/config", (_,res) => res.json(service.publicConfig()));
  app.post("/api/tracking/events", (req,res) => res.status(202).json(service.browserEvent(req.body, req)));
  app.get("/api/admin/tracking", (_,res) => res.json({ settings: service.read(), status: service.status(), events: service.events() }));
  app.put("/api/admin/tracking", (req,res) => res.json({ settings: service.save(req.body, req.user.id), status: service.status() }));
  app.post("/api/admin/tracking/test", async (req,res) => res.json(await service.test(req.body || {}, req, req.user.id)));
}
