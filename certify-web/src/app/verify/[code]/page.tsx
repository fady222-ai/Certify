import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { verifyCertificate } from "@/lib/api";
import {
  IconCheck, IconShield, IconBadge, IconQr, IconLinkedin, IconArrow,
} from "@/components/icons";

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `التحقق من الشهادة ${code} | Certify`,
    description: "صفحة التحقق الرسمية من صحة الشهادة الرقمية.",
  };
}

export default async function VerifyPage({ params }: Params) {
  const { code } = await params;
  const result = await verifyCertificate(code);

  const verified = result.found && result.valid && result.integrity;

  return (
    <>
      <SiteHeader />
      <main className="mesh-bg flex-1">
        <div className="absolute inset-0 dot-grid opacity-50" />
        <div className="relative mx-auto max-w-3xl px-5 py-14 lg:py-20">
          {/* شريط الحالة */}
          <div className="mx-auto mb-8 text-center">
            {verified ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-verify-50 px-5 py-2 text-sm font-extrabold text-verify-700 ring-1 ring-verify-100">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-verify-500 text-white">
                  <IconCheck className="h-4 w-4" />
                </span>
                شهادة موثّقة وصحيحة
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-5 py-2 text-sm font-extrabold text-red-600 ring-1 ring-red-100">
                <IconShield className="h-5 w-5" />
                {result.found ? "تعذّر التحقق من صحة الشهادة" : "الشهادة غير موجودة"}
              </span>
            )}
          </div>

          {result.found && result.certificate ? (
            <CertificateCard result={result} verified={!!verified} />
          ) : (
            <div className="card mx-auto max-w-md p-10 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-red-500">
                <IconShield className="h-8 w-8" />
              </div>
              <h1 className="mt-5 font-display text-2xl font-black text-ink">
                لم نعثر على هذه الشهادة
              </h1>
              <p className="mt-3 text-sm text-ink-soft">
                {result.message ?? "تأكد من صحة رمز التحقق ثم حاول مرة أخرى."}
              </p>
              <p className="mt-4 inline-block rounded-lg bg-surface-2 px-3 py-1.5 font-mono text-xs text-ink-muted">
                {code}
              </p>
              <div className="mt-7">
                <Link href="/" className="btn-ghost">
                  <IconArrow className="h-4 w-4" />
                  العودة للرئيسية
                </Link>
              </div>
            </div>
          )}

          {/* شريط ثقة */}
          <div className="mx-auto mt-10 flex max-w-md items-center justify-center gap-2 text-xs text-ink-muted">
            <IconShield className="h-4 w-4 text-brand-400" />
            تم التحقق عبر بصمة رقمية مشفّرة (HMAC-SHA256)
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function CertificateCard({
  result,
  verified,
}: {
  result: Awaited<ReturnType<typeof verifyCertificate>>;
  verified: boolean;
}) {
  const c = result.certificate!;
  const org = c.organization;
  const accent = org.primary_color || "#4f46e5";

  return (
    <div className="card mx-auto max-w-2xl overflow-hidden">
      {/* رأس ملوّن */}
      <div
        className="px-8 py-7 text-white"
        style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15">
              <IconBadge className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-bold opacity-80">جهة الإصدار</p>
              <p className="font-display text-lg font-extrabold">
                {org.name ?? "منصة الشهادات"}
              </p>
            </div>
          </div>
          {verified && (
            <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
              <IconCheck className="h-4 w-4" /> موثّقة
            </span>
          )}
        </div>
      </div>

      {/* جسم البطاقة */}
      <div className="px-8 py-8">
        <Field label="اسم المتدرب" value={c.recipient_name} big />
        {c.course_name && <Field label="الدورة" value={c.course_name} />}
        <div className="grid grid-cols-2 gap-4">
          {c.issue_date_label && <Field label="تاريخ الإصدار" value={c.issue_date_label} />}
          <Field label="رمز التحقق" value={c.verification_code} mono />
        </div>

        {/* تحقق السلامة */}
        <div className="mt-6 flex items-center gap-3 rounded-xl bg-verify-50 p-4 ring-1 ring-verify-100">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-verify-500 text-white">
            <IconShield className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-verify-700">
              {result.integrity ? "لم يتم العثور على أي تلاعب" : "تحذير: بصمة الشهادة غير متطابقة"}
            </p>
            <p className="text-xs text-ink-soft">
              {result.integrity
                ? "بيانات الشهادة مطابقة للبصمة الرقمية المسجّلة وقت الإصدار."
                : "قد تكون بيانات هذه الشهادة عُدّلت بعد إصدارها."}
            </p>
          </div>
        </div>

        {/* إجراءات */}
        <div className="mt-7 flex flex-wrap gap-3">
          {c.pdf_url && (
            <a href={c.pdf_url} target="_blank" rel="noreferrer" className="btn-primary">
              <IconQr className="h-4 w-4" />
              عرض الشهادة (PDF)
            </a>
          )}
          <button className="btn-ghost" type="button">
            <IconLinkedin className="h-4 w-4 text-[#0a66c2]" />
            إضافة إلى لينكدإن
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  big,
  mono,
}: {
  label: string;
  value: string;
  big?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-bold text-ink-muted">{label}</p>
      <p
        className={`mt-1 font-extrabold text-ink ${big ? "font-display text-2xl" : "text-base"} ${
          mono ? "font-mono text-sm tracking-wide" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
