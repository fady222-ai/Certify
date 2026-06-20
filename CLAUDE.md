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

التسعير بالدولار (3 باقات): Free $0 · Pro $29 · Business $79 (شهري). الحصص:
مجاني 10 · Pro 2000 · Business 10000 شهادة/شهر. (أُزيلت Starter القديمة؛ `seed.js`
يعطّل أي باقة لم تعد في الكتالوج عبر `isActive:false` فتختفي من `/api/plans`.)

**علم ميزة الإصدار الجماعي (`hasBulkIssuance`):** الباقة المجانية **لا** تستطيع
الإصدار الجماعي — الإنفاذ الموثوق في `controllers/batchController.js` (`createBatch`
يرفض بـ403 إن `!req.organization?.plan?.hasBulkIssuance` قبل أي معالجة ملف). الواجهة
(`dashboard/bulk/page.tsx`) تقرأ نفس العلم عبر `getBilling()` وتعرض بطاقة ترقية بدل
أداة الرفع. العلم مكشوف في API عبر `presentPlan` (`has_bulk_issuance`)، ومصدره
الكتالوج `config/plans.js` (free=false، pro/business=true). نمط مطابق لـ`hasApi`/
`hasWhiteLabel`.

| البوابة | المنطقة | التجديد التلقائي |
|---------|---------|------------------|
| **Stripe** | عالمي | أصلي عبر `invoice.paid` webhook |
| **Tap** | الخليج | cron يومي + بطاقة محفوظة (`tapCardId`) |
| **Paymob** | مصر (فودافون كاش/إنستاباي/فوري) | بطاقات: cron + token؛ المحافظ: تذكير بالبريد فقط |

- ملفات الخدمات: `certify-api/src/services/{stripe,tap,paymob}Service.js`
- **التحكم (مقسّم لثلاثة، مسؤولية واحدة لكلٍّ):**
  `controllers/billingController.js` (المعالِجات المُصادَقة: `listPlans`/`getBilling`/
  `createCheckout`/`cancelSubscription`/`changePlan`) ·
  `controllers/billingWebhookController.js` (callbacks/webhooks للبوابات الثلاث:
  تحقّق توقيع + idempotency + تطبيق الحالة) ·
  `services/billingService.js` (المساعدات المشتركة: `presentPlan`/`presentSubscription`/
  `applyPlanToOrg`/`cancelActiveGatewaySubscription`/`isFreshWebhookEvent`).
- التجديد المجدول: `certify-api/src/jobs/renewSubscriptions.js` (cron يومي 03:00 UTC)
- **مهم للـ webhooks:** `server.js` يتخطّى `express.json` على مساري
  `/billing/webhook` و`/billing/stripe/webhook` (للحفاظ على raw body لتوقيع HMAC).
  Paymob webhook يستخدم JSON عادي (HMAC من الحقول وليس raw body). توقيع Paymob
  يُقارَن بـ `timingSafeEqual` (مقارنة ثابتة الزمن).
- **توقيع webhooks في الإنتاج:** عند تفعيل أي بوابة في الإنتاج يجب ضبط سر الـ
  webhook (`STRIPE_WEBHOOK_SECRET`/`TAP_WEBHOOK_SECRET`/`PAYMOB_HMAC_SECRET`)؛
  الخادم يرفض أي webhook بلا توقيع صالح. التخطّي مسموح في dev فقط.
- **محدِّد معدّل للـ webhooks:** مسارات الـ webhook/callback العامة (Tap/Stripe/Paymob)
  محميّة بمحدِّد مخصّص 60/دقيقة لكل IP (`webhookLimiter` في `server.js`)، معزول عن
  الميزانية العامة (120/دقيقة على `/api`) — يكفي حركة البوابات الحقيقية ويكبح الإغراق.
- **التخفيض للمجاني** (`changePlan` أو checkout بسعر 0) يُلغي اشتراك Stripe
  النشط فوراً (`cancelActiveGatewaySubscription`) فيتوقف المحاسبة.
- **وضع dev:** إن لم تُضبط مفاتيح بوابة، يتم التبديل المباشر للباقة بدون دفع — **في
  غير الإنتاج فقط**. في الإنتاج (`config.isProduction`) أي بوّابة غير مهيّأة/معطّلة
  تُرفَض بـ`503 gateway_unavailable` ولا تُمنَح الباقة مجاناً أبداً (الفحص موحَّد قبل
  فروع البوّابات في `createCheckout`). البوّابة المجهولة تُرفَض بـ400. `/billing/checkout`
  محدود 20/دقيقة/IP. الواجهة (مُعاد تصميمها): `GatewayPicker` يعرض **المتاح فقط** (لا
  تظليل «غير مفعّلة»)، و`resolveGatewayChoice` صار يُرجِع `{kind}` =
  `none`/`direct`/`picker`: صفر بوّابة → **لا نافذة**؛ زر الترقية المدفوع يُعطَّل برسالة
  «الدفع غير متاح حالياً» (التخفيض للمجاني يبقى متاحاً). واحدة → دفع مباشر؛ اثنتان+ → نافذة.
