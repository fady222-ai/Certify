import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { API_URL, getCredential } from "@/lib/api";
import { IconShield, IconCheck, IconArrow, IconBadge, IconDownload } from "@/components/icons";

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `الشهادة الرقمية ${code} | Certify`,
    description: "شهادة رقمية موثّقة قابلة للتحقق متوافقة مع معيار Open Badges 3.0.",
  };
}

export default async function CredentialPage({ params }: Params) {
  const { code } = await params;
  const result = await getCredential(code);

  return (
    <>
      <SiteHeader />
      <main className="mesh-bg flex-1">
        <div className="absolute inset-0 dot-grid opacity-50" />
        <div className="relative mx-auto max-w-2xl px-5 py-14 lg:py-20">
          {result.ok ? (
            <CredentialCard code={code} result={result} />
          ) : (
            <div className="card mx-auto max-w-md p-10 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-red-500">
                <IconShield className="h-8 w-8" />
              </div>
              <h1 className="mt-5 font-display text-2xl font-black text-ink">
                {result.status === "revoked"
                  ? "هذه الشهادة ملغاة"
                  : "لم نعثر على هذه الشهادة"}
              </h1>
              <p className="mt-3 text-sm text-ink-soft">
                {result.message ??
                  (result.status === "revoked"
                    ? "ألغت جهة الإصدار هذه الشهادة فلم تعد قابلة للتحقق."
                    : "تأكد من صحة رمز التحقق ثم حاول مرة أخرى.")}
              </p>
              <div className="mt-7">
                <Link href={`/verify/${code}`} className="btn-ghost">
                  <IconArrow className="h-4 w-4" />
                  صفحة التحقق
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

function CredentialCard({
  code,
  result,
}: {
  code: string;
  result: { credential: import("@/lib/api").OpenBadgeCredential };
}) {
  const c = result.credential;
  const achievement = c.credentialSubject.achievement?.name ?? c.name ?? "شهادة";
  const issuer = c.issuer?.name ?? "جهة الإصدار";
  const recipient = c.credentialSubject.name ?? "—";
  const jwtUrl = `${API_URL}/api/verify/${encodeURIComponent(code)}/openbadge?format=jwt`;
  const issuerKeysUrl = `${API_URL}/api/credentials/issuer/jwks.json`;

  return (
    <div className="card mx-auto overflow-hidden">
      {/* رأس موثّق */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-8 py-7 text-white">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15">
            <IconBadge className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-bold opacity-80">شهادة رقمية موثّقة</p>
            <p className="font-display text-lg font-extrabold">Open Badges 3.0</p>
          </div>
          <span className="ms-auto flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
            <IconCheck className="h-4 w-4" /> موقّعة تشفيرياً
          </span>
        </div>
      </div>

      {/* الجسم */}
      <div className="px-8 py-8">
        <Field label="الإنجاز" value={achievement} big />
        <Field label="اسم الحاصل عليها" value={recipient} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="جهة الإصدار" value={issuer} />
          {c.validFrom && <Field label="تاريخ الإصدار" value={fmt(c.validFrom)} />}
        </div>
        {c.validUntil && <Field label="صالحة حتى" value={fmt(c.validUntil)} />}

        {/* صندوق ثقة */}
        <div className="mt-6 flex items-start gap-3 rounded-xl bg-verify-50 p-4 ring-1 ring-verify-100">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-verify-500 text-white">
            <IconShield className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-verify-700">موثّقة بتوقيع رقمي (EdDSA / Ed25519)</p>
            <p className="text-xs text-ink-soft">
              هذه شهادة رقمية تحمل توقيعاً تشفيرياً من جهة الإصدار، يستطيع أي طرف خارجي
              (جهة توظيف، جامعة، منصة مهنية) التحقّق منها واكتشاف أي تلاعب — دون الرجوع إلينا.
              متوافقة مع معيار W3C Verifiable Credentials و1EdTech Open Badges 3.0.
            </p>
          </div>
        </div>

        {/* إجراءات للخبراء/الأنظمة */}
        <div className="mt-7 flex flex-wrap gap-3">
          <a href={jwtUrl} className="btn-ghost" download>
            <IconDownload className="h-4 w-4" />
            تنزيل الشهادة الرقمية (.jwt)
          </a>
          <a href={issuerKeysUrl} target="_blank" rel="noreferrer" className="btn-ghost">
            <IconShield className="h-4 w-4" />
            مفاتيح التحقق العامة
          </a>
          <Link href={`/verify/${code}`} className="btn-ghost">
            <IconArrow className="h-4 w-4" />
            صفحة التحقق
          </Link>
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          ملف <span className="font-mono">.jwt</span> موجّه لأنظمة التحقق والمحافظ الرقمية —
          لا تحتاج فتحه يدوياً.
        </p>
      </div>
    </div>
  );
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ar", {
      numberingSystem: "latn",
      dateStyle: "medium",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function Field({
  label,
  value,
  big,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-bold text-ink-muted">{label}</p>
      <p className={`mt-1 font-extrabold text-ink ${big ? "font-display text-2xl" : "text-base"}`}>
        {value}
      </p>
    </div>
  );
}
