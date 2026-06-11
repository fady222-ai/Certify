import { z } from "zod";
import * as auth from "../services/authService.js";

const registerSchema = z.object({
  name: z.string().trim().min(2, "الاسم قصير جداً.").max(120),
  email: z.string().trim().email("بريد إلكتروني غير صالح."),
  password: z.string().min(8, "كلمة المرور يجب ألا تقل عن ٨ أحرف."),
  organizationName: z.string().trim().max(160).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email("بريد إلكتروني غير صالح."),
  password: z.string().min(1, "كلمة المرور مطلوبة."),
});

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

    const { token, user, org } = await auth.register(parsed.data);
    return res.status(201).json({ token, ...auth.presentUser(user, org) });
  } catch (e) {
    next(e);
  }
}

export async function loginHandler(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    const { token, user, org } = await auth.login(parsed.data);
    return res.json({ token, ...auth.presentUser(user, org) });
  } catch (e) {
    next(e);
  }
}

export async function meHandler(req, res) {
  return res.json(auth.presentUser(req.user, req.organization));
}
