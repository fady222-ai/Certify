import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { API_URL, verifyCertificate } from "@/lib/api";
import { CertificateActions } from "@/components/CertificateActions";
import { getDict, normalizeLocale, LOCALE_COOKIE, type Dict } from "@/lib/i18n";
import {
  IconCheck, IconShield, IconBadge, IconArrow, IconBan, IconClock,
} from "@/components/icons";
import type { VerificationResult } from "@/lib/api";

type VDict = Dict["verify"];

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
  const result = await verifyCertificate(code);
  const c = result.certificate;

  // Rich title/description so shares on WhatsApp/LinkedIn/X render an
  // achievement card, not a bare link.
  const title = c
    ? `${c.recipient_name}${c.course_name ? ` — ${c.course_name}` : ""} | شهادة موثّقة`
    : `التحقق من الشهادة ${code} | Certify`;
  const description = c
    ? `شهادة${c.course_name ? ` «${c.course_name}»` : ""} صادرة عن ${
        c.organization.name ?? "منصة الشهادات"
      }. اضغط للتحقق من صحتها.`
    : "صفحة التحقق الرسمية من صحة الشهادة الرقمية.";
  // Use the org logo as the preview image when available (Arabic OG-image
  // generation is avoided for now — see CLAUDE.md).
  const images = c?.organization.logo_url ? [{ url: c.organization.logo_url }] : undefined;

  return {
    title,
    description,
    openGraph: { title, description, type: "website", images },
    twitter: { card: "summary", title, description, images },
  };
}

export default async function VerifyPage({ params }: Params) {
  const { code } = await params;
  const result = await verifyCertificate(code);
  const d = getDict(normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value)).verify;

  const state = verifyState(result);
  const verified = result.found && state === "verified";
  // White-label (Business): hide all Certify chrome — the page shows the issuing
  // academy only, as if it were their own verification page.
  const whiteLabel = !!result.white_label;
  const orgName = result.certificate?.organization.name ?? null;

  const badge = !result.found ? d.notFoundBadge : (d as VDict)[`${state}Badge` as const];

  return (
    <>
      {!whiteLabel && <SiteHeader />}
      <main className="mesh-bg flex-1">
        <div className="absolute inset-0 dot-grid opacity-50" />
        <div className="relative mx-auto max-w-3xl px-5 py-14 lg:py-20">
          {/* شريط الحالة */}
          <div className="mx-auto mb-8 text-center">
            {state === "verified" && result.found ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-verify-50 px-5 py-2 text-sm font-extrabold text-verify-700 ring-1 ring-verify-100">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-verify-500 text-white">
                  <IconCheck className="h-4 w-4" />
                </span>
                {badge}
              </span>
            ) : state === "expired" && result.found ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-5 py-2 text-sm font-extrabold text-amber-700 ring-1 ring-amber-100">
                <IconClock className="h-5 w-5" />
                {badge}
              </span>
            ) : state === "revoked" && result.found ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-5 py-2 text-sm font-extrabold text-red-600 ring-1 ring-red-100">
                <IconBan className="h-5 w-5" />
                {badge}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-5 py-2 text-sm font-extrabold text-red-600 ring-1 ring-red-100">
                <IconShield className="h-5 w-5" />
                {badge}
              </span>
            )}
          </div>

          {result.found && result.certificate ? (
            <CertificateCard result={result} verified={!!verified} state={state} d={d} />
          ) : (
            <div className="card mx-auto max-w-md p-10 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-red-500">
                <IconShield className="h-8 w-8" />
              </div>
              <h1 className="mt-5 font-display text-2xl font-black text-ink">{d.notFoundTitle}</h1>
              <p className="mt-3 text-sm text-ink-soft">{result.message ?? d.notFoundHint}</p>
              <p className="mt-4 inline-block rounded-lg bg-surface-2 px-3 py-1.5 font-mono text-xs text-ink-muted">
                {code}
              </p>
              <div className="mt-7">
                <Link href="/" className="btn-ghost">
                  <IconArrow className="h-4 w-4" />
                  {d.backHome}
                </Link>
              </div>
            </div>
          )}

        </div>
      </main>
      {whiteLabel ? (
        <footer className="border-t bg-surface-2/60 py-6 text-center text-xs text-ink-muted">
          © {new Date().getFullYear()} {orgName ?? ""} · {d.officialFooter}
        </footer>
      ) : (
        <SiteFooter />
      )}
    </>
  );
}

function CertificateCard({
  result,
  verified,
  state,
  d,
}: {
  result: Awaited<ReturnType<typeof verifyCertificate>>;
  verified: boolean;
  state: VerifyState;
  d: VDict;
}) {
  const c = result.certificate!;
  const org = c.organization;
  const accent = org.primary_color || "#4f46e5";

  // Visual tone per state; the title/body text comes from the dictionary.
  const visual = {
    verified: { tone: "bg-verify-50 ring-verify-100", iconBg: "bg-verify-500", icon: IconShield, titleColor: "text-verify-700" },
    revoked: { tone: "bg-red-50 ring-red-100", iconBg: "bg-red-500", icon: IconBan, titleColor: "text-red-700" },
    expired: { tone: "bg-amber-50 ring-amber-100", iconBg: "bg-amber-500", icon: IconClock, titleColor: "text-amber-700" },
    tampered: { tone: "bg-red-50 ring-red-100", iconBg: "bg-red-500", icon: IconShield, titleColor: "text-red-700" },
    invalid: { tone: "bg-red-50 ring-red-100", iconBg: "bg-red-500", icon: IconShield, titleColor: "text-red-700" },
  }[state];
  const statusBox = { ...visual, ...d.status[state] };
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
              <p className="text-xs font-bold opacity-80">{d.issuer}</p>
              <p className="font-display text-lg font-extrabold">
                {org.name ?? d.platformFallback}
              </p>
            </div>
          </div>
          {verified && (
            <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
              <IconCheck className="h-4 w-4" /> {d.verifiedChip}
            </span>
          )}
        </div>
      </div>

      {/* جسم البطاقة */}
      <div className="px-8 py-8">
        <Field label={d.recipient} value={c.recipient_name} big />
        {c.course_name && <Field label={d.course} value={c.course_name} />}
        <div className="grid grid-cols-2 gap-4">
          {c.issue_date_label && <Field label={d.issueDate} value={c.issue_date_label} />}
          <Field label={d.code} value={c.verification_code} mono />
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

        {/* رمز التحقق السريع QR */}
        {state !== "revoked" && (
          <div className="mt-6 flex items-center gap-4 rounded-xl bg-surface-2/60 p-4">
            <img
              src={`${API_URL}/api/verify/${encodeURIComponent(c.verification_code)}/qr.png`}
              alt={d.scanAlt}
              width={96}
              height={96}
              className="h-24 w-24 shrink-0 rounded-lg bg-white p-1.5 ring-1 ring-black/5"
            />
            <div>
              <p className="text-sm font-extrabold text-ink">{d.scanTitle}</p>
              <p className="mt-1 text-xs text-ink-soft">{d.scanDesc}</p>
            </div>
          </div>
        )}

        {/* إجراءات */}
        <CertificateActions
          code={c.verification_code}
          pdfUrl={c.pdf_url}
          courseName={c.course_name}
          orgName={org.name}
          recipientName={c.recipient_name}
          issueDate={c.issue_date}
          expiryDate={c.expiry_date}
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
