"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getAdminOrganization, adminChangePlan, adminToggleSuspend,
  adminResendOrgOtp, adminVerifyOrgEmail, type AdminOrgDetail,
} from "@/lib/admin";
import { formatDate, formatDateTime } from "@/lib/format";
import { IconArrow, IconBuilding, IconUsers, IconBadge, IconCreditCard, IconMail, IconCheck } from "@/components/icons";

const PLAN_SLUGS = ["free", "pro", "business"];
const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-600",
  pro: "bg-brand-50 text-brand-700",
  business: "bg-amber-50 text-amber-700",
};
const SUB_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "نشط", cls: "bg-emerald-50 text-emerald-700" },
  past_due: { label: "متأخر", cls: "bg-amber-50 text-amber-700" },
  cancelled: { label: "ملغى", cls: "bg-red-50 text-red-600" },
  inactive: { label: "غير مفعل", cls: "bg-gray-100 text-gray-500" },
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="font-bold text-ink">{children}</span>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof IconBadge; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
        <Icon className="h-4 w-4 text-brand-600" /> {title}
      </h2>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

export default function AdminOrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [org, setOrg] = useState<AdminOrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrg(await getAdminOrganization(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function changePlan(slug: string) {
    setBusy(true);
    try {
      const res = await adminChangePlan(id, slug);
      flash(res.message);
      await load();
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleSuspend() {
    setBusy(true);
    try {
      const res = await adminToggleSuspend(id);
      flash(res.message);
      await load();
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmail() {
    setBusy(true);
    try {
      const res = await adminVerifyOrgEmail(id);
      flash(res.message);
      await load();
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp() {
    setBusy(true);
    try {
      const res = await adminResendOrgOtp(id);
      flash(res.message);
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" /></div>;
  }
  if (error || !org) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Link href="/admin/organizations" className="text-sm font-bold text-brand-700">← رجوع للمنظمات</Link>
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error ?? "غير موجود"}</div>
      </main>
    );
  }

  const sub = org.subscription;
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-6">
      {toast && (
        <div className="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-brand-50 px-5 py-2.5 text-sm font-bold text-brand-700 shadow-lg ring-1 ring-brand-100">{toast}</div>
      )}

      <Link href="/admin/organizations" className="inline-flex items-center gap-1 text-sm font-bold text-brand-700">
        <IconArrow className="h-4 w-4 rotate-180" /> رجوع للمنظمات
      </Link>

      {/* Header + actions */}
      <div className="card flex flex-wrap items-start justify-between gap-4 p-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-black text-ink">{org.name}</h1>
            {org.suspended ? (
              <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600 ring-1 ring-red-100">موقوف</span>
            ) : (
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">نشط</span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-muted">{org.slug} · سجلت {formatDate(org.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={org.plan?.slug ?? "free"}
            disabled={busy}
            onChange={(e) => changePlan(e.target.value)}
            className={`cursor-pointer rounded-md border-0 px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-200 ${PLAN_COLORS[org.plan?.slug ?? "free"]}`}
          >
            {PLAN_SLUGS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={toggleSuspend}
            disabled={busy}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
              org.suspended ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                : "bg-red-50 text-red-600 ring-1 ring-red-200 hover:bg-red-100"}`}
          >
            {busy ? "…" : org.suspended ? "تفعيل" : "إيقاف"}
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="المالك" icon={IconMail}>
          <Row label="الاسم">{org.owner_name ?? "—"}</Row>
          <Row label="البريد">{org.owner_email ?? "—"}</Row>
          <Row label="حالة البريد">
            {org.owner_verified
              ? <span className="inline-flex items-center gap-1 text-emerald-700"><IconCheck className="h-3.5 w-3.5" /> محقق</span>
              : <span className="text-amber-700">غير محقق</span>}
          </Row>
          {!org.owner_verified && (
            <div className="flex flex-wrap gap-2 py-2">
              <button onClick={verifyEmail} disabled={busy}
                className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:opacity-60">
                تحقيق البريد يدويا
              </button>
              <button onClick={resendOtp} disabled={busy}
                className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-bold text-ink-soft ring-1 ring-line transition hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60">
                إعادة إرسال الرمز
              </button>
            </div>
          )}
          <Row label="انضم في">{formatDate(org.owner_joined_at)}</Row>
        </Card>

        <Card title="الباقة والاستخدام" icon={IconBadge}>
          <Row label="الباقة">{org.plan?.name ?? "مجانية"}</Row>
          <Row label="هذا الشهر">{org.certs_this_month}{org.plan?.limit ? ` / ${org.plan.limit}` : ""}</Row>
          <Row label="إجمالي الشهادات">{org.certs_total}</Row>
        </Card>

        <Card title="الاشتراك" icon={IconCreditCard}>
          {sub ? (
            <>
              <Row label="الحالة">
                <span className={`rounded-md px-2 py-0.5 text-xs ${SUB_STATUS[sub.status]?.cls ?? "bg-gray-100 text-gray-500"}`}>
                  {SUB_STATUS[sub.status]?.label ?? sub.status}
                </span>
              </Row>
              <Row label="المبلغ">{sub.amount != null ? `$${sub.amount} / ${sub.interval === "annual" ? "سنة" : "شهر"}` : "—"}</Row>
              <Row label="البوابة">{sub.gateway}</Row>
              <Row label="نهاية الفترة">{formatDate(sub.current_period_end)}</Row>
              {sub.cancel_at_period_end && <Row label="إلغاء تلقائي">نهاية الفترة</Row>}
            </>
          ) : (
            <p className="py-2 text-sm text-ink-muted">لا يوجد اشتراك مدفوع.</p>
          )}
        </Card>

        <Card title="المحتوى" icon={IconUsers}>
          <Row label="القوالب">{org.counts.templates}</Row>
          <Row label="الدفعات">{org.counts.batches}</Row>
          <Row label="الأعضاء">{org.counts.members}</Row>
          <Row label="تذاكر الدعم">{org.counts.support_tickets}</Row>
        </Card>

        <Card title="معلومات" icon={IconBuilding}>
          <Row label="آخر تحديث">{formatDateTime(org.updated_at)}</Row>
          <Row label="اللون الأساسي">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-4 w-4 rounded ring-1 ring-line" style={{ backgroundColor: org.branding.primary_color }} />
              <span dir="ltr">{org.branding.primary_color}</span>
            </span>
          </Row>
          <Row label="الشعار">{org.branding.logo_url ? "موجود" : "—"}</Row>
        </Card>
      </div>
    </main>
  );
}