- **إدارة المفاتيح من لوحة الإدارة (مشفّرة):** المدير يضبط مفاتيح البوابات الثلاث من
  `/admin/payment-gateways` بدل متغيّرات البيئة فقط. المصدر الموحَّد
  `services/gatewayConfig.js`: قِيَم قاعدة البيانات (إن وُجدت) تُرجِّح على متغيّرات
  البيئة (fallback)، مع كاش بالذاكرة يُحمَّل عند الإقلاع (`loadGatewayConfigs` في
  `server.js`) ويُحدَّث عند كل كتابة (`refreshGatewayConfig`) فيبقى مسار الدفع/الـ
  webhook متزامناً بلا استعلام لكل طلب. الخدمات الثلاث تقرأ عبر
  `stripeConfig()`/`tapConfig()`/`paymobConfig()` و`isConfigured()` صارت
  `isGatewayAvailable()` (مُفعّلة + الحقول المطلوبة موجودة).
  - **الأمان:** الأسرار تُخزَّن مشفّرة AES-256-GCM (`services/secretCrypto.js`،
    مفتاح مشتقّ من `APP_KEY`)؛ الـAPI لا يُعيد السرّ كاملاً أبداً — فقط معاينة
    مقنّعة (`••••1234`). تحديث جزئي (الحقل السرّي الفارغ يُبقي المحفوظ)؛ تحقّق
    بادئات Stripe؛ كل المسارات `requireAuth + requireAdmin`؛ تسجيل `updatedById`.
  - المسارات: `GET/PUT/DELETE /api/admin/payment-gateways[/:gateway]`
    (`adminController.js`). الواجهة: `lib/admin.ts` + صفحة `admin/payment-gateways`.
  - **نموذج حالات الواجهة (مُعاد تصميمها):** صفحة الأدمن تعرض لكل بوّابة **حالة واحدة**
    مشتقّة عبر `gatewayStatus()` (`lib/admin.ts`): `needs_setup` (ينقص مفتاح مطلوب) /
    `live` (مكتملة ومُتاحة = `available`) / `off` (مكتملة لكن مُوقفة). مفتاح **«الإتاحة
    للعملاء»** يظهر فقط بعد اكتمال المفاتيح (live/off) ويحفظ فوراً؛ وفي `needs_setup` زر
    **«حفظ وإتاحة للعملاء»** يحفظ المفاتيح ويُفعّل معاً (معطّل حتى تكتمل). ملخّص علوي
    «ما يراه العملاء» يسرد البوّابات الحيّة. الحقول قابلة للتحرير دوماً (المفتاح يعني
    الإتاحة لا قفل التحرير). **لا تغيير خلفي** — الحالات تُشتق من `enabled`/`available`/
    `fields[].set`. حارس الخلفية: لا يُقبل `enabled:true` بحقول مطلوبة ناقصة (422،
    `missingRequiredFields`).
  - **حدّ طول الحقول:** `validateGatewayFields` يرفض أي حقل > 1024 حرفاً
    (`MAX_FIELD_LEN`) فلا يُخزَّن blob مشفّر ضخم يُفكّ بالذاكرة عند كل تحميل كاش.
  - **قيد الكاش متعدّد النسخ:** كاش `gatewayConfig` بالذاكرة لكل process. على نشر
    بأكثر من نسخة API، كتابة الأدمن (تدوير/تعطيل مفتاح) لا تنتشر للنسخ الأخرى حتى
    إعادة الإقلاع. نشر Railway الحالي بنسخة واحدة غير متأثّر؛ عند التوسّع أفقياً
    يلزم آلية إبطال كاش مشترَكة (إشعار/إعادة قراءة).
  - **اختبارات** (`test/gateway-config.test.js`): دورة تشفير/فكّ + كشف العبث،
    التقنيع، الدمج الجزئي، التحقق (شامل حدّ الطول)، وأن قيمة DB تُرجِّح وتُقنَّع في عرض الـAPI.
