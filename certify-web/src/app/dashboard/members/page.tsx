"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  listMembers, createMember, updateMember, deleteMember,
  ROLE_LABELS, type Member,
} from "@/lib/members";
import { IconUsers, IconTrash, IconCheck } from "@/components/icons";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ar", { numberingSystem: "latn", dateStyle: "medium" });
}

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [limit, setLimit] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // add-member form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [monthlyLimit, setMonthlyLimit] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await listMembers();
      setMembers(r.data);
      setCanManage(r.can_manage);
      setLimit(r.limit);
    } catch {
      setError("تعذر تحميل الأعضاء.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load();
  }, [router, load]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createMember({ name, email, password, role, monthlyLimit: Number(monthlyLimit) });
      setName(""); setEmail(""); setPassword(""); setRole("member"); setMonthlyLimit("");
      await load();
      flash("تمت إضافة العضو.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إضافة العضو.");
    } finally {
      setBusy(false);
    }
  }

  async function onChangeRole(m: Member, next: "admin" | "member") {
    try {
      await updateMember(m.id, { role: next });
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذر تغيير الدور.");
    }
  }

  async function onChangeLimit(m: Member, next: number) {
    if (!Number.isFinite(next) || next < 1 || next === m.monthly_limit) return;
    try {
      await updateMember(m.id, { monthlyLimit: next });
      await load();
      flash("تم تحديث الحدّ.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذر تحديث الحدّ.");
    }
  }

  async function onRemove(m: Member) {
    if (!confirm(`إزالة ${m.name ?? m.email}؟ سيُحذف حسابه نهائياً.`)) return;
    try {
      await deleteMember(m.id);
      await load();
      flash("تمت إزالة العضو.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذر الإزالة.");
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-ink-muted">جار التحميل…</div>;
  }

  const full = members.length >= limit;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">أعضاء الفريق</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {members.length} من {limit} مقعداً في باقتك.
          </p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <IconUsers className="h-6 w-6" />
        </span>
      </div>

      {toast && (
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700 ring-1 ring-brand-100">{toast}</div>
      )}

      {/* قائمة الأعضاء */}
      <div className="card overflow-hidden">
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 font-display font-black text-ink-soft">
                {(m.name ?? m.email ?? "؟").charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink">{m.name ?? "—"}</p>
                <p className="truncate text-xs text-ink-muted">{m.email}</p>
              </div>
              {/* الاستخدام/الحدّ الشهري */}
              {m.is_owner ? (
                <span className="hidden text-xs text-ink-muted sm:block">بلا حدّ فردي</span>
              ) : (
                <span className="hidden text-xs text-ink-soft sm:block">
                  هذا الشهر: <span className="font-bold text-ink">{m.used_this_month}</span>
                  {" / "}
                  {canManage ? (
                    <input
                      type="number"
                      min={1}
                      defaultValue={m.monthly_limit ?? 1}
                      onBlur={(e) => onChangeLimit(m, Number(e.target.value))}
                      className="w-16 rounded-md border border-line bg-white px-1.5 py-0.5 text-center text-xs font-bold"
                      title="حدّ الإصدار الشهري"
                    />
                  ) : (
                    <span className="font-bold text-ink">{m.monthly_limit}</span>
                  )}
                </span>
              )}
              {canManage && !m.is_owner ? (
                <select
                  value={m.role}
                  onChange={(e) => onChangeRole(m, e.target.value as "admin" | "member")}
                  className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-bold"
                >
                  <option value="member">عضو</option>
                  <option value="admin">مدير</option>
                </select>
              ) : (
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  m.is_owner ? "bg-brand-50 text-brand-700" : "bg-surface-2 text-ink-soft"
                }`}>
                  {ROLE_LABELS[m.role]}
                </span>
              )}
              {canManage && !m.is_owner && (
                <button onClick={() => onRemove(m)} title="إزالة"
                  className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600">
                  <IconTrash className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* إضافة عضو */}
      {canManage && (
        <div className="card p-6">
          <h2 className="font-display text-lg font-extrabold text-ink">إضافة عضو جديد</h2>
          {full ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 ring-1 ring-amber-100">
              وصلت إلى الحد الأقصى لأعضاء باقتك ({limit}). قم بترقية الباقة لإضافة المزيد.
            </p>
          ) : (
            <form onSubmit={onAdd} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" required
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="البريد الإلكتروني" required
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm" />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="كلمة مرور مؤقتة (8+ أحرف)" required minLength={8}
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm" />
              <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "member")}
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold">
                <option value="member">عضو (إصدار الشهادات)</option>
                <option value="admin">مدير (يدير الأعضاء أيضاً)</option>
              </select>
              <input value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} type="number" min={1}
                placeholder="حدّ الإصدار الشهري (مطلوب)" required
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm sm:col-span-2" />
              {error && <p className="text-sm font-bold text-red-600 sm:col-span-2">{error}</p>}
              <div className="sm:col-span-2">
                <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
                  <IconCheck className="h-4 w-4" /> {busy ? "جار الإضافة…" : "إضافة العضو"}
                </button>
                <p className="mt-2 text-xs text-ink-muted">
                  سلّم العضو بريده وكلمة المرور المؤقتة ليسجّل الدخول. يمكنه إصدار الشهادات؛ والمدير يدير الأعضاء كذلك.
                </p>
              </div>
            </form>
          )}
        </div>
      )}
    </main>
  );
}
