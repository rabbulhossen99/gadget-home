import { fail } from './commerce.mjs';
export function safeResponse(data) {
  const fields = ['consignment_id','tracking_code','invoice','merchant_order_id','order_status','order_status_slug',
    'invoice_id','delivery_fee','delivery_status','status','created_at','updated_at','price','final_price','cod_percentage','additional_charge','discount'];
  return Object.fromEntries(fields.filter(k => ['string','number'].includes(typeof data?.[k])).map(k => [k,data[k]]));
}
export function courierError(message, rejected = false, upstreamStatus = 0) {
  return Object.assign(new Error(message), { status: 502, safeCourier: true, rejected, upstreamStatus });
}
const errors = {
  400: 'Invalid courier request. Check recipient, location, weight and COD.',
  401: 'Courier authentication failed. Check credentials.',
  403: 'Courier account is not permitted to perform this action.',
  404: 'Courier record or endpoint was not found.',
  409: 'Courier reports a conflicting shipment. Reconcile before retrying.',
  422: 'Courier validation failed. Check recipient, phone, address, location, weight and COD.',
  429: 'Courier rate limit reached. Wait before retrying.',
};
// Field limits from the couriers' merchant API documentation.
const limits = {
  steadfast: { name: [1, 100], address: [1, 250], note: 480 },
  pathao: { name: [3, 100], address: [10, 220], note: 255 },
};
const clip = (text, max) => text.length > max ? text.slice(0, max - 1) + '…' : text;
// Appends the thana and district when they fit and are not already part of the address.
function deliveryAddress(order, max) {
  const base = String(order.address || '').trim().replace(/\s+/g, ' ');
  const extra = [order.thana, order.district].filter(x => x && !base.toLowerCase().includes(String(x).toLowerCase()));
  const full = [base, ...extra].join(', ');
  return full.length <= max ? full : base.length <= max ? base : null;
}
export function createCourierAdapter(provider, config, context = {}) {
  const request = context.request || fetch;
  const base = provider === 'steadfast' ? 'https://portal.packzy.com/api/v1'
    : config.environment === 'sandbox' ? 'https://courier-api-sandbox.pathao.com' : 'https://api-hermes.pathao.com';
  let localToken;
  async function raw(path, body, access, authRequest = false) {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (provider === 'steadfast') { headers['Api-Key'] = config.apiKey; headers['Secret-Key'] = config.secretKey; }
    else if (access) headers.Authorization = 'Bearer ' + access;
    let response, data;
    try {
      response = await request(base + path, { method: body === undefined ? 'GET' : 'POST', headers,
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000), redirect: 'error' });
      data = await response.json();
    } catch {
      context.log?.(path, 0, {}, 'Courier timeout, network failure or unreadable response.');
      throw courierError('Courier response was not confirmed. Check the merchant portal before retrying a booking.', authRequest);
    }
    const declared = Number(data?.code || data?.status), bad = !response.ok || declared >= 400;
    const code = response.ok && declared >= 400 ? declared : response.status;
    context.log?.(path, code, authRequest ? {} : safeResponse(data?.data || data?.consignment || data), bad ? (errors[code] || 'Courier unavailable.') : '');
    if (bad) {
      const fields = data?.errors && typeof data.errors === 'object' ? Object.keys(data.errors).filter(k =>
        /^(recipient_(name|phone|address|city|zone|area)|item_(weight|quantity|description|type)|amount_to_collect|cod_amount|store_id|invoice|merchant_order_id|note|special_instruction|delivery_type)$/.test(k)) : [];
      throw courierError((errors[code] || 'Courier service unavailable. Retry status checks later.') +
        (fields.length ? ' Fields: ' + fields.join(', ') + '.' : ''), authRequest || [400,401,403,422,429].includes(code), code);
    }
    return data;
  }
  async function acquire(force) {
    const saved = context.readToken ? context.readToken() : localToken;
    if (!force && saved?.access_token && saved.expiresAt > Date.now() + 60000) return saved.access_token;
    const creds = { client_id: config.clientId, client_secret: config.clientSecret };
    let response;
    if (saved?.refresh_token) {
      try { response = await raw('/aladdin/api/v1/issue-token', { ...creds, grant_type: 'refresh_token', refresh_token: saved.refresh_token }, undefined, true); }
      catch (e) { if (![400,401,422].includes(e.upstreamStatus)) throw e; }
    }
    if (!response) response = await raw('/aladdin/api/v1/issue-token', { ...creds, grant_type: 'password', username: config.username, password: config.password }, undefined, true);
    if (!response.access_token || !Number.isFinite(Number(response.expires_in)) || Number(response.expires_in) <= 0)
      throw courierError('Pathao returned no valid token and expiry.', true);
    const value = { access_token: response.access_token, refresh_token: response.refresh_token || saved?.refresh_token,
      expires_in: Number(response.expires_in), expiresAt: Date.now() + Number(response.expires_in) * 1000 };
    localToken = value; context.writeToken?.(value);
    return value.access_token;
  }
  const token = force => provider !== 'pathao' ? undefined
    : context.withTokenLock ? context.withTokenLock(() => acquire(force)) : acquire(force);
  async function json(path, body) {
    try { return await raw(path, body, await token(false)); }
    catch (e) {
      if (provider !== 'pathao' || e.upstreamStatus !== 401) throw e;
      return raw(path, body, await token(true));
    }
  }
  function booking(data) {
    const c = provider === 'pathao' ? data.data : data.consignment;
    if (!c?.consignment_id) throw courierError('Booking may have succeeded but no consignment ID was returned. Reconcile before retrying.');
    return { consignmentId: String(c.consignment_id), trackingId: String(c.tracking_code || c.consignment_id),
      status: c.order_status || c.status || 'Booked', response: safeResponse(c) };
  }
  const historyRows = data => {
    const rows = data?.trackings || data?.data || [];
    return Array.isArray(rows) ? rows.slice(-100).map(safeResponse) : [];
  };
  return {
    async test() {
      if (provider === 'steadfast') { await json('/get_balance'); return { ok: true, stores: [] }; }
      const data = await json('/aladdin/api/v1/stores');
      return { ok: true, stores: (data.data?.data || []).map(x => ({ store_id: x.store_id, store_name: x.store_name, store_address: x.store_address })) };
    },
    async locations(city = '', zone = '') {
      if (provider !== 'pathao') fail('Pathao locations are only available for Pathao.');
      const path = zone ? '/aladdin/api/v1/zones/' + encodeURIComponent(zone) + '/area-list'
        : city ? '/aladdin/api/v1/cities/' + encodeURIComponent(city) + '/zone-list' : '/aladdin/api/v1/city-list';
      const rows = (await json(path)).data?.data;
      if (!Array.isArray(rows)) throw courierError('Pathao location list was not returned.', true);
      const key = zone ? 'area' : city ? 'zone' : 'city';
      return rows.map(x => ({ id: String(x[key + '_id']), name: x[key + '_name'] }));
    },
    async price(order, options) {
      if (provider !== 'pathao') fail('Price estimates are available for Pathao only.');
      return safeResponse((await json('/aladdin/api/v1/merchant/price-plan', {
        store_id: config.storeId, item_type: 2, delivery_type: options.deliveryType, item_weight: options.weight,
        recipient_city: Number(order.courierLocation.districtId), recipient_zone: Number(order.courierLocation.thanaId),
      })).data);
    },
    // Builds the booking request and checks it against the courier's documented field limits,
    // so invalid orders are rejected here instead of after submission.
    prepare(order, options) {
      const name = provider === 'pathao' ? 'Pathao' : 'Steadfast', limit = limits[provider];
      const recipient = String(order.name || '').trim(), phone = String(order.phone || '').trim();
      if (recipient.length < limit.name[0] || recipient.length > limit.name[1])
        fail(`${name} needs a recipient name of ${limit.name[0]}–${limit.name[1]} characters. Edit the order first.`);
      if (!/^01[0-9]{9}$/.test(phone)) fail(`${name} needs an 11-digit mobile number starting with 01. Edit the order first.`);
      const address = deliveryAddress(order, limit.address[1]);
      if (!address) fail(`The delivery address is longer than ${name}'s limit of ${limit.address[1]} characters. Shorten it in the order first.`);
      if (address.length < limit.address[0]) fail(`${name} needs a delivery address of at least ${limit.address[0]} characters. Edit the order first.`);
      const description = clip(order.lines.map(x => x.name + ' x' + x.quantity).join('; '), 255);
      const note = clip([options.instruction, order.shippingNote].filter(Boolean).join('; '), limit.note);
      if (provider === 'steadfast') return { path: '/create_order', body: {
        invoice: order.number, recipient_name: recipient, recipient_phone: phone, recipient_address: address,
        cod_amount: options.cod / 100, item_description: description, ...(note ? { note } : {}),
      } };
      const loc = order.courierLocation;
      return { path: '/aladdin/api/v1/orders', body: {
        store_id: config.storeId, merchant_order_id: order.number, recipient_name: recipient,
        recipient_phone: phone, recipient_address: address, recipient_city: Number(loc.districtId), recipient_zone: Number(loc.thanaId),
        ...(loc.areaId ? { recipient_area: Number(loc.areaId) } : {}),
        delivery_type: options.deliveryType, item_type: 2, item_weight: options.weight,
        item_quantity: order.lines.reduce((n,x) => n + x.quantity * (x.components?.length || 1), 0),
        item_description: description, ...(note ? { special_instruction: note } : {}), amount_to_collect: options.cod / 100,
      } };
    },
    async send(prepared) { return booking(await json(prepared.path, prepared.body)); },
    async book(order, options) { return this.send(this.prepare(order, options)); },
    async track(s) {
      const response = provider === 'pathao' ? await json('/aladdin/api/v1/orders/' + encodeURIComponent(s.consignmentId) + '/info')
        : await json('/status_by_cid/' + encodeURIComponent(s.consignmentId));
      const data = provider === 'pathao' ? response.data : response;
      if (data?.merchant_order_id && data.merchant_order_id !== s.orderNumber) fail('Consignment belongs to a different order.', 409);
      const status = data?.order_status || data?.delivery_status;
      if (typeof status !== 'string') throw courierError('Courier returned no shipment status.', true);
      return { status, response: safeResponse(data) };
    },
    async lookupInvoice(invoice) {
      if (provider !== 'steadfast') fail('Pathao requires a confirmed consignment ID from the merchant portal.');
      return { response: safeResponse(await json('/status_by_invoice/' + encodeURIComponent(invoice))),
        history: historyRows(await json('/trackings_by_invoice/' + encodeURIComponent(invoice))) };
    },
    async statusByTracking(code) { return safeResponse(await json('/status_by_trackingcode/' + encodeURIComponent(code))); },
    async history(invoice) { return historyRows(await json('/trackings_by_invoice/' + encodeURIComponent(invoice))); },
  };
}
