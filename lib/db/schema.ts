import { pgTable, text, integer, boolean, jsonb, timestamp, pgEnum, primaryKey } from "drizzle-orm/pg-core";
import type { ExtractField } from "../extract/fields";

export const templateFormat = pgEnum("template_format", ["xlsx", "docx"]);
export const fieldKind = pgEnum("field_kind", ["string", "amount", "date", "text"]);
export const fieldSource = pgEnum("field_source", ["rule", "llm", "manual"]);
export const fillStatus = pgEnum("fill_status", ["uploading", "processing", "review", "done", "error"]);

export const templates = pgTable("templates", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  nameRu: text("name_ru").notNull(),
  nameEn: text("name_en").notNull(),
  descRu: text("desc_ru").notNull().default(""),
  descEn: text("desc_en").notNull().default(""),
  locale: text("locale").notNull().default("ru"),
  format: templateFormat("format").notNull(),
  fileKey: text("file_key"),
  sheets: jsonb("sheets").$type<string[]>().notNull().default([]),
  primary: boolean("primary").notNull().default(false),
  userId: text("user_id"),                // null = built-in (pt), else owner email (lowercase)
  deletedAt: timestamp("deleted_at"),     // soft delete: hidden from gallery/wizard, history intact
  defaultFields: jsonb("default_fields").$type<ExtractField[]>(), // LLM-proposed initial set (Reset target); null for pt
});

export const fields = pgTable("fields", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull().references(() => templates.id),
  group: text("group").notNull(),
  labelRu: text("label_ru").notNull(),
  labelEn: text("label_en").notNull(),
  kind: fieldKind("kind").notNull(),
  cell: text("cell").notNull(),
  required: boolean("required").notNull().default(false),
  source: fieldSource("source").notNull(),
  rule: text("rule"),
  unit: text("unit"),
});

export const fills = pgTable("fills", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  templateId: text("template_id").notNull().references(() => templates.id),
  status: fillStatus("status").notNull().default("uploading"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sourceFiles = pgTable("source_files", {
  id: text("id").primaryKey(),
  fillId: text("fill_id").notNull().references(() => fills.id),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: text("size").notNull(),
  pages: integer("pages").notNull().default(1),
  blobKey: text("blob_key"),
});

export const extractedValues = pgTable("extracted_values", {
  id: text("id").primaryKey(),
  fillId: text("fill_id").notNull().references(() => fills.id),
  fieldId: text("field_id").notNull(),
  value: text("value").notNull().default(""),
  confidence: text("confidence").notNull().default("high"),
  sourceFileId: text("source_file_id"),
  locator: text("locator"),
});

export const templateMappings = pgTable("template_mappings", {
  userId: text("user_id").notNull(),
  templateId: text("template_id").notNull().references(() => templates.id),
  fields: jsonb("fields").$type<ExtractField[]>().notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.templateId] }) }));

export const users = pgTable("users", {
  email: text("email").primaryKey(),          // stored lowercased
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userAvatars = pgTable("user_avatars", {
  email: text("email").primaryKey(),            // stored lowercased
  url: text("url").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
