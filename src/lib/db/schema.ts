import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

const nowIso = () => sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const organizations = sqliteTable("organizations", {
  ein: text("ein").primaryKey(),
  name: text("name").notNull(),
  aka: text("aka"),
  nteeCode: text("ntee_code"),
  nteeMajor: integer("ntee_major"),
  subsection: integer("subsection"),
  city: text("city"),
  county: text("county"),
  state: text("state"),
  fyeMonth: integer("fye_month"),
  orgType: text("org_type", {
    enum: [
      "private_foundation",
      "community_foundation",
      "university",
      "hospital_health",
      "cultural",
      "other_operating",
    ],
  }),
  latestAssets: real("latest_assets"),
  latestFilingYear: integer("latest_filing_year"),
  channelFlag: text("channel_flag"),
  boardMeetingCadence: text("board_meeting_cadence"),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  tag: text("tag"),
  createdAt: text("created_at").notNull().default(nowIso()),
  updatedAt: text("updated_at").notNull().default(nowIso()),
});

export const filings = sqliteTable("filings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ein: text("ein")
    .notNull()
    .references(() => organizations.ein, { onDelete: "cascade" }),
  taxYear: integer("tax_year").notNull(),
  formType: text("form_type"),
  totalRevenue: real("total_revenue"),
  totalExpenses: real("total_expenses"),
  totalAssets: real("total_assets"),
  totalLiabilities: real("total_liabilities"),
  contributions: real("contributions"),
  pdfUrl: text("pdf_url"),
  rawSourceId: integer("raw_source_id").references(() => rawApiCache.id),
  createdAt: text("created_at").notNull().default(nowIso()),
});

export const manualFacts = sqliteTable("manual_facts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ein: text("ein")
    .notNull()
    .references(() => organizations.ein, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: text("value").notNull(),
  enteredAt: text("entered_at").notNull().default(nowIso()),
  note: text("note"),
});

export const people = sqliteTable("people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  notes: text("notes"),
  isKnownContact: integer("is_known_contact", { mode: "boolean" })
    .notNull()
    .default(false),
  isJpmAlum: integer("is_jpm_alum", { mode: "boolean" }).notNull().default(false),
  isPrincipalUhnw: integer("is_principal_uhnw", { mode: "boolean" })
    .notNull()
    .default(false),
  tag: text("tag"),
  createdAt: text("created_at").notNull().default(nowIso()),
});

export const affiliations = sqliteTable("affiliations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  ein: text("ein")
    .notNull()
    .references(() => organizations.ein, { onDelete: "cascade" }),
  role: text("role"),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(true),
  sourceUrl: text("source_url"),
  isVerbalNote: integer("is_verbal_note", { mode: "boolean" }).notNull().default(false),
  tag: text("tag"),
  createdAt: text("created_at").notNull().default(nowIso()),
});

export const signals = sqliteTable("signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ein: text("ein")
    .notNull()
    .references(() => organizations.ein, { onDelete: "cascade" }),
  type: text("type").notNull(),
  headline: text("headline").notNull(),
  detail: text("detail"),
  eventDate: text("event_date").notNull(),
  basePoints: real("base_points").notNull(),
  halfLifeDays: integer("half_life_days"),
  isPersistent: integer("is_persistent", { mode: "boolean" })
    .notNull()
    .default(false),
  sourceUrl: text("source_url"),
  isVerbalNote: integer("is_verbal_note", { mode: "boolean" })
    .notNull()
    .default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  tag: text("tag"),
  createdAt: text("created_at").notNull().default(nowIso()),
});

export const scores = sqliteTable("scores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ein: text("ein")
    .notNull()
    .references(() => organizations.ein, { onDelete: "cascade" }),
  computedAt: text("computed_at").notNull().default(nowIso()),
  pillarBreakdown: text("pillar_breakdown", { mode: "json" }).notNull(),
  total: real("total").notNull(),
  tier: text("tier").notNull(),
  confidence: real("confidence").notNull(),
  confidenceGrade: text("confidence_grade").notNull(),
  weightProfile: text("weight_profile").notNull(),
});

export const pipeline = sqliteTable("pipeline", {
  ein: text("ein")
    .primaryKey()
    .references(() => organizations.ein, { onDelete: "cascade" }),
  stage: text("stage", {
    enum: [
      "identified",
      "researched",
      "outreach",
      "meeting",
      "proposal",
      "won",
      "lost",
      "parked",
    ],
  })
    .notNull()
    .default("identified"),
  ownerNote: text("owner_note"),
  nextAction: text("next_action"),
  nextActionDate: text("next_action_date"),
  lastTouchDate: text("last_touch_date"),
  updatedAt: text("updated_at").notNull().default(nowIso()),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
});

export const rawApiCache = sqliteTable("raw_api_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull(),
  fetchedAt: text("fetched_at").notNull().default(nowIso()),
  payload: text("payload", { mode: "json" }).notNull(),
});
