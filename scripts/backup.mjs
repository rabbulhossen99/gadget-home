import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase } from "../server/db.mjs";
const folder = resolve("./data/backups");
mkdirSync(folder, { recursive: true });
const filename = resolve(
  folder,
  `commerce-${new Date().toISOString().replaceAll(":", "-")}.sqlite`,
);
const db = openDatabase();
try {
  db.prepare("VACUUM INTO ?").run(filename);
  console.log(`Consistent database snapshot saved to ${filename}`);
  console.log(
    "Back up the uploads directory separately. Keep backups outside the public web root.",
  );
} finally {
  db.close();
}