- **اختبارات** (`test/billing.test.js` + `test/billing-prod-security.test.js`، `npm test`):
  تثبّت منطق كودنا (لا منطق البوابة) دون DB/شبكة حقيقية — التحقق من التوقيع
  (Tap HMAC-SHA256، Paymob HMAC-SHA512 على 20 حقلاً، Stripe عبر الـ SDK: قبول الصحيح
  ورفض المزيّف)؛ معالِجات الـ webhook (توقيع خاطئ → 401، `CAPTURED`/`success` → تفعيل
  وحفظ البطاقة، `FAILED`/فشل → `past_due`)؛ منطق المهلة في `processRenewals` (تخفيض
  `past_due` المتجاوز للمهلة و`cancelAtPeriodEnd` المنتهية للمجاني، وعدم تخفيض ما هو
  داخل المهلة)؛ وضمان الإنتاج: رفض أي webhook غير موقّع عند غياب السر.

---

## إدارة المنظمات (الأدمن)

- **القائمة** (`/admin/organizations`): بحث + تغيير الباقة + إيقاف/تفعيل، وكل صفّ يفتح
  **صفحة التفاصيل** `/admin/organizations/[id]`.
- **صفحة التفاصيل (drill-down):** `GET /api/admin/organizations/:id`
  (`adminController.getAdminOrganization`، requireAuth+requireAdmin) تُرجِع المالك +
  حالة بريده، الاشتراك (الحالة/المبلغ/الفترة/البوابة)، الاستخدام الشهري وإجمالي الشهادات،
  وعدّادات (قوالب/دفعات/أعضاء/تذاكر) + العلامة التجارية. الإجراءات (تغيير الباقة،
  إيقاف/تفعيل) مضمّنة في الصفحة بإعادة استخدام `adminChangePlan`/`adminToggleSuspend`.
  (قراءة فقط — لا تغيير schema.)
- **تحكّم بتحقّق بريد المالك:** من صفحة التفاصيل، إن كان بريد المالك غير مُحقّق يستطيع
  الأدمن **إعادة إرسال OTP** (`POST /api/admin/organizations/:id/resend-otp`، يعيد استخدام
  `authService.resendOtp`) أو **تحويله إلى مُحقّق مباشرةً** (`POST .../verify-email`، يضبط
  `emailVerified=true` ويُبطل الرموز المعلّقة). كلاهما requireAuth+requireAdmin.
- **أرقام التاريخ لاتينية:** `lib/format.ts` (`formatDate`/`formatDateTime` بـ
  `numberingSystem:"latn"`) لعرض أرقام غربية مع نصّ عربي؛ مُطبّقة عبر صفحات الأدمن/الفوترة/
  الدعم/الدفعات (بدل `ar-SA` الذي يُظهر أرقاماً عربية).

## نظام الأمان (مُنفّذ بالكامل)

تأمين شامل لمرحلة التسجيل/المصادقة:

- **تحقق OTP بالبريد**: التسجيل لا يُصدر JWT فوراً — يُرسل رمز 6 أرقام (صلاحية
  15 دقيقة) عبر `POST /auth/verify-email`. حماية ضد التخمين: محدِّد 5/دقيقة على
  المسار + عدّاد محاولات لكل رمز (`VerificationToken.attempts`، يُبطَل الرمز بعد
  5 محاولات خاطئة → 429).
- **الدخول بالبريد أو اسم الأكاديمية**: `login` يستقبل `identifier` ويبحث بالبريد
  أولاً ثم باسم المنظمة (فريد، غير حسّاس للأحرف) → مالكها. لا حقل `username` منفصل.
- **الحماية من تخمين كلمة المرور**: لا قفل لكل‑حساب (كان قابلاً للتسليح كـ DoS
  عبر اسم الأكاديمية العام). الاعتماد على محدِّدات معدّل لكل IP على `/auth/login`:
  10/دقيقة (سرعة عامة) + 10 محاولات **فاشلة**/15 دقيقة عبر `skipSuccessfulRequests`
  (الدخول الناجح لا يُحتسب). يبقى عدّاد `failedLoginAttempts` للمراقبة فقط.
- **تسجيل خروج حقيقي**: `POST /auth/logout` يضبط `tokenRevokedAt`؛ الـ middleware
  يرفض أي JWT صدر في/قبل ذلك الوقت (مقارنة `<=`).
- **استعادة كلمة المرور**: `forgot-password` (آمن ضد email enumeration) +
  `reset-password` (رمز صالح ساعة، يُبطل كل JWT قائم).
- **JWT**: قُلّص من 30 يوماً → 7 أيام، مع `jti`.
- **طول كلمة المرور**: 8+ أحرف (بلا اشتراط حرف كبير/رقم).
- **rate limits**: register 5/دقيقة، forgot-password 5/دقيقة، resend-otp 5/دقيقة،
  verify-email 5/دقيقة.
- ملفات: `authController.js`, `authService.js`, `middleware/auth.js`,
  `services/email/authTemplates.js`. الواجهة: `RegisterForm.tsx` (خطوتان)،
  `LoginForm.tsx`، صفحتا `/forgot-password` و`/reset-password`.
