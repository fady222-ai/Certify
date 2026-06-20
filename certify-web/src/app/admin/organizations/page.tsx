"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  listAdminOrganizations,
  adminChangePlan,
  adminToggleSuspend,
  type AdminOrg,
} from "@/lib/admin";
import { formatDate } from "@/lib/format";
import { IconSearch } from "@/components/icons";

const PLAN_SLUGS = ["free", "pro", "business"];

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-600",
  pro: "bg-brand-50 text-brand-700",
  business: "bg-amber-50 text-amber-700",
};

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const res = await listAdminOrganizations(q);
      setOrgs(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handlePlanChange(orgId: string, slug: string) {
    setBusy(orgId);
    try {
      const res = await adminChangePlan(orgId, slug);
      showToast(res.message);
      await load(search);
    } catch {
      showToast("حدث خطأ أثناء تغيير الباقة.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSuspend(orgId: string) {
    setBusy(orgId);
    try {
      const res = await adminToggleSuspend(orgId);
      showToast(res.message);
      setOrgs((prev) => prev.map((o) => o.id === orgId ? res.organization : o));
    } catch {
      showToast("حدث خطأ.");
    } finally {
      setBusy(null);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load(search);
  }

  return (
    <main className="space-y-6 p-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-brand-50 px-5 py-2.5 text-sm font-bold text-brand-700 shadow-lg ring-1 ring-brand-100">
          {toast}
        </div>
      )}

      <div>
        <h1 className="font-display text-2xl font-black text-ink">إدارة المنظمات</h1>
        <p className="mt-1 text-sm text-ink-soft">كل المنظمات المسجلة على المنصة.</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <IconSearch className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو البريد الإلكتروني…"
            className="input pr-11"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">بحث</button>
          {search && (
            <button type="button" onClick={() => { setSearch(""); load(); }} className="btn-ghost">
              مسح
            </button>
          )}
        </div>
      </form>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="px-6 py-16 text-center text-sm text-ink-muted">جار التحميل…</div>
        ) : orgs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <IconSearch className="h-8 w-8" />
            </div>
            <h3 className="mt-5 font-display text-xl font-black text-ink">لا توجد نتائج</h3>
            <p className="mt-2 text-sm text-ink-soft">جرب تعديل كلمات البحث.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-ink-muted text-xs uppercase">
                  <th className="text-right px-5 py-3 font-medium">المنظمة</th>
                  <th className="text-right px-5 py-3 font-medium">المالك</th>
                  <th className="text-right px-5 py-3 font-medium">الباقة</th>
                  <th className="text-right px-5 py-3 font-medium">الشهر</th>
                  <th className="text-right px-5 py-3 font-medium">الإجمالي</th>
                  <th className="text-right px-5 py-3 font-medium">الحالة</th>
                  <th className="text-right px-5 py-3 font-medium">تاريخ التسجيل</th>
                  <th className="text-right px-5 py-3 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr
                    key={org.id}
                    className={`border-b border-line last:border-0 transition-colors ${
                      org.suspended ? "opacity-60 bg-red-50/60" : "hover:bg-surface-2/40"
                    }`}
                  >
                    {/* Name */}
                    <td className="px-5 py-3">
                      <Link href={`/admin/organizations/${org.id}`} className="font-medium text-brand-700 hover:underline">
                        {org.name}
                      </Link>
                      <p className="text-ink-muted text-xs">{org.slug}</p>
                    </td>

                    {/* Owner */}
                    <td className="px-5 py-3">
                      <p className="text-ink-soft">{org.owner_name ?? "—"}</p>
                      <p className="text-ink-muted text-xs">{org.owner_email ?? "—"}</p>
                    </td>

                    {/* Plan */}
                    <td className="px-5 py-3">
                      <select
                        value={org.plan?.slug ?? "free"}
                        disabled={busy === org.id}
                        onChange={(e) => handlePlanChange(org.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-md font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-200 ${
                          PLAN_COLORS[org.plan?.slug ?? "free"]
                        }`}
                      >
                        {PLAN_SLUGS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Certs this month */}
                    <td className="px-5 py-3">
                      <span className="text-ink-soft">{org.certs_this_month}</span>
                      {org.plan?.limit && (
                        <span className="text-ink-muted text-xs"> / {org.plan.limit}</span>
                      )}
                    </td>

                    {/* Total certs */}
                    <td className="px-5 py-3 text-ink-soft">{org.certs_total}</td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      {org.suspended ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-md text-xs font-medium ring-1 ring-red-100">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                          موقوف
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium ring-1 ring-emerald-100">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                          نشط
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3 text-ink-muted text-xs">
                      {formatDate(org.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/organizations/${org.id}`}
                          className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-line transition-colors hover:bg-brand-50 hover:text-brand-700"
                        >
                          تفاصيل
                        </Link>
                        <button
                          onClick={() => handleSuspend(org.id)}
                          disabled={busy === org.id}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                            org.suspended
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-200"
                              : "bg-red-50 text-red-600 hover:bg-red-100 ring-1 ring-red-200"
                          }`}
                        >
                          {busy === org.id ? "..." : org.suspended ? "تفعيل" : "إيقاف"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-ink-muted">
        إجمالي: {orgs.length} منظمة
        {orgs.filter((o) => o.suspended).length > 0 && (
          <span className="text-red-500 mr-2">
            ({orgs.filter((o) => o.suspended).length} موقوف)
          </span>
        )}
      </p>
    </main>
  );
}
