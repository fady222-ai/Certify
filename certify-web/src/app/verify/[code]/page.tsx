import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { verifyCertificate } from "@/lib/api";
import { CertificateActions } from "@/components/CertificateActions";
import {
  IconCheck, IconShield, IconBadge, IconArrow, IconBan, IconClock,
} from "@/components/icons";
import type { VerificationResult } from "@/lib/api";

type Params = { params: Promise<{ code: string }> };

type VerifyState = "verified" | "revoked" | "expired" | "tampered" | "invalid";

/**
 * Collapse the raw verification flags into one coherent state so the page never
 * shows contradictory messages (e.g. "cannot verify" alongside "no tampering").
 * Status takes precedence: a revoked/expired certificate is not "verified" even
 * though its integrity hash still matches.
 */
function verifyState(result: VerificationResult): VerifyState {
  if (result.status === "revoked") return "revoked";
  if (!result.integrity) return "tampered";
  if (result.valid) return "verified";
  // Found, not revoked, hash intact, yet not valid → past its expiry date.
  if (result.status === "expired" || result.certificate?.expiry_date) return "expired";
  return "invalid";
}

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

  const state = verifyState(result);
  const verified = result.found && state === "verified";

  return (
    <>
      <SiteHeader />
      <main className="mesh-bg flex-1">
        <div className="absolute inset-0 dot-grid opacity-50" />
        <div className="relative mx-auto max-w-3xl px-5 py-14 lg:py-20">
          {/* شريط الحالة */}
          <div className="mx-auto mb-8 text-center">
            {!result.found ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-5 py-2 text-sm font-extrabold text-red-600 ring-1 ring-red-100">
                <IconShield className="h-5 w-5" />
                الشهادة غير موجودة
              </span>
            ) : state === "verified" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-verify-50 px-5 py-2 text-sm font-extrabold text-verify-700 ring-1 ring-verify-100">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-verify-500 text-white">
                  <IconCheck className="h-4 w-4" />
                </span>
                شهادة موثقة وصحيحة
              </span>
            ) : state === "revoked" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-5 py-2 text-sm font-extrabold text-red-600 ring-1 ring-red-100">
                <IconBan className="h-5 w-5" />
                هذه الشهادة ملغاة
              </span>
            ) : state === "expired" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-5 py-2 text-sm font-extrabold text-amber-700 ring-1 ring-amber-100">
                <IconClock className="h-5 w-5" />
                انتهت صلاحية هذه الشهادة
              </span>
            ) : state === "tampered" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-5 py-2 text-sm font-extrabold text-red-600 ring-1 ring-red-100">
                <IconShield className="h-5 w-5" />
                تحذير: بصمة الشهادة غير متطابقة
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-5 py-2 text-sm font-extrabold text-red-600 ring-1 ring-red-100">
                <IconShield className="h-5 w-5" />
                تعذر التحقق من صحة الشهادة
              </span>
            )}
          </div>

          {result.found && result.certificate ? (
            <CertificateCard result={result} verified={!!verified} state={state} />
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

        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function CertificateCard({
  result,
  verified,
  state,
}: {
  result: Awaited<ReturnType<typeof verifyCertificate>>;
  verified: boolean;
  state: VerifyState;
}) {
  const c = result.certificate!;
  const org = c.organization;
  const accent = org.primary_color || "#4f46e5";

  // Status box: one coherent message per state (no contradictory green/red).
  const statusBox = {
    verified: {
      tone: "bg-verify-50 ring-verify-100",
      iconBg: "bg-verify-500",
      icon: IconShield,
      title: "لم يتم العثور على أي تلاعب",
      titleColor: "text-verify-700",
      body: "بيانات الشهادة مطابقة للبصمة الرقمية المسجلة وقت الإصدار.",
    },
    revoked: {
      tone: "bg-red-50 ring-red-100",
      iconBg: "bg-red-500",
      icon: IconBan,
      title: "هذه الشهادة ملغاة",
      titleColor: "text-red-700",
      body: "ألغت جهة الإصدار هذه الشهادة فلم تعد سارية.",
    },
    expired: {
      tone: "bg-amber-50 ring-amber-100",
      iconBg: "bg-amber-500",
      icon: IconClock,
      title: "انتهت صلاحية هذه الشهادة",
      titleColor: "text-amber-700",
      body: "تجاوزت الشهادة تاريخ انتهاء صلاحيتها المحدد وقت الإصدار.",
    },
    tampered: {
      tone: "bg-red-50 ring-red-100",
      iconBg: "bg-red-500",
      icon: IconShield,
      title: "تحذير: بصمة الشهادة غير متطابقة",
      titleColor: "text-red-700",
      body: "قد تكون بيانات هذه الشهادة عدلت بعد إصدارها.",
    },
    invalid: {
      tone: "bg-red-50 ring-red-100",
      iconBg: "bg-red-500",
      icon: IconShield,
      title: "تعذر التحقق من صحة الشهادة",
      titleColor: "text-red-700",
      body: "هذه الشهادة ليست سارية حاليا.",
    },
  }[state];
  const StatusIcon = statusBox.icon;

  return (
    <div className="card mx-auto max-w-2xl overflow-hidden">
      {/* رأس ملون */}
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
              <IconCheck className="h-4 w-4" /> موثقة
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

        {/* حالة الشهادة */}
        <div className={`mt-6 flex items-center gap-3 rounded-xl p-4 ring-1 ${statusBox.tone}`}>
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-white ${statusBox.iconBg}`}>
            <StatusIcon className="h-5 w-5" />
          </span>
          <div>
            <p className={`text-sm font-extrabold ${statusBox.titleColor}`}>{statusBox.title}</p>
            <p className="text-xs text-ink-soft">{statusBox.body}</p>
          </div>
        </div>

        {/* إجراءات */}
        <CertificateActions
          code={c.verification_code}
          pdfUrl={c.pdf_url}
          courseName={c.course_name}
          orgName={org.name}
          issueDate={c.issue_date}
          expiryDate={c.expiry_date}
          openBadge={state !== "revoked"}
        />
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