- **اختبارات** (`test/auth.test.js`، تُشغَّل بـ `npm test`): تثبّت دفاعات التخمين
  دون قاعدة بيانات حقيقية (عزل Prisma بإحلال دوالّ الكائن المفرد في الذاكرة) — تدفّق
  OTP (نجاح، رمز خاطئ يزيد العدّاد، تجاوز 5 محاولات يُبطل الرمز 429، انتهاء الصلاحية)
  وتسجيل الدخول (نجاح يصفّر العدّاد، خطأ 401 بلا قفل حساب، عدم كشف وجود الحساب،
  الدخول باسم الأكاديمية، بريد غير مفعّل → 403 مع إعادة إرسال OTP).

نماذج Prisma المضافة: `VerificationToken` (يحوي `attempts`), `PasswordResetToken`.
حقول `User` المضافة: `emailVerified`, `failedLoginAttempts`, `lockedUntil`,
`tokenRevokedAt`.

### المصادقة الثنائية (MFA / TOTP)

تحقّق بخطوتين اختياري لأي حساب، **والوسيلة الأقوى لحماية حساب الأدمن المميّز**
(الدخول يبقى موحّداً — لا صفحة أدمن منفصلة؛ القرار: الصفحة المنفصلة «إخفاء» بلا أمان).
- **TOTP نقي بلا تبعية:** `services/totp.js` (RFC 6238 بـ`node:crypto`؛ مختبَر بمتجهات
  RFC في `test/totp.test.js`). QR عبر مكتبة `qrcode` الموجودة.
- **التدفّق:** الدخول بخطوتين كنمط OTP القائم — بعد كلمة المرور، إن `totpEnabled`
  يُرجِع `login` **توكن تحدٍّ قصير العمر** (`{typ:"mfa"}`, 5د) بلا جلسة؛ ثم
  `POST /auth/mfa/verify {mfa_token, code}` يتحقّق (TOTP أو رمز احتياطي) ويُصدر JWT.
  توكن التحدّي يمنع تخمين TOTP بالـuserId وحده (يثبت نجاح العامل الأول).
- **التسجيل:** `POST /auth/mfa/setup` (يولّد سرّاً، يخزّنه **مشفّراً** عبر `secretCrypto`،
  يُعيد QR + السرّ) → `POST /auth/mfa/enable {code}` (يؤكّد، يُفعّل، يُعيد **رموز احتياط**
  أحادية الاستخدام مرة واحدة، تُخزَّن بصماتها SHA-256) → `POST /auth/mfa/disable {code}`.
  كلها `requireAuth`. الواجهة: `app/admin/security/page.tsx` (+ بند تنقّل «الأمان» ولافتة
  حثّ في `/admin`)، وخطوة رمز في `LoginForm`، ودوالّ `lib/auth.ts`
  (`verifyMfa`/`setupMfa`/`enableMfa`/`disableMfa`، و`mfa_enabled` في `presentUser`).
- **at-rest:** سرّ TOTP مشفّر AES-GCM، الرموز الاحتياطية مُجزّأة SHA-256 (تسرّب DB وحده
  لا يكفي). محدِّد معدّل على `/auth/mfa/verify` (نفس حدود الدخول) لكبح تخمين الرمز.
- **التعافي من القفل:** `ADMIN_RESET_MFA=true` + إعادة تشغيل → `ensureAdmin` يصفّر MFA
  للأدمن (مخرج طوارئ إن فقد جهازه؛ يُلغى المتغيّر بعدها).
- **اختبارات:** `test/totp.test.js` + توسيع `test/auth.test.js` (تحدٍّ، TOTP صحيح/خاطئ،
  رمز احتياطي أحادي، توكن مزيّف، enable/disable) + `src/lib/auth.test.ts`.

> **تنبيه schema:** أُضيفت حقول `totpSecret`/`totpEnabled`/`mfaBackupCodes` إلى `User`.
> شغّل `npx prisma db push` على بيئة النشر بعد سحب هذا التحديث.

### تحصينات إضافية (مراجعة pentest — PR #2)

- **عزل المستأجرين (IDOR):** الإصدار يتحقّق أن `templateId` عام أو يخصّ نفس
  المنظمة قبل الاستخدام (`certificateIssuer.assertTemplateAccessible`) — يمنع
  استخدام قالب منظمة أخرى الخاص.
- **إلغاء الشهادة يحذف الـ PDF:** `revokeCertificate` يحذف الملف من القرص ويصفّر
  `pdfUrl` فيتوقف رابط `/storage` العام فوراً.
