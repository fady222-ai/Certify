"use client";

import { useEffect, useState, useCallback } from "react";
import {
  listAdminOrganizations,
  adminChangePlan,
  adminToggleSuspend,
  type AdminOrg,
} from "@/lib/admin";

const PLAN_SLUGS = ["free", "starter", "pro", "enterprise"];

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-700 text-gray-300",
  starter: "bg-blue-900 text-blue-300",
  pro: "bg-indigo-900 text-indigo-300",
  enterprise: "bg-amber-900 text-amber-300",
};

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // org id being acted on

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
    <div className="p-8 space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-gray-700 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-white">إدارة المنظمات</h1>
        <p className="text-gray-500 text-sm mt-1">كل المنظمات المسجّلة على المنصة</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو البريد الإلكتروني..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-5 py-2 rounded-lg transition-colors"
        >
          بحث
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(""); load(); }}
            className="text-gray-400 hover:text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            مسح
          </button>
        )}
      </form>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orgs.length === 0 ? (
          <div className="text-center text-gray-500 py-16">لا توجد نتائج.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
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
                    className={`border-b border-gray-800 last:border-0 transition-colors ${
                      org.suspended ? "opacity-50 bg-red-950/20" : "hover:bg-gray-800/40"
                    }`}
                  >
                    {/* Name */}
                    <td className="px-5 py-3">
                      <p className="text-white font-medium">{org.name}</p>
                      <p className="text-gray-500 text-xs">{org.slug}</p>
                    </td>

                    {/* Owner */}
                    <td className="px-5 py-3">
                      <p className="text-gray-300">{org.owner_name ?? "—"}</p>
                      <p className="text-gray-500 text-xs">{org.owner_email ?? "—"}</p>
                    </td>

                    {/* Plan */}
                    <td className="px-5 py-3">
                      <select
                        value={org.plan?.slug ?? "free"}
                        disabled={busy === org.id}
                        onChange={(e) => handlePlanChange(org.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded font-medium border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                          PLAN_COLORS[org.plan?.slug ?? "free"]
                        }`}
                      >
                        {PLAN_SLUGS.map((s) => (
                          <option key={s} value={s} className="bg-gray-800 text-white">
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Certs this month */}
                    <td className="px-5 py-3">
                      <span className="text-gray-300">{org.certs_this_month}</span>
                      {org.plan?.limit && (
                        <span className="text-gray-600 text-xs"> / {org.plan.limit}</span>
                      )}
                    </td>

                    {/* Total certs */}
                    <td className="px-5 py-3 text-gray-300">{org.certs_total}</td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      {org.suspended ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900/60 text-red-400 rounded text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                          موقوف
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-900/40 text-emerald-400 rounded text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                          نشط
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {new Date(org.created_at).toLocaleDateString("ar-SA")}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleSuspend(org.id)}
                        disabled={busy === org.id}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                          org.suspended
                            ? "bg-emerald-900/50 text-emerald-400 hover:bg-emerald-900"
                            : "bg-red-900/50 text-red-400 hover:bg-red-900"
                        }`}
                      >
                        {busy === org.id ? "..." : org.suspended ? "تفعيل" : "إيقاف"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-600">
        إجمالي: {orgs.length} منظمة
        {orgs.filter((o) => o.suspended).length > 0 && (
          <span className="text-red-500 mr-2">
            ({orgs.filter((o) => o.suspended).length} موقوف)
          </span>
        )}
      </p>
    </div>
  );
}
