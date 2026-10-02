import { openDatabase } from "./db.mjs";
import { createApp } from "./app.mjs";
const production = process.env.NODE_ENV === "production";
if (production && !process.env.APP_ORIGIN?.startsWith("https://"))
  throw new Error("Production requires APP_ORIGIN=https://your-domain");
const db = openDatabase();
const app = createApp(db, { production });
const server = app.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(`Commerce API listening on port ${process.env.PORT || 3001}`),
);
const cleanup = setInterval(() => {
  db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  const row = db
    .prepare("SELECT data FROM content WHERE kind='settings' AND id='store'")
    .get();
  const days = row ? JSON.parse(row.data).abandonedRetentionDays : 30;
  db.prepare("DELETE FROM checkouts WHERE updated_at < datetime('now',?)").run(
    `-${days} days`,
  );
}, 3600000);
cleanup.unref();
// Refreshes booked shipments from the courier; each shipment is checked at most every 5 minutes.
const courierSync = setInterval(
  () =>
    app.locals.couriers
      .tick()
      .catch((error) => console.error("Courier status sync failed", error)),
  60000,
);
courierSync.unref();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(cleanup);
    clearInterval(courierSync);
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