- **صلابة:** `JSON.parse` لـ `design_data` ملفوف بـ try/catch (لا 500 على بيانات
  تالفة)؛ المدير لا يستطيع تغيير باقة منظمته من لوحة الإدارة؛ تحقّق صحة البريد
  في رفع الدفعات؛ حماية `getStoredUser` بالواجهة.
- **سليم بعد التحقق:** حقن SQL، XSS، SSRF (`safeImageSrc`)، CSRF (Bearer token).

### تحصينات إضافية (مراجعة pentest كاملة — الجولة الثانية)

- **OTP آمن تشفيرياً:** `generateOtp` يستخدم `crypto.randomInt` (كان `Math.random`
  القابل للتنبؤ).
- **تثبيت خوارزمية JWT:** `signToken`/`verifyToken` يثبّتان `HS256` صراحةً —
  يُرفض أي توكن بخوارزمية مختلفة (`authService.js`).
- **Puppeteer بلا JS:** `renderPdf` يستدعي `setJavaScriptEnabled(false)` قبل
  `setContent` (دفاع عمق — الشهادة HTML/CSS ثابت لا يحتاج سكربت).
- **منع تكرار الـ webhooks (idempotency):** نموذج `WebhookEvent` (فريد
  `[gateway, eventId]`) + `isFreshWebhookEvent` في `billingController.js`؛ يمنع
  تكرار Stripe لـ`invoice.paid` من تمديد الفترة مرّتين، وإعادة إرسال Tap/Paymob
  من إعادة تفعيل اشتراك. مفاتيح: Stripe `event.id`، Tap `chargeId:status`،
  Paymob `obj.id`.
- **محدِّد معدّل لمسارات التحقق العامة:** `/api/verify` محدودة 60/دقيقة/IP (دفاع
  عمق فوق العام 120/دقيقة).
- **بلاغ خاطئ صُحِّح:** مقارنة إبطال التوكن `<=` صحيحة ومقصودة (ترفض ما صدر
  في/قبل الإبطال) — لا تُغيَّر لـ`<`.
- **تعداد البريد عند التسجيل:** بريد مفعّل يُرجِع 409 صريحاً (مقايضة UX مقبولة،
  مكبوحة بـ5/دقيقة) — الادّعاء بأن التسجيل «آمن ضد التعداد» دقيق فقط للبريد *غير*
  المفعّل (يُعيد إرسال OTP بصمت).
- **اختبارات:** تثبيت خوارزمية JWT (`auth.test.js`) + منع تكرار webhooks
  (`billing.test.js`) ضمن `npm test`.

> **تنبيه schema:** أُضيف نموذج `WebhookEvent`. شغّل `npx prisma db push` على بيئة
> النشر بعد سحب هذا التحديث.

> **تنبيه schema:** أُضيف حقل `hasBulkIssuance` إلى `Plan` (علم ميزة الإصدار
> الجماعي). شغّل `npx prisma db push` ثم `node prisma/seed.js` على بيئة النشر بعد
> سحب هذا التحديث (الـseed يكتب العلم ويعطّل باقة Starter القديمة).

> **تنبيه schema:** أُضيف نموذج `GatewayConfig` (مفاتيح بوابات الدفع المشفّرة).
> شغّل `npx prisma db push` على بيئة النشر بعد سحب هذا التحديث.

---

## نظام الدعم (تذاكر مستخدم/زائر ↔ أدمن)

نظام تذاكر async مترابط (لا WebSocket) **بتدفّقين يتشاركان نموذج بيانات واحداً**:
- **(أ) مستخدم مسجّل:** يفتح تذاكر من `/dashboard/support`، محادثة مترابطة، يرى ردود
  الأدمن، يغلق التذكرة.
- **(ب) زائر بلا حساب:** نموذج تواصل عام `/support` → تذكرة يراها الأدمن؛ الزائر يتابعها
  عبر رابط **`publicToken`** (UUID غير قابل للتخمين) يصله بالبريد ويفتح
  `/support/ticket/[token]` (قراءة + ردّ بلا تسجيل دخول — نمط رابط استعادة كلمة المرور).

- **النماذج:** `SupportTicket` (`userId`/`organizationId` اختياريان للزائر؛ `guestName`/
  `guestEmail`؛ `publicToken @unique`؛ `status`: open/answered/closed؛ `lastMessageAt`)
  و`SupportMessage` (`authorRole`: user/admin/guest هو **مصدر حقيقة المُرسِل**؛ `authorId`
  عمود نصّي عادي لا علاقة). `onDelete: SetNull` يحفظ السجلّ للأدمن إن حُذف المستخدم/المنظمة.
