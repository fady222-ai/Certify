import { prisma } from "../db/prisma.js";

const INDEX_NAME = "organizations_name_lower_key";

/**
 * Create a case-insensitive UNIQUE index on organizations(lower(name)) so the
 * database itself guarantees academy-name uniqueness (closes the registration
 * race). Idempotent and fault-tolerant: if the index can't be created because
 * legacy duplicate names exist, it logs a clear warning and does NOT crash —
 * the app-level check still applies until duplicates are resolved.
 */
export async function ensureOrgNameIndex() {
  try {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX_NAME} ON organizations (lower(name));`,
    );
    console.log("[orgindex] unique index on lower(name) is in place.");
  } catch (e) {
    console.error(
      `[orgindex] could not create unique index (likely duplicate academy names). ` +
        `Run "npm run check:dups" to inspect, then "npm run check:dups -- --fix" and redeploy. Detail: ${e.message}`,
    );
  }
}
