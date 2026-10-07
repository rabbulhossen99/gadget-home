import { createHash, randomBytes } from "node:crypto";
import { id, record, records, save, transaction } from "./db.mjs";
import { checkoutSchema } from "./schemas.mjs";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
export function settings(db) {
  const value = record(db, "settings", "store");
  if (!value) fail("Store has not been initialized. Run pnpm db:seed.", 503);
  return value;
}
export function categoryVisible(db, categoryId, seen = new Set()) {
  if (seen.has(categoryId)) return false;
  seen.add(categoryId);
  const c = record(db, "categories", categoryId);
  return !!c?.active && (!c.parentId || categoryVisible(db, c.parentId, seen));
}
export function publicProduct(db, p) {
  if (!p || p.status !== "active" || !categoryVisible(db, p.categoryId))
    return null;
  const { targeting, ...safe } = p;
  return { ...safe, variants: p.variants.filter((v) => v.active) };
}
export function quote(db, input) {
  const config = settings(db),
    lines = [],
    requirements = new Map();
  function resolveVariant(productId, variantId, quantity) {
    const product = publicProduct(db, record(db, "products", productId));
    if (!product) fail("A product is no longer available.", 409);
    const variant = variantId
      ? product.variants.find((v) => v.id === variantId)
      : product.variants[0];
    if (!variant) fail(`A package for ${product.name} is unavailable.`, 409);
    const key = `${productId}:${variant.id}`,
      existing = requirements.get(key);
    const count = (existing?.quantity || 0) + quantity;
    if (count > variant.stock)
      fail(`Not enough stock for ${product.name} (${variant.name}).`, 409);
    requirements.set(key, {
      productId,
      variantId: variant.id,
      quantity: count,
    });
    return {
      productId,
      variantId: variant.id,
      name: product.name,
      variant: variant.name,
      image: product.images[0],
      quantity,
      unitPrice: variant.price,
      freeDelivery: !!product.freeDelivery,
    };
  }
  for (const item of input.items) {
    if (item.type === "product") {
      const line = resolveVariant(
        item.productId,
        item.variantId,
        item.quantity,
      );
      lines.push({
        ...line,
        type: "product",
        total: line.unitPrice * line.quantity,
      });
    } else {
      const combo = record(db, "combos", item.comboId);
      if (
        !combo?.active ||
        new Set(item.productIds).size !== item.productIds.length ||
        item.productIds.some((p) => !combo.productIds.includes(p))
      )
        fail("This combo selection is unavailable.", 409);
      const tier = combo.tiers.find((t) => t.count === item.productIds.length);
      if (!tier) fail("Select the correct number of combo products.");
      const components = item.productIds.map((p) =>
        resolveVariant(p, null, item.quantity),
      );
      lines.push({
        type: "combo",
        comboId: combo.id,
        name: combo.name,
        variant: `${tier.count} products`,
        quantity: item.quantity,
        unitPrice: tier.price,
        total: tier.price * item.quantity,
        image: components[0].image,
        components,
        freeDelivery: components.every((component) => component.freeDelivery),
      });
    }
  }
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  const freeDelivery =
    lines.length > 0 && lines.every((line) => line.freeDelivery);
  // Product-level eligibility is the source of truth for checkout delivery.
  // Any chargeable line requires the selected area fee; only an all-free cart
  // receives zero shipping.
  const shipping = freeDelivery
    ? 0
    : input.area === "inside"
      ? config.shippingInside
      : config.shippingOutside;
  let discount = 0,
    couponId = null;
  if (input.coupon) {
    const coupon = records(db, "coupons").find(
      (c) => c.code === input.coupon.toUpperCase(),
    );
    const now = new Date().toISOString();
    if (
      !coupon?.active ||
      (coupon.startsAt && coupon.startsAt > now) ||
      (coupon.endsAt && coupon.endsAt < now) ||
      subtotal < coupon.minSubtotal
    )
      fail("Coupon is unavailable or its minimum spend has not been reached.");
    const count = db
      .prepare("SELECT count(*) AS n FROM coupon_uses WHERE coupon_id=?")
      .get(coupon.id).n;
    if (count >= coupon.limit) fail("Coupon redemption limit reached.");
    couponId = coupon.id;
    if (coupon.type === "shipping") shipping = 0;
    else
      discount = Math.min(
        subtotal,
        coupon.type === "percent"
          ? Math.round((subtotal * coupon.value) / 100)
          : coupon.value,
      );
  }
  return {
    lines,
    subtotal,
    shipping,
    freeDelivery,
    discount,
    total: subtotal + shipping - discount,
    currency: config.currency,
    couponId,
    requirements: [...requirements.values()],
  };
}
export function orderView(db, row, admin = false) {
  if (!row) fail("Order not found.", 404);
  const data = JSON.parse(row.data);
  const events = db
    .prepare(
      "SELECT data,created_at FROM order_events WHERE order_id=? ORDER BY rowid",
    )
    .all(row.id)
    .map((e) => ({ ...JSON.parse(e.data), createdAt: e.created_at }));
  if (!admin) delete data.adminNote;
  return {
    ...data,
    id: row.id,
    number: row.number,
    status: row.status,
    createdAt: row.created_at,
    events,
    items: db.prepare("SELECT * FROM order_items WHERE order_id=? ORDER BY rowid").all(row.id).map((item) => ({ id: item.id, productId: item.product_id, variantId: item.variant_id, quantity: item.quantity, unitPrice: (data.lines || []).find((line) => line.productId === item.product_id && line.variantId === item.variant_id)?.unitPrice, ...JSON.parse(item.data) })),
  };
}
export function placeOrder(db, session, input, withinTransaction = false) {
  const work = () => {
    const previous = db
      .prepare("SELECT * FROM orders WHERE session_id=? AND idempotency_key=?")
      .get(session.id, input.idempotencyKey);
    if (previous) return orderView(db, previous);
    if (!input.items.length) fail("Your cart is empty.");
    const total = quote(db, input),
      config = settings(db);
    if (total.total !== input.expectedTotal)
      fail(
        "Prices or shipping changed. Review the updated total before placing your order.",
        409,
      );
    if (
      (input.paymentMethod === "cod" && !config.codEnabled) ||
      (input.paymentMethod === "manual" && !config.manualEnabled)
    )
      fail("Payment method is unavailable.");
    if (input.paymentMethod === "manual" && input.paymentReference.length < 4)
      fail("Enter your mobile payment transaction reference.");
    const orderId = id(),
      token = randomBytes(32).toString("hex");
    const number = `GH-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(5).toString("hex").toUpperCase()}`;
    const { requirements, couponId, ...amounts } = total;
    const data = {
      ...amounts,
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      area: input.area,
      note: input.note,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference,
      paymentStatus:
        input.paymentMethod === "manual" ? "pending_verification" : "unpaid",
      carrier: "",
      trackingNumber: "",
      shippingNote: "",
      version: 1,
      submittedAt: new Date().toISOString(),
    };
    db.prepare(
      "INSERT INTO orders(id,number,user_id,session_id,idempotency_key,token_hash,data) VALUES(?,?,?,?,?,?,?)",
    ).run(
      orderId,
      number,
      session.user_id,
      session.id,
      input.idempotencyKey,
      hash(token),
      JSON.stringify(data),
    );
    for (const req of requirements) {
      const product = record(db, "products", req.productId),
        variant = product.variants.find((v) => v.id === req.variantId);
      variant.stock -= req.quantity;
      save(db, "products", product.id, product);
      db.prepare("INSERT INTO order_items VALUES(?,?,?,?,?,?)").run(
        id(),
        orderId,
        product.id,
        variant.id,
        req.quantity,
        JSON.stringify({ name: product.name, variant: variant.name, unitPrice: variant.price }),
      );
    }
    if (couponId)
      db.prepare("INSERT INTO coupon_uses VALUES(?,?)").run(couponId, orderId);
    db.prepare(
      "INSERT INTO order_events(id,order_id,actor,data) VALUES(?,?,?,?)",
    ).run(
      id(),
      orderId,
      session.user_id || "guest",
      JSON.stringify({ status: "pending", message: "Order placed" }),
    );
    db.prepare(
      "UPDATE checkouts SET status='converted',updated_at=CURRENT_TIMESTAMP WHERE session_id=?",
    ).run(session.id);
    db.prepare("UPDATE carts SET data='[]' WHERE session_id=?").run(session.id);
    return {
      ...orderView(
        db,
        db.prepare("SELECT * FROM orders WHERE id=?").get(orderId),
      ),
      trackingToken: token,
    };
  };
  return withinTransaction ? work() : transaction(db, work);
}
export function convertIncompleteOrder(db, checkoutId, actor, details = {}) {
  return transaction(db, () => {
    const existing = db.prepare("SELECT * FROM orders WHERE json_extract(data,'$.sourceCheckoutId')=?").get(checkoutId);
    if (existing) return orderView(db, existing, true);
    const draft = db.prepare("SELECT * FROM checkouts WHERE id=?").get(checkoutId);
    if (!draft) fail("Incomplete order not found.", 404);
    const data = JSON.parse(draft.data);
    if (data.convertedOrderId) return orderView(db, db.prepare("SELECT * FROM orders WHERE id=?").get(data.convertedOrderId), true);
    if (draft.status === "converted") fail("This checkout has already been converted.", 409);
    data.name = data.name || "Guest Customer";
    data.address = data.address || "Address not provided";
    const input = checkoutSchema.parse({ name: data.name, phone: data.phone, address: data.address, email: data.email || "", note: data.note || "", items: data.items, area: data.area || "inside", coupon: data.coupon || "", paymentMethod: "cod", paymentReference: "", idempotencyKey: data.checkoutKey || draft.id, expectedTotal: quote(db, { items: data.items, area: data.area || "inside", coupon: data.coupon || "" }).total });
    const session = db.prepare("SELECT user_id FROM sessions WHERE id=?").get(draft.session_id);
    const order = placeOrder(db, { id: draft.session_id, user_id: session?.user_id || null }, input, true);
    const convertedAt = new Date().toISOString();
    const stored = JSON.parse(db.prepare("SELECT data FROM orders WHERE id=?").get(order.id).data);
    db.prepare("UPDATE orders SET data=? WHERE id=?").run(JSON.stringify({ ...stored, sourceCheckoutId: draft.id, convertedAt, originalPhone: input.phone }), order.id);
    db.prepare("INSERT INTO order_events(id,order_id,actor,data) VALUES(?,?,?,?)").run(id(), order.id, actor, JSON.stringify({ status: order.status, message: "Incomplete checkout confirmed by Admin", sourceCheckoutId: draft.id, convertedAt }));
    db.prepare("DELETE FROM checkouts WHERE id=?").run(draft.id);
    return orderView(db, db.prepare("SELECT * FROM orders WHERE id=?").get(order.id), true);
  });
}
export function editConfirmedOrder(db, orderId, input, actor) {
  return transaction(db, () => {
    const row = db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
    if (!row) fail("Order not found.", 404);

    const data = JSON.parse(row.data);
    const customer = input.customerInfo || {};
    if (data.originalPhone && customer.phone !== undefined && customer.phone !== data.originalPhone) fail("Original customer phone is locked.", 409);
    if ((data.trackingNumber || data.carrier) && ((customer.name !== undefined && customer.name !== data.name) || (customer.phone !== undefined && customer.phone !== data.phone) || (customer.address !== undefined && customer.address !== data.address))) fail("Customer and delivery details are locked after courier submission.", 409);
    if (data.version !== input.expectedVersion) fail("Order changed. Reload before saving.", 409);
    const current = db.prepare("SELECT * FROM order_items WHERE order_id=? ORDER BY rowid").all(orderId);
    if (!Number.isInteger(input.discount) || input.discount < 0 || input.discount % 100 !== 0) fail("Discount must be a whole BDT amount.");
    const inventoryHeld = !["cancelled", "returned", "refunded"].includes(row.status) || data.courierInventoryHeld;
    const requested = new Map(input.items.map((item) => [item.id, item.quantity]));
    if (requested.size !== input.items.length || input.items.some((item) => !current.some((old) => old.id === item.id))) fail("Invalid order items.");
    if (!input.items.length) fail("An order must contain at least one product.");
    const changes = [];
    for (const item of current) {
      const next = requested.get(item.id);
      if (next === undefined) {
        const product = record(db, "products", item.product_id), variant = product?.variants.find((v) => v.id === item.variant_id);
        if (variant && inventoryHeld) { variant.stock += item.quantity; save(db, "products", product.id, product); }
        db.prepare("DELETE FROM order_items WHERE id=?").run(item.id);
        changes.push(`Product removed: ${JSON.parse(item.data).name}`);
      } else {
        if (!Number.isInteger(next) || next < 1 || next > 999) fail("Quantity must be a whole number from 1 to 999.");
        if (next !== item.quantity) {
          const product = record(db, "products", item.product_id), variant = product?.variants.find((v) => v.id === item.variant_id);
          if (inventoryHeld && !variant) fail("Product variant is unavailable.", 409);
          const delta = item.quantity - next;
          if (inventoryHeld && delta < 0 && variant.stock < -delta) fail(`Not enough stock for ${JSON.parse(item.data).name}.`, 409);
          if (inventoryHeld) { variant.stock += delta; save(db, "products", product.id, product); }
          db.prepare("UPDATE order_items SET quantity=? WHERE id=?").run(next, item.id);
          changes.push(`Quantity changed: ${item.quantity} → ${next}`);
        }
      }
    }
    const remaining = db.prepare("SELECT * FROM order_items WHERE order_id=? ORDER BY rowid").all(orderId);
    if (!remaining.length) fail("An order must contain at least one product.");
    const subtotal = remaining.reduce((sum, item) => { const price = JSON.parse(item.data).unitPrice ?? (data.lines || []).find((line) => line.productId === item.product_id && line.variantId === item.variant_id)?.unitPrice; if (!Number.isSafeInteger(price)) fail("This legacy order cannot be edited safely.", 409); return sum + price * item.quantity; }, 0);
    const discount = input.discount;
    const shipping = input.shipping ?? data.shipping;
    if (discount > subtotal + shipping) fail("Discount cannot exceed subtotal plus shipping.");
    const calculatedTotal = subtotal + shipping - discount;
    const total = calculatedTotal;
    if (discount !== (data.discount || 0)) changes.push(discount ? `Discount set: ৳${discount / 100}` : "Discount removed");
    if (total !== data.total) changes.push(`Final amount changed: ৳${(data.total || 0) / 100} → ৳${total / 100}`);
    if (input.note !== undefined && input.note !== data.note) changes.push("Customer note updated");
    if (customer.note !== undefined && customer.note !== data.note) changes.push("Customer note updated");
    if (input.shipping !== undefined && input.shipping !== data.shipping) changes.push(`Shipping changed: ৳${(data.shipping || 0) / 100} → ৳${input.shipping / 100}`);
    for (const key of ["name", "phone", "address"]) if (customer[key] !== undefined && customer[key] !== data[key]) changes.push(`${key} updated`);
    if (!changes.length) return orderView(db, row, true);
    const lines = remaining.map((item) => { const snapshot = JSON.parse(item.data); const old = (data.lines || []).find((line) => line.productId === item.product_id && line.variantId === item.variant_id); const unitPrice = snapshot.unitPrice ?? old?.unitPrice; if (!Number.isSafeInteger(unitPrice)) fail("This legacy order cannot be edited safely.", 409); return { ...old, type: "product", name: snapshot.name, variant: snapshot.variant, productId: item.product_id, variantId: item.variant_id, unitPrice, quantity: item.quantity, total: unitPrice * item.quantity }; });
    if ((data.lines || []).some((line) => line.type === "combo")) fail("Combo orders cannot be edited safely yet.", 409);
    const nextData = { ...data, ...customer, lines, subtotal, shipping: input.shipping ?? data.shipping, discount, manualDiscount: discount, total, note: customer.note ?? input.note ?? data.note, version: data.version + 1 };
    db.prepare("UPDATE orders SET data=? WHERE id=?").run(JSON.stringify(nextData), orderId);
    db.prepare("INSERT INTO order_events(id,order_id,actor,data) VALUES(?,?,?,?)").run(id(), orderId, actor, JSON.stringify({ status: row.status, message: "Order modified by Admin; " + changes.join("; ") }));
    return orderView(db, db.prepare("SELECT * FROM orders WHERE id=?").get(orderId), true);
  });
}export const transitions = {
  pending: ["processing", "on-hold", "cancelled", "pending-payment", "confirmed"],
  "pending-payment": ["pending", "processing", "on-hold", "cancelled"],
  "on-hold": ["pending", "processing", "cancelled"],
  processing: ["on-hold", "completed", "cancelled", "shipped"],
  completed: ["refunded"],
  refunded: [],
  // Legacy transitions remain available for existing orders.
  
  confirmed: ["processing", "cancelled"],
  
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: ["pending"],
  returned: [],
};
export function updateOrder(db, orderId, input, actor) {
  return transaction(db, () => {
    const row = db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
    if (!row) fail("Order not found.", 404);
    const data = JSON.parse(row.data);
    if (data.version !== input.expectedVersion)
      fail("Order changed. Reload before saving.", 409);
    if (
      input.status !== row.status &&
      !transitions[row.status].includes(input.status)
    )
      fail(`Cannot change ${row.status} to ${input.status}.`);
    if (input.status === "shipped" && (!input.carrier || !input.trackingNumber))
      fail("Carrier and tracking number are required for shipping.");
    const deliveryChanged = ["name", "phone", "address"].some(
      (key) => input[key] !== undefined && input[key] !== data[key],
    );
    if (data.originalPhone && input.phone !== undefined && input.phone !== data.originalPhone) fail("Original customer phone is locked.", 409);
    if (["confirmed", "processing", "shipped", "delivered", "completed"].includes(row.status) && (deliveryChanged || input.carrier !== data.carrier || input.trackingNumber !== data.trackingNumber)) fail("Customer and courier details are locked after confirmation.", 409);
    if (
      deliveryChanged &&
      !["pending", "pending-payment", "on-hold", "confirmed", "processing"].includes(row.status)
    )
      fail("Delivery contact details can only be changed before shipping.");
    if (input.paymentStatus === "refunded" && !["paid", "refunded"].includes(data.paymentStatus))
      fail("Only a recorded payment can be marked refunded.");
    if (
      input.status !== row.status &&
      ["cancelled", "returned"].includes(input.status)
    ) {
      for (const item of db
        .prepare("SELECT * FROM order_items WHERE order_id=?")
        .all(orderId)) {
        const product = record(db, "products", item.product_id),
          variant = product?.variants.find((v) => v.id === item.variant_id);
        if (!variant)
          fail("Cannot restore stock: the original package is missing.", 409);
        variant.stock += item.quantity;
        save(db, "products", product.id, product);
      }
      db.prepare("DELETE FROM coupon_uses WHERE order_id=?").run(orderId);
    }
    if (row.status === "cancelled" && input.status === "pending") {
      for (const item of db
        .prepare("SELECT * FROM order_items WHERE order_id=?")
        .all(orderId)) {
        const product = record(db, "products", item.product_id);
        const variant = product?.variants.find((v) => v.id === item.variant_id);
        if (!variant)
          fail("Cannot reserve stock: the original package is missing.", 409);
        if (variant.stock < item.quantity)
          fail("Not enough stock to restore this order to Pending.", 409);
        variant.stock -= item.quantity;
        save(db, "products", product.id, product);
      }
    }
    const { expectedVersion, status, ...changes } = input;
    db.prepare("UPDATE orders SET data=?,status=? WHERE id=?").run(
      JSON.stringify({ ...data, ...changes, version: data.version + 1 }),
      status,
      orderId,
    );
    db.prepare(
      "INSERT INTO order_events(id,order_id,actor,data) VALUES(?,?,?,?)",
    ).run(
      id(),
      orderId,
      actor,
      JSON.stringify({
        status,
        message: `${row.status} → ${status}${deliveryChanged ? "; delivery details updated" : ""}`,
        carrier: changes.carrier,
        trackingNumber: changes.trackingNumber,
      }),
    );
    return orderView(
      db,
      db.prepare("SELECT * FROM orders WHERE id=?").get(orderId),
      true,
    );
  });
}