- **التحكم:** `controllers/supportController.js` (Zod + عزل IDOR: مسارات المستخدم مقيّدة
  `{id, userId}` → 404؛ المسارات العامة بالـtoken فقط، لا قبول `id` عام، وتُقيَّد بتذاكر
  الزوّار: `if (!ticket || ticket.userId) 404`).
  العارضات snake_case؛ **الـtoken الخام لا يظهر إلا مرة واحدة في ردّ إنشاء الزائر** (لا في
  أي عرض تذكرة حتى للأدمن).
- **أمان الـtoken (at-rest):** الـtoken قدرة حاملة، فيُعامَل كبيان اعتماد: يُولَّد UUID
  عشوائي ويُسلَّم مرة واحدة (ردّ الإنشاء + رابط البريد)، ويُخزَّن فقط **بصمته SHA-256**
  (`publicTokenHash @unique` للبحث) و**نصّه المشفّر AES-GCM** (`publicTokenEnc` عبر
  `secretCrypto`، لإعادة بناء الرابط في بريد ردّ الأدمن). تسرّب قاعدة البيانات/النسخة
  وحده لا يمنح وصولاً (البصمة لا تُعكَس، والنصّ المشفّر يحتاج `APP_KEY`). تذاكر المستخدمين
  بلا token (null) فهي غير قابلة للوصول عبر المسارات العامة بنيوياً.
- **الحالة ثنائية فقط: `open`/`closed`** (لا نظام حالات/لا «answered»). الردّ لا يغيّر
  الحالة (تبقى مفتوحة)؛ `presentTicket` يطبّع أي قيمة قديمة غير `closed` إلى `open`.
  **الإغلاق صلاحية الأدمن فقط بزرّ واحد** (`adminCloseTicket` → `POST /support/admin/
  tickets/:id/close`؛ أُزيل إغلاق المستخدم ومسار `adminSetStatus`/`status`). **الإغلاق
  نهائي:** الردّ على `closed` يُرفَض بـ409 (مستخدم وزائر) — تُفتح تذكرة جديدة.
- **تجميع بريد الأدمن (بلا حالات):** يُنبَّه الأدمن على ردّ العميل **فقط إذا كان صاحب آخر
  رسالة هو الأدمن** (دارت النوبة إليه)؛ ردود العميل المتتالية لا تُرسل بريداً (كبح إغراق).
- **المسارات** (`routes/index.js`): مستخدم `/support/tickets[...]` (requireAuth) · عام
  `/support/public/tickets[/:token][/messages]` (بلا auth) · أدمن `/support/admin/tickets`
  (requireAuth+requireAdmin، بحث/فلتر/ترقيم).
- **حدود معدّل** (`server.js`): `/api/support/public` 20/دقيقة/IP + إنشاء الزائر POST
  5/ساعة/IP + إنشاء المستخدم POST 20/ساعة/IP — فوق العام 120/دقيقة.
- **قيود إساءة بنيوية** (تصمد أمام تدوير الـIP): حدّ التذاكر المفتوحة لكل صاحب طلب
  (`MAX_OPEN_TICKETS=5`، مستخدم بالـid وزائر بالبريد) + سقف رسائل لكل تذكرة
  (`MAX_MESSAGES_PER_TICKET=200`، و`loadMessages` بـ`take` محدود).
- **البريد** (`services/supportMailer.js` + `services/email/supportTemplates.js`): تنبيهات
  عبر Resend (best-effort، fallback console). **كبح إغراق الأدمن:** إشعار الأدمن يُرسَل
  فقط عند انتقال التذكرة `answered→open` (تجميع بالحالة) لا على كل ردّ + سقف بالذاكرة
  (20 إشعار/10د). **منع التصيّد:** إيصال الزائر بلا أي نصّ يتحكّم به المرسِل (لا اسم/موضوع)
  + تهدئة لكل مستلِم (3/ساعة). **عدم تعداد البريد:** إنشاء الزائر يُرجِع `{public_token}`
  فقط ويُرسل الإيصال بصرف النظر عن وجود الحساب. (القيود بالذاكرة لكل process — قيد توسّع
  أفقي كما في كاش gatewayConfig.)
- **الواجهة:** `lib/support.ts` (دوالّ مُصادَقة عبر `authedFetch` + دوالّ عامة عبر `fetch`)؛
  صفحات `dashboard/support` و`admin/support` و`support` (عام) و`support/ticket/[token]`؛
  بنود تنقّل «الدعم الفني»/«تذاكر الدعم» (IconMail) + رابط فوتر `/support`.
- **اختبارات:** `test/tickets.test.js` (عزل Prisma بالذاكرة: IDOR، عدم التعداد، تخمين
  token→404، التحوّلات، الترقيم) + `src/lib/support.test.ts` (Vitest، mock fetch).

