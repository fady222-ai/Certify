# دليل ربط Stripe بمنصة Certify

## المتطلبات
- حساب Stripe (مجاني للبدء) — سجّل على https://dashboard.stripe.com/register
- سيرفر Certify API يعمل ومتاح من الإنترنت (للـ webhooks في الإنتاج)

---

## 1. إنشاء الحساب والحصول على المفاتيح

### أ) اشترك في Stripe
1. افتح https://dashboard.stripe.com/register
2. أدخل البريد الإلكتروني وكلمة المرور
3. فعّل حسابك من البريد الوارد

### ب) انسخ مفاتيح الاختبار (Test Keys)
1. من لوحة التحكم: **Developers → API keys**
2. ستجد:
   - **Publishable key** — `pk_test_...` (للواجهة الأمامية، غير مستخدم هنا)
   - **Secret key** — `sk_test_...` (الخادم فقط — **لا تشاركه أبداً**)
3. انسخ الـ **Secret key**

---

## 2. إعداد الـ Webhook

الـ webhooks تُبلّغ سيرفرك تلقائياً عند نجاح الدفع أو فشله أو تجديد الاشتراك.

### أ) في الإنتاج (Production)
1. من لوحة Stripe: **Developers → Webhooks → Add endpoint**
2. أدخل عنوان الـ webhook:
   ```
   https://YOUR_API_DOMAIN/api/billing/stripe/webhook
   ```
3. اضغط **Select events** واختر هذه الأحداث الخمسة بالضبط:
   - `checkout.session.completed` — تفعيل الاشتراك بعد الدفع
   - `invoice.paid` — تمديد دورة الاشتراك عند التجديد
   - `invoice.payment_failed` — وضع "متأخر" عند فشل التجديد
   - `customer.subscription.deleted` — التخفيض للمجاني عند الإلغاء
   - `customer.subscription.updated` — تحديث حالة الإلغاء المُجدول
4. اضغط **Add endpoint**
5. من صفحة الـ webhook الجديدة: اضغط **Reveal** بجانب **Signing secret**
6. انسخ القيمة `whsec_...`

### ب) للاختبار المحلي (Stripe CLI)
```bash
# تثبيت Stripe CLI
# macOS:
brew install stripe/stripe-cli/stripe

# تسجيل الدخول
stripe login

# تشغيل الاستماع المحلي (ضع رقم البورت الخاص بك)
stripe listen --forward-to localhost:8000/api/billing/stripe/webhook
```
سيعطيك الأمر مفتاح `whsec_...` مؤقتاً للاختبار المحلي.

---

## 3. ضبط متغيرات البيئة

في ملف `certify-api/.env`:

```env
# مفتاح Stripe السري — للاختبار استخدم sk_test_، للإنتاج sk_live_
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxx

# مفتاح توقيع الـ Webhook (من خطوة 2 أعلاه)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxx
```

أعد تشغيل السيرفر بعد التعديل:
```bash
npm run dev
# أو في الإنتاج:
pm2 restart certify-api
```

---

## 4. اختبار الدفع

### بطاقات الاختبار (Test Cards)
| الغرض | رقم البطاقة | تاريخ الانتهاء | CVV |
|--------|-------------|----------------|-----|
| نجاح الدفع | `4242 4242 4242 4242` | أي تاريخ مستقبلي | أي 3 أرقام |
| تحقق 3D Secure | `4000 0025 0000 3155` | أي تاريخ مستقبلي | أي 3 أرقام |
| رفض البطاقة | `4000 0000 0000 0002` | أي تاريخ مستقبلي | أي 3 أرقام |
| فشل عند التجديد | `4000 0000 0000 0341` | أي تاريخ مستقبلي | أي 3 أرقام |

### خطوات الاختبار الكاملة
1. افتح المنصة وسجّل دخول
2. انتقل إلى `/pricing`
3. اختر باقة مدفوعة → اختر **Stripe**
4. أدخل بطاقة `4242 4242 4242 4242` في صفحة Stripe
5. بعد النجاح ستُعاد إلى `/dashboard/billing?success=1`
6. تحقق من تفعيل الباقة في لوحة التحكم

### مشاهدة الأحداث في Stripe
من لوحة Stripe: **Developers → Events** — ستجد كل الأحداث المُرسلة وحالتها.

---

## 5. الانتقال للإنتاج (Go Live)

### أ) استكمال التحقق في Stripe
1. من لوحة Stripe: اضغط **Activate account** (شريط التنبيه العلوي)
2. أدخل بيانات نشاطك التجاري والمستندات المطلوبة
3. بعد القبول (عادة ساعات لأعمال الخليج)، يُفعَّل وضع الإنتاج

### ب) استبدال المفاتيح في .env
```env
STRIPE_SECRET_KEY=sk_live_xxxxxxxx   # بدلاً من sk_test_
STRIPE_WEBHOOK_SECRET=whsec_live_xxx # webhook جديد بنفس الأحداث للإنتاج
```

### ج) تحقق من webhook الإنتاج
أضف webhook endpoint جديداً في Stripe يشير لعنوان الإنتاج (نفس الأحداث الخمسة).

---

## 6. استكشاف الأخطاء

| المشكلة | السبب الأرجح | الحل |
|---------|--------------|------|
| `No such customer` | معرّف عميل Stripe غير متطابق | امسح قاعدة البيانات وابدأ من جديد في الاختبار |
| `Webhook signature verification failed` | `STRIPE_WEBHOOK_SECRET` خاطئ | تأكد من نسخ المفتاح كاملاً بما فيه `whsec_` |
| `No redirect_url` في التطوير | السيرفر يعمل في dev mode (بلا مفاتيح) | تأكد من ضبط `STRIPE_SECRET_KEY` |
| الاشتراك لا يُفعَّل بعد الدفع | الـ webhook لا يصل | شغّل `stripe listen` محلياً أو تحقق من الـ webhook URL في لوحة Stripe |
| `stripe is not defined` | حزمة stripe غير مثبّتة | شغّل `npm i stripe` في `certify-api` |

---

## 7. ملاحظات أمنية

- **في الإنتاج، سر الـ webhook إلزامي:** عند ضبط `STRIPE_SECRET_KEY` مع
  `NODE_ENV=production`، يرفض الخادم أي webhook بلا توقيع صالح، لذا يجب ضبط
  `STRIPE_WEBHOOK_SECRET` أيضاً وإلا لن تصل إشعارات الدفع/التجديد.
- **لا تضع** `STRIPE_SECRET_KEY` في الكود مباشرة أو في git — فقط في `.env`
- ملف `.env` موجود في `.gitignore` بالفعل
- في الإنتاج استخدم متغيرات بيئة في خادمك (Railway/Render/VPS environment variables)
- الـ `sk_live_` يملك صلاحية سحب أموال — احفظه في مكان آمن

---

## روابط مفيدة

- [لوحة Stripe](https://dashboard.stripe.com)
- [توثيق Stripe Checkout](https://stripe.com/docs/payments/checkout)
- [توثيق Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [بطاقات الاختبار الكاملة](https://stripe.com/docs/testing#cards)
