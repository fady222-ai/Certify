import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { prisma } from "../db/prisma.js";
import { config } from "../config/index.js";

const TOKEN_TTL = "30d";

/** Build a URL-safe slug from a name, falling back to a random suffix. */
export function slugify(name) {
  const base = String(name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "") // strips Arabic & punctuation
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  const suffix = crypto.randomBytes(3).toString("hex");
  return base ? `${base}-${suffix}` : `org-${suffix}`;
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.appKey, {
    expiresIn: TOKEN_TTL,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, config.appKey);
}

/** Shape the user + their primary organization for API responses. */
export function presentUser(user, org) {
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      locale: user.locale,
      is_admin: config.adminEmail ? user.email.toLowerCase() === config.adminEmail : false,
    },
    organization: org
      ? {
          id: org.id,
          name: org.name,
          slug: org.slug,
          primary_color: org.primaryColor,
          logo_url: org.logoUrl,
          suspended: !!org.suspendedAt,
          plan: org.plan
            ? { slug: org.plan.slug, name: org.plan.name, certificates_per_month: org.plan.certificatesPerMonth }
            : null,
        }
      : null,
  };
}

/**
 * Register a new user and create their organization on the free plan.
 */
export async function register({ name, email, password, organizationName }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error("هذا البريد الإلكتروني مسجّل بالفعل.");
    err.statusCode = 409;
    throw err;
  }

  const free = await prisma.plan.findUnique({ where: { slug: "free" } });
  const passwordHash = await hashPassword(password);

  const { user, org } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, passwordHash },
    });

    const org = await tx.organization.create({
      data: {
        name: organizationName?.trim() || name,
        slug: slugify(organizationName || name),
        ownerId: user.id,
        planId: free?.id ?? null,
        members: { create: { userId: user.id, role: "owner" } },
      },
      include: { plan: true },
    });

    return { user, org };
  });

  return { token: signToken(user), user, org };
}

/**
 * Authenticate a user by email + password.
 */
export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    const err = new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    err.statusCode = 401;
    throw err;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const err = new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    err.statusCode = 401;
    throw err;
  }

  const org = await primaryOrg(user.id);
  return { token: signToken(user), user, org };
}

/** The user's owned organization (primary workspace). */
export async function primaryOrg(userId) {
  return prisma.organization.findFirst({
    where: { ownerId: userId },
    include: { plan: true },
    orderBy: { createdAt: "asc" },
  });
}