> **تنبيه schema:** أُضيف نموذجا `SupportTicket` و`SupportMessage`، ثم استُبدل
> `publicToken` بـ`publicTokenHash @unique` + `publicTokenEnc` (تخزين الـtoken
> مُجزّأً ومشفّراً). شغّل `npx prisma db push` على بيئة النشر بعد سحب هذا التحديث.

---

## Git والنشر

- **الفرع النشط للتطوير:** `claude/youthful-johnson-qrd0un`
- **المستودع:** `fady222-ai/Certify` (أُعيدت تسميته من `alfady-branch`)
- **CI:** `.github/workflows/ci.yml` (Node 20، لكل push وPR) بوظيفتين:
  `api-tests` (`npm ci` → `npx prisma generate` → `npm test`، بلا قاعدة بيانات —
  عزل DB بالذاكرة) و`web-tests` (`certify-web`: `npm ci` → `npm test` عبر Vitest).
- **اختبارات الواجهة:** Vitest + jsdom (`certify-web/vitest.config.ts` — يحلّ alias `@/`
  كـtsconfig، `npm test`) تغطّي: منطق `src/lib/auth.ts` (تخزين/إبطال التوكن، الدخول
  والتحقق، التسجيل بخطوتين `register`/`resendOtp` دون إنشاء جلسة، استعادة كلمة المرور
  `forgot`/`resetPassword`، `refreshProfile`، و`authedFetch` يُسجّل الخروج على 401)؛
  `src/lib/api.ts` (`verifyCertificate`: نجاح/404/خطأ شبكة)؛ `src/lib/billing.ts`
  (`resolveGatewayChoice`: صفر/واحد بوابة → دفع مباشر، بوابتان+ → نافذة الاختيار)؛
  ومنطق كانفس محرّر القوالب `components/templateEditor/canvas.ts`.
- بعد أي تعديل على schema: شغّل `npx prisma db push` على بيئة النشر.
- **تفرّد اسم المنظمة:** مفروض بفهرس دالّي فريد `lower(name)` يُنشأ تلقائياً عند
  الإقلاع (`ensureOrgNameIndex`, idempotent ومتسامح). إن فشل إنشاؤه بسبب أسماء
  مكرّرة قديمة، شغّل `npm run check:dups` للكشف ثم `npm run check:dups -- --fix`
  لحلّها، وأعد التشغيل.
- **بريد مخصص:** لاستخدام دومين خاص — فعّل الدومين في Resend (DNS) ثم اضبط
  `EMAIL_FROM=noreply@your-domain.com`. لا تغيير في الكود.

### تحسينات الجودة (تنظيف منخفض الأولوية)
- **تقسيم محرّر القوالب:** `components/TemplateEditor.tsx` (كان 465 سطراً) قُسِّم:
  منطق الكانفس النقي (`buildObject`/`objectToElement`/`normColor`/الثوابت) في
  `components/templateEditor/canvas.ts`، وعناصر الواجهة الصغيرة (`Panel`/`ToolBtn`/
  `NumberRow`/`ColorRow`) في `components/templateEditor/controls.tsx`. المنطق النقي
  مُغطّى باختبار `canvas.test.ts`. `vitest.config.ts` يحلّ الآن alias `@/` كـtsconfig.
- **مصدر حقائق الباقات موحّد (الخلفية = المرجع):** الكتالوج المرجعي للباقات
  (الأسعار + الحصة الشهرية + الحدود) في `certify-api/src/config/plans.js`؛
  `prisma/seed.js` يستورده ويكتبه للـDB. الواجهة تحمل **نسخة عرض** في
  `certify-web/src/lib/pricing.ts` (`PLAN_PRICING`) تستوردها الصفحات الثلاث
  `app/page.tsx` و`app/pricing/page.tsx` و`app/dashboard/billing/page.tsx`؛ نصوص
  التسويق (المزايا/الوسوم) تبقى محليّة بكل صفحة. **حارس التطابق:**
  `certify-api/test/plan-pricing-sync.test.js` يقرأ `pricing.ts` ويقارن سعر/حصة كل
  باقة بالكتالوج المرجعي ويُفشل CI عند أي انحراف — فلا يمكن تغيير سعر/حصة في جهة
  دون الأخرى. الحصة تُكتب رقماً واحداً (`certsPerMonth`) ويُشتقّ منه نصّ `certsLabel`
  (صرف عربي صحيح). (كانت الأسعار مكرّرة ومختلفة — الهبوط أظهر $49/$99 خطأً.) الباقات
  تَعِد فقط بالمبنيّ فعلاً (أُزيل ذكر «أعضاء فريق» و«API» و«White-label/نطاق فرعي» الغامض).
