import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { prisma } from "../db/prisma.js";
import { config } from "../config/index.js";
import { sendEmail } from "./email/index.js";
import { otpEmail, passwordResetEmail } from "./email/authTemplates.js";

const TOKEN_TTL = "7d";
const OTP_TTL_MINUTES = 15;
const RESET_TTL_HOURS = 1;
const MAX_OTP_ATTEMPTS = 5;

export function slugify(name) {
  const base = String(name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
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
  return jwt.sign(
    { sub: user.id, email: user.email, jti: crypto.randomUUID() },
    config.appKey,
    { expiresIn: TOKEN_TTL, algorithm: "HS256" },
  );
}

export function verifyToken(token) {
  // Pin the algorithm — never accept a token signed with anything but HS256.
  return jwt.verify(token, config.appKey, { algorithms: ["HS256"] });
}

export function presentUser(user, org) {
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      locale: user.locale,
      is_admin: user.role === "admin",
      email_verified: user.emailVerified,
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

function generateOtp() {
  // Cryptographically secure, uniformly distributed 6-digit code (100000–999999).
  return crypto.randomInt(100000, 1000000).toString();
}

async function saveAndSendOtp(userId, userName, email) {
  await prisma.verificationToken.deleteMany({ where: { userId } });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await prisma.verificationToken.create({ data: { userId, code, expiresAt } });

  const msg = otpEmail({ userName, code, expiresMinutes: OTP_TTL_MINUTES });
  sendEmail({ to: email, ...msg }).catch(() => {});
}

export async function register({ name, email, password, organizationName }) {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    // Already registered but unverified — resend OTP
    if (!existing.emailVerified) {
      await saveAndSendOtp(existing.id, existing.name, email);
      return { userId: existing.id, requiresVerification: true };
    }
    const err = new Error("هذا البريد الإلكتروني مسجّل بالفعل.");
    err.statusCode = 409;
    throw err;
  }

  // Academy name must be unique (normalized, case-insensitive) — blocks repeat
  // spam accounts reusing the same academy name. The name is immutable later.
  const orgName = String(organizationName ?? "").trim().replace(/\s+/g, " ");

  const free = await prisma.plan.findUnique({ where: { slug: "free" } });
  const passwordHash = await hashPassword(password);

  const conflict = new Error("اسم الأكاديمية مستخدم بالفعل. اختر اسماً آخر.");
  conflict.statusCode = 409;

  let user;
  try {
    ({ user } = await prisma.$transaction(async (tx) => {
      // Re-check uniqueness inside the transaction to close the TOCTOU race.
      const dupOrg = await tx.organization.findFirst({
        where: { name: { equals: orgName, mode: "insensitive" } },
        select: { id: true },
      });
      if (dupOrg) throw conflict;

      const u = await tx.user.create({
        data: { name, email, passwordHash, emailVerified: false },
      });

      await tx.organization.create({
        data: {
          name: orgName,
          slug: slugify(orgName),
          ownerId: u.id,
          planId: free?.id ?? null,
          members: { create: { userId: u.id, role: "owner" } },
        },
      });

      return { user: u };
    }));
  } catch (e) {
    // The DB unique index on lower(name) is the hard guarantee — map its
    // violation to the same friendly message as the app-level check.
    if (e === conflict || e?.code === "P2002") throw conflict;
    throw e;
  }

  await saveAndSendOtp(user.id, user.name, email);
  return { userId: user.id, requiresVerification: true };
}

export async function verifyEmail({ userId, code }) {
  const record = await prisma.verificationToken.findFirst({
    where: { userId, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    const err = new Error("رمز التحقق غير صالح أو منتهي الصلاحية.");
    err.statusCode = 422;
    throw err;
  }

  if (new Date() > record.expiresAt) {
    const err = new Error("انتهت صلاحية رمز التحقق. اطلب رمزاً جديداً.");
    err.statusCode = 422;
    throw err;
  }

  // Too many wrong guesses for this code — invalidate it and force a resend.
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    const err = new Error("تجاوزت عدد المحاولات المسموح. اطلب رمزاً جديداً.");
    err.statusCode = 429;
    throw err;
  }

  if (record.code !== code) {
    await prisma.verificationToken.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    const err = new Error("رمز التحقق غير صحيح.");
    err.statusCode = 422;
    throw err;
  }

  await prisma.$transaction([
    prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: userId }, data: { emailVerified: true } }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const org = await primaryOrg(userId);
  return { token: signToken(user), user, org };
}

export async function resendOtp({ userId }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.emailVerified) {
    const err = new Error("طلب غير صالح.");
    err.statusCode = 400;
    throw err;
  }
  await saveAndSendOtp(user.id, user.name, user.email);
}

// Resolve a login identifier to a user: try email first, then fall back to the
// (unique, case-insensitive) academy name → its owner. Lets users sign in with
// either their email or their academy name, like global platforms.
async function findUserByIdentifier(identifier) {
  const id = String(identifier ?? "").trim();
  if (!id) return null;

  const byEmail = await prisma.user.findUnique({ where: { email: id } });
  if (byEmail) return byEmail;

  const org = await prisma.organization.findFirst({
    where: { name: { equals: id, mode: "insensitive" } },
    select: { ownerId: true },
  });
  if (!org) return null;
  return prisma.user.findUnique({ where: { id: org.ownerId } });
}

export async function login({ identifier, password }) {
  const user = await findUserByIdentifier(identifier);

  if (!user || !user.passwordHash) {
    const err = new Error("البريد الإلكتروني/اسم الأكاديمية أو كلمة المرور غير صحيحة.");
    err.statusCode = 401;
    throw err;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);

  if (!ok) {
    // عدّاد المحاولات الفاشلة (للمراقبة) — بلا قفل لكل‑حساب: القفل كان قابلاً
    // للتسليح كـ DoS عبر اسم الأكاديمية العام. الحماية من التخمين عبر محدِّدات
    // المعدّل لكل IP (انظر loginFailureLimiter في server.js).
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: (user.failedLoginAttempts ?? 0) + 1 },
    });

    const err = new Error("البريد الإلكتروني/اسم الأكاديمية أو كلمة المرور غير صحيحة.");
    err.statusCode = 401;
    throw err;
  }

  if (user.failedLoginAttempts > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0 },
    });
  }

  if (!user.emailVerified) {
    await saveAndSendOtp(user.id, user.name, user.email);
    const err = new Error("يرجى تفعيل بريدك الإلكتروني أولاً. تم إرسال رمز تحقق جديد إليك.");
    err.statusCode = 403;
    err.userId = user.id;
    throw err;
  }

  const org = await primaryOrg(user.id);
  return { token: signToken(user), user, org };
}

export async function logout({ userId }) {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenRevokedAt: new Date() },
  });
}

export async function forgotPassword({ email }) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return without revealing if email exists
  if (!user || !user.emailVerified) return;

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 60 * 60 * 1000);
  await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });

  const resetUrl = `${config.verifyBaseUrl}/reset-password?token=${token}`;
  const msg = passwordResetEmail({ userName: user.name, resetUrl, expiresHours: RESET_TTL_HOURS });
  sendEmail({ to: user.email, ...msg }).catch(() => {});
}

export async function resetPassword({ token, newPassword }) {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!record || record.usedAt) {
    const err = new Error("رابط الاستعادة غير صالح أو مستخدم بالفعل.");
    err.statusCode = 422;
    throw err;
  }

  if (new Date() > record.expiresAt) {
    const err = new Error("انتهت صلاحية رابط الاستعادة. اطلب رابطاً جديداً.");
    err.statusCode = 422;
    throw err;
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        tokenRevokedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
  ]);
}

export async function primaryOrg(userId) {
  return prisma.organization.findFirst({
    where: { ownerId: userId },
    include: { plan: true },
    orderBy: { createdAt: "asc" },
  });
}
