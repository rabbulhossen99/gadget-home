import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import express from 'express';
import { id, transaction, audit } from './db.mjs';
import { fail, hash, orderView } from './commerce.mjs';
import { createCourierAdapter } from './courier-adapters.mjs';
import { administrativeLocations } from './delivery-locations.mjs';

const providers = z.enum(['steadfast', 'pathao']);
const secretNames = ['apiKey', 'secretKey', 'clientId', 'clientSecret', 'username', 'password', 'webhookSecret'];
const configSchema = z.object({
  enabled: z.boolean(), active: z.boolean().default(false), verifiedContract: z.boolean().default(false),
  environment: z.enum(['sandbox', 'production']).default('sandbox'),
  storeId: z.number().int().min(0).default(0),
  defaultWeight: z.number().min(0.5).max(10).default(0.5),
  ...Object.fromEntries(secretNames.map(name => [name, z.string().max(1000).optional()])),
}).strict();
function encryptionKey() {
  const key = process.env.COURIER_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(key)) fail('Configure a 64-character hex COURIER_ENCRYPTION_KEY on the server first.', 503);
  return Buffer.from(key, 'hex');
}
function encrypt(provider, value) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(provider));
  return [iv.toString('hex'), cipher.update(JSON.stringify(value), 'utf8', 'hex') + cipher.final('hex'), cipher.getAuthTag().toString('hex')].join('.');
}
function decrypt(provider, value) {
  const [iv, data, tag] = value.split('.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'hex'));
  decipher.setAAD(Buffer.from(provider));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return JSON.parse(decipher.update(data, 'hex', 'utf8') + decipher.final('utf8'));
}
export function installCourierTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS courier_settings(provider TEXT PRIMARY KEY, encrypted TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS courier_shipments(
      order_id TEXT PRIMARY KEY REFERENCES orders(id), provider TEXT NOT NULL,
      state TEXT NOT NULL, consignment_id TEXT, tracking_id TEXT, courier_status TEXT,
      shipped_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      error TEXT, attempts INTEGER NOT NULL DEFAULT 0, next_sync INTEGER NOT NULL DEFAULT 0,
      lease_until INTEGER NOT NULL DEFAULT 0, UNIQUE(provider,consignment_id)
    );
    CREATE TABLE IF NOT EXISTS courier_logs(
      id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
      action TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS courier_webhooks(
      provider TEXT NOT NULL, event_hash TEXT NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(provider,event_hash)
    );
    CREATE INDEX IF NOT EXISTS courier_logs_order ON courier_logs(order_id,created_at);
  `);
}
export function courierService(db, adapterFactory = createCourierAdapter) {
  installCourierTables(db);
  const getConfig = provider => {
    const row = db.prepare('SELECT encrypted FROM courier_settings WHERE provider=?').get(provider);
    return row ? decrypt(provider, row.encrypted) : { enabled: false, active: false, verifiedContract: false, environment: 'sandbox', storeId: 0, defaultWeight: 0.5 };
  };
  const log = (orderId, action, message) => db.prepare('INSERT INTO courier_logs(id,order_id,action,message) VALUES(?,?,?,?)').run(id(), orderId, action, message);
  function configuration(provider, value) {
    providers.parse(provider);
    if (value !== undefined) {
      const input = configSchema.parse(value), previous = getConfig(provider);
      for (const name of secretNames) input[name] = input[name] || previous[name] || '';
      if (input.enabled) {
        const required = provider === 'steadfast' ? ['apiKey', 'secretKey'] : ['clientId', 'clientSecret', 'username', 'password'];
        if (required.some(k => !input[k]) || input.webhookSecret.length < 32) fail('Enter all credentials and a webhook secret of at least 32 characters.');
        if (!input.verifiedContract) fail('Verify the provider contract in your merchant portal before enabling.');
        if (provider === 'pathao' && !input.storeId) fail('Select your Pathao pickup store.');
      }
      db.prepare('INSERT INTO courier_settings VALUES(?,?) ON CONFLICT(provider) DO UPDATE SET encrypted=excluded.encrypted').run(provider, encrypt(provider, input));
    }
    const config = getConfig(provider);
    return { ...config, ...Object.fromEntries(secretNames.map(k => [k, ''])), configured: Object.fromEntries(secretNames.map(k => [k, !!config[k]])) };
  }
  function shipment(orderId) {
    const order = db.prepare('SELECT data FROM orders WHERE id=?').get(orderId);
    if (!order) fail('Order not found.', 404);
    const row = db.prepare('SELECT * FROM courier_shipments WHERE order_id=?').get(orderId);
    return { location: JSON.parse(order.data).courierLocation || null, shipment: row || null, logs: db.prepare('SELECT * FROM courier_logs WHERE order_id=? ORDER BY rowid DESC LIMIT 200').all(orderId) };
  }
  const adapter = (provider, enabled = true) => {
    const c = getConfig(provider);
    if (enabled && !c.enabled) fail('Enable this courier in Courier API settings first.');
    return adapterFactory(provider, c);
  };
  const locationCache = new Map();
  async function locations(provider, districtId = '', zoneId = '') {
    providers.parse(provider);
    if (districtId && !/^[0-9]{1,10}$/.test(districtId)) fail('Invalid district ID.');
    if (zoneId && !/^[0-9]{1,10}$/.test(zoneId)) fail('Invalid zone ID.');
    if (provider === 'steadfast') return administrativeLocations(districtId);
    const config = getConfig(provider);
    const key = hash(JSON.stringify(config)) + ':' + districtId + ':' + zoneId;
    const cached = locationCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.rows;
    const rows = await adapter(provider, false).locations(districtId, zoneId);
    if (rows.some(x => !/^[0-9]{1,10}$/.test(x.id) || typeof x.name !== 'string'))
      fail('Courier returned invalid location data.', 502);
    locationCache.set(key, { rows, expires: Date.now() + 3600000 });
    return rows;
  }
  async function saveLocation(orderId, input, actor) {
    const { provider, districtId, thanaId, areaId, expectedVersion } = z.object({
      provider: providers, districtId: z.string().regex(/^[0-9]{1,10}$/),
      thanaId: z.string().regex(/^[0-9]{1,10}$/), areaId: z.string().regex(/^[0-9]{1,10}$/).optional(), expectedVersion: z.number().int().positive(),
    }).strict().parse(input);
    const district = (await locations(provider)).find(x => x.id === districtId);
    if (!district) fail('Select a valid district.');
    const thana = (await locations(provider, districtId)).find(x => x.id === thanaId);
    if (!thana) fail('Select a thana belonging to the selected district.');
    const area = areaId ? (await locations(provider, districtId, thanaId)).find(x => x.id === areaId) : null;
    if (areaId && !area) fail('Select an area belonging to the selected zone.');
    return transaction(db, () => {
      const row = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
      const order = orderView(db, row, true);
      if (order.version !== expectedVersion) fail('Order changed. Reload before saving.', 409);
      const existing = shipment(orderId).shipment;
      if (existing && existing.state !== 'rejected') fail('Location is locked after courier submission.', 409);
      const data = JSON.parse(row.data);
      const courierLocation = { provider, districtId, thanaId, areaId: area?.id || '', district: district.name, thana: thana.name, area: area?.name || '' };
      db.prepare('UPDATE orders SET data=? WHERE id=?').run(JSON.stringify({
        ...data, district: district.name, thana: thana.name, courierLocation, version: data.version + 1,
      }), orderId);
      log(orderId, 'location', district.name + ' / ' + thana.name);
      audit(db, actor, 'order.delivery-location', orderId);
      return { location: courierLocation, version: data.version + 1 };
    });
  }
  async function book(orderId, provider, version, actor) {
    providers.parse(provider);
    const courierConfig = getConfig(provider);
    const api = adapter(provider);
    let order;
    transaction(db, () => {
      const row = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
      order = orderView(db, row, true);
      if (order.version !== version) fail('Order changed. Reload before sending.', 409);
      if (!['processing', 'confirmed'].includes(order.status)) fail('Move the order to Processing before sending it to a courier.');
      if (!order.district || !order.thana) fail('District and thana are missing. Complete delivery details first.');
      if (order.courierLocation?.provider !== provider) fail('Save a delivery location for the selected courier first.');
      if (order.paymentMethod !== 'cod' && order.paymentStatus !== 'paid') fail('This prepaid order has not been verified as paid. Do not ship with zero COD until payment is confirmed.');
      const existing = shipment(orderId).shipment;
      if (existing && existing.state !== 'rejected') fail('This order already has a courier submission. Track or reconcile it instead of submitting again.', 409);
      db.prepare(`INSERT INTO courier_shipments(order_id,provider,state) VALUES(?,?,'submitting')
        ON CONFLICT(order_id) DO UPDATE SET provider=excluded.provider,state='submitting',error=NULL,updated_at=CURRENT_TIMESTAMP`).run(orderId, provider);
      log(orderId, 'booking', 'Booking requested with ' + provider);
      audit(db, actor, 'courier.book', orderId);
    });
    try {
      const result = await api.book(order, {
        cod: order.paymentMethod === 'cod' ? order.total : 0,
        weight: courierConfig.defaultWeight || 0.5,
        deliveryType: 48,
        instruction: order.note || '',
      });
      transaction(db, () => {
        db.prepare(`UPDATE courier_shipments SET state='booked',consignment_id=?,tracking_id=?,courier_status=?,
          shipped_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,next_sync=0,error=NULL WHERE order_id=?`)
          .run(result.consignmentId, result.trackingId, result.status, orderId);
        const row = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
        const data = JSON.parse(row.data);
        db.prepare('UPDATE orders SET data=? WHERE id=?').run(JSON.stringify({
          ...data, carrier: provider, trackingNumber: result.trackingId, version: data.version + 1,
        }), orderId);
        log(orderId, 'booked', 'Consignment ' + result.consignmentId + ' created.');
      });
    } catch (error) {
      db.prepare("UPDATE courier_shipments SET state=?,error=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?")
        .run(error.rejected ? 'rejected' : 'uncertain', error.message, orderId);
      log(orderId, 'booking_failed', error.message);
      throw error;
    }
    return shipment(orderId);
  }
  async function track(orderId, force = false) {
    const now = Date.now();
    const claimed = db.prepare(`UPDATE courier_shipments SET lease_until=? WHERE order_id=? AND state='booked'
      AND lease_until<? AND (?=1 OR next_sync<=?)`).run(now + 90000, orderId, now, force ? 1 : 0, now);
    if (!claimed.changes) return shipment(orderId);
    const row = shipment(orderId).shipment;
    try {
      const orderRow = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
      const status = await adapter(row.provider).track({ consignmentId: row.consignment_id, orderNumber: orderRow.number });
      transaction(db, () => {
        // Use freshly read state after the external request, never a stale order snapshot.
        const current = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
        const mapped = mapCourierStatus(row.provider, status);
        const terminal = ['completed', 'cancelled', 'refunded', 'delivered', 'returned'].includes(current.status);
        if (mapped && mapped !== current.status && !terminal) {
          const data = JSON.parse(current.data);
          // Cancellation is a lifecycle change, not proof of physically returned stock.
          db.prepare('UPDATE orders SET status=?,data=? WHERE id=?').run(mapped, JSON.stringify({
            ...data, version: data.version + 1, courierInventoryHeld: mapped === 'cancelled' || data.courierInventoryHeld,
          }), orderId);
          db.prepare('INSERT INTO order_events(id,order_id,actor,data) VALUES(?,?,?,?)')
            .run(id(), orderId, 'courier:' + row.provider, JSON.stringify({ status: mapped, message: row.provider + ': ' + status }));
        }
        if (status !== row.courier_status) log(orderId, 'status', status + (terminal ? ' (terminal order status preserved)' : ''));
        db.prepare(`UPDATE courier_shipments SET courier_status=?,error=NULL,attempts=0,lease_until=0,
          next_sync=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).run(status, now + 300000, orderId);
      });
    } catch (error) {
      db.prepare('UPDATE courier_shipments SET error=?,attempts=attempts+1,lease_until=0,next_sync=? WHERE order_id=?')
        .run(error.message, now + Math.min(3600000, 30000 * 2 ** Math.min(row.attempts, 7)), orderId);
      log(orderId, 'sync_failed', error.message);
      if (force) throw error;
    }
    return shipment(orderId);
  }
  function webhook(provider, headers, payload) {
    providers.parse(provider);
    const config = getConfig(provider);
    const supplied = provider === 'steadfast' ? String(headers.authorization || '').replace(/^Bearer /, '') : String(headers['x-pathao-signature'] || '');
    const expected = config.webhookSecret || '';
    if (!config.enabled || expected.length < 32 || supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
      fail('Invalid courier webhook authentication.', 401);
    if (provider === 'pathao' && payload.event === 'webhook_integration') return { accepted: true };
    const cid = String(payload.consignment_id || '');
    if (!cid || cid.length > 150) fail('Missing consignment ID.');
    const row = db.prepare("SELECT * FROM courier_shipments WHERE provider=? AND consignment_id=? AND state='booked'").get(provider, cid);
    // A callback can precede persistence of the booking response; return 503 for courier retry.
    if (!row) fail('Shipment is not registered yet. Retry this notification.', 503);
    const eventHash = hash(JSON.stringify(payload));
    transaction(db, () => {
      const result = db.prepare('INSERT OR IGNORE INTO courier_webhooks(provider,event_hash,order_id) VALUES(?,?,?)').run(provider, eventHash, row.order_id);
      if (result.changes) {
        db.prepare('UPDATE courier_shipments SET next_sync=0 WHERE order_id=?').run(row.order_id);
        log(row.order_id, 'webhook', 'Authenticated notification queued for API verification.');
      }
    });
    return { accepted: true };
  }
  async function tick() {
    const rows = db.prepare("SELECT order_id FROM courier_shipments WHERE state='booked' AND next_sync<=? AND lease_until<? ORDER BY next_sync LIMIT 10").all(Date.now(), Date.now());
    for (const row of rows) await track(row.order_id);
  }
  async function reconcile(orderId, consignmentId, actor) {
    const row = shipment(orderId).shipment;
    if (!row || !['uncertain', 'submitting'].includes(row.state)) fail('Only uncertain bookings can be reconciled.');
    const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
    // This is an explicit admin linking action; no second parcel is created.
    const status = await adapter(row.provider).track({ consignmentId, orderNumber: order.number });
    transaction(db, () => {
      db.prepare("UPDATE courier_shipments SET state='booked',consignment_id=?,tracking_id=?,courier_status=?,shipped_at=CURRENT_TIMESTAMP,next_sync=0,error=NULL WHERE order_id=?")
        .run(consignmentId, consignmentId, status, orderId);
      const data = JSON.parse(order.data);
      db.prepare('UPDATE orders SET data=? WHERE id=?').run(JSON.stringify({ ...data, carrier: row.provider, trackingNumber: consignmentId, version: data.version + 1 }), orderId);
      log(orderId, 'reconciled', 'Admin linked verified consignment ' + consignmentId);
      audit(db, actor, 'courier.reconcile', orderId);
    });
    return shipment(orderId);
  }
  return { configuration, locations, saveLocation, shipment, book, track, webhook, tick, reconcile, test: p => { providers.parse(p); return adapter(p, false).test(); } };
}
export function mapCourierStatus(provider, raw) {
  const s = raw.toLowerCase().replaceAll(/[ _-]+/g, '_');
  const common = {
    delivered: 'completed', cancelled: 'cancelled', canceled: 'cancelled',
    hold: 'on-hold', on_hold: 'on-hold', partial_delivered: 'on-hold',
    returned: 'on-hold', return: 'on-hold', delivery_failed: 'on-hold',
    pending: 'processing', in_review: 'processing', picked: 'processing',
    pickup: 'processing', picked_up: 'processing', in_transit: 'processing',
    out_for_delivery: 'processing', delivery_in_progress: 'processing',
  };
  return common[s] || null;
}
export function mountCourierWebhooks(app, service) {
  app.post('/api/webhooks/:provider', express.json({ limit: '64kb' }), (req, res) => {
    const result = service.webhook(req.params.provider, req.headers, req.body || {});
    if (req.params.provider === 'pathao') res.set('X-Pathao-Merchant-Webhook-Integration-Secret', process.env.PATHAO_WEBHOOK_INTEGRATION_SECRET || '');
    res.json(result);
  });
}
export function mountCourierAdmin(app, service) {
  app.get('/api/admin/couriers/:provider/locations', async (req, res) => res.json(
    await service.locations(req.params.provider, String(req.query.districtId || ''), String(req.query.zoneId || ''))
  ));
  app.put('/api/admin/orders/:id/courier/location', async (req, res) => res.json(
    await service.saveLocation(req.params.id, req.body, req.user.id)
  ));
  app.get('/api/admin/couriers', (_, res) => res.json({
    steadfast: service.configuration('steadfast'), pathao: service.configuration('pathao'),
    encryptionReady: /^[a-f0-9]{64}$/i.test(process.env.COURIER_ENCRYPTION_KEY || ''),
  }));
  app.put('/api/admin/couriers/:provider', (req, res) => res.json(service.configuration(req.params.provider, req.body)));
  app.post('/api/admin/couriers/:provider/test', async (req, res) => res.json(await service.test(req.params.provider)));
  app.get('/api/admin/orders/:id/courier', (req, res) => res.json(service.shipment(req.params.id)));
  app.post('/api/admin/orders/:id/courier', async (req, res) => {
    const input = z.object({ provider: providers, expectedVersion: z.number().int().positive() }).strict().parse(req.body);
    res.json(await service.book(req.params.id, input.provider, input.expectedVersion, req.user.id));
  });
  app.post('/api/admin/orders/:id/courier/track', async (req, res) => res.json(await service.track(req.params.id, true)));
  app.post('/api/admin/orders/:id/courier/reconcile', async (req, res) => {
    const input = z.object({ consignmentId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/) }).strict().parse(req.body);
    res.json(await service.reconcile(req.params.id, input.consignmentId, req.user.id));
  });
}

