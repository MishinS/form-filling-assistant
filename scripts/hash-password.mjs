// scripts/hash-password.mjs
// Usage: node scripts/hash-password.mjs <password>  → prints a bcrypt hash for AUTH_USERS.
import bcrypt from "bcryptjs";

const pw = process.argv[2];
if (!pw) {
  console.error("usage: node scripts/hash-password.mjs <password>");
  process.exit(1);
}
console.log(bcrypt.hashSync(pw, 10));