- **بوّابات الدفع في الواجهة:** `GatewayPicker` يعرض المتاح فقط؛ وقرار «نافذة أم دفع
  مباشر أم منع» في دالّة نقيّة واحدة `resolveGatewayChoice` (`src/lib/billing.ts`،
  ترجع `none`/`direct`/`picker`) يشترك فيها `/pricing` و`/dashboard/billing`. عند صفر
  بوّابة يُعطَّل زر الترقية المدفوع برسالة (لا نافذة مسدودة). `/pricing` يقرأ التوفّر من
  `/api/plans` عبر `listPlans`. (مغطّاة باختبار `billing.test.ts`؛ ونموذج حالات الأدمن
  بـ`admin.test.ts`.) **قيد dev:** بلا أي بوّابة مهيّأة لا يمكن تجربة الترقية المدفوعة
  من الواجهة (يُهيّأ مفتاح بوّابة واحد لتجربتها).
- **ترقيم صفحات الشهادات:** `GET /api/certificates` يقبل `page`/`pageSize`
  (افتراضي 50، سقف 100) ويُعيد `{ data, total, page, pageSize }`؛ الواجهة
  (`dashboard/certificates`) تعرض أزرار السابق/التالي.
- **تسجيل أخطاء البريد:** `logMailFailure(context)` في `services/email/index.js`
  يحلّ محلّ `.catch(() => {})` الصامت في إرسال البريد (best-effort يبقى غير حاجب،
  لكن الفشل يظهر في السجلّ).

### متغيرات البيئة الأساسية (certify-api)
`DATABASE_URL`, `APP_KEY` (32+ حرف), `APP_URL`, `CERTIFY_VERIFY_BASE_URL`,
`CORS_ALLOWED_ORIGINS`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `RESEND_API_KEY`,
`EMAIL_FROM`, ومفاتيح `STRIPE_*` / `TAP_*` / `PAYMOB_*` (كلها اختيارية للبدء).
`ERROR_WEBHOOK_URL` اختياري: عند ضبطه تُرسَل تنبيهات أخطاء الخادم (5xx + أخطاء
غير ملتقطة) إلى webhook متوافق مع Slack/Discord (`{ text }`).

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

- [x] معالجة حالة `past_due` (مهلة سماح 7 أيام ثم تخفيض للمجاني + بريد
  `sendPaymentFailed`) — منفّذة في `jobs/renewSubscriptions.js`.
- [x] تحديث `DEPLOY.md`: اسم المستودع في Railway أصبح **Certify** (كان alfady-branch).
- [x] تحديث وصف PR #1 — أُضيف تصحيح للمكدّس (Node/Express/Prisma/Next 16 لا
  Laravel/Next 14)؛ الـPR مغلق فالنص الأصلي محفوظ كسجلّ تاريخي.
- [x] تحصين أمني + مراجعة pentest كاملة (PR #2) — راجع قسم نظام الأمان.

> **تنبيه schema:** أُضيف حقل `attempts` إلى `VerificationToken` (حدّ محاولات
> تخمين رمز OTP). شغّل `npx prisma db push` على بيئة النشر بعد سحب هذا التحديث.

### القالب الافتراضي للمنظمة

- `Organization.defaultTemplateId` يحدّد القالب المُستخدَم تلقائياً في كل إصدار،
  فلا يختار المستخدم القالب في كل مرة. يُعيَّن مرة واحدة من صفحة القوالب بزر
  **«تعيين»** (`PUT /api/organization/default-template`، يُعيد استخدام
  `assertTemplateAccessible` لمنع IDOR). حذف القالب يصفّر التعيين تلقائياً.
- `issueCertificate` يرجع للقالب الافتراضي عند عدم تمرير `templateId` (يشمل
  الإصدار الفردي والجماعي عبر نفس المُصدِّر).
- الواجهة: زر **«تعيين»** على بطاقة القالب (حلّ محلّ زر «معاينة» — المعاينة تُفتح
  بالنقر على البطاقة). مودال الإصدار الفردي وصفحة الإصدار الجماعي حُذفت منهما قائمة
  اختيار القالب ويستخدمان الافتراضي، ويعرضان تنبيه «اختر قالباً أولاً» يمنع الإصدار
  إن لم يُعيَّن قالب.

> **تنبيه schema:** أُضيف حقل `defaultTemplateId` إلى `Organization`. شغّل
> `npx prisma db push` على بيئة النشر بعد سحب هذا التحديث.

---

## ملاحظات للجلسات الجديدة

- المستودع نُظِّف من مشروع `branch-chat-server` غير المرتبط (كان في الجذر) — لا
  تُعِد إضافة ملفات رسائل/socket/federation؛ ليست جزءاً من Certify.
- عند العمل على GitHub MCP: تأكد أن نطاق الجلسة هو `fady222-ai/Certify`.
