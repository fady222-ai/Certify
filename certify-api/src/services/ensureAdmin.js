import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { config } from "../config/index.js";

/**
 * Provisions the platform super-admin from environment variables on startup.
 *
 * The admin is a normal account (logs in via the usual login page) but carries
 * role="admin", which unlocks the admin panel. The credentials live in the
 * ADMIN_EMAIL / ADMIN_PASSWORD env vars — they are the source of truth, so the
 * account can never be hijacked through public registration, and changing the
 * env password + redeploying updates it.
 *
 * Runs every boot and is idempotent. No-op if the env vars aren't set.
 */
export async function ensureAdmin() {
  const { adminEmail, adminPassword, adminName } = config;

  if (!adminEmail || !adminPassword) {
    console.log("[admin] ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin provisioning.");
    return;
  }
  if (adminPassword.length < 8) {
    console.warn("[admin] ADMIN_PASSWORD is shorter than 8 chars — admin not provisioned.");
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: "admin", passwordHash },
    });
    console.log(`[admin] Updated admin account: ${adminEmail}`);
  } else {
    await prisma.user.create({
      data: { email: adminEmail, name: adminName, role: "admin", passwordHash },
    });
    console.log(`[admin] Created admin account: ${adminEmail}`);
  }
}
