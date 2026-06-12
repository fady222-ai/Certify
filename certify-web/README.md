# Certify Web (واجهة المنصة)

واجهة منصة الشهادات الرقمية العربية — مبنية بـ **Next.js 16 (App Router)** +
TypeScript + TailwindCSS، بتصميم RTL بالكامل.

> ⚠️ هذه نسخة Next.js 16 بها breaking changes — اقرأ `AGENTS.md` وراجع
> `node_modules/next/dist/docs/` قبل كتابة أي كود Next.

## التشغيل المحلي

```bash
npm install
npm run dev   # http://localhost:3000
```

تأكد أن خادم `certify-api` يعمل (المنفذ 8000 افتراضياً).

## متغيرات البيئة

| المتغير | الوصف |
|---------|-------|
| `NEXT_PUBLIC_API_URL` | عنوان خادم `certify-api` (مثل `https://certify-api...up.railway.app`). الافتراضي محلياً `http://127.0.0.1:8000`. |

## النشر

راجع `DEPLOY.md` في جذر المستودع — يشرح نشر الواجهة والخادم على Railway خطوة بخطوة.

## البنية

```
src/app/         صفحات App Router (لوحة التحكم، التحقق، التسعير، المصادقة…)
src/components/  مكوّنات الواجهة (النماذج، المحرر، الهيدر/الفوتر…)
src/lib/         دوال الاتصال بالـ API
```
