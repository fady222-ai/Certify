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
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

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
    { expiresIn: TOKEN_TTL },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.appKey);
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
  return Math.floor(100000 + Math.random() * 900000).toString();
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

  const free = await prisma.plan.findUnique({ where: { slug: "free" } });
  const passwordHash = await hashPassword(password);

  const { user } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, passwordHash, emailVerified: false },
    });

    await tx.organization.create({
      data: {
        name: organizationName?.trim() || name,
        slug: slugify(organizationName || name),
        ownerId: user.id,
        planId: free?.id ?? null,
        members: { create: { userId: user.id, role: "owner" } },
      },
    });

    return { user };
  });

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

  if (record.code !== code) {
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

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    const err = new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    err.statusCode = 401;
    throw err;
  }

  if (user.lockedUntil && new Date() < user.lockedUntil) {
    const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    const err = new Error(`الحساب مقفل مؤقتاً بسبب محاولات كثيرة. حاول مجدداً بعد ${remaining} دقيقة.`);
    err.statusCode = 423;
    throw err;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);

  if (!ok) {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const lockData =
      attempts >= MAX_FAILED_ATTEMPTS
        ? { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) }
        : {};

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: attempts, ...lockData },
    });

    const err = new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    err.statusCode = 401;
    throw err;
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  if (!user.emailVerified) {
    await saveAndSendOtp(user.id, user.name, email);
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
