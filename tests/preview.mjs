// Disposable UI test fixture. This process never opens the real commerce database.
import { openDatabase } from "../server/db.mjs";
import { seed } from "../server/seed.mjs";
import { passwordHash } from "../server/auth.mjs";
import { createApp } from "../server/app.mjs";
const db = openDatabase(":memory:");
seed(db);
db.prepare(
  "INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)",
).run(
  "preview-admin",
  "preview@example.test",
  "Preview Admin",
  await passwordHash("preview-test-only-2026"),
  "admin",
);
const server = createApp(db, {
  origin: "http://127.0.0.1:3002",
  uploadDir: "./data/preview-uploads",
}).listen(3002, "127.0.0.1", () =>
  console.log(
    "Disposable preview: http://127.0.0.1:3002 — preview@example.test / preview-test-only-2026",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
