"use client";

import { authedFetch } from "./auth";

export type CertEvent = { type: string; at: string };

export type CertificateDetail = {
  id: string;
  recipient_name: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  course_name: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  verification_code: string;
  pdf_url: string | null;
  opened_count: number;
  downloaded_count: number;
  shared_count: number;
  linkedin_added: boolean;
  revoked_at: string | null;
  revoked_reason: string | null;
  template: { id: string; name: string } | null;
  created_at: string;
  events: CertEvent[];
};

export async function getCertificate(id: string): Promise<CertificateDetail> {
  const res = await authedFetch(`certificates/${id}`);
  if (!res.ok) throw new Error("الشهادة غير موجودة.");
  return res.json();
}

export async function revokeCertificate(id: string, reason: string) {
  const res = await authedFetch(`certificates/${id}/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذر الإلغاء.");
  return data;
}

export async function reactivateCertificate(id: string) {
  const res = await authedFetch(`certificates/${id}/reactivate`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذرت إعادة التفعيل.");
  return data;
}

export async function deleteCertificate(id: string) {
  const res = await authedFetch(`certificates/${id}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذر الحذف.");
  return data;
}

export async function resendCertificateEmail(id: string) {
  const res = await authedFetch(`certificates/${id}/resend-email`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذر الإرسال.");
  return data as { message: string; transport: string };
}

/** Download all certificates as a CSV file (authed → blob → browser download). */
export async function exportCertificatesCsv(): Promise<void> {
  const res = await authedFetch("certificates/export");
  if (!res.ok) throw new Error("تعذر تصدير الشهادات.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "certificates.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type Analytics = {
  monthly: { month: string; count: number }[];
  top_courses: { course: string; count: number }[];
};

export async function getAnalytics(): Promise<Analytics> {
  const res = await authedFetch("me/analytics");
  if (!res.ok) throw new Error("تعذر تحميل التحليلات.");
  return res.json();
}

const EVENT_LABELS: Record<string, string> = {
  issued: "تم الإصدار",
  opened: "فتحت صفحة التحقق",
  downloaded: "تم تحميل الشهادة",
  shared: "تمت مشاركة الرابط",
  added_to_linkedin: "أضيفت إلى لينكدإن",
  emailed: "أرسل البريد",
  revoked: "ألغيت الشهادة",
  reactivated: "أعيد تفعيلها",
};

export function eventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type;
}
