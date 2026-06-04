// Upserts the one template row the fills FK needs. Idempotent. Full template-table
// management is phase 8c. Run after `drizzle-kit push`:  node scripts/db-seed.mjs
import pkg from "@next/env";
const { loadEnvConfig } = pkg;
loadEnvConfig(process.cwd());

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }
const sql = neon(url);

await sql`
  INSERT INTO templates (id, code, name_ru, name_en, desc_ru, desc_en, locale, format, file_key, sheets, "primary")
  VALUES ('pt', 'ПТ-Ф15', 'Платёжное требование', 'Payment Request',
          'Внутренняя заявка на оплату по счёту / договору', 'Internal request to pay against an invoice / contract',
          'ru', 'xlsx', 'pt.xlsx', '["ПТ","Счёт","График оплат"]'::jsonb, true)
  ON CONFLICT (id) DO NOTHING
`;
console.log("seed: pt template ensured");
