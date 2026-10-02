import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export function openDatabase(
  filename = process.env.DATABASE_PATH || "./data/commerce.sqlite",
) {
  if (filename !== ":memory:")
    mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('customer','admin')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES categories(id) ON DELETE RESTRICT, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS content (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(kind,id));
    CREATE TABLE IF NOT EXISTS carts (session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE, data TEXT NOT NULL DEFAULT '[]');
    CREATE TABLE IF NOT EXISTS checkouts (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, data TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'incomplete', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE UNIQUE INDEX IF NOT EXISTS checkout_session ON checkouts(session_id);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, user_id TEXT REFERENCES users(id), session_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, token_hash TEXT NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(session_id,idempotency_key));
    CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT REFERENCES products(id) ON DELETE RESTRICT, variant_id TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS order_events (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), actor TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS coupon_uses (coupon_id TEXT NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id), PRIMARY KEY(coupon_id,order_id));
    CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), user_id TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0, UNIQUE(product_id,user_id));
    CREATE TABLE IF NOT EXISTS privacy_requests (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS order_status_date ON orders(status,created_at);
    CREATE INDEX IF NOT EXISTS order_user ON orders(user_id);
    INSERT OR IGNORE INTO migrations(version) VALUES(1);
  `);
  // An earlier category delete cleared these columns without updating the
  // records; restore them from the stored data so the references are enforced.
  db.exec(`
    UPDATE products SET category_id=json_extract(data,'$.categoryId')
      WHERE category_id IS NULL AND json_extract(data,'$.categoryId') IN (SELECT id FROM categories);
    UPDATE categories SET parent_id=json_extract(data,'$.parentId')
      WHERE parent_id IS NULL AND json_extract(data,'$.parentId') IN (SELECT id FROM categories);
  `);
  return db;
}
export function transaction(db, work) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export const id = () => randomUUID();
export const decode = (row) =>
  row ? { ...JSON.parse(row.data), id: row.id, version: row.version } : null;
export function records(db, kind) {
  return kind === "products" || kind === "categories"
    ? db.prepare(`SELECT * FROM ${kind}`).all().map(decode)
    : db.prepare("SELECT * FROM content WHERE kind=?").all(kind).map(decode);
}
export function record(db, kind, key) {
  return decode(
    kind === "products" || kind === "categories"
      ? db.prepare(`SELECT * FROM ${kind} WHERE id=?`).get(key)
      : db
          .prepare("SELECT * FROM content WHERE kind=? AND id=?")
          .get(kind, key),
  );
}
export function save(db, kind, key, data, version) {
  const old = record(db, kind, key);
  if (old && version !== undefined && old.version !== version)
    throw Object.assign(
      new Error("This record changed. Reload before saving."),
      { status: 409 },
    );
  const encoded = JSON.stringify(data);
  if (kind === "products")
    db.prepare(
      "INSERT INTO products(id,category_id,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET category_id=excluded.category_id,data=excluded.data,version=products.version+1",
    ).run(key, data.categoryId || null, encoded);
  else if (kind === "categories")
    db.prepare(
      "INSERT INTO categories(id,parent_id,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET parent_id=excluded.parent_id,data=excluded.data,version=categories.version+1",
    ).run(key, data.parentId || null, encoded);
  else
    db.prepare(
      "INSERT INTO content(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,version=content.version+1",
    ).run(kind, key, encoded);
  return record(db, kind, key);
}
export function audit(db, actor, action, target) {
  db.prepare("INSERT INTO audit_log VALUES(?,?,?,?,CURRENT_TIMESTAMP)").run(
    id(),
    actor,
    action,
    target,
  );
}
