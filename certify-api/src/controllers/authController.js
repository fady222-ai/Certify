import { z } from "zod";
import * as auth from "../services/authService.js";

const passwordSchema = z
  .string()
  .min(8, "كلمة المرور يجب ألا تقل عن ٨ أحرف.");

const registerSchema = z.object({
  name: z.string().trim().min(2, "الاسم قصير جداً.").max(120),
  email: z.string().trim().email("بريد إلكتروني غير صالح."),
  password: passwordSchema,
  organizationName: z.string().trim().min(2, "اسم الأكاديمية مطلوب.").max(160),
  locale: z.enum(["ar", "en"]).optional(),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "أدخل البريد الإلكتروني."),
  password: z.string().min(1, "كلمة المرور مطلوبة."),
});

const verifyEmailSchema = z.object({
  userId: z.string().uuid("معرّف غير صالح."),
  code: z.string().length(6, "رمز التحقق يتكون من ٦ أرقام."),
});

const resendOtpSchema = z.object({
  userId: z.string().uuid("معرّف غير صالح."),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("بريد إلكتروني غير صالح."),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "الرمز مطلوب."),
  password: passwordSchema,
});

// TOTP codes are 6 digits; backup codes are longer — accept a small range.
const mfaCodeSchema = z.string().trim().min(6, "الرمز مطلوب.").max(20);
const mfaVerifySchema = z.object({
  mfa_token: z.string().min(1, "طلب غير صالح."),
  code: mfaCodeSchema,
});
const mfaCodeBodySchema = z.object({ code: mfaCodeSchema });

function validationError(res, parsed) {
  return res.status(422).json({
    message: parsed.error.issues[0]?.message ?? "بيانات غير صالحة.",
    errors: parsed.error.flatten().fieldErrors,
  });
}

export async function registerHandler(req, res, next) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    const result = await auth.register(parsed.data);
    return res.status(201).json({
      message: "تم إرسال رمز التحقق إلى بريدك الإلكتروني.",
      userId: result.userId,
      requires_verification: true,
    });
  } catch (e) {
    next(e);
  }
}

export async function verifyEmailHandler(req, res, next) {
  try {
    const parsed = verifyEmailSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    const { token, user, org } = await auth.verifyEmail(parsed.data);
    return res.json({ token, ...auth.presentUser(user, org) });
  } catch (e) {
    next(e);
  }
}

export async function resendOtpHandler(req, res, next) {
  try {
    const parsed = resendOtpSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    await auth.resendOtp(parsed.data);
    return res.json({ message: "تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني." });
  } catch (e) {
    next(e);
  }
}

export async function loginHandler(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    const result = await auth.login(parsed.data);
    // MFA enabled → withhold the session; client must complete /auth/mfa/verify.
    if (result.requiresMfa) {
      return res.json({ requires_mfa: true, mfa_token: result.mfaToken });
    }
    const { token, user, org } = result;
    return res.json({ token, ...auth.presentUser(user, org) });
  } catch (e) {
    // Pass userId hint for unverified users so the frontend can show the OTP step
    if (e.statusCode === 403 && e.userId) {
      return res.status(403).json({ message: e.message, userId: e.userId, requires_verification: true });
    }
    next(e);
  }
}

export async function mfaVerifyHandler(req, res, next) {
  try {
    const parsed = mfaVerifySchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    const { token, user, org } = await auth.verifyMfaLogin({
      mfaToken: parsed.data.mfa_token,
      code: parsed.data.code,
    });
    return res.json({ token, ...auth.presentUser(user, org) });
  } catch (e) {
    next(e);
  }
}

export async function mfaSetupHandler(req, res, next) {
  try {
    const { otpauthUri, qrDataUrl, secret } = await auth.setupMfa(req.user);
    return res.json({ otpauth_uri: otpauthUri, qr_data_url: qrDataUrl, secret });
  } catch (e) {
    next(e);
  }
}

export async function mfaEnableHandler(req, res, next) {
  try {
    const parsed = mfaCodeBodySchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    const { backupCodes } = await auth.enableMfa(req.user, parsed.data.code);
    return res.json({ message: "تم تفعيل المصادقة الثنائية.", backup_codes: backupCodes });
  } catch (e) {
    next(e);
  }
}

export async function mfaDisableHandler(req, res, next) {
  try {
    const parsed = mfaCodeBodySchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    await auth.disableMfa(req.user, parsed.data.code);
    return res.json({ message: "تم تعطيل المصادقة الثنائية." });
  } catch (e) {
    next(e);
  }
}

export async function logoutHandler(req, res, next) {
  try {
    await auth.logout({ userId: req.user.id });
    return res.json({ message: "تم تسجيل الخروج بنجاح." });
  } catch (e) {
    next(e);
  }
}

export async function forgotPasswordHandler(req, res, next) {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    await auth.forgotPassword(parsed.data);
    return res.json({ message: "إن كان البريد مسجلاً، ستصلك رسالة استعادة خلال دقائق." });
  } catch (e) {
    next(e);
  }
}

export async function resetPasswordHandler(req, res, next) {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    await auth.resetPassword({ token: parsed.data.token, newPassword: parsed.data.password });
    return res.json({ message: "تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول." });
  } catch (e) {
    next(e);
  }
}

export async function meHandler(req, res) {
  return res.json(auth.presentUser(req.user, req.organization));
}

const localeSchema = z.object({ locale: z.enum(["ar", "en"]) });

// Persist the signed-in user's UI language so transactional emails (OTP,
// billing, support) match the language they're actually using.
export async function setLocaleHandler(req, res, next) {
  try {
    const parsed = localeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ message: parsed.error.issues[0]?.message ?? "Invalid locale." });
    }
    await auth.updateLocale(req.user.id, parsed.data.locale);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}
