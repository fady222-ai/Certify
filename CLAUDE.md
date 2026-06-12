# Certify — منصة الشهادات الرقمية العربية

> **هذا الملف هو "ذاكرة المشروع".** أي جلسة Claude جديدة تقرأه تلقائياً لتفهم
> السياق الكامل دون الحاجة لإعادة الشرح. حدّثه كلما تغيّرت قرارات أو بنية مهمة.

---

## ما هو المشروع

**Certify** — منصة SaaS عربية لإصدار وإدارة والتحقق من **الشهادات الرقمية**
(شهادات إتمام دورات، حضور، تقدير…). RTL بالكامل، عملة **بالدولار USD**.

**القيد الأهم (قرار نهائي):** المشروع **100% Node.js**. ❌ لا PHP / لا Laravel
إطلاقاً — تم الاتفاق على ذلك صراحةً لتسهيل الصيانة والتطوير.

---

## البنية (Monorepo)

```
certify-api/   ← الخادم الخلفي: Express + Prisma + PostgreSQL
certify-web/   ← الواجهة: Next.js 16 (App Router) + TypeScript + Tailwind
docker-compose.yml  ← PostgreSQL محلي للتطوير
DEPLOY.md      ← دليل النشر على Railway (خطوة بخطوة بالعربي)
STRIPE_SETUP.md ← دليل إعداد مفاتيح Stripe
```

> **مهم:** كل من `certify-api` و`certify-web` مشروع Node مستقل بـ `package.json`
> و`Dockerfile` خاص. النشر على Railway يستخدم **Root Directory** لكل خدمة.

> **تنبيه Next.js 16:** اقرأ `certify-web/AGENTS.md` — هذه نسخة بها breaking
> changes؛ راجع `node_modules/next/dist/docs/` قبل كتابة كود Next.

---

## المكدّس التقني

| الطبقة | التقنية |
|--------|---------|
| API | Express, Prisma ORM, PostgreSQL |
| Auth | JWT (jsonwebtoken، صلاحية 7 أيام)، bcryptjs، Zod للتحقق |
| الأمان | helmet, cors, express-rate-limit |
| البريد | **Resend** (HTTP API)، مع fallback للـ console في dev |
| الـ PDF | Puppeteer (headless Chrome) لتحويل HTML RTL إلى PDF |
| الدفع | Stripe (عالمي) · Tap (الخليج) · Paymob (مصر) |
| الواجهة | Next.js 16, TypeScript, TailwindCSS |

---

## بوابات الدفع (3 بوابات)

التسعير بالدولار: Free $0 · Starter $9 · Pro $29 · Business $79 (شهري).

| البوابة | المنطقة | التجديد التلقائي |
|---------|---------|------------------|
| **Stripe** | عالمي | أصلي عبر `invoice.paid` webhook |
| **Tap** | الخليج | cron يومي + بطاقة محفوظة (`tapCardId`) |
| **Paymob** | مصر (فودافون كاش/إنستاباي/فوري) | بطاقات: cron + token؛ المحافظ: تذكير بالبريد فقط |

- ملفات الخدمات: `certify-api/src/services/{stripe,tap,paymob}Service.js`
- التحكم: `certify-api/src/controllers/billingController.js`
- التجديد المجدول: `certify-api/src/jobs/renewSubscriptions.js` (cron يومي 03:00 UTC)
- **مهم للـ webhooks:** `server.js` يتخطّى `express.json` على مساري
  `/billing/webhook` و`/billing/stripe/webhook` (للحفاظ على raw body لتوقيع HMAC).
  Paymob webhook يستخدم JSON عادي (HMAC من الحقول وليس raw body).
- **وضع dev:** إن لم تُضبط مفاتيح بوابة، يتم التبديل المباشر للباقة بدون دفع.

---

## نظام الأمان (مُنفّذ بالكامل)

تأمين شامل لمرحلة التسجيل/المصادقة:

- **تحقق OTP بالبريد**: التسجيل لا يُصدر JWT فوراً — يُرسل رمز 6 أرقام (صلاحية
  15 دقيقة) عبر `POST /auth/verify-email`.
- **قفل الحساب**: بعد 5 محاولات دخول خاطئة → قفل 15 دقيقة (status 423).
- **تسجيل خروج حقيقي**: `POST /auth/logout` يضبط `tokenRevokedAt`؛ الـ middleware
  يرفض أي JWT صدر قبل ذلك الوقت.
- **استعادة كلمة المرور**: `forgot-password` (آمن ضد email enumeration) +
  `reset-password` (رمز صالح ساعة، يُبطل كل JWT قائم).
- **JWT**: قُلّص من 30 يوماً → 7 أيام، مع `jti`.
- **تعقيد كلمة المرور**: 8+ أحرف + حرف كبير + رقم.
- **rate limits**: register 5/دقيقة، forgot-password 5/دقيقة، resend-otp 5/دقيقة.
- ملفات: `authController.js`, `authService.js`, `middleware/auth.js`,
  `services/email/authTemplates.js`. الواجهة: `RegisterForm.tsx` (خطوتان)،
  `LoginForm.tsx`، صفحتا `/forgot-password` و`/reset-password`.

نماذج Prisma المضافة: `VerificationToken`, `PasswordResetToken`. حقول `User`
المضافة: `emailVerified`, `failedLoginAttempts`, `lockedUntil`, `tokenRevokedAt`.

---

## Git والنشر

- **الفرع النشط للتطوير:** `claude/youthful-johnson-qrd0un`
- **المستودع:** `fady222-ai/Certify` (أُعيدت تسميته من `alfady-branch`)
- بعد أي تعديل على schema: شغّل `npx prisma db push` على بيئة النشر.
- **بريد مخصص:** لاستخدام دومين خاص — فعّل الدومين في Resend (DNS) ثم اضبط
  `EMAIL_FROM=noreply@your-domain.com`. لا تغيير في الكود.

### متغيرات البيئة الأساسية (certify-api)
`DATABASE_URL`, `APP_KEY` (32+ حرف), `APP_URL`, `CERTIFY_VERIFY_BASE_URL`,
`CORS_ALLOWED_ORIGINS`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `RESEND_API_KEY`,
`EMAIL_FROM`, ومفاتيح `STRIPE_*` / `TAP_*` / `PAYMOB_*` (كلها اختيارية للبدء).

---

## التشغيل المحلي

```bash
# قاعدة البيانات
docker compose up -d db
# الخادم
cd certify-api && npm install && npx prisma db push && node prisma/seed.js && npm run dev
# الواجهة
cd certify-web && npm install && npm run dev
```

---

## مهام معلّقة / أفكار مستقبلية

- [ ] معالجة حالة `past_due` (تنبيه المستخدم + مهلة سماح قبل التخفيض).
- [x] تحديث `DEPLOY.md`: اسم المستودع في Railway أصبح **Certify** (كان alfady-branch).
- [ ] تحديث عنوان/وصف PR #1 (الوصف القديم يذكر Laravel/Next 14 خطأً).

> **تنبيه schema:** أُضيف حقل `attempts` إلى `VerificationToken` (حدّ محاولات
> تخمين رمز OTP). شغّل `npx prisma db push` على بيئة النشر بعد سحب هذا التحديث.

---

## ملاحظات للجلسات الجديدة

- المستودع نُظِّف من مشروع `branch-chat-server` غير المرتبط (كان في الجذر) — لا
  تُعِد إضافة ملفات رسائل/socket/federation؛ ليست جزءاً من Certify.
- عند العمل على GitHub MCP: تأكد أن نطاق الجلسة هو `fady222-ai/Certify`.
