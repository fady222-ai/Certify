# Certify API (Node.js)

خادم منصة الشهادات الرقمية — مبني بـ **Node.js / Express** (بدون PHP/Composer).

## الستاك
- **Express** — REST API
- **Prisma** — نماذج البيانات والهجرات (PostgreSQL في التطوير والإنتاج)
- **puppeteer** — توليد PDF عربي RTL عبر headless Chrome
- **qrcode** — رمز QR للتحقق
- **crypto** (مدمج) — بصمة HMAC-SHA256 لمنع التزوير

## التشغيل محلياً

```bash
npm install
cp .env.example .env          # عدّل APP_KEY وغيره
npx puppeteer browsers install chrome
npx prisma db push            # إنشاء قاعدة البيانات
npm run db:seed               # بيانات تجريبية (CERT-SMOK-0001)
npm run dev                   # يعمل على http://localhost:8000
```

## نقاط النهاية
- `GET /api/health` — فحص الحالة
- `GET /api/verify/:code` — التحقق العام من شهادة (يسجّل حدث الفتح + فحص السلامة)
- `GET /storage/certificates/:id.pdf` — ملف الشهادة المُولّد

## البنية
```
prisma/schema.prisma     نماذج البيانات
prisma/seed.js           بيانات أولية
src/
  config/                الإعدادات والمتغيرات
  db/prisma.js           عميل Prisma المشترك
  services/
    certificateHasher.js   بصمة HMAC + كشف التلاعب
    certificateRenderer.js رندر PDF عبر puppeteer
    certificateIssuer.js   إصدار + حدود الباقة + تتبع الاستخدام
  templates/certificate.js  قالب الشهادة (HTML/RTL)
  controllers/           معالجات الطلبات
  routes/                مسارات API
  server.js              نقطة الدخول
```

## الانتقال للإنتاج
المخطط يستخدم `provider = "postgresql"` أصلاً، فلا تغيير في الكود مطلوب. اضبط
`DATABASE_URL` على قاعدة الإنتاج ثم طبّق المخطط عبر `npx prisma db push`
(أو `npx prisma migrate deploy` إن كنت تستخدم migrations). راجع `DEPLOY.md`.
