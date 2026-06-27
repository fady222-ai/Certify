import { prisma } from "../db/prisma.js";

// Platform-wide key/value flags managed by the platform admin. Cached in memory
// (loaded at boot, refreshed on every write) so the hot path reads are sync.
// NOTE: like gatewayConfig, the cache is per-process — on a multi-instance
// deploy a write won't propagate to other instances until reboot.

const WHATSAPP_FLAG = "whatsapp_enabled";

const cache = new Map(); // key -> string value

/** Load all platform settings into the in-memory cache. Call at boot. */
export async function loadPlatformSettings() {
  try {
    const rows = await prisma.platformSetting.findMany();
    cache.clear();
    for (const r of rows) cache.set(r.key, r.value);
  } catch (e) {
    // Table may not exist yet (pre-migration) — defaults apply.
    console.error("[platformSettings] load skipped:", e.message);
  }
}

function getBool(key, fallback = false) {
  const v = cache.get(key);
  if (v == null) return fallback;
  return v === "true" || v === "1";
}

async function setValue(key, value) {
  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  cache.set(key, value);
}

/** Is the WhatsApp delivery feature enabled platform-wide? (default: off) */
export function isWhatsappEnabledPlatform() {
  return getBool(WHATSAPP_FLAG, false);
}

/** Toggle the platform-wide WhatsApp feature flag. */
export async function setWhatsappEnabledPlatform(enabled) {
  await setValue(WHATSAPP_FLAG, enabled ? "true" : "false");
}
