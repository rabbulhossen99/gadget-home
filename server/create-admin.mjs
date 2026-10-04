import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { stdin as input, stdout as output } from "node:process";
import { openDatabase, id, transaction, audit } from "./db.mjs";
import { passwordHash } from "./auth.mjs";
import { z } from "zod";
let muted = false;
const terminalOutput = new Writable({
  write(chunk, encoding, done) {
    if (!muted) output.write(chunk, encoding);
    done();
  },
});
const rl = createInterface({
  input,
  output: terminalOutput,
  terminal: !!input.isTTY,
});
const reset = process.argv.includes("--reset-password");
let db;
try {
  const email = z
    .string()
    .email()
    .parse(
      (process.env.ADMIN_EMAIL || (await rl.question("Admin email: ")))
        .trim()
        .toLowerCase(),
    );
  const name = reset
    ? ""
    : (process.env.ADMIN_NAME || (await rl.question("Admin name: "))).trim();
  if (!reset && !name) throw new Error("Name is required");
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    output.write("New password (12+ characters, hidden): ");
    muted = true;
    password = await rl.question("");
    muted = false;
    output.write("\n");
  }
  z.string().min(12).max(128).parse(password);
  db = openDatabase();
  const user = db.prepare("SELECT id,role FROM users WHERE email=?").get(email);
  const hashed = await passwordHash(password);
  if (reset) {
    if (user?.role !== "admin")
      throw new Error("Administrator not found. No account changed.");
    transaction(db, () => {
      db.prepare("UPDATE users SET password=? WHERE id=?").run(hashed, user.id);
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
      audit(db, "local-cli", "admin.password-reset", user.id);
    });
    console.log(
      "Administrator password reset. Existing sessions were revoked.",
    );
  } else {
    if (user)
      throw new Error(
        "Email already exists. No existing account has been changed.",
      );
    db.prepare(
      "INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)",
    ).run(id(), email, name, hashed, "admin");
    console.log("Administrator created. Sign in at /admin.");
  }
} finally {
  muted = false;
  rl.close();
  db?.close();
}
