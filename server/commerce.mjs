import { createHash, randomBytes } from "node:crypto";
import { id, record, records, save, transaction } from "./db.mjs";
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
  let shipping =
    config.freeShippingThreshold !== null &&
    subtotal >= config.freeShippingThreshold
      ? 0
      : input.area === "inside"
        ? config.shippingInside
        : config.shippingOutside;
  const freeDelivery =
    lines.length > 0 && lines.every((line) => line.freeDelivery);
  if (freeDelivery) shipping = 0;
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
  };
}
export function placeOrder(db, session, input) {
  return transaction(db, () => {
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
        JSON.stringify({ name: product.name, variant: variant.name }),
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
  });
}
export const transitions = {
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
