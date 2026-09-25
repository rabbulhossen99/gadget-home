import { transaction, audit } from "./db.mjs";
import { fail, orderView } from "./commerce.mjs";
import { safeUser } from "./auth.mjs";
export function customerExport(db, userId) {
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(userId);
  if (!user) fail("Customer not found.", 404);
  return {
    user: safeUser(user),
    orders: db
      .prepare("SELECT * FROM orders WHERE user_id=?")
      .all(userId)
      .map((o) => orderView(db, o)),
    reviews: db
      .prepare("SELECT product_id,data FROM reviews WHERE user_id=?")
      .all(userId)
      .map((r) => ({ productId: r.product_id, ...JSON.parse(r.data) })),
  };
}
export function anonymizeRequest(db, requestId, actor) {
  return transaction(db, () => {
    const request = db
      .prepare("SELECT * FROM privacy_requests WHERE id=?")
      .get(requestId);
    if (!request) fail("Request not found.", 404);
    const data = JSON.parse(request.data);
    if (data.type !== "deletion" || data.status !== "pending")
      fail("Only pending deletion requests can be fulfilled.");
    const user = db
      .prepare("SELECT * FROM users WHERE id=?")
      .get(request.user_id);
    if (!user || user.role !== "customer")
      fail("Only customer accounts can be anonymized.");
    const orders = db
      .prepare("SELECT * FROM orders WHERE user_id=?")
      .all(user.id);
    if (
      orders.some(
        (o) => !["cancelled", "delivered", "returned"].includes(o.status),
      )
    )
      fail("Resolve active orders before anonymizing this customer.", 409);
    for (const order of orders) {
      const details = JSON.parse(order.data);
      for (const key of [
        "phone",
        "email",
        "address",
        "note",
        "paymentReference",
        "shippingNote",
        "trackingNumber",
      ])
        details[key] = "";
      details.name = "Deleted customer";
      details.version++;
      db.prepare(
        "UPDATE orders SET data=?,session_id=?,token_hash=? WHERE id=?",
      ).run(JSON.stringify(details), "anonymized", "revoked", order.id);
      for (const event of db
        .prepare("SELECT id,data FROM order_events WHERE order_id=?")
        .all(order.id)) {
        const eventData = JSON.parse(event.data);
        delete eventData.trackingNumber;
        db.prepare("UPDATE order_events SET data=? WHERE id=?").run(
          JSON.stringify(eventData),
          event.id,
        );
      }
    }
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
    db.prepare("DELETE FROM reviews WHERE user_id=?").run(user.id);
    db.prepare("UPDATE users SET name=?,email=?,password=? WHERE id=?").run(
      "Deleted customer",
      `${user.id}@deleted.invalid`,
      "disabled",
      user.id,
    );
    db.prepare("UPDATE privacy_requests SET data=? WHERE id=?").run(
      JSON.stringify({
        ...data,
        status: "completed",
        note: "Account and order contact details anonymized; financial order records retained.",
        resolvedAt: new Date().toISOString(),
      }),
      requestId,
    );
    audit(db, actor, "customer.anonymize", user.id);
    return { ok: true };
  });
}
